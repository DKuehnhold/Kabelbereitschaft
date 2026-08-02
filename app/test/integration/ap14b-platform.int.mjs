// AP14/B Integrationstests gegen ein synthetisches PostgreSQL 18.
//
// Lauf (siehe app/supabase/test/run_ap14b_local.ps1, Schritt "Integrationstests"):
//   AP14B_APP_DATABASE_URL=...   Verbindung der Anwendung (Rolle erbt app_user,
//                                kein SUPERUSER, kein BYPASSRLS)
//   AP14B_ADMIN_DATABASE_URL=... Verbindung der Migrations-/Eigentuemerrolle,
//                                ausschliesslich fuer Fixtures und Gegenproben
//   node --import ./test/integration/module-hooks.mjs \
//        test/integration/ap14b-platform.int.mjs
//
// Ohne diese beiden Variablen werden alle Pruefungen uebersprungen; die Datei
// ist damit in einer Umgebung ohne Datenbank harmlos.
//
// Geprueft wird der ECHTE Anwendungscode (`src/lib/db`, `src/lib/auth-service`,
// `scripts/bootstrap-admin.mjs`), nicht eine Nachbildung. Es kommen
// ausschliesslich synthetische Werte vor.

import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { Client } from "pg";

const APP_URL = process.env.AP14B_APP_DATABASE_URL?.trim();
const ADMIN_URL = process.env.AP14B_ADMIN_DATABASE_URL?.trim();
const ENABLED = Boolean(APP_URL && ADMIN_URL);

// Muss vor der ersten Abfrage stehen: der Pool in src/lib/db liest die Variable
// beim ersten Verbindungsaufbau.
if (ENABLED) process.env.DATABASE_URL = APP_URL;

const { withUserTransaction } = await import("../../src/lib/db/index.ts");
const {
  authenticateCredentials,
  changeOwnPassword,
  revokeAllSessionsForAccount,
  revokeSession,
  validateSession,
  SessionRevokeDeniedError,
} = await import("../../src/lib/auth-service.ts");
const { MIN_PASSWORD_LENGTH, hashPassword, verifyPassword } = await import(
  "../../src/lib/auth-password.ts"
);
const { PASSWORD_CHANGE_PATH, evaluateAccess } = await import(
  "../../src/lib/auth-paths.ts"
);

const APP_ROOT = new URL("../../", import.meta.url);

// --------------------------------------------------------------------------
// Synthetische Fixtures
// --------------------------------------------------------------------------

const DISPO = {
  id: "ac140b00-0000-0000-0000-0000000000d1",
  email: "i1.disponent@beispiel.invalid",
  name: "I1 Disponent",
  role: "disponent",
  active: true,
};
const MONTEUR = {
  id: "ac140b00-0000-0000-0000-0000000000d2",
  email: "i1.monteur@beispiel.invalid",
  name: "I1 Monteur",
  role: "monteur",
  active: true,
};
const ADMIN = {
  id: "ac140b00-0000-0000-0000-0000000000a1",
  email: "i1.admin@beispiel.invalid",
  name: "I1 Administrator",
  role: "admin",
  active: true,
};
const ADMIN_INACTIVE = {
  id: "ac140b00-0000-0000-0000-0000000000a2",
  email: "i1.admin.inaktiv@beispiel.invalid",
  name: "I1 Administrator inaktiv",
  role: "admin",
  active: false,
};
/** Konto mit erzwungenem Passwortwechsel (ADR-011 / 2.3). */
const CHANGER = {
  id: "ac140b00-0000-0000-0000-0000000000c1",
  email: "i1.wechsel@beispiel.invalid",
  name: "I1 Wechsel",
  role: "disponent",
  active: true,
};
/** Konto mit Wechselzwang, dessen Profil deaktiviert ist. */
const CHANGER_INACTIVE = {
  id: "ac140b00-0000-0000-0000-0000000000c2",
  email: "i1.wechsel.inaktiv@beispiel.invalid",
  name: "I1 Wechsel inaktiv",
  role: "monteur",
  active: false,
};
/** Konto mit Wechselzwang, dessen Auth-Konto deaktiviert ist. */
const CHANGER_DISABLED = {
  id: "ac140b00-0000-0000-0000-0000000000c3",
  email: "i1.wechsel.gesperrt@beispiel.invalid",
  name: "I1 Wechsel gesperrt",
  role: "monteur",
  active: true,
};

const FIXTURES = [
  DISPO,
  MONTEUR,
  ADMIN,
  ADMIN_INACTIVE,
  CHANGER,
  CHANGER_INACTIVE,
  CHANGER_DISABLED,
];

/**
 * Synthetische Passwoerter des Wechseltests. Sie kommen ausschliesslich hier vor,
 * gelten fuer keinen echten Zugang und erfuellen die zentralen Regeln.
 */
const OLD_PASSWORD = "Synthetisches-Uebergangskennwort-2026!";
const NEW_PASSWORD = "Synthetisches-Neukennwort-2026!";

/** Geschuetzte Routen, die ein Konto mit Wechselzwang nicht erreichen darf. */
const PROTECTED_PATHS = [
  "/",
  "/dashboard",
  "/vorgaenge",
  "/vorgaenge/neu",
  "/benutzer",
  "/bestand",
  "/export",
  "/lager",
  "/material",
  "/meine-einsaetze",
  "/stammdaten/kunden",
  "/api/sync",
  "/api/images/upload",
];

/** Platzhalter aus Migration 0012: absichtlich kein anmeldefaehiger Hash. */
const MARKER = "!MIGRATED-ACCOUNT-REQUIRES-RESET!";

const BOOTSTRAP_EMAIL = "i1.bootstrap@beispiel.invalid";
const BOOTSTRAP_SECOND_EMAIL = "i1.bootstrap.zweiter@beispiel.invalid";
const BOOTSTRAP_PASSWORD = "Synthetisches-Bootstrap-Kennwort-2026!";

let admin;

// --------------------------------------------------------------------------
// Hilfsmittel (alle ueber die Eigentuemerrolle - Gegenprobe, nicht Prueflauf)
// --------------------------------------------------------------------------

async function setUpFixtures() {
  for (const person of FIXTURES) {
    await admin.query(
      `insert into public.auth_accounts (id, email, password_hash, must_change_password)
       values ($1::uuid, $2::text, $3::text, false)
       on conflict (id) do update set email = excluded.email`,
      [person.id, person.email, MARKER],
    );
    await admin.query(
      `insert into public.profiles (id, full_name, role, is_active)
       values ($1::uuid, $2::text, $3::public.user_role, $4::boolean)
       on conflict (id) do update
         set role = excluded.role, is_active = excluded.is_active`,
      [person.id, person.name, person.role, person.active],
    );
  }

  // Die drei Wechselkonten erhalten ein echtes, ueber die ZENTRALE
  // Implementierung erzeugtes Argon2id-Uebergangspasswort und den Wechselzwang.
  // Der Hash entsteht hier und nicht als Literal: ein festes Hashliteral im
  // Quelltext waere ein hinterlegtes Kennwort.
  const transitionalHash = await hashPassword(OLD_PASSWORD);
  for (const person of [CHANGER, CHANGER_INACTIVE, CHANGER_DISABLED]) {
    await admin.query(
      `update public.auth_accounts
       set password_hash = $2::text,
           password_hash_version = 1,
           must_change_password = true,
           password_changed_at = null,
           is_disabled = $3::boolean,
           failed_attempts = 0,
           locked_until = null
       where id = $1::uuid`,
      [person.id, transitionalHash, person === CHANGER_DISABLED],
    );
  }
  // Der Wechsel-Audittrigger reagiert auf password_changed_at; die Fixture setzt
  // ihn auf NULL und hinterlaesst damit keinen Auditsatz.
  await admin.query(
    `delete from public.audit_events
     where entity = 'auth_accounts' and entity_id = any($1::uuid[])`,
    [[CHANGER.id, CHANGER_INACTIVE.id, CHANGER_DISABLED.id]],
  );
}

async function tearDownFixtures() {
  const ids = FIXTURES.map((person) => person.id);
  await admin.query(
    `delete from public.auth_sessions where account_id = any($1::uuid[])`,
    [ids],
  );
  await admin.query(`delete from public.audit_events where actor = any($1::uuid[])`, [ids]);
  await admin.query(
    `delete from public.audit_events where entity_id = any($1::uuid[])`,
    [ids],
  );
  // Der Passwortwechsel laeuft MIT gesetzter Identitaet; tg_touch_updated()
  // schreibt dann auth_accounts.updated_by. Ohne dieses Loesen scheitert das
  // Loeschen des Profils am Fremdschluessel. Der Trigger setzt den Wert aus der
  // aktuellen Identitaet - hier ist keine gesetzt, also NULL.
  await admin.query(
    `update public.auth_accounts set updated_by = null where id = any($1::uuid[])`,
    [ids],
  );
  // Der im Bootstrap-Test angelegte Administrator wird ebenfalls entfernt:
  // sonst waere die Ausgangslage fuer einen weiteren Lauf verbraucht.
  await admin.query(
    `delete from public.auth_sessions
     where account_id in (
       select id from public.auth_accounts where lower(email) = any($1::text[])
     )`,
    [[BOOTSTRAP_EMAIL, BOOTSTRAP_SECOND_EMAIL]],
  );
  await admin.query(
    `delete from public.profiles
     where id in (
       select id from public.auth_accounts where lower(email) = any($1::text[])
     )`,
    [[BOOTSTRAP_EMAIL, BOOTSTRAP_SECOND_EMAIL]],
  );
  await admin.query(`delete from public.auth_accounts where lower(email) = any($1::text[])`, [
    [BOOTSTRAP_EMAIL, BOOTSTRAP_SECOND_EMAIL],
  ]);
  await admin.query(`delete from public.profiles where id = any($1::uuid[])`, [ids]);
  await admin.query(`delete from public.auth_accounts where id = any($1::uuid[])`, [ids]);
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

async function isRevoked(sessionId) {
  const result = await admin.query(
    `select revoked_at is not null as revoked from public.auth_sessions where id = $1::uuid`,
    [sessionId],
  );
  return result.rows[0].revoked;
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

async function tableExists(name) {
  const result = await admin.query(`select to_regclass($1::text) is not null as present`, [
    `public.${name}`,
  ]);
  return result.rows[0].present;
}

async function usableAdminCount() {
  const result = await admin.query(
    `select count(*)::integer as usable
     from public.auth_accounts a
     join public.profiles p on p.id = a.id
     where p.role = 'admin' and p.is_active and not a.is_disabled
       and a.password_hash like '$argon2id$%'`,
  );
  return result.rows[0].usable;
}

async function readAccount(email) {
  const result = await admin.query(
    `select a.id, a.password_hash, a.must_change_password, a.password_hash_version,
            p.role::text as role, p.is_active, p.full_name
     from public.auth_accounts a
     left join public.profiles p on p.id = a.id
     where lower(a.email) = $1::text`,
    [email],
  );
  return result.rows[0] ?? null;
}

/** Startet das Bootstrap-Werkzeug und uebergibt das Kennwort ueber stdin. */
function runBootstrap(args, password) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
        "scripts/bootstrap-admin.mjs",
        ...args,
      ],
      {
        cwd: fileURLToPath(APP_ROOT),
        env: { ...process.env, BOOTSTRAP_DATABASE_URL: ADMIN_URL },
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
    child.stdin.end(`${password}\n`);
  });
}

/**
 * Anweisungstext des Kindprozesses fuer die Startgate-Probe.
 *
 * Er oeffnet GENAU EINE Transaktion ueber die Fassade aus src/lib/db und meldet
 * das Ergebnis. Der Fehler wird ausdruecklich gefangen und ausgegeben, damit der
 * Exitcode bestimmt ist und die vollstaendige Meldung samt Aufrufkette geprueft
 * werden kann - auch daraufhin, was sie NICHT enthaelt.
 */
const PROBE_SOURCE = `
const { withUserTransaction } = await import(${JSON.stringify(
  new URL("../../src/lib/db/index.ts", import.meta.url).href,
)});
try {
  await withUserTransaction(${JSON.stringify(DISPO.id)}, (client) =>
    client.query("select 1 as eins"),
  );
  console.log("STARTGATE-PASSIERT");
} catch (error) {
  console.error(error);
  process.exitCode = 7;
} finally {
  await globalThis.__kabelbereitschaftPool?.end();
}
`;

/**
 * Startet einen KINDPROZESS, der die Fassade mit der uebergebenen Verbindung
 * benutzt.
 *
 * Warum ein Kindprozess und nicht ein Aufruf hier: das Startgate laeuft je
 * Prozess genau EINMAL und behaelt sein Ergebnis. Im Testprozess selbst ist es
 * mit AP14B_APP_DATABASE_URL bereits entschieden; eine zweite Rolle liesse sich
 * hier gar nicht mehr messen. Dasselbe Muster benutzt bereits `runBootstrap`.
 */
function runFacadeProbe(databaseUrl) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
        // Dieselben Aufloesungsregeln wie im Testlauf: "server-only" und die
        // dateiendungslosen Importe der .ts-Module.
        "--import",
        new URL("./module-hooks.mjs", import.meta.url).href,
        "--input-type=module",
        "--eval",
        PROBE_SOURCE,
      ],
      {
        cwd: fileURLToPath(APP_ROOT),
        // Die Verbindung geht als Umgebungsvariable und NICHT als Argument: ein
        // Argument stuende in der Prozessliste und damit ein Kennwort.
        env: { ...process.env, DATABASE_URL: databaseUrl },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
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

const options = { skip: ENABLED ? false : "AP14B_APP_DATABASE_URL/AP14B_ADMIN_DATABASE_URL fehlen" };

// --------------------------------------------------------------------------
// 1) Mehrfachanweisung
// --------------------------------------------------------------------------

test("I1 Mehrfachanweisung: Luecke im Simple-Query-Protokoll ist real", options, async () => {
  // Ohne diesen Nachweis bliebe offen, ob die Absicherung ueberhaupt etwas
  // verhindert. `pg` waehlt bei leerer Werteliste das Simple-Query-Protokoll,
  // und darin fuehrt PostgreSQL BEIDE Anweisungen aus.
  await admin.query("drop table if exists public.zz_ap14b_simple");
  await admin.query("select 1; create table public.zz_ap14b_simple (x integer)");
  assert.equal(await tableExists("zz_ap14b_simple"), true);
  await admin.query("drop table public.zz_ap14b_simple");
});

test("I2 Mehrfachanweisung: Extended-Query-Protokoll fuehrt sie nicht aus", options, async () => {
  await assert.rejects(
    () =>
      admin.query({
        text: "select 1; create table public.zz_ap14b_extended (x integer)",
        values: [],
        queryMode: "extended",
      }),
    /multiple commands/i,
  );
  assert.equal(await tableExists("zz_ap14b_extended"), false);
});

test("I3 Mehrfachanweisung: der Wrapper weist sie vor dem SQL-Lauf ab", options, async () => {
  await assert.rejects(
    () =>
      withUserTransaction(DISPO.id, (client) =>
        client.query("select 1; create table public.zz_ap14b_wrapper (x integer)"),
      ),
    /Mehrere Anweisungen/,
  );
  assert.equal(await tableExists("zz_ap14b_wrapper"), false);
});

test("I4 Mehrfachanweisung kann die Identitaet nicht uebernehmen", options, async () => {
  // Der eigentliche Angriff: eine angehaengte Sitzungseinstellung wuerde die
  // transaktionslokale Identitaet auf ein fremdes Konto umstellen.
  const identity = await withUserTransaction(DISPO.id, async (client) => {
    // Der Thunk ist ausdruecklich `async`: `assert.rejects` gibt einen SYNCHRON
    // geworfenen Fehler unveraendert weiter, statt ihn zu pruefen. Der Wrapper
    // liefert die Verletzung inzwischen als abgelehntes Promise; die Huelle
    // haelt den Test unabhaengig davon korrekt.
    await assert.rejects(
      async () =>
        client.query(`select 1; select set_config('app.user_id', $1::text, true)`, [MONTEUR.id]),
      /Mehrere Anweisungen/,
    );
    // Die Transaktion ist unbeschaedigt - abgewiesen wurde vor dem Senden.
    const result = await client.query("select app.current_user_id() as id");
    return result.rows[0].id;
  });
  assert.equal(identity, DISPO.id);
});

// --------------------------------------------------------------------------
// 2) Einzelwiderruf nur der eigenen Sitzung
// --------------------------------------------------------------------------

test("I5 revokeSession widerruft eine fremde Sitzung nicht", options, async () => {
  const foreign = await createSession(MONTEUR.id);

  assert.equal(await revokeSession(DISPO.id, foreign, "signout"), false);
  assert.equal(await isRevoked(foreign), false);

  // Auch kein Auditeintrag: es wurde nichts geaendert.
  const audit = await admin.query(
    `select count(*)::integer as rows from public.audit_events
     where entity = 'auth_sessions' and entity_id = $1::uuid`,
    [foreign],
  );
  assert.equal(audit.rows[0].rows, 0);
});

test("I6 revokeSession widerruft die eigene Sitzung, auditiert und idempotent", options, async () => {
  const own = await createSession(DISPO.id);

  assert.equal(await revokeSession(DISPO.id, own, "signout"), true);
  assert.equal(await isRevoked(own), true);
  assert.equal(await revokeSession(DISPO.id, own, "signout"), false);

  const audit = await admin.query(
    `select actor, detail->>'reason' as reason
     from public.audit_events
     where entity = 'auth_sessions' and entity_id = $1::uuid and action = 'revoke'`,
    [own],
  );
  assert.equal(audit.rows.length, 1);
  assert.equal(audit.rows[0].actor, DISPO.id);
  assert.equal(audit.rows[0].reason, "signout");
});

test("I7 revokeSession bricht bei unbrauchbarer Kennung ab", options, async () => {
  const own = await createSession(DISPO.id);
  await assert.rejects(() => revokeSession(DISPO.id, "keine-uuid"), /Sitzungs-ID/);
  await assert.rejects(() => revokeSession("keine-uuid", own), /Benutzer-ID/);
  assert.equal(await isRevoked(own), false);
});

// --------------------------------------------------------------------------
// 3) Massenwiderruf
// --------------------------------------------------------------------------

test("I8 Massenwiderruf: Selbstwiderruf ist zulaessig", options, async () => {
  await createSession(DISPO.id);
  await createSession(DISPO.id);
  const revoked = await revokeAllSessionsForAccount(DISPO.id, DISPO.id, "password_changed");
  assert.ok(revoked >= 2, `nur ${revoked} Sitzung(en) widerrufen`);
  assert.equal(await openSessionCount(DISPO.id), 0);
});

test("I9 Massenwiderruf: ohne Adminrolle scheitert er fail-closed", options, async () => {
  const foreign = await createSession(MONTEUR.id);
  // Verglichen wird gegen den Stand VOR dem Aufruf und nicht gegen eine feste
  // Zahl: I5 laesst bewusst eine offene Fremdsitzung zurueck (dort ist genau
  // das der Nachweis). Eine feste Erwartung wuerde diesen Test an die
  // Ausfuehrungsreihenfolge binden, ohne mehr zu belegen.
  const openBefore = await openSessionCount(MONTEUR.id);

  await assert.rejects(
    () => revokeAllSessionsForAccount(DISPO.id, MONTEUR.id, "admin_forced"),
    (error) => {
      assert.ok(error instanceof SessionRevokeDeniedError, error?.name);
      return true;
    },
  );
  assert.equal(await isRevoked(foreign), false);
  // Fail-closed heisst: KEINE Sitzung wurde angetastet.
  assert.equal(await openSessionCount(MONTEUR.id), openBefore);
});

test("I10 Massenwiderruf: ein inaktiver Administrator scheitert ebenfalls", options, async () => {
  const foreign = await createSession(MONTEUR.id);
  await assert.rejects(
    () => revokeAllSessionsForAccount(ADMIN_INACTIVE.id, MONTEUR.id, "admin_forced"),
    SessionRevokeDeniedError,
  );
  assert.equal(await isRevoked(foreign), false);
});

test("I11 Massenwiderruf: ein aktiver Administrator darf fremde Sitzungen beenden", options, async () => {
  await createSession(MONTEUR.id);
  const openBefore = await openSessionCount(MONTEUR.id);
  assert.ok(openBefore >= 1);

  const revoked = await revokeAllSessionsForAccount(ADMIN.id, MONTEUR.id, "admin_forced");
  assert.equal(revoked, openBefore);
  assert.equal(await openSessionCount(MONTEUR.id), 0);

  // Urheber ist der Administrator, nicht das betroffene Konto.
  const audit = await admin.query(
    `select count(*)::integer as rows
     from public.audit_events
     where entity = 'auth_sessions' and action = 'revoke'
       and actor = $1::uuid and detail->>'reason' = 'admin_forced'`,
    [ADMIN.id],
  );
  assert.equal(audit.rows[0].rows, revoked);
});

test("I12 Massenwiderruf: die Rolle stammt nicht aus dem Aufruf", options, async () => {
  // Es gibt keinen Rollenparameter - der Beweis ist die Signatur. Zusaetzlich:
  // eine unbrauchbare Konto-ID bricht ab, bevor SQL laeuft.
  assert.equal(revokeAllSessionsForAccount.length, 3);
  await assert.rejects(
    () => revokeAllSessionsForAccount(ADMIN.id, "keine-uuid", "admin_forced"),
    /Konto-ID/,
  );
});

// --------------------------------------------------------------------------
// 4) Bootstrap des ersten Administrators
// --------------------------------------------------------------------------

test("I13 Bootstrap: Ausgangslage ist leer im Sinne von ADR-011 / 2.11", options, async () => {
  assert.equal(
    await usableAdminCount(),
    0,
    "Es besteht bereits ein anmeldefaehiger Administrator; das Bootstrap waere nicht pruefbar.",
  );
});

test("I14 Bootstrap: legt genau einen Administrator an", options, async () => {
  const result = await runBootstrap(
    ["--email", BOOTSTRAP_EMAIL, "--name", "I1 Bootstrap"],
    BOOTSTRAP_PASSWORD,
  );
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /angelegt/);

  const account = await readAccount(BOOTSTRAP_EMAIL);
  assert.ok(account, "Konto fehlt");
  assert.ok(account.password_hash.startsWith("$argon2id$"), account.password_hash.slice(0, 12));
  assert.equal(await verifyPassword(account.password_hash, BOOTSTRAP_PASSWORD), true);
  assert.equal(await verifyPassword(account.password_hash, `${BOOTSTRAP_PASSWORD}x`), false);
  assert.equal(account.role, "admin");
  assert.equal(account.is_active, true);
  assert.equal(account.must_change_password, false);
  assert.equal(account.password_hash_version, 1);
  assert.equal(account.full_name, "I1 Bootstrap");
});

test("I15 Bootstrap: kein Klartext in Ausgabe, Konto oder Audit", options, async () => {
  const inAccounts = await admin.query(
    `select count(*)::integer as hits from public.auth_accounts
     where password_hash like '%' || $1::text || '%'`,
    [BOOTSTRAP_PASSWORD],
  );
  assert.equal(inAccounts.rows[0].hits, 0);

  const inAudit = await admin.query(
    `select count(*)::integer as hits from public.audit_events
     where detail::text like '%' || $1::text || '%'`,
    [BOOTSTRAP_PASSWORD],
  );
  assert.equal(inAudit.rows[0].hits, 0);
});

test("I16 Bootstrap: erneuter Lauf ist ein unveraenderter Leerlauf", options, async () => {
  const before = await readAccount(BOOTSTRAP_EMAIL);
  const result = await runBootstrap(["--email", BOOTSTRAP_EMAIL], BOOTSTRAP_PASSWORD);
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Unveraendert/);

  const after = await readAccount(BOOTSTRAP_EMAIL);
  assert.equal(after.password_hash, before.password_hash);
  assert.equal(after.id, before.id);
});

test("I17 Bootstrap: ein zweiter Administrator wird verweigert", options, async () => {
  const result = await runBootstrap(
    ["--email", BOOTSTRAP_SECOND_EMAIL],
    BOOTSTRAP_PASSWORD,
  );
  assert.equal(result.code, 3, `Exit ${result.code}: ${result.stdout}${result.stderr}`);
  assert.match(result.stderr, /anmeldefaehiger Administrator/);
  assert.equal(await readAccount(BOOTSTRAP_SECOND_EMAIL), null);
});

test("I18 Bootstrap: zu kurzes Kennwort wird abgewiesen", options, async () => {
  const result = await runBootstrap(["--email", "i1.zu.kurz@beispiel.invalid"], "kurz");
  assert.equal(result.code, 2, result.stderr);
  assert.match(result.stderr, /mindestens/);
  assert.equal(await readAccount("i1.zu.kurz@beispiel.invalid"), null);
});

test("I19 Bootstrap: fehlende Verbindungsangabe bricht ab", options, async () => {
  const result = await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
        "scripts/bootstrap-admin.mjs",
        "--email",
        "i1.ohne.verbindung@beispiel.invalid",
      ],
      {
        cwd: fileURLToPath(APP_ROOT),
        env: { ...process.env, BOOTSTRAP_DATABASE_URL: "" },
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stderr }));
    child.stdin.end(`${BOOTSTRAP_PASSWORD}\n`);
  });
  assert.equal(result.code, 1);
  assert.match(result.stderr, /BOOTSTRAP_DATABASE_URL/);
});

// --------------------------------------------------------------------------
// 5) Erzwungener Passwortwechsel (ADR-011 / 2.3, Pflichtnachweis 2.12 e)
//
// Geprueft wird der ECHTE Anwendungscode gegen die ECHTE Datenbank: der
// Wechselzwang wird aus `public.auth_accounts` gelesen, durch
// `validateSession()` transportiert und entscheidet die Routenweiche.
// --------------------------------------------------------------------------

/** Kontozustand fuer die Gegenproben; liest ueber die Eigentuemerrolle. */
async function readChangeState(accountId) {
  const result = await admin.query(
    `select password_hash, password_hash_version, must_change_password,
            password_changed_at, is_disabled, failed_attempts, locked_until
     from public.auth_accounts
     where id = $1::uuid`,
    [accountId],
  );
  return result.rows[0] ?? null;
}

async function passwordChangeAuditCount(accountId) {
  const result = await admin.query(
    `select count(*)::integer as rows
     from public.audit_events
     where entity = 'auth_accounts' and entity_id = $1::uuid
       and action = 'password_changed'`,
    [accountId],
  );
  return result.rows[0].rows;
}

test(
  "I20 ADR-011/2.12(e): must_change_password sperrt aus der Datenbank heraus jede andere Route",
  options,
  async () => {
    // Der Wert kommt nicht aus dem Test, sondern aus der Datenbank - ueber
    // dieselbe Auswertung, die jeder geschuetzte Request durchlaeuft.
    const sessionId = await createSession(CHANGER.id);
    const validated = await validateSession(CHANGER.id, sessionId);
    assert.ok(validated, "gueltige Sitzung wird nicht erkannt");
    assert.equal(validated.mustChangePassword, true);

    for (const path of PROTECTED_PATHS) {
      assert.equal(
        evaluateAccess({
          path,
          isSignedIn: true,
          mustChangePassword: validated.mustChangePassword,
        }),
        "to-password-change",
        path,
      );
    }
    // Offen bleiben ausschliesslich der Wechselpfad, die Auth-Endpunkte und die
    // Abmeldung - sonst waere das Konto handlungsunfaehig.
    for (const path of [PASSWORD_CHANGE_PATH, "/api/auth/session", "/auth/signout"]) {
      assert.equal(
        evaluateAccess({
          path,
          isSignedIn: true,
          mustChangePassword: validated.mustChangePassword,
        }),
        "allow",
        path,
      );
    }
  },
);

test("I21 Passwortwechsel: falsches aktuelles Passwort aendert nichts", options, async () => {
  const before = await readChangeState(CHANGER.id);
  const sessionId = await createSession(CHANGER.id);

  const outcome = await changeOwnPassword(CHANGER.id, `${OLD_PASSWORD}x`, NEW_PASSWORD);
  assert.equal(outcome.kind, "rejected");

  const after = await readChangeState(CHANGER.id);
  assert.equal(after.password_hash, before.password_hash);
  assert.equal(after.must_change_password, true);
  assert.equal(after.password_changed_at, null);
  assert.equal(await isRevoked(sessionId), false, "Sitzung wurde faelschlich beendet");
  assert.equal(await passwordChangeAuditCount(CHANGER.id), 0);
});

test("I22 Passwortwechsel: zu kurzes neues Passwort wird abgewiesen", options, async () => {
  const before = await readChangeState(CHANGER.id);
  const tooShort = "a".repeat(MIN_PASSWORD_LENGTH - 1);

  const outcome = await changeOwnPassword(CHANGER.id, OLD_PASSWORD, tooShort);
  assert.equal(outcome.kind, "rule");
  assert.equal(outcome.violation, "too_short");

  const after = await readChangeState(CHANGER.id);
  assert.equal(after.password_hash, before.password_hash);
  assert.equal(after.must_change_password, true);
});

test("I23 Passwortwechsel: derselbe Wert ist kein Wechsel", options, async () => {
  // Sonst liesse sich der Wechselzwang aufheben, ohne das Uebergangspasswort zu
  // ersetzen.
  const before = await readChangeState(CHANGER.id);
  const outcome = await changeOwnPassword(CHANGER.id, OLD_PASSWORD, OLD_PASSWORD);
  assert.equal(outcome.kind, "unchanged");

  const after = await readChangeState(CHANGER.id);
  assert.equal(after.password_hash, before.password_hash);
  assert.equal(after.must_change_password, true);
});

test("I24 Passwortwechsel: deaktiviertes Konto und inaktives Profil bleiben fail-closed", options, async () => {
  for (const person of [CHANGER_DISABLED, CHANGER_INACTIVE]) {
    const before = await readChangeState(person.id);
    const outcome = await changeOwnPassword(person.id, OLD_PASSWORD, NEW_PASSWORD);
    assert.equal(outcome.kind, "rejected", person.email);

    const after = await readChangeState(person.id);
    assert.equal(after.password_hash, before.password_hash, person.email);
    assert.equal(after.must_change_password, true, person.email);
    assert.equal(await passwordChangeAuditCount(person.id), 0, person.email);
  }
});

test("I25 Passwortwechsel: unbrauchbare Benutzer-ID bricht vor dem SQL-Lauf ab", options, async () => {
  await assert.rejects(
    () => changeOwnPassword("keine-uuid", OLD_PASSWORD, NEW_PASSWORD),
    /Benutzer-ID/,
  );
});

test("I26 Passwortwechsel: ein Datenbankfehler rollt alles zurueck", options, async () => {
  // Echter, nicht nachgebildeter Fehlerfall: dem Anwendungsbenutzer wird das
  // Recht entzogen, Sitzungen zu widerrufen. Der Wechsel darf dann NICHT nur den
  // Hash aendern - sonst waere `must_change_password` aufgehoben, waehrend die
  // alten Sitzungen weiterlaufen.
  const before = await readChangeState(CHANGER.id);
  const sessionId = await createSession(CHANGER.id);
  await admin.query("revoke update on public.auth_sessions from app_user");
  try {
    await assert.rejects(
      () => changeOwnPassword(CHANGER.id, OLD_PASSWORD, NEW_PASSWORD),
      // Geprueft wird der SQLSTATE und nicht der Meldungstext: der ist
      // sprachabhaengig (42501 = insufficient_privilege).
      (error) => {
        assert.equal(error?.code, "42501", `SQLSTATE ${error?.code}: ${error?.message}`);
        return true;
      },
    );
  } finally {
    await admin.query("grant update on public.auth_sessions to app_user");
  }

  const after = await readChangeState(CHANGER.id);
  assert.equal(after.password_hash, before.password_hash, "Hash wurde nicht zurueckgerollt");
  assert.equal(after.must_change_password, true);
  assert.equal(after.password_changed_at, null);
  assert.equal(await isRevoked(sessionId), false);
  assert.equal(await passwordChangeAuditCount(CHANGER.id), 0);
});

test("I27 Passwortwechsel: Erfolg aendert Hash, hebt den Zwang auf und beendet alle Sitzungen", options, async () => {
  await createSession(CHANGER.id);
  await createSession(CHANGER.id);
  const openBefore = await openSessionCount(CHANGER.id);
  assert.ok(openBefore >= 2, `nur ${openBefore} offene Sitzung(en)`);
  const before = await readChangeState(CHANGER.id);

  const outcome = await changeOwnPassword(CHANGER.id, OLD_PASSWORD, NEW_PASSWORD);
  assert.equal(outcome.kind, "changed");
  assert.equal(outcome.revokedSessions, openBefore);

  const after = await readChangeState(CHANGER.id);
  assert.notEqual(after.password_hash, before.password_hash);
  assert.ok(after.password_hash.startsWith("$argon2id$"), after.password_hash.slice(0, 12));
  assert.equal(await verifyPassword(after.password_hash, NEW_PASSWORD), true);
  assert.equal(await verifyPassword(after.password_hash, OLD_PASSWORD), false);
  assert.equal(after.must_change_password, false);
  assert.equal(after.password_hash_version, 1);
  assert.ok(after.password_changed_at instanceof Date, String(after.password_changed_at));
  assert.equal(after.failed_attempts, 0);
  assert.equal(after.locked_until, null);

  // Keine Sitzung bleibt offen: die erneute Anmeldung ist zwingend.
  assert.equal(await openSessionCount(CHANGER.id), 0);
});

test("I28 Passwortwechsel: Widerruf und Wechsel sind vollstaendig auditiert", options, async () => {
  assert.equal(await passwordChangeAuditCount(CHANGER.id), 1);

  const changeAudit = await admin.query(
    `select actor, detail
     from public.audit_events
     where entity = 'auth_accounts' and entity_id = $1::uuid
       and action = 'password_changed'`,
    [CHANGER.id],
  );
  assert.equal(changeAudit.rows.length, 1);
  assert.equal(changeAudit.rows[0].actor, CHANGER.id);
  assert.equal(changeAudit.rows[0].detail.must_change_password, false);

  const revokeAudit = await admin.query(
    `select count(*)::integer as rows
     from public.audit_events
     where entity = 'auth_sessions' and action = 'revoke'
       and actor = $1::uuid and detail->>'reason' = 'password_changed'`,
    [CHANGER.id],
  );
  assert.ok(revokeAudit.rows[0].rows >= 2, `nur ${revokeAudit.rows[0].rows} Widerrufe auditiert`);
});

test("I29 Passwortwechsel: kein Klartext in Konto oder Audit", options, async () => {
  for (const secret of [OLD_PASSWORD, NEW_PASSWORD]) {
    const inAccounts = await admin.query(
      `select count(*)::integer as hits from public.auth_accounts
       where password_hash like '%' || $1::text || '%'`,
      [secret],
    );
    assert.equal(inAccounts.rows[0].hits, 0, secret === NEW_PASSWORD ? "neu" : "alt");

    const inAudit = await admin.query(
      `select count(*)::integer as hits from public.audit_events
       where detail::text like '%' || $1::text || '%'`,
      [secret],
    );
    assert.equal(inAudit.rows[0].hits, 0);
  }

  // Auch kein Hashmaterial im Auditdetail.
  const hashInAudit = await admin.query(
    `select count(*)::integer as hits from public.audit_events
     where entity = 'auth_accounts' and detail::text like '%argon2%'`,
  );
  assert.equal(hashInAudit.rows[0].hits, 0);
});

test("I30 nach dem Wechsel: alte Sitzung tot, neue Anmeldung ohne Wechselzwang", options, async () => {
  // Die alte Sitzung ist widerrufen: der naechste geschuetzte Request faellt aus.
  const stale = await admin.query(
    `select id from public.auth_sessions
     where account_id = $1::uuid
     order by issued_at desc
     limit 1`,
    [CHANGER.id],
  );
  assert.equal(await validateSession(CHANGER.id, stale.rows[0].id), null);

  // Das alte Passwort trifft nicht mehr, das neue schon - und ohne Wechselzwang.
  const context = { ipHash: null, userAgentHash: null };
  assert.equal(
    await authenticateCredentials(CHANGER.email, OLD_PASSWORD, context),
    null,
  );

  const session = await authenticateCredentials(CHANGER.email, NEW_PASSWORD, context);
  assert.ok(session, "Anmeldung mit dem neuen Passwort scheitert");
  assert.equal(session.mustChangePassword, false);
  assert.equal(session.userId, CHANGER.id);

  // Und die Routenweiche gibt alles wieder frei.
  for (const path of PROTECTED_PATHS) {
    assert.equal(
      evaluateAccess({
        path,
        isSignedIn: true,
        mustChangePassword: session.mustChangePassword,
      }),
      "allow",
      path,
    );
  }
});

// --------------------------------------------------------------------------
// 6) Startgate der Laufzeitrolle (ADR-011 / 2.5)
//
// Die Waechter aus Migration 0017 kennen eine Eigentuemerausnahme. Liefe die
// Anwendung mit der Migrations-/Eigentuemerrolle oder mit einem Superuser, waere
// diese Ausnahme im Normalbetrieb dauerhaft erfuellt und saemtliche Waechter
// waeren wirkungslos - ohne jede Fehlermeldung. Das Startgate in src/lib/db
// verweigert diesen Betrieb, bevor die erste Transaktion beginnt.
// --------------------------------------------------------------------------

test("I31 Startgate: die Eigentuemerverbindung wird fail-closed abgewiesen", options, async () => {
  const result = await runFacadeProbe(ADMIN_URL);
  const output = `${result.stdout}${result.stderr}`;

  assert.notEqual(result.code, 0, `Exitcode 0 - das Gate hat durchgelassen: ${output}`);
  assert.ok(!output.includes("STARTGATE-PASSIERT"), output);
  assert.match(output, /Laufzeitrolle der Datenbankverbindung nicht zulaessig/);
  // Welche der drei Zusagen verletzt ist, haengt von der Zielumgebung ab: die
  // Eigentuemerrolle kann Superuser sein oder "nur" Eigentuemerin. Genannt
  // werden muss sie in jedem Fall.
  assert.match(output, /Superuser|BYPASSRLS|Eigentuemerrolle/);

  // Negativnachweis: die Ausgabe nennt weder eine Verbindungszeichenfolge noch
  // ein Kennwort noch einen Rollennamen.
  assert.ok(!output.includes("postgresql://"), "Verbindungszeichenfolge in der Ausgabe");
  for (const url of [ADMIN_URL, APP_URL]) {
    assert.ok(!output.includes(url), "Verbindungszeichenfolge in der Ausgabe");
    const parsed = new URL(url);
    const password = decodeURIComponent(parsed.password);
    if (password) assert.ok(!output.includes(password), "Kennwort in der Ausgabe");
    const role = decodeURIComponent(parsed.username);
    if (role) assert.ok(!output.includes(role), "Rollenname in der Ausgabe");
  }
});

test("I32 Startgate: die Anwendungsverbindung passiert es", options, async () => {
  // Gegenprobe zu I31 - ohne sie belegte der Negativfall nur, dass irgendetwas
  // scheitert, und nicht, dass genau die falsche Rolle scheitert.
  const result = await runFacadeProbe(APP_URL);
  assert.equal(result.code, 0, `${result.stdout}${result.stderr}`);
  assert.match(result.stdout, /STARTGATE-PASSIERT/);
});
