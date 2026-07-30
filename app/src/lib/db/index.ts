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
//   - Der Pool ist modulprivat. Es gibt keinen Export, der eine rohe Verbindung
//     herausgibt; damit ist "kein Datenbankzugriff ausserhalb des Wrappers"
//     strukturell erzwungen und nicht nur eine Konvention.
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

async function inTransaction<T>(
  userId: string | null,
  work: (client: DatabaseClient) => Promise<T>,
): Promise<T> {
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
