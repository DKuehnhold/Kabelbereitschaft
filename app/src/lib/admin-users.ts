import "server-only";

import {
  PASSWORD_HASH_VERSION,
  checkPasswordRules,
  hashPassword,
  type PasswordRuleViolation,
} from "@/lib/auth-password";
import { isUuid, withUserTransaction, type DatabaseClient } from "@/lib/db";
import { pgErrorCode } from "@/lib/db/pg-errors";
import type { UserRole } from "@/lib/roles";

// AP14/B: administrative Benutzerverwaltung (ADR-011 / 2.3 und / 2.4).
//
// Dieses Modul haelt die drei administrativen Eingriffe auf ein FREMDES Konto:
// Passwort-Reset, Sperre bzw. Entsperre und Rollenwechsel. Es ist die serverseitige
// Fachschicht ohne Oberflaeche; Server Actions und Seiten sind Gegenstand eines
// eigenen Arbeitspakets.
//
// Verbindliche Eigenschaften:
//
//   - JEDE Operation laeuft in GENAU EINER Transaktion unter der Identitaet des
//     Handelnden (`withUserTransaction`). `withAuthTransaction` ist hier
//     ausdruecklich unzulaessig - die Begruendung faellt allerdings je Operation
//     unterschiedlich aus, und das wird hier ehrlich benannt:
//
//       * Rollenwechsel (`adminSetRole`) schreibt auf `public.profiles` und
//         steht damit hinter DREI unabhaengigen Schranken: dem spaltenbezogenen
//         `update (role)`-Recht aus Migration `0017`, der RLS-Policy
//         `profiles_update` und dem BEFORE-Trigger `trg_protect_profile`
//         (0001_init.sql). Alle drei setzen eine gesetzte Identitaet voraus.
//
//       * Passwort-Reset und Kontosperre schreiben auf `public.auth_accounts`.
//         Diese Tabelle traegt weiterhin KEINE RLS - sie ist rechtegeschuetzt.
//         Seit Migration `0017` steht hinter ihr aber zusaetzlich der
//         BEFORE-UPDATE-Waechter `trg_protect_auth_account_admin_change`: eine
//         Aenderung von `is_disabled` oder eine echte Passwortaenderung verlangt,
//         dass `app.current_user_id()` in DERSELBEN Transaktion aus der Datenbank
//         als aktiver Administrator bestaetigt wird (SQLSTATE `KB003`).
//         `assertActiveAdmin` ist damit nicht mehr die einzige Rollenschranke,
//         sondern die erste von zweien. `withAuthTransaction` bleibt trotzdem
//         unzulaessig: ohne gesetzte Identitaet wuerde der Datenbankwaechter die
//         Aenderung fail-closed abweisen, die Anwendungspruefung koennte gar
//         nicht laufen, und der Auditsatz haette keinen Urheber.
//
//   - `KB003` wird von diesem Modul BEWUSST NICHT gefangen und NICHT in einen
//     fachlichen Rueckgabewert uebersetzt. Er bedeutet, dass die Anwendungs-
//     schranke `assertActiveAdmin` umgangen wurde oder fehlt - also ein
//     Programmfehler und kein Betriebsfall. Gefangen wird ausschliesslich
//     `KB001` (Schutz des letzten aktiven Administrators).
//
//   - Die Rolle des Handelnden wird AUSSCHLIESSLICH in derselben Transaktion aus
//     der Datenbank gelesen (`assertActiveAdmin`) - niemals aus einem Parameter,
//     einem Aufrufkontext oder einem Token-Claim. Genau deshalb hat keine der
//     drei Funktionen einen Rollenparameter fuer den Handelnden.
//
//   - Jede ECHTE Aenderung widerruft in DERSELBEN Transaktion alle offenen
//     Sitzungen des Zielkontos. Es gibt keinen Zustand, in dem die Rolle bereits
//     gewechselt, eine alte Sitzung aber noch gueltig waere.
//
//   - Auditsaetze entstehen ausschliesslich ueber die SECURITY-DEFINER-Trigger
//     aus Migration `0017` (`role_changed`, `account_disabled`/`account_enabled`,
//     `password_reset_by_admin`) und `0012` (`revoke` je Sitzung). Die Anwendung
//     schreibt NIE selbst in `public.audit_events`; dort besteht bewusst weder
//     eine Insert-Policy noch ein Tabellenrecht fuer `app_user`.
//
//   - Kein Klartextpasswort verlaesst dieses Modul. Der uebergebene Wert wird
//     genau einmal gehasht und erscheint in keinem Rueckgabewert, keiner
//     Fehlermeldung und keiner Protokollzeile. Es gibt hier auch keinen
//     Passwortgenerator und keine Kontoanlage - beides ist bewusst nicht Teil
//     dieses Arbeitspakets (Migration `0017` erteilt dafuer kein Recht).
//
//   - Kein `error.message` einer PG-Ausnahme gelangt in einen Rueckgabewert.
//     Ausgewertet wird ausschliesslich der SQLSTATE (Regel aus `pg-errors.ts`).

/**
 * SQLSTATE des Schutztriggers `trg_protect_last_active_admin` aus Migration
 * `0017` (Abschnitt 3).
 *
 * Frei gewaehlte, benutzerdefinierte Klasse und damit der einzige zuverlaessige
 * Weg, den Schutz des letzten aktiven Administrators von einer gewoehnlichen
 * Rechteverweigerung (42501 aus `trg_protect_profile`) zu unterscheiden. Die
 * Konstante steht bewusst LOKAL: `pg-errors.ts` sammelt die Codes von
 * PostgreSQL selbst bzw. der Fachfunktionen aus 0010/0011 und wird von diesem
 * Arbeitspaket nicht geaendert.
 */
const LAST_ACTIVE_ADMIN_PROTECTED = "KB001";

/**
 * Rollen, die ein Administrator vergeben darf.
 *
 * Ausdrueckliche Allowlist und nicht etwa "alles, was der Enum hergibt": die
 * Autorisierung darf nicht von einem TypeScript-Typ abhaengen, den es zur
 * Laufzeit nicht gibt. Der Wert kommt aus einem Formular und ist damit
 * ungeprueft; `adminSetRole` nimmt ihn deshalb als `string` entgegen und prueft
 * ihn gegen diese Liste.
 *
 * Eine Rolle `kunde` existiert nicht und wird hier auch nicht vorbereitet
 * (ADR-011 / 2.4).
 */
export const ADMIN_ASSIGNABLE_ROLES = ["admin", "disponent", "monteur"] as const;

/**
 * Eine administrative Handlung wurde verweigert, weil der Handelnde kein aktiver
 * Administrator ist.
 *
 * Eigene Klasse, damit ein Aufrufer den Verweigerungsfall von einem technischen
 * Fehler unterscheiden kann, ohne eine Meldung zu vergleichen. Die Meldung nennt
 * keine Kennung, keine E-Mail-Adresse und keinen Passwortwert.
 */
export class AdminActionDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminActionDeniedError";
  }
}

type ActorRow = {
  role: UserRole;
  is_active: boolean;
  is_disabled: boolean;
};

/**
 * True, wenn der Wert eine vergebbare Rolle benennt.
 *
 * Die Zwischenvariable ist die Kopplung an `@/lib/roles`: enthielte
 * `ADMIN_ASSIGNABLE_ROLES` einen dort unbekannten Wert, scheiterte bereits die
 * Uebersetzung. Der anschliessende Vergleich laeuft ueber `readonly string[]`,
 * weil `includes` sonst den engen Elementtyp verlangen wuerde - dasselbe Idiom
 * wie in `db/statement-guard.ts`.
 */
function isAssignableRole(value: string): value is UserRole {
  const assignable: readonly UserRole[] = ADMIN_ASSIGNABLE_ROLES;
  return (assignable as readonly string[]).includes(value);
}

/**
 * Bricht ab, wenn der Handelnde kein aktiver Administrator ist.
 *
 * Erster Schritt JEDER der drei Operationen und bewusst in derselben Transaktion
 * wie die Aenderung: eine Pruefung davor liesse ein Fenster, in dem der Handelnde
 * zwischen Pruefung und Schreibzugriff herabgestuft oder gesperrt wird.
 *
 * Gefordert sind alle drei Bedingungen der Definition aus Migration `0017`
 * (Abschnitt 3): `role = 'admin'`, `is_active` und `not is_disabled`. Ein
 * Administrator, der eine davon verletzt, kann sich nicht anmelden und darf auch
 * ueber eine noch offene Sitzung nichts mehr verwalten - fail-closed.
 *
 * Gelesen wird unter der Identitaet des Handelnden; `profiles_select` deckt die
 * eigene Zeile ab. `public.auth_accounts` ist rechte-, nicht RLS-geschuetzt.
 */
async function assertActiveAdmin(
  client: DatabaseClient,
  actorUserId: string,
): Promise<void> {
  const result = await client.query<ActorRow>(
    `select p.role, p.is_active, a.is_disabled
     from public.profiles p
     join public.auth_accounts a on a.id = p.id
     where p.id = $1::uuid`,
    [actorUserId],
  );
  const actor = result.rows[0];
  if (!actor || !actor.is_active || actor.is_disabled || actor.role !== "admin") {
    throw new AdminActionDeniedError(
      "Diese Verwaltungsfunktion ist ausschliesslich einem aktiven Administrator erlaubt.",
    );
  }
}

/**
 * Sperrt die Zeile des Zielkontos fuer die Dauer der Transaktion.
 *
 * `for no key update` serialisiert konkurrierende Eingriffe auf DEMSELBEN
 * Zielkonto - zwei gleichzeitige Sperrversuche wuerden sonst beide auf einem
 * veralteten `is_disabled` entscheiden (Muster aus `auth-service.ts`).
 *
 * Bewusst KEIN zweiter Zeilensperrversuch auf `public.profiles`: die
 * Serialisierung ueber die Kontozeile genuegt bereits, weil
 * `profiles.id = auth_accounts.id` gilt und jede der drei Operationen dieselbe
 * Kennung betrifft. Eine zusaetzliche Sperre auf dem Profil braechte damit
 * keinen weiteren Schutz.
 */
async function lockAccount(
  client: DatabaseClient,
  accountId: string,
): Promise<{ id: string; is_disabled: boolean } | null> {
  const result = await client.query<{ id: string; is_disabled: boolean }>(
    `select id, is_disabled
     from public.auth_accounts
     where id = $1::uuid
     for no key update`,
    [accountId],
  );
  return result.rows[0] ?? null;
}

/**
 * Widerruft alle offenen Sitzungen eines Kontos und liefert deren Anzahl.
 *
 * Laeuft ausdruecklich INNERHALB der bereits geoeffneten Transaktion und nicht
 * ueber `revokeAllSessionsForAccount` aus `auth-service.ts`: jene Funktion
 * oeffnet eine eigene Transaktion, die Aenderung und Widerruf auseinanderfallen
 * liesse. Je widerrufener Sitzung entsteht genau ein Auditsatz `revoke`
 * (Trigger aus Migration `0012`).
 *
 * `revoked_at is null` macht den Aufruf idempotent: ein bereits widerrufener
 * Zeitpunkt bleibt unveraendert und erzeugt keinen zweiten Auditsatz. Dieses
 * Modul setzt `revoked_at` NIEMALS zurueck - eine widerrufene Sitzung wird nie
 * wieder gueltig.
 */
async function revokeOpenSessions(
  client: DatabaseClient,
  accountId: string,
  reason: string,
): Promise<number> {
  const revoked = await client.query<{ id: string }>(
    `update public.auth_sessions
     set revoked_at = now(),
         revoked_reason = $2::text
     where account_id = $1::uuid
       and revoked_at is null
     returning id`,
    [accountId, reason],
  );
  return revoked.rows.length;
}

/**
 * Ergebnis eines administrativen Passwort-Resets.
 *
 * `not_found` fasst "Kennung unbrauchbar" und "kein solches Konto" zusammen; der
 * Aufrufer kann daraus keine Kontoexistenz ableiten.
 */
export type AdminPasswordResetOutcome =
  | { kind: "reset"; revokedSessions: number }
  | { kind: "not_found" }
  | { kind: "self_forbidden" }
  | { kind: "rule"; violation: PasswordRuleViolation };

/**
 * Setzt das Passwort eines FREMDEN Kontos auf ein Uebergangspasswort
 * (ADR-011 / 2.3).
 *
 * Ablauf, alles oder nichts:
 *   1. Kennungen pruefen. Eine unbrauchbare Ziel-Kennung ist `not_found` und
 *      kein Wurf - sie ist eine Eingabe, kein Programmfehler.
 *   2. Das EIGENE Konto ist ausgeschlossen. Der eigene Wechsel laeuft ueber
 *      `/passwort-aendern` (`changeOwnPassword`) und verlangt dort das aktuelle
 *      Passwort. Die Trennung haelt ausserdem die Auditunterscheidung eindeutig:
 *      der Trigger aus Migration `0017` (2a) fuehrt einen Vorgang genau dann als
 *      `password_reset_by_admin`, wenn die handelnde Identitaet eine ANDERE als
 *      das betroffene Konto ist - sonst als `password_changed`.
 *   3. Die zentralen Passwortregeln gelten auch hier, nicht nur in einer
 *      Oberflaeche. Bei Verletzung wird die Datenbank gar nicht erst beruehrt.
 *   4. Der Hash entsteht VOR der Transaktion: Argon2id kostet absichtlich
 *      Rechenzeit und soll keine Poolverbindung mit offener Transaktion halten.
 *   5. In der Transaktion: Administrator bestaetigen, Zielkonto sperrend lesen,
 *      Hash setzen, `must_change_password` erzwingen, Fehlversuchszaehler und
 *      Anmeldesperre zuruecksetzen, danach alle offenen Sitzungen widerrufen.
 *
 * `must_change_password = true` ist der Kern des Verfahrens: das
 * Uebergangspasswort ist ausschliesslich ein Einmalzugang, und der Benutzer muss
 * unmittelbar nach der Anmeldung ein eigenes setzen. `failed_attempts` und
 * `locked_until` werden zurueckgesetzt, weil das alte Passwort ohnehin ungueltig
 * wird und eine stehengebliebene Sperre den Reset sonst wirkungslos machte.
 *
 * Ein DEAKTIVIERTES Zielkonto ist ausdruecklich zulaessig und bleibt
 * deaktiviert: der Reset ist die uebliche Vorbereitung einer spaeteren
 * Entsperre und aktiviert von sich aus nichts. Ebenso wird ein inaktives Profil
 * hier nicht geprueft - der Reset veraendert die Rechtelage nicht.
 *
 * Ein Reset ist IMMER eine echte Aenderung; es gibt kein `unchanged`. Der
 * Schutz des letzten aktiven Administrators (SQLSTATE `KB001`) kann hier nicht
 * ausloesen: der Trigger prueft ausschliesslich den UEBERGANG von "aktiver
 * Administrator" zu "nicht mehr", und diese Anweisung ruehrt weder `is_disabled`
 * noch `role` noch `is_active` an. Deshalb steht hier bewusst keine
 * `KB001`-Behandlung.
 *
 * Das Klartextpasswort wird nach Schritt 4 nicht mehr angefasst und erscheint in
 * keinem Rueckgabewert. Die Uebergabe an den Benutzer ist ein organisatorischer
 * Weg ausserhalb dieses Moduls.
 */
export async function adminResetPassword(
  actorUserId: string,
  targetAccountId: string,
  temporaryPassword: string,
): Promise<AdminPasswordResetOutcome> {
  if (!isUuid(actorUserId)) {
    throw new Error(
      "Fehlende oder ungueltige Benutzer-ID des Handelnden: der Passwort-Reset wird verweigert.",
    );
  }
  if (!isUuid(targetAccountId)) return { kind: "not_found" };
  if (targetAccountId === actorUserId) return { kind: "self_forbidden" };

  const violation = checkPasswordRules(temporaryPassword);
  if (violation !== null) return { kind: "rule", violation };

  const newHash = await hashPassword(temporaryPassword);

  return withUserTransaction<AdminPasswordResetOutcome>(actorUserId, async (client) => {
    await assertActiveAdmin(client, actorUserId);

    const account = await lockAccount(client, targetAccountId);
    if (!account) return { kind: "not_found" };

    const updated = await client.query<{ id: string }>(
      `update public.auth_accounts
       set password_hash = $2::text,
           password_hash_version = $3::integer,
           must_change_password = true,
           password_changed_at = now(),
           failed_attempts = 0,
           locked_until = null
       where id = $1::uuid
       returning id`,
      [targetAccountId, newHash, PASSWORD_HASH_VERSION],
    );
    if (updated.rows.length !== 1) {
      // Fail-closed: ohne bestaetigte Aenderung darf kein Erfolg gemeldet und
      // keine Sitzung widerrufen werden. Der Wrapper rollt zurueck. Die Meldung
      // nennt keine Kennung.
      throw new Error("Administrativer Passwort-Reset: das Konto wurde nicht geaendert.");
    }

    const revokedSessions = await revokeOpenSessions(
      client,
      targetAccountId,
      "admin_password_reset",
    );

    return { kind: "reset", revokedSessions };
  });
}

/**
 * Ergebnis einer administrativen Sperre bzw. Entsperre.
 *
 * `unchanged` traegt den bestehenden Zustand mit, damit eine Oberflaeche ihn
 * anzeigen kann, ohne erneut zu lesen.
 */
export type AdminAccountStateOutcome =
  | { kind: "changed"; disabled: boolean; revokedSessions: number }
  | { kind: "unchanged"; disabled: boolean }
  | { kind: "not_found" }
  | { kind: "last_admin" };

/**
 * Sperrt oder entsperrt ein Konto (ADR-011 / 2.4).
 *
 * Gefuehrt wird die Sperre ueber `public.auth_accounts.is_disabled` und
 * ausdruecklich NICHT ueber `public.profiles.is_active`: `is_disabled` wirkt in
 * Stufe 1 der Sitzungspruefung und beendet damit die Anmeldung UND jede bereits
 * ausgestellte Sitzung (`validateSession`, Bedingung `not a.is_disabled`).
 * `public.profiles.is_active` bleibt fuer `app_user` ohnehin unveraenderbar
 * (Migration `0017`, Abschnitt 1).
 *
 * Idempotent: stimmt der gewuenschte Zustand mit dem bestehenden ueberein, wird
 * NICHT geschrieben, keine Sitzung widerrufen und kein Auditsatz erzeugt.
 *
 * Auch die ENTSPERRE widerruft alle offenen Sitzungen. Das ist kein Versehen:
 * ein Widerruf ist unumkehrbar, kostet also nichts, aber eine aus anderer Quelle
 * offen gebliebene Sitzung darf durch die Reaktivierung nicht heimlich wieder
 * benutzbar werden. `revoked_at` wird von diesem Modul niemals zurueckgesetzt.
 *
 * `KB001` wird AUSSERHALB des Transaktions-Rueckrufs gefangen: der Schutztrigger
 * feuert erst nach dem UPDATE, die Transaktion ist zu diesem Zeitpunkt bereits
 * abgebrochen und der Wrapper rollt zurueck. Der Fall ist fachlich und kein
 * technischer Fehler - jeder andere Fehler wird unveraendert durchgereicht.
 */
export async function adminSetAccountDisabled(
  actorUserId: string,
  targetAccountId: string,
  disabled: boolean,
): Promise<AdminAccountStateOutcome> {
  if (!isUuid(actorUserId)) {
    throw new Error(
      "Fehlende oder ungueltige Benutzer-ID des Handelnden: die Kontoaenderung wird verweigert.",
    );
  }
  if (!isUuid(targetAccountId)) return { kind: "not_found" };

  try {
    return await withUserTransaction<AdminAccountStateOutcome>(
      actorUserId,
      async (client) => {
        await assertActiveAdmin(client, actorUserId);

        const account = await lockAccount(client, targetAccountId);
        if (!account) return { kind: "not_found" };
        if (account.is_disabled === disabled) {
          return { kind: "unchanged", disabled: account.is_disabled };
        }

        const updated = await client.query<{ id: string }>(
          `update public.auth_accounts
           set is_disabled = $2::boolean
           where id = $1::uuid
           returning id`,
          [targetAccountId, disabled],
        );
        if (updated.rows.length !== 1) {
          // Fail-closed, siehe adminResetPassword.
          throw new Error("Kontosperre: das Konto wurde nicht geaendert.");
        }

        const revokedSessions = await revokeOpenSessions(
          client,
          targetAccountId,
          disabled ? "admin_account_disabled" : "admin_account_enabled",
        );

        return { kind: "changed", disabled, revokedSessions };
      },
    );
  } catch (error) {
    if (pgErrorCode(error) === LAST_ACTIVE_ADMIN_PROTECTED) {
      return { kind: "last_admin" };
    }
    throw error;
  }
}

/**
 * Ergebnis eines administrativen Rollenwechsels.
 *
 * `invalid_role` und `not_found` sind getrennt: der eine Fall ist eine
 * unbrauchbare Eingabe, der andere ein unbekanntes Ziel. Beide fuehren zu keiner
 * Datenbankaenderung.
 */
export type AdminRoleChangeOutcome =
  | { kind: "changed"; previousRole: UserRole; role: UserRole; revokedSessions: number }
  | { kind: "unchanged"; role: UserRole }
  | { kind: "not_found" }
  | { kind: "invalid_role" }
  | { kind: "last_admin" };

/**
 * Weist einem Benutzer eine andere Rolle zu (ADR-011 / 2.4).
 *
 * `role` ist bewusst `string` und wird zur Laufzeit gegen
 * `ADMIN_ASSIGNABLE_ROLES` geprueft: die Autorisierung darf nicht von einem Typ
 * abhaengen, den es zur Laufzeit nicht gibt. Erst danach wird die Datenbank
 * beruehrt.
 *
 * Geschrieben wird ausschliesslich `public.profiles.role` - die einzige Spalte,
 * fuer die `app_user` ein Aenderungsrecht besitzt (Migration `0017`,
 * Abschnitt 1). Die Policy `profiles_update` entscheidet ueber die Zeile, der
 * BEFORE-Trigger `trg_protect_profile` weist eine Nicht-Administrator-Identitaet
 * mit 42501 ab. Dieses Modul verlaesst sich darauf nicht allein: die eigene
 * Pruefung `assertActiveAdmin` ist die erste, die Datenbank die zweite Schranke.
 *
 * Das Zielkonto wird vorab sperrend gelesen. Das dient der SERIALISIERUNG
 * gleichzeitiger Eingriffe auf denselben Benutzer und zugleich als Nachweis, dass
 * die Kennung ueberhaupt zu einem Konto gehoert; fehlt Konto oder Profil, ist das
 * Ergebnis `not_found`.
 *
 * Idempotent: dieselbe Rolle erneut zuzuweisen schreibt nicht, widerruft keine
 * Sitzung und erzeugt keinen Auditsatz.
 *
 * Nach einem echten Wechsel werden alle offenen Sitzungen widerrufen. Das ist
 * zwingend und nicht bloss vorsichtig: eine laufende Sitzung traegt Rolle und
 * Navigation aus dem Zeitpunkt ihrer Ausstellung; ohne Widerruf behielte ein
 * Herabgestufter seine bisherigen Rechte bis zum Ablauf.
 *
 * `KB001` (letzter aktiver Administrator) wird wie in `adminSetAccountDisabled`
 * ausserhalb des Rueckrufs ausgewertet.
 */
export async function adminSetRole(
  actorUserId: string,
  targetProfileId: string,
  role: string,
): Promise<AdminRoleChangeOutcome> {
  if (!isUuid(actorUserId)) {
    throw new Error(
      "Fehlende oder ungueltige Benutzer-ID des Handelnden: der Rollenwechsel wird verweigert.",
    );
  }
  if (!isUuid(targetProfileId)) return { kind: "not_found" };
  if (!isAssignableRole(role)) return { kind: "invalid_role" };

  try {
    return await withUserTransaction<AdminRoleChangeOutcome>(
      actorUserId,
      async (client) => {
        await assertActiveAdmin(client, actorUserId);

        const account = await lockAccount(client, targetProfileId);
        if (!account) return { kind: "not_found" };

        const profiles = await client.query<{ role: UserRole }>(
          `select role from public.profiles where id = $1::uuid`,
          [targetProfileId],
        );
        const profile = profiles.rows[0];
        if (!profile) return { kind: "not_found" };
        if (profile.role === role) return { kind: "unchanged", role: profile.role };

        const updated = await client.query<{ id: string }>(
          `update public.profiles
           set role = $2::public.user_role
           where id = $1::uuid
           returning id`,
          [targetProfileId, role],
        );
        if (updated.rows.length !== 1) {
          // Fail-closed, siehe adminResetPassword.
          throw new Error("Rollenwechsel: das Profil wurde nicht geaendert.");
        }

        const revokedSessions = await revokeOpenSessions(
          client,
          targetProfileId,
          "admin_role_changed",
        );

        return {
          kind: "changed",
          previousRole: profile.role,
          role,
          revokedSessions,
        };
      },
    );
  } catch (error) {
    if (pgErrorCode(error) === LAST_ACTIVE_ADMIN_PROTECTED) {
      return { kind: "last_admin" };
    }
    throw error;
  }
}
