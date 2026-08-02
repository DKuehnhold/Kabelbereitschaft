import "server-only";

import {
  Pool,
  type PoolClient,
  type QueryConfig,
  type QueryResult,
  type QueryResultRow,
} from "pg";

import { assertAllowedStatement } from "./statement-guard";

// AP14/B: kontrollierter Datenbankzugriff gemaess ADR-011 / 2.5.
//
// Verbindliche Eigenschaften dieses Moduls:
//   - Die FASSADE ist strukturell erzwungen: es gibt keinen Export, der eine
//     rohe Verbindung herausgibt, und unter app/src importiert ausschliesslich
//     diese Datei `pg` (die Werkzeuge unter app/scripts sind kein Anwendungscode
//     und laufen ohnehin im Eigentuemerkontext).
//     BEKANNTE GRENZE - ausdruecklich benannt, damit aus dieser Zusage niemand
//     mehr liest, als sie traegt: der Anker `globalThis.__kabelbereitschaftPool`
//     (unten) ist von jedem Servermodul desselben Prozesses OHNE Import
//     erreichbar. Dass niemand ihn benutzt, ist eine Konvention und keine
//     strukturelle Sperre. Der Anker ist noetig, weil Next.js Servermodule im
//     Entwicklungsbetrieb mehrfach laedt; die Testsuiten beenden den Pool
//     ueber ihn. Eine Umstellung auf ein nicht erratbares Symbol oder eine
//     Lint-Regel waere eine eigene Entscheidung und ist hier NICHT getroffen.
//   - Vor der ersten fachlichen Transaktion prueft ein einmaliges Startgate die
//     Laufzeitrolle (kein Superuser, kein BYPASSRLS, keine Mitgliedschaft in
//     der Eigentuemerrolle). Es gibt dafuer keine Umgehungsvariable: schlaegt
//     das Gate fehl, laeuft KEINE Transaktion dieses Prozesses.
//   - Jede fachliche Operation laeuft in einer expliziten Transaktion. Die
//     Identitaet wird darin mit SET LOCAL gesetzt (via set_config(..., true))
//     und endet mit der Transaktion. Sie kann deshalb nicht ueber eine
//     Poolverbindung in den naechsten Request ausbluten.
//   - Fehlende oder unplausible Identitaet ist ein Abbruch VOR dem SQL-Lauf.
//     Die RLS-Verweigerung ist die zweite, nicht die erste Verteidigungslinie.
//   - Die uebergebene Client-Fassade erlaubt ausschliesslich parametrisierte
//     Abfragen. Transaktions- und Sitzungssteuerung ist blockiert.
//   - Jede fachliche Abfrage laeuft im Extended-Query-Protokoll. Damit ist eine
//     Mehrfachanweisung protokollseitig unmoeglich; zusaetzlich weist der
//     Anweisungsschutz sie bereits vor dem Verbindungsaufbau ab.

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * True fuer eine kanonisch geschriebene UUID.
 *
 * Exportiert, damit Aufrufer eine Kennung PRUEFEN koennen, statt sich auf einen
 * Typfehler von PostgreSQL zu verlassen. Ein `$1::uuid` mit unbrauchbarem Wert
 * bricht zwar auch ab, aber erst nach dem Verbindungsaufbau und mit einer
 * Datenbankmeldung statt einer fachlichen.
 */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

const DEFAULT_POOL_MAX = 10;
const DEFAULT_STATEMENT_TIMEOUT_MS = 15_000;
const DEFAULT_IDLE_IN_TRANSACTION_TIMEOUT_MS = 30_000;

declare global {
  // Next.js laedt Servermodule im Entwicklungsbetrieb mehrfach. Ohne diesen
  // Anker entstuende pro Neuladen ein weiterer Pool.
  var __kabelbereitschaftPool: Pool | undefined;
}

/** Positive Ganzzahl aus einer Laufzeitvariablen; sonst der Vorgabewert. */
function positiveInteger(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} muss eine positive Ganzzahl sein.`);
  }
  return parsed;
}

function databaseUrl(): string {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) {
    // Enthaelt bewusst nur den Variablennamen, niemals einen Wert.
    throw new Error(
      "DATABASE_URL ist nicht konfiguriert. Wert in der Environment-Datei der " +
        "Umgebung setzen (Vorlage: deploy/env/app.env.example).",
    );
  }
  return value;
}

function createPool(): Pool {
  const pool = new Pool({
    connectionString: databaseUrl(),
    max: positiveInteger("DATABASE_POOL_MAX", DEFAULT_POOL_MAX),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  // Ohne diesen Handler beendet ein Fehler auf einer im Pool ruhenden
  // Verbindung (Serverneustart, Netzabbruch) den gesamten Node-Prozess.
  pool.on("error", (error) => {
    console.error("Datenbankpool: Fehler auf ruhender Verbindung", error.message);
  });

  return pool;
}

function getPool(): Pool {
  globalThis.__kabelbereitschaftPool ??= createPool();
  return globalThis.__kabelbereitschaftPool;
}

/**
 * Fassade fuer fachliche Abfragen innerhalb einer Transaktion.
 *
 * Absichtlich NICHT `PoolClient`: die Signatur erzwingt getrennte Uebergabe von
 * Anweisung und Werten und laesst damit die Objektform von `pg` (mit
 * `rowMode`, mehreren Anweisungen und ohne Parameter) nicht zu.
 */
export type DatabaseClient = {
  query<Row extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<Row>>;
};

/**
 * `pg`-Abfragebeschreibung mit erzwungener Protokollwahl.
 *
 * `queryMode` existiert in `pg` 8.22 zur Laufzeit, wird von `@types/pg` 8.15
 * aber nicht beschrieben. Die Erweiterung ist deshalb hier lokal deklariert -
 * kein `any`, kein `@ts-expect-error`.
 */
type ExtendedQueryConfig = QueryConfig & { queryMode: "extended" };

function facade(client: PoolClient): DatabaseClient {
  return {
    // Ausdruecklich `async`: der Anweisungsschutz wuerde sonst SYNCHRON werfen,
    // waehrend jeder andere Fehler dieser Methode eine Ablehnung des Promise
    // ist. Ein Aufrufer, der `query(...).catch(...)` ohne `await` schreibt,
    // wuerde die Verletzung dann nicht abfangen. Einheitliche Semantik: jeder
    // Fehler dieser Methode erscheint als abgelehntes Promise.
    async query<Row extends QueryResultRow = QueryResultRow>(
      text: string,
      values: readonly unknown[] = [],
    ): Promise<QueryResult<Row>> {
      assertAllowedStatement(text);

      // `queryMode: "extended"` ist hier sicherheitsrelevant und keine
      // Optimierung: ohne die Angabe waehlt `pg` bei LEERER Werteliste das
      // Simple-Query-Protokoll (`Query.requiresPreparation()` prueft
      // `values.length > 0`). Das Simple-Query-Protokoll fuehrt mehrere durch
      // Semikolon getrennte Anweisungen in einem Aufruf aus. Im
      // Extended-Query-Protokoll weist PostgreSQL das ab
      // ("cannot insert multiple commands into a prepared statement"), und zwar
      // unabhaengig davon, ob Werte uebergeben werden.
      //
      // Es entsteht KEINE benannte vorbereitete Anweisung: der Name bleibt
      // leer, damit serverseitig kein Anweisungscache pro Verbindung waechst.
      const config: ExtendedQueryConfig = {
        text,
        values: [...values],
        queryMode: "extended",
      };
      return client.query<Row>(config);
    },
  };
}

/**
 * Laufzeitgrenzen und Identitaet in EINER Anweisung, transaktionslokal.
 *
 * Bewusst hier und nicht im `connect`-Ereignis des Pools: dessen Rueckruf laeuft
 * nebenlaeufig zur ersten Abfrage, die Grenzen waeren fuer die erste Anweisung
 * einer neuen Verbindung also nicht verlaesslich gesetzt. Ebenso bewusst nicht
 * ueber den Startparameter `options` der Verbindung - der wuerde einen
 * vorgeschalteten Verbindungspool (pgbouncer) hart voraussetzen bzw. brechen,
 * und die Zielinfrastruktur ist noch nicht abschliessend festgelegt.
 *
 * `SET LOCAL` kennt keine Parameter; `set_config(..., true)` ist die
 * parametrisierte, transaktionslokale Entsprechung.
 */
async function applyTransactionSettings(
  client: PoolClient,
  userId: string | null,
): Promise<void> {
  const statementTimeoutMs = positiveInteger(
    "DATABASE_STATEMENT_TIMEOUT_MS",
    DEFAULT_STATEMENT_TIMEOUT_MS,
  );
  const idleTimeoutMs = positiveInteger(
    "DATABASE_IDLE_IN_TRANSACTION_TIMEOUT_MS",
    DEFAULT_IDLE_IN_TRANSACTION_TIMEOUT_MS,
  );

  if (userId === null) {
    await client.query(
      `select
         set_config('statement_timeout', $1::text, true),
         set_config('idle_in_transaction_session_timeout', $2::text, true)`,
      [String(statementTimeoutMs), String(idleTimeoutMs)],
    );
    return;
  }

  await client.query(
    `select
       set_config('statement_timeout', $1::text, true),
       set_config('idle_in_transaction_session_timeout', $2::text, true),
       set_config('app.user_id', $3::text, true)`,
    [String(statementTimeoutMs), String(idleTimeoutMs), userId],
  );
}

/**
 * Ergebnis der Rollenpruefung - acht Zusagen, jede einzeln beurteilbar.
 *
 * Bewusst acht getrennte Spalten statt eines vorberechneten "ist in Ordnung":
 * die Meldung soll die VERLETZTE Zusage nennen und nicht nur, dass etwas
 * verletzt ist.
 */
type RuntimeRoleRow = {
  session_superuser: boolean;
  session_bypassrls: boolean;
  session_owns_auth_accounts: boolean;
  session_owns_profiles: boolean;
  current_superuser: boolean;
  current_bypassrls: boolean;
  current_owns_auth_accounts: boolean;
  current_owns_profiles: boolean;
};

/**
 * Die drei Zusagen ueber die Laufzeitrolle, gelesen aus dem Systemkatalog.
 *
 * WARUM `session_user` UND ZUSAETZLICH `current_user`:
 *   Massgeblich ist `session_user` - das ist die ANMELDEROLLE, und nur sie
 *   beschreibt, womit der Prozess an der Datenbank haengt. `set role` setzt
 *   ausschliesslich `current_user`; wer nur `current_user` prueft, misst
 *   deshalb einen Zustand, der sich jederzeit wieder aendern laesst. Umgekehrt
 *   waere `session_user` allein zu wenig: liefe die Verbindung zum
 *   Pruefzeitpunkt bereits unter einer angenommenen Rolle, wuerde die Pruefung
 *   an ihr vorbeisehen. Deshalb werden BEIDE Rollen gegen dieselben drei
 *   Zusagen gemessen. Weichen sie voneinander ab, ist das fuer sich genommen
 *   KEIN Abweisungsgrund - die abweichende Rolle muss die Zusagen aber
 *   ebenfalls erfuellen.
 *
 * WARUM 'MEMBER' UND NICHT 'USAGE':
 *   'USAGE' beantwortet, ob die Rolle die Rechte der Eigentuemerrolle
 *   AUTOMATISCH erbt. Eine mit `noinherit` angelegte Anmelderolle liefert dort
 *   `false`, kann aber jederzeit `set role <eigentuemer>` ausfuehren und danach
 *   alles tun, was der Eigentuemer darf. Ab PostgreSQL 16 steuert zudem jedes
 *   `grant ... with inherit/set` getrennt, ob Vererbung und/oder Rollenwechsel
 *   gilt - 'USAGE' und 'MEMBER' fallen dort regelmaessig auseinander. Fuer die
 *   BETRIEBSVORAUSSETZUNG "Anmelderolle getrennt von der Eigentuemerrolle" ist
 *   'MEMBER' der richtige, strengere Modus.
 *   ASYMMETRIE ZU MIGRATION 0017, ABSICHTLICH: die Waechter dort benutzen in
 *   ihrer Eigentuemerausnahme `pg_has_role(current_user, <owner>, 'USAGE')` -
 *   dort geht es um die Frage, ob der gerade Schreibende die Rechte des
 *   Eigentuemers TATSAECHLICH hat, und ein Freibrief soll so eng wie moeglich
 *   sein. Hier geht es um das Gegenteil: eine Betriebsvoraussetzung soll so
 *   frueh wie moeglich anschlagen. Beide Modi sind an ihrer Stelle richtig.
 *
 * WARUM BEIDE EIGENTUEMER:
 *   Die beiden Waechter in 0017 lesen getrennt den Eigentuemer von
 *   public.auth_accounts bzw. public.profiles. Diese beiden koennen
 *   auseinanderfallen; jede Mitgliedschaft in einem der beiden hebelt einen der
 *   Waechter aus.
 */
const RUNTIME_ROLE_QUERY = `select
     r.rolsuper     as session_superuser,
     r.rolbypassrls as session_bypassrls,
     pg_catalog.pg_has_role(session_user, o.auth_owner, 'MEMBER')
       as session_owns_auth_accounts,
     pg_catalog.pg_has_role(session_user, o.profile_owner, 'MEMBER')
       as session_owns_profiles,
     c.rolsuper     as current_superuser,
     c.rolbypassrls as current_bypassrls,
     pg_catalog.pg_has_role(current_user, o.auth_owner, 'MEMBER')
       as current_owns_auth_accounts,
     pg_catalog.pg_has_role(current_user, o.profile_owner, 'MEMBER')
       as current_owns_profiles
   from pg_catalog.pg_roles r
   join pg_catalog.pg_roles c on c.rolname = current_user
   cross join (
     select
       (select k.relowner from pg_catalog.pg_class k
         where k.oid = 'public.auth_accounts'::regclass) as auth_owner,
       (select k.relowner from pg_catalog.pg_class k
         where k.oid = 'public.profiles'::regclass)      as profile_owner
   ) o
   where r.rolname = session_user`;

/**
 * Fehler des Startgates - Klartext der verletzten Zusage, sonst nichts.
 *
 * Dieselbe Zurueckhaltung wie in `databaseUrl()`, das bewusst nur den
 * Variablennamen nennt: die Meldung enthaelt NIEMALS die
 * Verbindungszeichenfolge, NIEMALS ein Kennwort und NIEMALS einen Rollennamen.
 * Sie landet im Serverprotokoll und moeglicherweise in einer Fehlerseite.
 */
function runtimeRoleError(violation: string): Error {
  return new Error(
    `Laufzeitrolle der Datenbankverbindung nicht zulaessig: ${violation}. ` +
      "Die Anwendung muss mit einer eigenen, nicht privilegierten Anmelderolle " +
      "laufen, die von der Migrations-/Eigentuemerrolle getrennt ist.",
  );
}

/**
 * Einmalige, fail-closed Pruefung der Laufzeitrolle.
 *
 * Holt sich eine EIGENE Verbindung und gibt sie im `finally` zurueck. Sie
 * laeuft nicht ueber die Fassade, sondern am rohen Client - wie `begin` und
 * `applyTransactionSettings` auch: die Fassade ist fuer fachliche Abfragen da.
 */
async function checkRuntimeRole(): Promise<void> {
  const client = await getPool().connect();
  try {
    const result = await client.query<RuntimeRoleRow>(RUNTIME_ROLE_QUERY);

    // Fail-closed im Vollsinn: keine Zeile, mehr als eine Zeile oder ein Wert,
    // der kein Wahrheitswert ist, sind eine Verweigerung - kein Vorgabewert,
    // keine Warnung. Ein Fehler der Abfrage selbst schlaegt ohnehin durch.
    if (result.rows.length !== 1) {
      throw runtimeRoleError(
        "die Laufzeitrolle ist im Systemkatalog nicht eindeutig bestimmbar",
      );
    }
    const row = result.rows[0];
    for (const value of Object.values(row)) {
      if (typeof value !== "boolean") {
        throw runtimeRoleError(
          "die Zusagen ueber die Laufzeitrolle sind nicht auswertbar",
        );
      }
    }

    if (row.session_superuser) {
      throw runtimeRoleError("die Anmelderolle ist Superuser");
    }
    if (row.session_bypassrls) {
      throw runtimeRoleError("die Anmelderolle umgeht RLS (BYPASSRLS)");
    }
    if (row.session_owns_auth_accounts || row.session_owns_profiles) {
      throw runtimeRoleError(
        "die Anmelderolle ist Mitglied der Eigentuemerrolle der Auth- bzw. Profiltabelle",
      );
    }
    if (row.current_superuser) {
      throw runtimeRoleError("die aktuell wirksame Rolle ist Superuser");
    }
    if (row.current_bypassrls) {
      throw runtimeRoleError("die aktuell wirksame Rolle umgeht RLS (BYPASSRLS)");
    }
    if (row.current_owns_auth_accounts || row.current_owns_profiles) {
      throw runtimeRoleError(
        "die aktuell wirksame Rolle ist Mitglied der Eigentuemerrolle der Auth- bzw. Profiltabelle",
      );
    }
  } finally {
    client.release();
  }
}

/**
 * Zwischengespeichertes Ergebnis des Startgates - genau EIN Lauf je Prozess.
 *
 * Ein einmal ABGELEHNTES Promise bleibt abgelehnt: jede weitere Transaktion
 * scheitert mit derselben Meldung. Das ist ausdruecklich gewollt. Eine
 * Wiederholung wuerde bedeuten, dass eine Betriebsvoraussetzung sich zur
 * Laufzeit "einrenken" kann - und genau das darf sie nicht. Der Preis ist
 * benannt: faellt das Gate wegen eines Verbindungsfehlers aus, hilft nur ein
 * Neustart des Prozesses.
 */
let runtimeRoleGate: Promise<void> | undefined;

/**
 * Startgate vor der ersten fachlichen Transaktion.
 *
 * Bewusst hier und NICHT im `connect`-Ereignis des Pools - derselbe Grund wie
 * bei `applyTransactionSettings`: dessen Rueckruf laeuft nebenlaeufig zur
 * ersten Abfrage. Ein dort geworfener Fehler wuerde die erste Transaktion also
 * nicht zuverlaessig aufhalten, sondern bestenfalls als Poolfehler erscheinen -
 * und damit waere aus der Sperre eine Warnung geworden.
 */
function assertRuntimeRole(): Promise<void> {
  runtimeRoleGate ??= checkRuntimeRole();
  return runtimeRoleGate;
}

async function inTransaction<T>(
  userId: string | null,
  work: (client: DatabaseClient) => Promise<T>,
): Promise<T> {
  // VOR dem Verbindungsaufbau der eigentlichen Transaktion: eine unzulaessige
  // Laufzeitrolle darf nicht einmal ein `begin` absetzen.
  await assertRuntimeRole();

  const client = await getPool().connect();
  let destroyed = false;
  try {
    await client.query("begin");
    await applyTransactionSettings(client, userId);
    const result = await work(facade(client));
    await client.query("commit");
    return result;
  } catch (error) {
    try {
      await client.query("rollback");
    } catch (rollbackError) {
      // Der Zustand der Verbindung ist unbekannt. Sie darf nicht in den Pool
      // zurueckkehren, sonst erbt der naechste Request eine offene Transaktion.
      destroyed = true;
      client.release(
        rollbackError instanceof Error ? rollbackError : new Error("rollback fehlgeschlagen"),
      );
    }
    throw error;
  } finally {
    if (!destroyed) client.release();
  }
}

/**
 * Fachliche Transaktion im Namen eines angemeldeten Benutzers.
 *
 * Setzt `app.user_id` transaktionslokal; `app.current_user_id()` und damit
 * saemtliche RLS-Policies sehen genau diese Identitaet. Eine fehlende oder
 * unplausible Benutzer-ID bricht ab, bevor SQL ausgefuehrt wird.
 */
export async function withUserTransaction<T>(
  userId: string,
  work: (client: DatabaseClient) => Promise<T>,
): Promise<T> {
  if (!isUuid(userId)) {
    throw new Error(
      "Fehlende oder ungueltige Benutzer-ID: Datenbankzugriff wird verweigert.",
    );
  }
  return inTransaction(userId, work);
}

/**
 * Transaktion OHNE Benutzeridentitaet - ausschliesslich fuer die
 * Authentifizierungstabellen `public.auth_accounts` und `public.auth_sessions`.
 *
 * Warum sie zulaessig ist: die Anmeldung muss lesen und schreiben koennen,
 * BEVOR eine Identitaet existiert. Beide Tabellen sind deshalb kein Ziel von
 * RLS, sondern per Rechtevergabe geschuetzt (Migration `0012`: `revoke all`
 * fuer `public`, `anon` und `authenticated`, `grant` nur fuer `app_user`).
 *
 * Warum sie kein Generalschluessel ist: ohne `app.user_id` liefert
 * `app.current_user_id()` NULL, und jede RLS-geschuetzte Fachtabelle
 * verweigert. Diese Funktion ist bewusst eng benannt und darf nicht fuer
 * fachliche Abfragen verwendet werden - dafuer gilt `withUserTransaction`.
 */
export async function withAuthTransaction<T>(
  work: (client: DatabaseClient) => Promise<T>,
): Promise<T> {
  return inTransaction(null, work);
}
