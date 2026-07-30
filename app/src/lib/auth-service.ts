import "server-only";

import { normalizeEmail } from "@/lib/auth-identity";
import type { LoginContext } from "@/lib/auth-identity";
import {
  PASSWORD_HASH_VERSION,
  checkPasswordRules,
  equalizeVerifyCost,
  hashPassword,
  needsRehash,
  verifyPassword,
  type PasswordRuleViolation,
} from "@/lib/auth-password";
import { isUuid, withAuthTransaction, withUserTransaction } from "@/lib/db";
import type { UserRole } from "@/lib/roles";

// AP14/B: serverseitige Authentifizierung und Sitzungsverwaltung (ADR-011 / 2.2).
//
// Zweistufiger Ablauf, genau in der von ADR-011 / 2.2 vorgegebenen Reihenfolge:
//
//   Stufe 1 - OHNE Identitaet (`withAuthTransaction`):
//     `auth_accounts` und `auth_sessions` sind nicht RLS-, sondern
//     rechtegeschuetzt (Migration `0012`). Hier laufen Kontosuche,
//     Passwortpruefung, Fehlversuchszaehlung sowie die Pruefung, ob eine
//     Sitzung existiert, unwiderrufen und unabgelaufen ist.
//
//   Stufe 2 - MIT Identitaet (`withUserTransaction`):
//     `public.profiles` ist RLS-geschuetzt; `profiles_select` verlangt
//     `id = app.current_user_id() or is_staff()`. Ein Lesen ohne gesetzte
//     Identitaet liefert unter der nicht privilegierten Rolle `app_user`
//     NULL Zeilen - Rolle und Anzeigename waeren nie ermittelbar. Die
//     Identitaet wird deshalb erst gesetzt, NACHDEM Stufe 1 sie bestaetigt
//     hat, und niemals aus einem ungeprueften Token uebernommen.
//
// Der Policy-Inhalt bleibt unveraendert; es wird nichts gelockert.

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

/**
 * Absolute Sitzungsobergrenze. Muss zum Check-Constraint
 * `auth_sessions_absolute_max` aus Migration `0012` passen
 * (`expires_at <= issued_at + interval '12 hours'`).
 */
const SESSION_HOURS = 12;

export type ValidatedSession = {
  userId: string;
  sessionId: string;
  email: string;
  fullName: string;
  role: UserRole;
  mustChangePassword: boolean;
};

type AccountRow = {
  id: string;
  email: string;
  password_hash: string;
  password_hash_version: number;
  must_change_password: boolean;
  is_disabled: boolean;
  failed_attempts: number;
  locked_until: Date | null;
};

type ProfileRow = {
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
};

type SessionRow = {
  email: string;
  must_change_password: boolean;
};

/**
 * Ergebnis der Passwortstufe.
 *
 * Die Unterscheidung existiert ausschliesslich, um den Rechenaufwand nach
 * aussen gleich zu halten: `unverified` bedeutet, dass kein Argon2-Lauf
 * stattgefunden hat und deshalb nachtraeglich ein Leerlauf gleicher Dauer
 * folgen muss.
 */
type PasswordOutcome =
  | { kind: "accepted"; accountId: string; email: string; mustChangePassword: boolean }
  | { kind: "rejected" }
  | { kind: "unverified" };

/**
 * Liest Rolle und Anzeigename des Profils unter der Identitaet des Benutzers.
 *
 * Gibt NULL zurueck, wenn kein Profil existiert oder es nicht aktiv ist. Die
 * `where`-Bedingung ist unter RLS zwar redundant, bleibt aber ausdruecklich
 * stehen: der Zugriff soll auch dann eng bleiben, wenn die Abfrage einmal in
 * einem Staff-Kontext laeuft, in dem `is_staff()` mehr Zeilen sichtbar macht.
 */
async function readActiveProfile(userId: string): Promise<ProfileRow | null> {
  return withUserTransaction(userId, async (client) => {
    const result = await client.query<ProfileRow>(
      `select full_name, role, is_active
       from public.profiles
       where id = $1::uuid`,
      [userId],
    );
    const row = result.rows[0];
    if (!row || !row.is_active) return null;
    return row;
  });
}

/**
 * Prueft Zugangsdaten und stellt bei Erfolg eine widerrufbare Sitzung aus.
 *
 * Rueckgabe ist absichtlich `ValidatedSession | null`: nach aussen wird nicht
 * zwischen unbekannter Adresse, falschem Passwort, gesperrtem Konto und
 * inaktivem Profil unterschieden. Jede Differenzierung waere eine
 * Benutzeraufzaehlung.
 */
export async function authenticateCredentials(
  emailInput: string,
  password: string,
  context: LoginContext,
): Promise<ValidatedSession | null> {
  const email = normalizeEmail(emailInput);
  if (!email || !password) {
    await equalizeVerifyCost(password);
    return null;
  }

  // Stufe 1: Konto und Passwort, ohne Identitaet.
  const outcome = await withAuthTransaction<PasswordOutcome>(async (client) => {
    const found = await client.query<AccountRow>(
      `select
         id,
         email,
         password_hash,
         password_hash_version,
         must_change_password,
         is_disabled,
         failed_attempts,
         locked_until
       from public.auth_accounts
       where lower(email) = $1::text
       for no key update`,
      [email],
    );

    const account = found.rows[0];
    if (!account) return { kind: "unverified" };

    const isLocked =
      account.locked_until !== null && account.locked_until.getTime() > Date.now();
    if (account.is_disabled || isLocked) return { kind: "unverified" };

    const valid = await verifyPassword(account.password_hash, password);

    if (!valid) {
      // Eine abgelaufene Sperre setzt den Zaehler zurueck. Ohne diesen Schritt
      // wuerde nach Ablauf der Sperre bereits der erste Fehlversuch sofort
      // erneut sperren.
      const previousAttempts = account.locked_until === null ? account.failed_attempts : 0;
      // Alle Parameter sind ausdruecklich getypt. Ohne die Casts leitet
      // PostgreSQL $2 aus `failed_attempts = $2` als integer, aus
      // `$2 >= $3` (unknown >= unknown) aber als text ab und bricht mit
      // "inconsistent types deduced for parameter $2" ab.
      await client.query(
        `update public.auth_accounts
         set failed_attempts = $2::integer,
             locked_until = case
               when $2::integer >= $3::integer
                 then now() + make_interval(mins => $4::integer)
               else null
             end
         where id = $1::uuid`,
        [account.id, previousAttempts + 1, MAX_FAILED_ATTEMPTS, LOCK_MINUTES],
      );
      return { kind: "rejected" };
    }

    // Erfolg: Zaehler und Sperre zuruecksetzen. Ein veralteter Parametersatz
    // wird in derselben Transaktion nachgezogen; der Klartext liegt genau hier
    // einmalig vor und wird nirgends protokolliert.
    const refreshedHash = needsRehash(account.password_hash_version)
      ? await hashPassword(password)
      : null;

    await client.query(
      `update public.auth_accounts
       set failed_attempts = 0,
           locked_until = null,
           last_login_at = now(),
           password_hash = coalesce($2::text, password_hash),
           password_hash_version =
             case when $2::text is null then password_hash_version else $3::integer end
       where id = $1::uuid`,
      [account.id, refreshedHash, PASSWORD_HASH_VERSION],
    );

    return {
      kind: "accepted",
      accountId: account.id,
      email: account.email,
      mustChangePassword: account.must_change_password,
    };
  });

  if (outcome.kind === "unverified") {
    // Ausserhalb der Transaktion, damit der Leerlauf keine Poolverbindung haelt.
    await equalizeVerifyCost(password);
    return null;
  }
  if (outcome.kind === "rejected") return null;

  // Stufe 2: Profil und Sitzung unter der jetzt bestaetigten Identitaet.
  // Die Sitzung entsteht erst, wenn das Profil aktiv ist - ein gesperrtes
  // Profil hinterlaesst keine ausgestellte Sitzung.
  return withUserTransaction(outcome.accountId, async (client) => {
    const profiles = await client.query<ProfileRow>(
      `select full_name, role, is_active
       from public.profiles
       where id = $1::uuid`,
      [outcome.accountId],
    );
    const profile = profiles.rows[0];
    if (!profile || !profile.is_active) return null;

    const created = await client.query<{ id: string }>(
      `insert into public.auth_sessions (
         account_id, expires_at, created_ip_hash, user_agent_hash
       )
       values (
         $1::uuid,
         now() + make_interval(hours => $2::integer),
         $3::text,
         $4::text
       )
       returning id`,
      [outcome.accountId, SESSION_HOURS, context.ipHash, context.userAgentHash],
    );

    return {
      userId: outcome.accountId,
      sessionId: created.rows[0].id,
      email: outcome.email,
      fullName: profile.full_name ?? outcome.email,
      role: profile.role,
      mustChangePassword: outcome.mustChangePassword,
    };
  });
}

/**
 * Prueft eine ausgestellte Sitzung bei jedem geschuetzten Request.
 *
 * Stufe 1 (ohne Identitaet) prueft:
 *   - die Sitzung existiert, ist nicht widerrufen und nicht abgelaufen;
 *   - das Konto ist nicht deaktiviert.
 * Stufe 2 (mit der dadurch bestaetigten Identitaet) prueft das aktive Profil
 * und liest Rolle und Anzeigename.
 *
 * `locked_until` wird ausdruecklich NICHT geprueft. Die Sperre schuetzt gegen
 * Passwortraten bei der Anmeldung. Wuerde sie auch laufende Sitzungen beenden,
 * koennte ein Fremder einen angemeldeten Benutzer allein durch absichtliche
 * Fehlversuche aus der Anwendung werfen.
 *
 * Rolle und Anzeigename kommen ausschliesslich aus der Datenbank, niemals aus
 * einem Token-Claim.
 */
export async function validateSession(
  userId: string,
  sessionId: string,
): Promise<ValidatedSession | null> {
  const account = await withAuthTransaction(async (client) => {
    // Eine einzige Anweisung: eine datenveraendernde CTE laeuft in PostgreSQL
    // immer vollstaendig, auch wenn die Hauptabfrage ihr Ergebnis nicht liest.
    // Die Zeitschwelle begrenzt die Schreiblast auf hoechstens einen Takt pro
    // Minute und Sitzung.
    const result = await client.query<SessionRow>(
      `with touched as (
         update public.auth_sessions
         set last_seen_at = now()
         where id = $1::uuid
           and account_id = $2::uuid
           and revoked_at is null
           and expires_at > now()
           and last_seen_at < now() - interval '1 minute'
         returning id
       )
       select a.email, a.must_change_password
       from public.auth_sessions s
       join public.auth_accounts a on a.id = s.account_id
       where s.id = $1::uuid
         and s.account_id = $2::uuid
         and s.revoked_at is null
         and s.expires_at > now()
         and not a.is_disabled`,
      [sessionId, userId],
    );
    return result.rows[0] ?? null;
  });

  if (!account) return null;

  const profile = await readActiveProfile(userId);
  if (!profile) return null;

  return {
    userId,
    sessionId,
    email: account.email,
    fullName: profile.full_name ?? account.email,
    role: profile.role,
    mustChangePassword: account.must_change_password,
  };
}

/**
 * Ein Widerruf wurde verweigert, weil der Handelnde dazu nicht berechtigt ist.
 *
 * Eigene Klasse, damit ein Aufrufer den Verweigerungsfall von einem technischen
 * Fehler unterscheiden kann, ohne eine Meldung zu vergleichen. Die Meldung
 * nennt keine Kennungen.
 */
export class SessionRevokeDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SessionRevokeDeniedError";
  }
}

/**
 * Widerruft genau eine EIGENE Sitzung.
 *
 * Laeuft unter der Identitaet des Handelnden, damit der Auditeintrag einen
 * Urheber traegt: den Auditsatz schreibt der Trigger
 * `trg_audit_auth_session_revoked` aus Migration `0012` mit
 * `actor = app.current_user_id()`. Die Anwendung schreibt selbst nicht in
 * `public.audit_events` - dort existiert bewusst keine Insert-Policy.
 *
 * `account_id = $2` ist verbindlich und nicht redundant: `auth_sessions` ist
 * rechte-, nicht RLS-geschuetzt (Migration `0012`), und `app_user` darf jede
 * Zeile aendern. Ohne die Bedingung koennte eine beliebige bekannte
 * Sitzungs-ID eine FREMDE Sitzung beenden - ADR-011 / 2.2 erlaubt bei der
 * Abmeldung ausdruecklich nur die eigene. Der kontoweite Widerruf hat eine
 * eigene, gehaertete Schnittstelle (`revokeAllSessionsForAccount`).
 *
 * Idempotent: ein erneuter Aufruf laesst Zeitpunkt und Grund unveraendert und
 * erzeugt keinen zweiten Auditeintrag. Die Rueckgabe sagt, ob dieser Aufruf den
 * Widerruf ausgeloest hat - `false` bedeutet "bereits widerrufen, unbekannt
 * oder fremd" und wird bewusst nicht unterschieden.
 */
export async function revokeSession(
  actorUserId: string,
  sessionId: string,
  reason = "signout",
): Promise<boolean> {
  if (!isUuid(sessionId)) {
    throw new Error("Ungueltige Sitzungs-ID: der Widerruf wird verweigert.");
  }
  const trimmedReason = reason.trim() || "signout";
  return withUserTransaction(actorUserId, async (client) => {
    const revoked = await client.query<{ id: string }>(
      `update public.auth_sessions
       set revoked_at = now(),
           revoked_reason = $3::text
       where id = $1::uuid
         and account_id = $2::uuid
         and revoked_at is null
       returning id`,
      [sessionId, actorUserId, trimmedReason],
    );
    return revoked.rows.length === 1;
  });
}

/**
 * Widerruft alle offenen Sitzungen eines Kontos.
 *
 * Ausloeser gemaess ADR-011 / 2.2: Passwortaenderung, administrativer
 * Passwort-Reset, Deaktivierung oder Rollenaenderung durch den Administrator
 * sowie administrativer Zwangswiderruf. Die zugehoerigen Verwaltungs-
 * oberflaechen sind Gegenstand eines eigenen Arbeitspakets. Je widerrufener
 * Sitzung entsteht genau ein Auditeintrag (Trigger aus Migration `0012`).
 *
 * Berechtigung - fail-closed und ausschliesslich aus der Datenbank:
 *   * Selbstwiderruf (`accountId === actorUserId`) ist immer zulaessig.
 *   * Ein fremdes Konto darf nur ein Handelnder widerrufen, dessen Profil in
 *     DERSELBEN Transaktion mit `role = 'admin'` und `is_active` bestaetigt
 *     wird. Gelesen wird unter der Identitaet des Handelnden, also durch
 *     `profiles_select` gedeckt.
 *   * Jeder andere Fall wirft `SessionRevokeDeniedError`; die Transaktion wird
 *     zurueckgerollt und nichts widerrufen.
 *
 * Die Rolle wird NIE aus einem Parameter, einem Aufrufkontext oder einem
 * Token-Claim uebernommen - genau deshalb hat diese Funktion keinen
 * Rollenparameter.
 *
 * Rueckgabe: Anzahl der tatsaechlich widerrufenen Sitzungen.
 */
export async function revokeAllSessionsForAccount(
  actorUserId: string,
  accountId: string,
  reason: string,
): Promise<number> {
  if (!isUuid(accountId)) {
    throw new Error("Ungueltige Konto-ID: der Widerruf wird verweigert.");
  }
  const trimmedReason = reason.trim() || "revoked";
  return withUserTransaction(actorUserId, async (client) => {
    if (accountId !== actorUserId) {
      const actor = await client.query<{ role: UserRole; is_active: boolean }>(
        `select role, is_active
         from public.profiles
         where id = $1::uuid`,
        [actorUserId],
      );
      const row = actor.rows[0];
      if (!row || !row.is_active || row.role !== "admin") {
        throw new SessionRevokeDeniedError(
          "Kontoweiter Sitzungswiderruf ist nur fuer das eigene Konto oder " +
            "durch einen aktiven Administrator zulaessig.",
        );
      }
    }

    const revoked = await client.query<{ id: string }>(
      `update public.auth_sessions
       set revoked_at = now(),
           revoked_reason = $2::text
       where account_id = $1::uuid
         and revoked_at is null
       returning id`,
      [accountId, trimmedReason],
    );
    return revoked.rows.length;
  });
}

/**
 * Ergebnis eines Passwortwechsels.
 *
 * `rejected` fasst bewusst zusammen: falsches aktuelles Passwort, deaktiviertes
 * Konto, inaktives oder fehlendes Profil. Der Aufrufer kann daraus keine Aussage
 * ueber den Kontozustand ableiten und deshalb auch keine bauen.
 */
export type PasswordChangeOutcome =
  | { kind: "changed"; revokedSessions: number }
  | { kind: "rejected" }
  | { kind: "unchanged" }
  | { kind: "rule"; violation: PasswordRuleViolation };

/**
 * Passwortwechsel des angemeldeten Benutzers (ADR-011 / 2.3).
 *
 * Ein Aufruf, eine Transaktion, alles oder nichts:
 *   1. Konto sperrend lesen (`for no key update`) - ein zweiter, gleichzeitiger
 *      Wechsel wartet, statt auf einem veralteten Hash zu pruefen.
 *   2. Konto nicht deaktiviert und Profil aktiv - sonst `rejected`.
 *   3. Aktuelles Passwort gegen den gespeicherten Hash pruefen - sonst
 *      `rejected`. Die Pruefung liegt IN derselben Transaktion wie die
 *      Aenderung; sonst waere zwischen Pruefung und Schreiben ein Fenster.
 *   4. Neuen Hash, `password_hash_version`, `must_change_password = false`,
 *      `password_changed_at` setzen und Fehlversuchszaehler/Sperre zuruecksetzen.
 *   5. ALLE offenen Sitzungen des Kontos widerrufen - einschliesslich der
 *      eigenen. Danach ist eine erneute Anmeldung zwingend.
 *
 * Jeder Fehler rollt die gesamte Transaktion zurueck (Wrapper): es gibt keinen
 * Zustand, in dem der Hash neu, aber eine Sitzung noch offen ist - oder in dem
 * `must_change_password` geloescht, das Passwort aber unveraendert waere.
 *
 * Auditierung entsteht ausschliesslich ueber die Trigger aus Migration `0012`:
 * `password_changed` auf dem Konto und je widerrufener Sitzung ein `revoke`. Die
 * Anwendung schreibt nicht selbst in `public.audit_events`. In keinem Auditsatz,
 * keiner Fehlermeldung und keiner Protokollzeile erscheint ein Klartextwert.
 *
 * Bewusst OHNE Zaehlung von Fehlversuchen: die Sperre nach 5 Fehlversuchen
 * schuetzt den Anmeldeweg. Hier ist der Aufrufer bereits durch eine gueltige,
 * nicht widerrufene Sitzung ausgewiesen; ein Zaehler an dieser Stelle wuerde nur
 * eine Selbstaussperrung ermoeglichen, ohne einen Angriffsweg zu schliessen.
 */
export async function changeOwnPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<PasswordChangeOutcome> {
  if (!isUuid(userId)) {
    throw new Error(
      "Fehlende oder ungueltige Benutzer-ID: der Passwortwechsel wird verweigert.",
    );
  }

  // Die zentralen Regeln gelten auch hier und nicht nur in der Server Action:
  // diese Funktion ist die Grenze, hinter der ein Hash entsteht.
  const violation = checkPasswordRules(newPassword);
  if (violation !== null) return { kind: "rule", violation };

  // Ein "Wechsel" auf denselben Wert wuerde `must_change_password` loeschen,
  // ohne das Uebergangspasswort tatsaechlich zu ersetzen.
  if (newPassword === currentPassword) return { kind: "unchanged" };

  // Der neue Hash entsteht VOR der Transaktion: Argon2id kostet absichtlich
  // Rechenzeit und soll keine Poolverbindung mit offener Transaktion halten.
  const newHash = await hashPassword(newPassword);

  return withUserTransaction(userId, async (client) => {
    const accounts = await client.query<{
      password_hash: string;
      is_disabled: boolean;
    }>(
      `select password_hash, is_disabled
       from public.auth_accounts
       where id = $1::uuid
       for no key update`,
      [userId],
    );
    const account = accounts.rows[0];
    if (!account || account.is_disabled) return { kind: "rejected" };

    // Getrennte Abfrage und kein Join: `public.profiles` ist RLS-geschuetzt,
    // `public.auth_accounts` rechtegeschuetzt. Getrennt bleibt sichtbar, welche
    // Bedingung welche Schutzebene benutzt.
    const profiles = await client.query<{ is_active: boolean }>(
      `select is_active from public.profiles where id = $1::uuid`,
      [userId],
    );
    const profile = profiles.rows[0];
    if (!profile || !profile.is_active) return { kind: "rejected" };

    if (!(await verifyPassword(account.password_hash, currentPassword))) {
      return { kind: "rejected" };
    }

    const updated = await client.query<{ id: string }>(
      `update public.auth_accounts
       set password_hash = $2::text,
           password_hash_version = $3::integer,
           must_change_password = false,
           password_changed_at = now(),
           failed_attempts = 0,
           locked_until = null
       where id = $1::uuid
       returning id`,
      [userId, newHash, PASSWORD_HASH_VERSION],
    );
    if (updated.rows.length !== 1) {
      // Fail-closed: ohne bestaetigte Aenderung darf kein Erfolg gemeldet und
      // keine Sitzung widerrufen werden. Der Wrapper rollt zurueck.
      throw new Error("Passwortwechsel: das Konto wurde nicht geaendert.");
    }

    const revoked = await client.query<{ id: string }>(
      `update public.auth_sessions
       set revoked_at = now(),
           revoked_reason = 'password_changed'
       where account_id = $1::uuid
         and revoked_at is null
       returning id`,
      [userId],
    );

    return { kind: "changed", revokedSessions: revoked.rows.length };
  });
}
