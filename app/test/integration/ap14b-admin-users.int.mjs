// AP14/B Integrationstests der administrativen Benutzerverwaltung gegen ein
// synthetisches PostgreSQL 18.
//
// Lauf (siehe app/supabase/test/run_ap14b_local.ps1, vierter Node-Aufruf im
// Schritt "Integrationstests"):
//   AP14B_APP_DATABASE_URL=...   Verbindung der Anwendung (Rolle erbt app_user,
//                                kein SUPERUSER, kein BYPASSRLS)
//   AP14B_ADMIN_DATABASE_URL=... Verbindung der Migrations-/Eigentuemerrolle,
//                                ausschliesslich fuer Fixtures und Gegenproben
//   node --import ./test/integration/module-hooks.mjs \
//        test/integration/ap14b-admin-users.int.mjs
//
// Ohne diese beiden Variablen werden alle Pruefungen uebersprungen; die Datei
// ist damit in einer Umgebung ohne Datenbank harmlos.
//
// BETRIEBSART "PFLICHTMODUS" (AP14B_REQUIRE_INTEGRATION=1): dann gilt das
// Ueberspringen ausdruecklich NICHT. Fehlt eine der beiden Verbindungsvariablen,
// bricht die Datei bereits beim Laden ab. Grund: in der GitHub-CI darf ein
// fehlender Verbindungswert nicht zu einem gruenen Lauf ohne Nachweis fuehren -
// ein stiller Skip waere dort ein vorgetaeuschter Nachweis. Dasselbe
// fail-closed Muster benutzt ap14b-minio-live.int.mjs. Ohne den Schalter - also
// im lokalen Gebrauch ohne Datenbank - bleibt das Skip-Verhalten unveraendert.
//
// WARUM DIESE DATEI NOETIG IST: der SQL-Smoke 23_ap14b_admin_users.sql misst die
// Datenbankseite (Spaltenrecht, RLS, Audittrigger, Schutz des letzten aktiven
// Administrators), fuehrt aber keine Zeile aus src/lib/admin-users.ts aus. Hier
// laufen deshalb die ECHTEN Modulfunktionen `adminResetPassword`,
// `adminSetAccountDisabled` und `adminSetRole` gegen echtes PostgreSQL,
// zusammen mit der ECHTEN Sitzungsauswertung aus src/lib/auth-service.ts. Im
// Test wird KEIN Anwendungs-SQL nachgebaut; die ADMIN-Verbindung dient
// ausschliesslich Fixtures und Gegenproben.
//
// Bewusst `module-hooks.mjs` und NICHT `module-hooks-app.mjs`: dieser Test
// braucht die echte Sitzungsauswertung (`authenticateCredentials`,
// `validateSession`) und darf sie nicht durch einen Sitzungsstub ersetzen.
// src/lib/admin-users.ts haengt ausserdem an keiner Next-Laufzeit - es genuegt
// der Ersatz fuer `server-only` und die Pfadkuerzel.
//
// Es kommen ausschliesslich synthetische Werte vor: Kennungen mit dem Praefix
// 25e00000- (er kommt in keiner anderen Test- oder Migrationsdatei vor -
// ap14b-platform.int.mjs benutzt ac140b00-, ap14b-masterdata-inventory.int.mjs
// 21c00000-, ap14b-images.int.mjs 23d00000-, ap14b-minio-live.int.mjs 24d00000-
// und 23_ap14b_admin_users.sql 23b00000-), Namen mit dem Praefix "V25",
// E-Mail-Adressen auf @beispiel.invalid und frei erfundene Kennwoerter, die fuer
// keinen echten Zugang gelten. Kein Hashliteral steht im Quelltext: jeder Hash
// entsteht zur Laufzeit ueber die zentrale Implementierung.
//
// REIHENFOLGE IM RUNNER: dieser Lauf steht bewusst als LETZTER der vier
// Integrationslaeufe. Seine Administratorkonten tragen - anders als die des
// Smokes 23 - einen echten Argon2id-Hash und wuerden `usableAdminCount()` aus
// ap14b-platform.int.mjs (Fall I13) mitzaehlen. `test.after` raeumt sie
// vollstaendig ab; die Reihenfolge ist trotzdem einzuhalten.

import test from "node:test";
import assert from "node:assert/strict";

import { Client } from "pg";

const APP_URL = process.env.AP14B_APP_DATABASE_URL?.trim();
const ADMIN_URL = process.env.AP14B_ADMIN_DATABASE_URL?.trim();
const ENABLED = Boolean(APP_URL && ADMIN_URL);

/**
 * Pflichtmodus: der Lauf DARF nicht uebersprungen werden.
 *
 * Gesetzt wird er von der CI. Dort ist ein Skip kein harmloses "keine Datenbank
 * vorhanden", sondern ein gruener Lauf ohne jeden Nachweis - genau das, was die
 * Waechterfaelle V26-V31 belegen sollen. Lokal bleibt der Schalter ungesetzt und
 * das bisherige Verhalten unveraendert.
 */
const REQUIRE_INTEGRATION = process.env.AP14B_REQUIRE_INTEGRATION?.trim() === "1";

if (REQUIRE_INTEGRATION && !ENABLED) {
  // Abbruch statt Skip, und zwar SOFORT beim Laden des Moduls: ein `skip` liefe
  // mit Exitcode 0 durch. Die Meldung nennt ausschliesslich die NAMEN der
  // fehlenden Variablen - niemals einen Wert und niemals eine
  // Verbindungszeichenfolge (Muster aus ap14b-minio-live.int.mjs).
  const missing = [
    ["AP14B_APP_DATABASE_URL", APP_URL],
    ["AP14B_ADMIN_DATABASE_URL", ADMIN_URL],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);
  throw new Error(
    `AP14/B-Integrationsnachweis nicht lauffaehig, Pflichtvariablen fehlen: ${missing.join(", ")}. ` +
      "Bei gesetztem AP14B_REQUIRE_INTEGRATION=1 wird dieser Lauf ausdruecklich NICHT uebersprungen.",
  );
}

// Muss vor der ersten Abfrage stehen: der Pool in src/lib/db liest die Variable
// beim ersten Verbindungsaufbau.
if (ENABLED) process.env.DATABASE_URL = APP_URL;

const { withUserTransaction } = await import("../../src/lib/db/index.ts");
const {
  ADMIN_ASSIGNABLE_ROLES,
  AdminActionDeniedError,
  adminResetPassword,
  adminSetAccountDisabled,
  adminSetRole,
} = await import("../../src/lib/admin-users.ts");
const { authenticateCredentials, changeOwnPassword, validateSession } = await import(
  "../../src/lib/auth-service.ts"
);
const { MIN_PASSWORD_LENGTH, hashPassword, verifyPassword } = await import(
  "../../src/lib/auth-password.ts"
);

// --------------------------------------------------------------------------
// Synthetische Fixtures
// --------------------------------------------------------------------------

/** Handelnder Administrator saemtlicher Erfolgsfaelle. */
const ADMIN_A = {
  id: "25e00000-0000-0000-0000-0000000000a1",
  email: "v25.admin.eins@beispiel.invalid",
  name: "V25 Administrator A",
  role: "admin",
  active: true,
  disabled: false,
};
/**
 * Zweiter AKTIVER Administrator.
 *
 * Er ist keine Zierde, sondern Voraussetzung fast aller uebrigen Faelle: der
 * Schutztrigger `trg_protect_last_active_admin` zaehlt GLOBAL, und ohne einen
 * zweiten aktiven Administrator wuerde jede Selbstsperre und jede
 * Selbstherabstufung von ADMIN_A als "letzter Administrator" abgewiesen.
 */
const ADMIN_B = {
  id: "25e00000-0000-0000-0000-0000000000a2",
  email: "v25.admin.zwei@beispiel.invalid",
  name: "V25 Administrator B",
  role: "admin",
  active: true,
  disabled: false,
};
/** Administrator mit GESPERRTEM Konto - fail-closed als Handelnder. */
const ADMIN_DISABLED = {
  id: "25e00000-0000-0000-0000-0000000000a3",
  email: "v25.admin.gesperrt@beispiel.invalid",
  name: "V25 Administrator gesperrt",
  role: "admin",
  active: true,
  disabled: true,
};
/** Administrator mit INAKTIVEM Profil - fail-closed als Handelnder. */
const ADMIN_INACTIVE = {
  id: "25e00000-0000-0000-0000-0000000000a4",
  email: "v25.admin.inaktiv@beispiel.invalid",
  name: "V25 Administrator inaktiv",
  role: "admin",
  active: false,
  disabled: false,
};
/** Nicht privilegierter Handelnder (Rollenschranke). */
const DISPO = {
  id: "25e00000-0000-0000-0000-0000000000d1",
  email: "v25.disponent@beispiel.invalid",
  name: "V25 Disponent",
  role: "disponent",
  active: true,
  disabled: false,
};
/** Ziel der Passwort- und Sperrfaelle. */
const MONTEUR = {
  id: "25e00000-0000-0000-0000-0000000000b1",
  email: "v25.monteur@beispiel.invalid",
  name: "V25 Monteur",
  role: "monteur",
  active: true,
  disabled: false,
};
/** Reservekonto: Ziel der Verweigerungs-, Rollen- und Abschlussfaelle. */
const RESERVE = {
  id: "25e00000-0000-0000-0000-0000000000b2",
  email: "v25.monteur.reserve@beispiel.invalid",
  name: "V25 Monteur Reserve",
  role: "monteur",
  active: true,
  disabled: false,
};

const FIXTURES = [ADMIN_A, ADMIN_B, ADMIN_DISABLED, ADMIN_INACTIVE, DISPO, MONTEUR, RESERVE];
const FIXTURE_IDS = FIXTURES.map((person) => person.id);

/** Gueltige Kennung ohne Konto - fuer die `not_found`-Faelle. */
const UNKNOWN_ID = "25e00000-0000-0000-0000-0000000000ff";

/**
 * Synthetische Kennwoerter dieser Datei.
 *
 * Sie kommen ausschliesslich hier vor, gelten fuer keinen echten Zugang und
 * erfuellen - bis auf TOO_SHORT_PASSWORD - die zentralen Regeln. Jedes ist
 * eindeutig genug, um in V25 zuverlaessig im Audit gesucht werden zu koennen,
 * und enthaelt bewusst kein `%` und kein `_` (beides waere ein LIKE-Platzhalter).
 */
const START_PASSWORD = "Synthetisches-Startkennwort-V25-2026!";
const TEMPORARY_PASSWORD = "Synthetisches-Uebergangskennwort-V25-2026!";
const OWN_PASSWORD = "Synthetisches-Eigenkennwort-V25-2026!";
/** Elf Zeichen und damit eines zu wenig (MIN_PASSWORD_LENGTH = 12). */
const TOO_SHORT_PASSWORD = "Kurz-2026!x";
const ALL_PASSWORDS = [START_PASSWORD, TEMPORARY_PASSWORD, OWN_PASSWORD, TOO_SHORT_PASSWORD];

/** Anmeldekontext ohne jeden personenbezogenen Wert. */
const LOGIN_CONTEXT = { ipHash: null, userAgentHash: null };

let admin;

// Zustand, den aufeinander folgende Faelle teilen. `node:test` fuehrt die
// Faelle dieser Datei in Quelltextreihenfolge nacheinander aus; dasselbe Muster
// benutzt ap14b-platform.int.mjs (I27/I28).
let resetOutcome = null;
let resetOpenBefore = 0;
let resetSessionIds = [];
let disabledSessionId = null;
let disabledRevokedAt = null;
let reenabledSessionId = null;

// --------------------------------------------------------------------------
// Hilfsmittel (alle ueber die Eigentuemerrolle - Gegenprobe, nicht Prueflauf)
// --------------------------------------------------------------------------

async function setUpFixtures() {
  // Der Hash entsteht hier und nicht als Literal: ein festes Hashliteral im
  // Quelltext waere ein hinterlegtes Kennwort. Ein Argon2id-Lauf genuegt fuer
  // alle Fixtures - die Konten teilen sich das Startkennwort.
  const startHash = await hashPassword(START_PASSWORD);

  for (const person of FIXTURES) {
    await admin.query(
      `insert into public.auth_accounts (id, email, password_hash, must_change_password)
       values ($1::uuid, $2::text, $3::text, false)
       on conflict (id) do update set email = excluded.email`,
      [person.id, person.email, startHash],
    );
    await admin.query(
      `insert into public.profiles (id, full_name, role, is_active)
       values ($1::uuid, $2::text, $3::public.user_role, $4::boolean)
       on conflict (id) do update
         set role = excluded.role, is_active = excluded.is_active`,
      [person.id, person.name, person.role, person.active],
    );
    await admin.query(
      `update public.auth_accounts
       set password_hash = $2::text,
           password_hash_version = 1,
           must_change_password = false,
           password_changed_at = null,
           is_disabled = $3::boolean,
           failed_attempts = 0,
           locked_until = null
       where id = $1::uuid`,
      [person.id, startHash, person.disabled],
    );
  }

  // Die Fixtures selbst duerfen keinen Auditsatz hinterlassen: mehrere Faelle
  // zaehlen "genau ein Satz" und wuerden sonst einen Vorlauf mitzaehlen. Die
  // abschliessende Anweisung sperrt das Konto von ADMIN_DISABLED und loest damit
  // tatsaechlich einen Satz aus (tg_audit_auth_account_disabled); auf dem
  // Konfliktpfad eines Wiederholungslaufs kaeme der Rollentrigger hinzu. Beides
  // wird hier wieder entfernt, wie es auch ap14b-platform.int.mjs in seinen
  // Fixtures tut.
  await admin.query(
    `delete from public.audit_events
     where actor = any($1::uuid[]) or entity_id = any($1::uuid[])`,
    [FIXTURE_IDS],
  );
}

async function tearDownFixtures() {
  await admin.query(
    `delete from public.auth_sessions where account_id = any($1::uuid[])`,
    [FIXTURE_IDS],
  );
  await admin.query(
    `delete from public.audit_events
     where actor = any($1::uuid[]) or entity_id = any($1::uuid[])`,
    [FIXTURE_IDS],
  );
  // Jede Aenderung dieser Datei laeuft MIT gesetzter Identitaet; tg_touch_updated()
  // schreibt dann auth_accounts.updated_by. Ohne dieses Loesen scheitert das
  // Loeschen des Profils am Fremdschluessel (Muster aus ap14b-platform.int.mjs).
  await admin.query(
    `update public.auth_accounts set updated_by = null where id = any($1::uuid[])`,
    [FIXTURE_IDS],
  );
  // Beide Loeschungen bewusst als EINE Anweisung je Tabelle: profiles.updated_by
  // zeigt seit 0012 auf public.auth_accounts, und die Fremdschluesselpruefung
  // laeuft am Ende der Anweisung - eine zeilenweise Loeschung koennte scheitern.
  await admin.query(`delete from public.profiles where id = any($1::uuid[])`, [FIXTURE_IDS]);
  await admin.query(`delete from public.auth_accounts where id = any($1::uuid[])`, [FIXTURE_IDS]);
}

async function createSession(accountId) {
  const created = await admin.query(
    `insert into public.auth_sessions (account_id, expires_at)
     values ($1::uuid, now() + interval '30 minutes')
     returning id`,
    [accountId],
  );
  return created.rows[0].id;
}

async function readSession(sessionId) {
  const result = await admin.query(
    `select revoked_at, revoked_reason
     from public.auth_sessions
     where id = $1::uuid`,
    [sessionId],
  );
  return result.rows[0] ?? null;
}

async function openSessionCount(accountId) {
  const result = await admin.query(
    `select count(*)::integer as open
     from public.auth_sessions
     where account_id = $1::uuid and revoked_at is null`,
    [accountId],
  );
  return result.rows[0].open;
}

async function revokedSessionCount(accountId, reason) {
  const result = await admin.query(
    `select count(*)::integer as revoked
     from public.auth_sessions
     where account_id = $1::uuid and revoked_reason = $2::text`,
    [accountId, reason],
  );
  return result.rows[0].revoked;
}

async function readAccount(accountId) {
  const result = await admin.query(
    `select password_hash, password_hash_version, must_change_password,
            password_changed_at, is_disabled, failed_attempts, locked_until
     from public.auth_accounts
     where id = $1::uuid`,
    [accountId],
  );
  return result.rows[0] ?? null;
}

async function readRole(profileId) {
  const result = await admin.query(
    `select role::text as role, is_active from public.profiles where id = $1::uuid`,
    [profileId],
  );
  return result.rows[0] ?? null;
}

async function auditRows(entity, entityId, action) {
  const result = await admin.query(
    `select actor, detail
     from public.audit_events
     where entity = $1::text and entity_id = $2::uuid and action = $3::text
     order by created_at`,
    [entity, entityId, action],
  );
  return result.rows;
}

async function auditCount(entityId) {
  const result = await admin.query(
    `select count(*)::integer as rows
     from public.audit_events
     where entity_id = $1::uuid`,
    [entityId],
  );
  return result.rows[0].rows;
}

/** Aktive Administratoren der GESAMTEN Datenbank - Zaehlung des Schutztriggers. */
async function activeAdminCount() {
  const result = await admin.query(
    `select count(*)::integer as active
     from public.profiles p
     join public.auth_accounts a on a.id = p.id
     where p.role = 'admin' and p.is_active and not a.is_disabled`,
  );
  return result.rows[0].active;
}

/**
 * Setzt Rolle und Auditstand eines eigenen Fixture-Kontos zurueck.
 *
 * Ausschliesslich fuer die Faelle des Schutztriggers: dort wird ein
 * Administrator absichtlich herabgestuft, und ohne diese Wiederherstellung
 * fehlte den folgenden Faellen ihr zweiter aktiver Administrator.
 */
async function restoreAdminRole(profileId) {
  await admin.query(
    `update public.profiles set role = 'admin'::public.user_role where id = $1::uuid`,
    [profileId],
  );
  await admin.query(
    `delete from public.audit_events
     where entity = 'profiles' and entity_id = $1::uuid and action = 'role_changed'`,
    [profileId],
  );
}

/**
 * Stellt den Zustand "ausschliesslich die uebergebenen Kennungen sind aktive
 * Administratoren" her, fuehrt den Rueckruf aus und macht danach ALLES rueckgaengig.
 *
 * WARUM DAS NOETIG IST: `trg_protect_last_active_admin` zaehlt die aktiven
 * Administratoren der GESAMTEN Datenbank. In derselben Datenbank liegen die
 * Fixtures der Smokes und der uebrigen Integrationslaeufe; ohne diesen
 * definierten Zustand waere kein Fall zum letzten Administrator aussagekraeftig.
 *
 * Geparkt wird ueber public.profiles.is_active im EIGENTUEMERKONTEXT - app_user
 * darf diese Spalte nach Migration 0017 ausdruecklich nicht aendern. Geparkt
 * werden nur Zeilen, die nach der Definition des Triggers ueberhaupt zaehlen.
 *
 * Die Wiederherstellung steht in `finally`: ein Fehlschlag mitten im Fall darf
 * die Datenbank nicht dauerhaft ohne Administratoren zuruecklassen. Entfernt
 * werden anschliessend genau die Auditsaetze, die das Parken und das
 * Zuruecksetzen selbst erzeugt haben - eingegrenzt auf die geparkten Kennungen
 * UND auf den Zeitraum ab dem Parken, damit kein fremder Bestandssatz faellt.
 *
 * EINE Nachwirkung bleibt und wird hier ausdruecklich benannt: der BEFORE-Trigger
 * tg_touch_updated() zieht bei jedem der beiden Schreibvorgaenge updated_at und
 * updated_by der geparkten Profile nach. Diese beiden Spalten lassen sich nicht
 * zurueckschreiben, ohne den Trigger abzuschalten - und genau das tut diese
 * Datei bewusst nicht. Fachlich ist nichts betroffen: is_active, role und jeder
 * Auditsatz stehen danach wieder auf dem Ausgangswert.
 */
async function withSoleActiveAdmins(keepIds, run) {
  const marker = await admin.query(`select clock_timestamp() as at`);
  const parkedAt = marker.rows[0].at;

  const others = await admin.query(
    `select p.id
     from public.profiles p
     join public.auth_accounts a on a.id = p.id
     where p.role = 'admin' and p.is_active and not a.is_disabled
       and p.id <> all($1::uuid[])`,
    [keepIds],
  );
  const parked = others.rows.map((row) => row.id);

  if (parked.length > 0) {
    await admin.query(
      `update public.profiles set is_active = false where id = any($1::uuid[])`,
      [parked],
    );
  }

  try {
    return await run();
  } finally {
    if (parked.length > 0) {
      await admin.query(
        `update public.profiles set is_active = true where id = any($1::uuid[])`,
        [parked],
      );
      await admin.query(
        `delete from public.audit_events
         where entity = 'profiles'
           and action in ('profile_activated', 'profile_deactivated')
           and entity_id = any($1::uuid[])
           and created_at >= $2::timestamptz`,
        [parked, parkedAt],
      );
    }
  }
}

// --------------------------------------------------------------------------

test.before(async () => {
  if (!ENABLED) return;
  admin = new Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await tearDownFixtures();
  await setUpFixtures();
});

test.after(async () => {
  if (!ENABLED) return;
  await tearDownFixtures();
  await admin.end();
  // Der Pool in src/lib/db exportiert bewusst keine Verbindung und auch keinen
  // Abschluss. Fuer das Ende des Testprozesses wird der modulprivate Anker
  // benutzt; in der Anwendung lebt der Pool so lange wie der Prozess.
  await globalThis.__kabelbereitschaftPool?.end();
});

const options = {
  skip: ENABLED ? false : "AP14B_APP_DATABASE_URL/AP14B_ADMIN_DATABASE_URL fehlen",
};

// --------------------------------------------------------------------------
// 1) Administrativer Passwort-Reset (ADR-011 / 2.3)
// --------------------------------------------------------------------------

test("V1 Reset: Hash, Wechselzwang, Fehlversuchszaehler und Sperre", options, async () => {
  // Ausgangslage mit Fehlversuchen und stehender Anmeldesperre: nur so ist
  // nachweisbar, dass der Reset beides zuruecksetzt. Beide Werte liegen VOR dem
  // Reset ausdruecklich nicht auf dem Erwartungswert.
  await admin.query(
    `update public.auth_accounts
     set failed_attempts = 3, locked_until = now() + interval '1 hour'
     where id = $1::uuid`,
    [MONTEUR.id],
  );
  resetSessionIds = [await createSession(MONTEUR.id), await createSession(MONTEUR.id)];
  resetOpenBefore = await openSessionCount(MONTEUR.id);
  assert.ok(resetOpenBefore >= 2, `nur ${resetOpenBefore} offene Sitzung(en)`);

  const before = await readAccount(MONTEUR.id);

  resetOutcome = await adminResetPassword(ADMIN_A.id, MONTEUR.id, TEMPORARY_PASSWORD);
  assert.equal(resetOutcome.kind, "reset");

  const after = await readAccount(MONTEUR.id);
  assert.notEqual(after.password_hash, before.password_hash);
  assert.ok(after.password_hash.startsWith("$argon2id$"), after.password_hash.slice(0, 12));
  assert.equal(after.must_change_password, true);
  assert.equal(after.password_hash_version, 1);
  assert.ok(after.password_changed_at instanceof Date, String(after.password_changed_at));
  assert.equal(after.failed_attempts, 0);
  assert.equal(after.locked_until, null);
  // Der Reset aktiviert von sich aus nichts: das Konto war nicht gesperrt und
  // bleibt es auch nicht.
  assert.equal(after.is_disabled, false);
});

test("V2 Reset: alle offenen Sitzungen sind widerrufen und tot", options, async () => {
  assert.equal(resetOutcome.revokedSessions, resetOpenBefore);
  assert.equal(await openSessionCount(MONTEUR.id), 0);

  for (const sessionId of resetSessionIds) {
    const session = await readSession(sessionId);
    assert.ok(session.revoked_at instanceof Date, String(session.revoked_at));
    assert.equal(session.revoked_reason, "admin_password_reset");
    // Der Nachweis kommt nicht aus der Spalte, sondern aus derselben
    // Auswertung, die jeder geschuetzte Request durchlaeuft.
    assert.equal(await validateSession(MONTEUR.id, sessionId), null);
  }
});

test("V3 Reset: altes Kennwort tot, Uebergangskennwort mit Wechselzwang", options, async () => {
  assert.equal(
    await authenticateCredentials(MONTEUR.email, START_PASSWORD, LOGIN_CONTEXT),
    null,
    "das alte Kennwort authentifiziert weiterhin",
  );

  const session = await authenticateCredentials(MONTEUR.email, TEMPORARY_PASSWORD, LOGIN_CONTEXT);
  assert.ok(session, "Anmeldung mit dem Uebergangskennwort scheitert");
  assert.equal(session.userId, MONTEUR.id);
  // Der Kern des Verfahrens: das Uebergangskennwort ist ein Einmalzugang.
  assert.equal(session.mustChangePassword, true);
});

test("V4 Reset: genau ein Auditsatz password_reset_by_admin", options, async () => {
  const rows = await auditRows("auth_accounts", MONTEUR.id, "password_reset_by_admin");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].actor, ADMIN_A.id);
  assert.equal(rows[0].detail.reset_by_admin, true);
  assert.equal(rows[0].detail.must_change_password, true);

  // Der Reset wird NICHT zusaetzlich als Selbstwechsel gefuehrt.
  assert.equal((await auditRows("auth_accounts", MONTEUR.id, "password_changed")).length, 0);
});

test("V5 Gegenprobe: der eigene Wechsel bleibt password_changed", options, async () => {
  // Ohne diesen Fall bliebe offen, ob die Unterscheidung aus Migration 0017 den
  // bisherigen Weg entwertet hat.
  const outcome = await changeOwnPassword(MONTEUR.id, TEMPORARY_PASSWORD, OWN_PASSWORD);
  assert.equal(outcome.kind, "changed");

  const rows = await auditRows("auth_accounts", MONTEUR.id, "password_changed");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].actor, MONTEUR.id);
  assert.equal(rows[0].detail.reset_by_admin, false);

  // Und der administrative Satz aus V4 bleibt unveraendert bestehen.
  assert.equal((await auditRows("auth_accounts", MONTEUR.id, "password_reset_by_admin")).length, 1);
});

test("V6 Reset: Disponent und Monteur werden fail-closed abgewiesen", options, async () => {
  const session = await createSession(RESERVE.id);
  const before = await readAccount(RESERVE.id);

  for (const actor of [DISPO, MONTEUR]) {
    await assert.rejects(
      () => adminResetPassword(actor.id, RESERVE.id, TEMPORARY_PASSWORD),
      AdminActionDeniedError,
      actor.email,
    );
  }

  const after = await readAccount(RESERVE.id);
  assert.equal(after.password_hash, before.password_hash);
  assert.equal(after.must_change_password, false);
  assert.equal(after.password_changed_at, null);
  assert.equal((await readSession(session)).revoked_at, null);
  assert.equal(await auditCount(RESERVE.id), 0);
});

test("V7 Reset: unbekanntes und unbrauchbares Ziel sind not_found", options, async () => {
  // Beide Faelle liefern dasselbe Ergebnis: aus der Antwort laesst sich nicht
  // ableiten, ob ein Konto existiert.
  assert.deepEqual(await adminResetPassword(ADMIN_A.id, UNKNOWN_ID, TEMPORARY_PASSWORD), {
    kind: "not_found",
  });
  assert.deepEqual(await adminResetPassword(ADMIN_A.id, "keine-uuid", TEMPORARY_PASSWORD), {
    kind: "not_found",
  });
});

test("V8 Reset: das eigene Konto ist ausgeschlossen", options, async () => {
  const session = await createSession(ADMIN_A.id);
  const before = await readAccount(ADMIN_A.id);

  assert.deepEqual(await adminResetPassword(ADMIN_A.id, ADMIN_A.id, TEMPORARY_PASSWORD), {
    kind: "self_forbidden",
  });

  const after = await readAccount(ADMIN_A.id);
  assert.equal(after.password_hash, before.password_hash);
  assert.equal(after.must_change_password, false);
  assert.equal((await readSession(session)).revoked_at, null);
  assert.equal(await auditCount(ADMIN_A.id), 0);
});

test("V9 Reset: ein zu kurzes Kennwort beruehrt die Datenbank nicht", options, async () => {
  assert.ok(TOO_SHORT_PASSWORD.length < MIN_PASSWORD_LENGTH);
  const before = await readAccount(RESERVE.id);

  const outcome = await adminResetPassword(ADMIN_A.id, RESERVE.id, TOO_SHORT_PASSWORD);
  assert.equal(outcome.kind, "rule");
  assert.equal(outcome.violation, "too_short");

  const after = await readAccount(RESERVE.id);
  assert.equal(after.password_hash, before.password_hash);
  assert.equal(after.must_change_password, false);
  assert.equal(await auditCount(RESERVE.id), 0);
});

test("V10 Reset: ein gesperrtes Zielkonto bleibt gesperrt", options, async () => {
  // Der Reset ist die uebliche Vorbereitung einer spaeteren Entsperre und darf
  // von sich aus nichts freischalten.
  await admin.query(`update public.auth_accounts set is_disabled = true where id = $1::uuid`, [
    RESERVE.id,
  ]);
  try {
    const outcome = await adminResetPassword(ADMIN_A.id, RESERVE.id, TEMPORARY_PASSWORD);
    assert.equal(outcome.kind, "reset");

    const after = await readAccount(RESERVE.id);
    assert.equal(after.is_disabled, true, "der Reset hat das Konto entsperrt");
    assert.equal(after.must_change_password, true);
  } finally {
    // Ausgangslage fuer die Rollenfaelle wiederherstellen.
    await admin.query(`update public.auth_accounts set is_disabled = false where id = $1::uuid`, [
      RESERVE.id,
    ]);
  }
});

test("V11 Reset: gesperrter oder inaktiver Handelnder wird abgewiesen", options, async () => {
  // Beide Bedingungen der Definition aus Migration 0017 werden einzeln geprueft:
  // ein Administrator, der eine davon verletzt, kann sich nicht anmelden und
  // darf auch ueber eine noch offene Sitzung nichts mehr verwalten.
  const before = await readAccount(RESERVE.id);

  for (const actor of [ADMIN_DISABLED, ADMIN_INACTIVE]) {
    await assert.rejects(
      () => adminResetPassword(actor.id, RESERVE.id, TEMPORARY_PASSWORD),
      AdminActionDeniedError,
      actor.email,
    );
  }

  assert.equal((await readAccount(RESERVE.id)).password_hash, before.password_hash);
});

// --------------------------------------------------------------------------
// 2) Sperre und Entsperre (ADR-011 / 2.4)
// --------------------------------------------------------------------------

test("V12 Sperre: beendet Anmeldung und laufende Sitzung", options, async () => {
  disabledSessionId = await createSession(MONTEUR.id);
  const openBefore = await openSessionCount(MONTEUR.id);
  assert.ok(openBefore >= 1);

  const outcome = await adminSetAccountDisabled(ADMIN_A.id, MONTEUR.id, true);
  assert.equal(outcome.kind, "changed");
  assert.equal(outcome.disabled, true);
  assert.equal(outcome.revokedSessions, openBefore);

  assert.equal((await readAccount(MONTEUR.id)).is_disabled, true);
  assert.equal(await openSessionCount(MONTEUR.id), 0);

  const session = await readSession(disabledSessionId);
  assert.equal(session.revoked_reason, "admin_account_disabled");
  disabledRevokedAt = session.revoked_at;
  assert.ok(disabledRevokedAt instanceof Date, String(disabledRevokedAt));

  // Zwei unabhaengige Wirkungsnachweise: die Anmeldung mit dem KORREKTEN
  // Kennwort scheitert, und die alte Sitzung ist tot.
  assert.equal(
    await authenticateCredentials(MONTEUR.email, OWN_PASSWORD, LOGIN_CONTEXT),
    null,
    "ein gesperrtes Konto meldet sich weiterhin an",
  );
  assert.equal(await validateSession(MONTEUR.id, disabledSessionId), null);

  const rows = await auditRows("auth_accounts", MONTEUR.id, "account_disabled");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].actor, ADMIN_A.id);
  assert.equal(rows[0].detail.is_disabled, true);
});

test("V13 Sperre: der zweite Aufruf ist ein unveraenderter Leerlauf", options, async () => {
  const revokedBefore = await revokedSessionCount(MONTEUR.id, "admin_account_disabled");

  const outcome = await adminSetAccountDisabled(ADMIN_A.id, MONTEUR.id, true);
  assert.equal(outcome.kind, "unchanged");
  assert.equal(outcome.disabled, true);

  assert.equal((await auditRows("auth_accounts", MONTEUR.id, "account_disabled")).length, 1);
  assert.equal(await revokedSessionCount(MONTEUR.id, "admin_account_disabled"), revokedBefore);
});

test("V14 Entsperre: neue Anmeldung ja, alte Sitzung bleibt tot", options, async () => {
  const outcome = await adminSetAccountDisabled(ADMIN_A.id, MONTEUR.id, false);
  assert.equal(outcome.kind, "changed");
  assert.equal(outcome.disabled, false);
  assert.equal((await readAccount(MONTEUR.id)).is_disabled, false);

  const rows = await auditRows("auth_accounts", MONTEUR.id, "account_enabled");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].actor, ADMIN_A.id);
  assert.equal(rows[0].detail.is_disabled, false);

  // Ein Widerruf ist unumkehrbar: die Reaktivierung darf die alte Sitzung nicht
  // heimlich wieder benutzbar machen.
  const session = await readSession(disabledSessionId);
  assert.deepEqual(session.revoked_at, disabledRevokedAt);
  assert.equal(session.revoked_reason, "admin_account_disabled");
  assert.equal(await validateSession(MONTEUR.id, disabledSessionId), null);

  const fresh = await authenticateCredentials(MONTEUR.email, OWN_PASSWORD, LOGIN_CONTEXT);
  assert.ok(fresh, "nach der Entsperre gelingt keine Anmeldung");
  assert.equal(fresh.userId, MONTEUR.id);
  reenabledSessionId = fresh.sessionId;
});

test("V15 Entsperre: der zweite Aufruf ist ein unveraenderter Leerlauf", options, async () => {
  const outcome = await adminSetAccountDisabled(ADMIN_A.id, MONTEUR.id, false);
  assert.equal(outcome.kind, "unchanged");
  assert.equal(outcome.disabled, false);

  assert.equal((await auditRows("auth_accounts", MONTEUR.id, "account_enabled")).length, 1);
  // Ein Leerlauf widerruft nichts: die frische Sitzung aus V14 lebt weiter.
  assert.equal((await readSession(reenabledSessionId)).revoked_at, null);
});

test("V16 Sperre: unbekanntes Ziel und unberechtigte Handelnde", options, async () => {
  assert.deepEqual(await adminSetAccountDisabled(ADMIN_A.id, UNKNOWN_ID, true), {
    kind: "not_found",
  });

  for (const actor of [DISPO, MONTEUR]) {
    await assert.rejects(
      () => adminSetAccountDisabled(actor.id, RESERVE.id, true),
      AdminActionDeniedError,
      actor.email,
    );
  }
  assert.equal((await readAccount(RESERVE.id)).is_disabled, false);
});

// --------------------------------------------------------------------------
// 3) Rollenwechsel (ADR-011 / 2.4)
// --------------------------------------------------------------------------

test("V17 Rollenwechsel: monteur -> disponent, auditiert, Sitzungen beendet", options, async () => {
  await createSession(RESERVE.id);
  const openBefore = await openSessionCount(RESERVE.id);
  assert.ok(openBefore >= 1);

  const outcome = await adminSetRole(ADMIN_A.id, RESERVE.id, "disponent");
  assert.equal(outcome.kind, "changed");
  assert.equal(outcome.previousRole, "monteur");
  assert.equal(outcome.role, "disponent");
  assert.equal(outcome.revokedSessions, openBefore);

  assert.equal((await readRole(RESERVE.id)).role, "disponent");
  // Ohne Widerruf behielte ein Herabgestufter seine bisherigen Rechte bis zum
  // Ablauf seiner Sitzung.
  assert.equal(await openSessionCount(RESERVE.id), 0);
  assert.equal(await revokedSessionCount(RESERVE.id, "admin_role_changed"), openBefore);

  const rows = await auditRows("profiles", RESERVE.id, "role_changed");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].actor, ADMIN_A.id);
  assert.equal(rows[0].detail.previous_role, "monteur");
  assert.equal(rows[0].detail.new_role, "disponent");
});

test("V18 Rollenwechsel: dieselbe Rolle erneut ist kein Wechsel", options, async () => {
  const session = await createSession(RESERVE.id);

  const outcome = await adminSetRole(ADMIN_A.id, RESERVE.id, "disponent");
  assert.equal(outcome.kind, "unchanged");
  assert.equal(outcome.role, "disponent");

  assert.equal((await auditRows("profiles", RESERVE.id, "role_changed")).length, 1);
  assert.equal((await readSession(session)).revoked_at, null);
});

test("V19 Rollenwechsel: unbrauchbare Rollenwerte werden abgewiesen", options, async () => {
  // Die Autorisierung haengt an einer Laufzeit-Allowlist und nicht an einem
  // TypeScript-Typ. Eine Rolle `kunde` existiert nicht und wird auch nicht
  // vorbereitet (ADR-011 / 2.4).
  assert.equal(ADMIN_ASSIGNABLE_ROLES.includes("kunde"), false);

  const before = await readRole(RESERVE.id);
  for (const value of ["kunde", "KUNDE", "", "admin; drop"]) {
    assert.deepEqual(
      await adminSetRole(ADMIN_A.id, RESERVE.id, value),
      { kind: "invalid_role" },
      JSON.stringify(value),
    );
  }
  assert.deepEqual(await readRole(RESERVE.id), before);
  assert.equal((await auditRows("profiles", RESERVE.id, "role_changed")).length, 1);
});

test("V20 Rollenwechsel: unbekanntes Ziel und unberechtigter Handelnder", options, async () => {
  assert.deepEqual(await adminSetRole(ADMIN_A.id, UNKNOWN_ID, "monteur"), { kind: "not_found" });

  await assert.rejects(
    () => adminSetRole(MONTEUR.id, RESERVE.id, "monteur"),
    AdminActionDeniedError,
  );
  assert.equal((await readRole(RESERVE.id)).role, "disponent");
});

// --------------------------------------------------------------------------
// 4) Schutz des letzten aktiven Administrators (Migration 0017, Abschnitt 3)
//
// Alle Faelle dieses Abschnitts laufen in `withSoleActiveAdmins`: der
// Schutztrigger zaehlt GLOBAL, der Ausgangszustand muss deshalb hergestellt und
// danach vollstaendig wiederhergestellt werden.
// --------------------------------------------------------------------------

test("V21 letzter Administrator: die Selbstherabstufung wird zurueckgerollt", options, async () => {
  await withSoleActiveAdmins([ADMIN_A.id], async () => {
    assert.equal(await activeAdminCount(), 1);
    const session = await createSession(ADMIN_A.id);

    const outcome = await adminSetRole(ADMIN_A.id, ADMIN_A.id, "monteur");
    assert.equal(outcome.kind, "last_admin");

    // Vollstaendiger Rollback: die Ausnahme des Schutztriggers nimmt die
    // Rollenaenderung, den bereits geschriebenen Auditsatz UND den
    // Sitzungswiderruf zurueck.
    assert.equal((await readRole(ADMIN_A.id)).role, "admin");
    assert.equal((await auditRows("profiles", ADMIN_A.id, "role_changed")).length, 0);
    assert.equal((await readSession(session)).revoked_at, null);
  });
});

test("V22 letzter Administrator: die Selbstsperre wird zurueckgerollt", options, async () => {
  await withSoleActiveAdmins([ADMIN_A.id], async () => {
    assert.equal(await activeAdminCount(), 1);
    const session = await createSession(ADMIN_A.id);

    const outcome = await adminSetAccountDisabled(ADMIN_A.id, ADMIN_A.id, true);
    assert.equal(outcome.kind, "last_admin");

    assert.equal((await readAccount(ADMIN_A.id)).is_disabled, false);
    assert.equal((await auditRows("auth_accounts", ADMIN_A.id, "account_disabled")).length, 0);
    assert.equal((await readSession(session)).revoked_at, null);
  });
});

test("V23 letzter Administrator: nur der letzte ist geschuetzt", options, async () => {
  // Der Fall belegt, dass der Trigger nicht pauschal jede Herabstufung
  // verweigert, sondern ausschliesslich die letzte.
  await withSoleActiveAdmins([ADMIN_A.id, ADMIN_B.id], async () => {
    assert.equal(await activeAdminCount(), 2);
    try {
      const first = await adminSetRole(ADMIN_A.id, ADMIN_B.id, "monteur");
      assert.equal(first.kind, "changed");
      assert.equal(first.previousRole, "admin");
      assert.equal(first.role, "monteur");
      assert.equal(await activeAdminCount(), 1);

      const second = await adminSetRole(ADMIN_A.id, ADMIN_A.id, "monteur");
      assert.equal(second.kind, "last_admin");
      assert.equal((await readRole(ADMIN_A.id)).role, "admin");
      assert.equal(await activeAdminCount(), 1);
    } finally {
      await restoreAdminRole(ADMIN_B.id);
    }
  });
});

test("V24 letzter Administrator: zwei gleichzeitige Herabstufungen", options, async () => {
  // DER WETTLAUF, um den es geht: zwei Transaktionen aendern VERSCHIEDENE
  // Zeilen, blockieren einander also nicht, und wuerden unter READ COMMITTED
  // beide den jeweils anderen Administrator noch als aktiv zaehlen. Ohne den
  // Advisory-Lock aus Migration 0017 endete die Datenbank bei NULL aktiven
  // Administratoren.
  //
  // Beide Aufrufe handeln unter DERSELBEN Identitaet (ADMIN_A) und stufen je
  // einen ANDEREN der beiden verbliebenen Administratoren herab. Welcher der
  // beiden zuerst festschreibt, entscheidet die Datenbank - der Fall laesst
  // deshalb DREI legitime Ausgaenge fuer den jeweils unterlegenen Aufruf zu:
  //
  //   1. Die Herabstufung von ADMIN_B gewinnt. Der Aufruf auf ADMIN_A selbst
  //      trifft danach den letzten Administrator und endet mit `last_admin`.
  //   2. Die Selbstherabstufung von ADMIN_A gewinnt. Der Aufruf auf ADMIN_B
  //      trifft danach ebenfalls den letzten Administrator: `last_admin`.
  //   3. Die Selbstherabstufung von ADMIN_A gewinnt und ist bereits
  //      festgeschrieben, BEVOR der andere Aufruf `assertActiveAdmin`
  //      durchlaeuft. Der Handelnde ist dann selbst kein aktiver Administrator
  //      mehr und wird fail-closed mit AdminActionDeniedError abgewiesen.
  //
  // Ausgang 3 ist gewolltes Verhalten und keine Abschwaechung: er verweigert
  // frueher als der Schutztrigger, nicht spaeter. Die EIGENTLICHE Zusicherung
  // dieses Falls ist deshalb nicht ein bestimmtes Ergebnispaar, sondern die
  // Invariante danach: es bleibt GENAU EIN aktiver Administrator uebrig -
  // niemals null. Genau diese Invariante wuerde ohne den Advisory-Lock brechen.
  await withSoleActiveAdmins([ADMIN_A.id, ADMIN_B.id], async () => {
    assert.equal(await activeAdminCount(), 2);
    try {
      // Poolvorwaermung: beide Aufrufe brauchen je eine eigene Verbindung.
      // Ohne sie baute der zweite Aufruf seine Verbindung erst auf und startete
      // messbar spaeter - der Fall pruefte dann keine Gleichzeitigkeit mehr.
      await Promise.all([
        withUserTransaction(ADMIN_A.id, (client) => client.query("select 1 as warm")),
        withUserTransaction(ADMIN_A.id, (client) => client.query("select 1 as warm")),
      ]);

      // `allSettled` statt `all`: Ausgang 3 wirft, und ein Wurf duerfte den Fall
      // nicht abbrechen, bevor die Invariante ueberhaupt gemessen wurde.
      const settled = await Promise.allSettled([
        adminSetRole(ADMIN_A.id, ADMIN_B.id, "monteur"),
        adminSetRole(ADMIN_A.id, ADMIN_A.id, "monteur"),
      ]);

      // Benennt den TATSAECHLICH erhaltenen Ausgang, damit ein Fehlschlag ohne
      // zweiten Lauf lesbar ist. Kennungen und Meldungstexte bleiben aussen vor.
      const describe = (outcome) =>
        outcome.status === "fulfilled"
          ? `erfuellt:${outcome.value.kind}`
          : `abgewiesen:${outcome.reason?.name ?? typeof outcome.reason}`;
      const seen = settled.map(describe).join(" | ");

      const changed = settled.filter(
        (outcome) => outcome.status === "fulfilled" && outcome.value.kind === "changed",
      );
      assert.equal(
        changed.length,
        1,
        `Genau eine Herabstufung darf gelingen, erhalten: ${seen}`,
      );

      const other = settled.find((outcome) => outcome !== changed[0]);
      const otherAccepted =
        (other.status === "fulfilled" && other.value.kind === "last_admin") ||
        (other.status === "rejected" && other.reason instanceof AdminActionDeniedError);
      assert.equal(
        otherAccepted,
        true,
        `Der zweite Aufruf muss mit last_admin oder AdminActionDeniedError enden, erhalten: ${seen}`,
      );

      // Die eigentliche Sicherheitsaussage - gemessen ueber den Admin-Client mit
      // DERSELBEN Definition wie der Schutztrigger.
      assert.equal(
        await activeAdminCount(),
        1,
        `Nach dem Wettlauf muss genau ein aktiver Administrator uebrig bleiben, Ausgaenge: ${seen}`,
      );
    } finally {
      await restoreAdminRole(ADMIN_A.id);
      await restoreAdminRole(ADMIN_B.id);
    }
  });
});

// --------------------------------------------------------------------------
// 5) Geheimnisfreiheit
// --------------------------------------------------------------------------

test("V25 kein Kennwort in Audit oder Rueckgabewert", options, async () => {
  // Die drei Rueckgabewerte werden hier frisch erzeugt: sie sind der einzige
  // Weg, auf dem ein Kennwort das Modul verlassen koennte. Das Reservekonto
  // wird dabei absichtlich veraendert - es ist der letzte Fall der Datei und
  // `test.after` raeumt es vollstaendig ab.
  const outcomes = [
    await adminResetPassword(ADMIN_A.id, RESERVE.id, TEMPORARY_PASSWORD),
    await adminSetAccountDisabled(ADMIN_A.id, RESERVE.id, true),
    await adminSetRole(ADMIN_A.id, RESERVE.id, "monteur"),
  ];
  assert.deepEqual(
    outcomes.map((outcome) => outcome.kind),
    ["reset", "changed", "changed"],
  );

  const serialized = JSON.stringify(outcomes);
  for (const [index, secret] of ALL_PASSWORDS.entries()) {
    // Die Meldung nennt bewusst nur den Listenplatz und niemals den Wert.
    assert.equal(
      serialized.includes(secret),
      false,
      `Kennwort Nr. ${index + 1} erscheint in einem Rueckgabewert`,
    );

    const inAudit = await admin.query(
      `select count(*)::integer as hits
       from public.audit_events
       where detail::text like '%' || $1::text || '%'`,
      [secret],
    );
    assert.equal(
      inAudit.rows[0].hits,
      0,
      `Kennwort Nr. ${index + 1} erscheint in ${inAudit.rows[0].hits} Auditsatz/-saetzen`,
    );
  }

  // Auch kein Hashmaterial im Auditdetail der eigenen Konten.
  const hashInAudit = await admin.query(
    `select count(*)::integer as hits
     from public.audit_events
     where entity_id = any($1::uuid[]) and detail::text like '%argon2%'`,
    [FIXTURE_IDS],
  );
  assert.equal(hashInAudit.rows[0].hits, 0);

  // Gegenprobe, dass ueberhaupt richtig gesucht wurde: der gespeicherte Hash
  // gehoert zum zuletzt gesetzten Uebergangskennwort - der Wert ist also in der
  // Datenbank wirksam, nur eben nirgends im Klartext.
  const account = await readAccount(RESERVE.id);
  assert.equal(await verifyPassword(account.password_hash, TEMPORARY_PASSWORD), true);
  assert.equal(await verifyPassword(account.password_hash, START_PASSWORD), false);
});

// --------------------------------------------------------------------------
// 6) Die beiden Datenbankwaechter aus Migration 0017 (Abschnitte 3b und 3c)
//    und die Ruecknahme des `delete` aus Abschnitt 1a.
//
// WAS DIESE FALLGRUPPE ANDERS MACHT ALS V1-V25: sie ruft ausdruecklich KEINE
// Modulfunktion auf, sondern setzt das SQL selbst ab - ueber
// `withUserTransaction`, also genau den Weg, den ein kuenftiger Anwendungscode
// AUSSERHALB von src/lib/admin-users.ts nehmen wuerde. Die Anwendungsschranke
// `assertActiveAdmin` wird damit bewusst uebersprungen. Gemessen wird die
// zweite, unabhaengige Ebene: die Datenbank selbst.
//
// WARUM DAS NOETIG IST: app_user besitzt `update` auf public.auth_accounts
// tabellenweit (0012:102), und die Tabelle traegt keine Policy, die zwischen
// Selbst- und Fremdaenderung unterscheidet. Faellt die Anwendungspruefung auf
// einem kuenftigen Pfad aus, haelt nur noch der Waechter.
//
// DIESE FALLGRUPPE MISST ZUGLEICH DIE LAUFUMGEBUNG: beide Waechter lassen den
// Eigentuemerkontext durch (Schritt 2 der Triggerfunktionen). Waere die Rolle
// hinter AP14B_APP_DATABASE_URL Mitglied der Eigentuemerrolle oder Superuser,
// liefe jeder Versuch hier durch - und die Faelle wuerden scheitern. Das ist
// gewollt: genau diese Betriebsvoraussetzung nennt Migration 0017 in
// Abschnitt 3b.
//
// ZAEHLWEISE DES AUDITS: RELATIV. V1-V25 haben fuer diese Kennungen bereits
// Auditsaetze erzeugt; ein absoluter Vergleich mit 0 waere schlicht falsch.
// "Kein Auditsatz" heisst hier nachweislich "kein ZUSAETZLICHER Auditsatz":
// gezaehlt wird unmittelbar vor dem Versuch und danach, verglichen wird die
// Differenz.
// --------------------------------------------------------------------------

/**
 * Fuehrt `run` aus und verlangt genau den erwarteten SQLSTATE.
 *
 * Ein Fall, der aus dem FALSCHEN Grund scheitert, ist wertlos - ein
 * `assert.rejects` ohne Codepruefung wuerde etwa eine Rechteverweigerung (42501)
 * mit dem Waechter (KB003) verwechseln. Deshalb wird `error.code` exakt
 * verglichen; jeder andere Wert - und auch ein ausbleibender Fehler - laesst den
 * Fall scheitern. Die Meldung nennt den TATSAECHLICH erhaltenen Code, damit ein
 * Fehlschlag ohne zweiten Lauf lesbar ist, und weder Werte noch Kennungen.
 */
async function assertSqlState(run, expectedCode, label) {
  let caught = null;
  try {
    await run();
  } catch (error) {
    caught = error;
  }

  assert.notEqual(caught, null, `${label}: der rohe Zugriff ist NICHT gescheitert`);
  assert.equal(
    caught.code,
    expectedCode,
    `${label}: erwartet SQLSTATE ${expectedCode}, erhalten ${caught.code ?? "kein SQLSTATE"}`,
  );
}

/**
 * Stellt die Ausgangslage des Reservekontos wieder her.
 *
 * V25 hinterlaesst RESERVE ABSICHTLICH gesperrt und mit neu gesetzter Rolle. Fuer
 * V27 und V29 waere ein bereits gesperrtes Konto toedlich: der Waechter erkennt
 * eine Sperre ueber `new.is_disabled is distinct from old.is_disabled`, ein
 * erneutes `set is_disabled = true` waere also gar keine Aenderung und liefe
 * durch Schritt 1 der Triggerfunktion hindurch - der Fall pruefte dann nichts.
 *
 * Geschrieben wird ueber die ADMIN-Verbindung (Eigentuemerkontext), wie es auch
 * `restoreAdminRole` und `withSoleActiveAdmins` tun; unter app_user waere genau
 * dieser Schreibvorgang jetzt vom Waechter blockiert.
 *
 * Die dabei entstehenden Auditsaetze (`account_enabled`) werden NICHT entfernt:
 * die Faelle dieser Gruppe zaehlen relativ und messen erst ab dem Zeitpunkt
 * unmittelbar vor dem jeweiligen Versuch.
 */
async function restoreReserveBaseline() {
  await admin.query(`update public.auth_accounts set is_disabled = false where id = $1::uuid`, [
    RESERVE.id,
  ]);
  await admin.query(
    `update public.profiles set role = 'monteur'::public.user_role where id = $1::uuid`,
    [RESERVE.id],
  );
}

/** `last_login_at` - in `readAccount` bewusst nicht enthalten, hier gebraucht. */
async function readLastLogin(accountId) {
  const result = await admin.query(
    `select last_login_at from public.auth_accounts where id = $1::uuid`,
    [accountId],
  );
  return result.rows[0]?.last_login_at ?? null;
}

test("V26 Waechter: app_user darf ein Auth-Konto nicht loeschen", options, async () => {
  // Ausgangslage der gesamten Fallgruppe (Begruendung bei restoreReserveBaseline).
  await restoreReserveBaseline();

  // Der Handelnde ist hier ausdruecklich ein GUELTIGER aktiver Administrator.
  // Der Fall misst also nicht die Rolle, sondern das fehlende TABELLENRECHT: das
  // `delete` stammte aus 0012:102 und wird von keiner Modulfunktion gebraucht.
  // Ohne die Ruecknahme aus 0017 (Abschnitt 1a) haette ein DELETE den Schutz des
  // letzten aktiven Administrators vollstaendig umgangen - trg_protect_last_active_admin
  // und die Audittrigger sind AFTER UPDATE und feuern bei einem DELETE gar nicht.
  // Der Benutzer waere samt Profil (Kaskade aus 0012) und ohne einen einzigen
  // Auditsatz verschwunden.
  const auditBefore = await auditCount(RESERVE.id);

  await assertSqlState(
    () =>
      withUserTransaction(ADMIN_A.id, (client) =>
        client.query(`delete from public.auth_accounts where id = $1::uuid`, [RESERVE.id]),
      ),
    "42501",
    "DELETE auf public.auth_accounts unter einem aktiven Administrator",
  );

  // Zwei Nachweise: das Konto steht noch, UND die Kaskade auf public.profiles hat
  // nicht gefeuert.
  assert.notEqual(await readAccount(RESERVE.id), null, "das Konto wurde geloescht");
  assert.notEqual(
    await readRole(RESERVE.id),
    null,
    "das Profil wurde ueber die Kaskade mitgeloescht",
  );
  assert.equal(await auditCount(RESERVE.id), auditBefore);
});

test("V27 Waechter: ein Disponent sperrt kein fremdes Konto", options, async () => {
  const before = await readAccount(RESERVE.id);
  // Vorbedingung des Falls: nur eine echte WERTAENDERUNG erreicht den Waechter.
  assert.equal(before.is_disabled, false, "das Zielkonto ist bereits gesperrt");
  const auditBefore = await auditCount(RESERVE.id);

  await assertSqlState(
    () =>
      withUserTransaction(DISPO.id, (client) =>
        client.query(`update public.auth_accounts set is_disabled = true where id = $1::uuid`, [
          RESERVE.id,
        ]),
      ),
    "KB003",
    "Kontosperre unter der Identitaet eines Disponenten",
  );

  assert.equal((await readAccount(RESERVE.id)).is_disabled, false);
  assert.equal(await auditCount(RESERVE.id), auditBefore);
});

test("V28 Waechter: ein Monteur setzt kein fremdes Kennwort zurueck", options, async () => {
  const before = await readAccount(RESERVE.id);
  const auditBefore = await auditCount(RESERVE.id);

  // Der Hash entsteht zur LAUFZEIT. Ein Hashliteral im Quelltext waere ein
  // hinterlegtes Kennwort - dieselbe Regel wie in setUpFixtures.
  const foreignHash = await hashPassword(TEMPORARY_PASSWORD);

  await assertSqlState(
    () =>
      withUserTransaction(MONTEUR.id, (client) =>
        client.query(
          `update public.auth_accounts
           set password_hash = $2::text,
               password_hash_version = 1,
               must_change_password = true,
               password_changed_at = now()
           where id = $1::uuid`,
          [RESERVE.id, foreignHash],
        ),
      ),
    "KB003",
    "Fremder Passwort-Reset unter der Identitaet eines Monteurs",
  );

  // Schritt 3 der Triggerfunktion erlaubt den EIGENEN Wechsel; hier handelt der
  // Monteur auf einem FREMDEN Konto und faellt deshalb in Schritt 4.
  const after = await readAccount(RESERVE.id);
  assert.equal(after.password_hash, before.password_hash);
  assert.deepEqual(after.password_changed_at, before.password_changed_at);
  assert.equal(after.must_change_password, before.must_change_password);
  assert.equal(await auditCount(RESERVE.id), auditBefore);
});

test("V29 Waechter: Adminrolle allein genuegt nicht", options, async () => {
  // DIE EIGENTLICHE LUECKE, die 0017 schliesst: beide Handelnden tragen die
  // Rolle 'admin'. public.is_admin() (0001_init.sql:59-61) liest ausschliesslich
  // profiles.role und haelt deshalb BEIDE fuer Administratoren - ein inaktives
  // Profil ebenso wie ein gesperrtes Konto. Erst public.is_active_admin_actor()
  // (0017, Abschnitt 3a) prueft alle DREI Bedingungen: role = 'admin',
  // profiles.is_active UND nicht auth_accounts.is_disabled. Genau diese beiden
  // Identitaeten weist die Anwendung in V11 bereits ab; hier wird die
  // Anwendungsschranke bewusst umgangen.
  for (const actor of [ADMIN_INACTIVE, ADMIN_DISABLED]) {
    const before = await readAccount(RESERVE.id);
    assert.equal(before.is_disabled, false, "das Zielkonto ist bereits gesperrt");
    const auditBefore = await auditCount(RESERVE.id);

    await assertSqlState(
      () =>
        withUserTransaction(actor.id, (client) =>
          client.query(`update public.auth_accounts set is_disabled = true where id = $1::uuid`, [
            RESERVE.id,
          ]),
        ),
      "KB003",
      `Kontosperre unter der Identitaet "${actor.name}"`,
    );

    assert.equal((await readAccount(RESERVE.id)).is_disabled, false, actor.name);
    assert.equal(await auditCount(RESERVE.id), auditBefore, actor.name);
  }
});

test("V30 Waechter: Rollenwechsel verlangt einen AKTIVEN Administrator", options, async () => {
  // Der Profilwaechter aus 0017, Abschnitt 3c. VOR dieser Migration waeren beide
  // Versuche GELUNGEN: die Policy profiles_update und der bestehende
  // trg_protect_profile (0001_init.sql:419-434) stuetzen sich allein auf
  // public.is_admin(), und das laesst ein inaktives Profil und ein gesperrtes
  // Konto durch. Der neue Waechter sortiert alphabetisch NACH trg_protect_profile
  // und greift genau in dieser Luecke - fuer einen Nicht-Administrator bleibt es
  // weiterhin bei 42501 aus dem alten Trigger.
  const before = await readRole(RESERVE.id);
  assert.equal(before.role, "monteur");

  for (const actor of [ADMIN_INACTIVE, ADMIN_DISABLED]) {
    const roleAuditBefore = (await auditRows("profiles", RESERVE.id, "role_changed")).length;
    const auditBefore = await auditCount(RESERVE.id);

    await assertSqlState(
      () =>
        withUserTransaction(actor.id, (client) =>
          client.query(
            `update public.profiles set role = 'disponent'::public.user_role where id = $1::uuid`,
            [RESERVE.id],
          ),
        ),
      "KB003",
      `Rollenwechsel unter der Identitaet "${actor.name}"`,
    );

    assert.deepEqual(await readRole(RESERVE.id), before, actor.name);
    assert.equal(
      (await auditRows("profiles", RESERVE.id, "role_changed")).length,
      roleAuditBefore,
      actor.name,
    );
    assert.equal(await auditCount(RESERVE.id), auditBefore, actor.name);
  }
});

test("V31 Normalbetrieb: der Waechter bricht den Anmeldeweg nicht", options, async () => {
  // OHNE DIESEN FALL WAERE DIE NEGATIVREIHE WERTLOS: ein Waechter, der alles
  // abweist, weist auch jede Anmeldung ab. Gemessen wird deshalb ueber die
  // ECHTEN Modulfunktionen, dass die drei Ausnahmen der Triggerfunktion aus
  // Abschnitt 3b tatsaechlich greifen.
  //
  // NICHT WIEDERHOLT WIRD DER EIGENE PASSWORTWECHSEL (Schritt 3 der
  // Triggerfunktion): V5 belegt ihn bereits vollstaendig und unter genau diesen
  // Triggern - changeOwnPassword fuer den Monteur (also ein NICHT administratives
  // Konto) gelingt dort und erzeugt GENAU EINEN Auditsatz 'password_changed' mit
  // actor = MONTEUR. Eine zweite Fassung desselben Nachweises brauchte nur ein
  // weiteres Kennwort und beliese es beim selben Aussagewert.
  const resetAuditBefore = (
    await auditRows("auth_accounts", MONTEUR.id, "password_reset_by_admin")
  ).length;
  const changedAuditBefore = (await auditRows("auth_accounts", MONTEUR.id, "password_changed"))
    .length;

  // a) Fehlversuch: setzt failed_attempts und locked_until und beruehrt weder
  //    is_disabled noch ein Passwortfeld - Schritt 1 der Triggerfunktion laesst
  //    ihn durch. Bricht der Waechter hier, waere die Anmeldung unbenutzbar.
  const beforeFailed = await readAccount(MONTEUR.id);
  const failed = await authenticateCredentials(MONTEUR.email, START_PASSWORD, LOGIN_CONTEXT);
  assert.equal(failed, null, "ein falsches Kennwort authentifiziert");

  const afterFailed = await readAccount(MONTEUR.id);
  assert.equal(
    afterFailed.failed_attempts,
    beforeFailed.failed_attempts + 1,
    "der Fehlversuchszaehler wurde nicht erhoeht",
  );
  // Ein einzelner Fehlversuch sperrt noch nicht (MAX_FAILED_ATTEMPTS = 5).
  assert.equal(afterFailed.locked_until, null);
  assert.equal(afterFailed.password_hash, beforeFailed.password_hash);

  // b) Erfolgreiche Anmeldung: schreibt last_login_at und stellt Zaehler und
  //    Sperre zurueck. Der Hash steht wegen `coalesce($2::text, password_hash)`
  //    IMMER in der SET-Liste - der Waechter prueft deshalb auf WERTAENDERUNG.
  const loginBefore = await readLastLogin(MONTEUR.id);
  const session = await authenticateCredentials(MONTEUR.email, OWN_PASSWORD, LOGIN_CONTEXT);
  assert.ok(session, "die Anmeldung mit dem gueltigen Kennwort scheitert");
  assert.equal(session.userId, MONTEUR.id);

  const afterLogin = await readAccount(MONTEUR.id);
  assert.equal(afterLogin.failed_attempts, 0, "der Fehlversuchszaehler wurde nicht zurueckgesetzt");
  assert.equal(afterLogin.locked_until, null);

  const loginAfter = await readLastLogin(MONTEUR.id);
  assert.ok(loginAfter instanceof Date, String(loginAfter));
  assert.ok(
    loginBefore === null || loginAfter.getTime() > loginBefore.getTime(),
    "last_login_at wurde nicht nachgezogen",
  );

  // d) Weder a) noch b) darf als Passwortvorgang im Audit erscheinen - schon gar
  //    nicht als administrativer Reset. Gezaehlt wird wieder relativ: V4 und V5
  //    haben fuer dieses Konto je einen Satz erzeugt.
  assert.equal(
    (await auditRows("auth_accounts", MONTEUR.id, "password_reset_by_admin")).length,
    resetAuditBefore,
    "der Anmeldebetrieb hat einen administrativen Reset auditiert",
  );
  assert.equal(
    (await auditRows("auth_accounts", MONTEUR.id, "password_changed")).length,
    changedAuditBefore,
    "der Anmeldebetrieb hat einen Passwortwechsel auditiert",
  );

  // Zustandshygiene der gesamten Fallgruppe: kein Fall hat RESERVE veraendert -
  // die Waechter haben jeden Versuch zurueckgerollt. Der Nachweis steht hier
  // ausdruecklich, weil ein gesperrtes oder umgerolltes Reservekonto jeden
  // Wiederholungslauf ab V27 still entwerten wuerde.
  const reserve = await readAccount(RESERVE.id);
  assert.equal(reserve.is_disabled, false, "RESERVE bleibt gesperrt zurueck");
  assert.equal((await readRole(RESERVE.id)).role, "monteur", "RESERVE bleibt umgerollt zurueck");
});
