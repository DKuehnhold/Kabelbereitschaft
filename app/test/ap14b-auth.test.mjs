// AP14/B Auth-Basis: gezielte Einheitentests ohne Datenbank und ohne Browser.
//
// Lauf:  node --test app/test/ap14b-auth.test.mjs   (Node >= 22.18)
// Node fuehrt die importierten .ts-Dateien mit Typentfernung direkt aus.
// Getestet werden ausschliesslich Module ohne "server-only" und ohne
// Datenbankbezug. Es kommen ausschliesslich synthetische Werte vor.
//
// Abgedeckt sind genau die Regeln, deren Verletzung nicht auffaellt, aber
// sicherheitsrelevant ist: Argon2id-Parameter, Nichtpruefbarkeit des
// Migrationsmarkers, Aufwandsangleichung gegen Benutzeraufzaehlung,
// Routeneinstufung des Proxys und die Sperre fuer Transaktionssteuerung im
// Datenbank-Wrapper.

import test from "node:test";
import assert from "node:assert/strict";

import {
  ARGON2_OPTIONS,
  MAX_PASSWORD_LENGTH,
  MIGRATED_PASSWORD_MARKER,
  MIN_PASSWORD_LENGTH,
  PASSWORD_HASH_VERSION,
  checkPasswordRules,
  equalizeVerifyCost,
  hashPassword,
  isVerifiableHash,
  needsRehash,
  passwordRuleMessage,
  verifyPassword,
} from "../src/lib/auth-password.ts";
import {
  hashClientHint,
  loginContextFromRequest,
  normalizeEmail,
} from "../src/lib/auth-identity.ts";
import {
  AFTER_LOGIN_PATH,
  PASSWORD_CHANGE_PATH,
  evaluateAccess,
  isAuthEndpoint,
  isLoginPath,
  isPasswordChangePath,
  isPublicPath,
} from "../src/lib/auth-paths.ts";
import {
  assertAllowedStatement,
  hasMultipleStatements,
  isAllowedStatement,
  leadingKeyword,
} from "../src/lib/db/statement-guard.ts";
import { withoutSessionId } from "../src/lib/auth-session-response.ts";
import {
  isPlatformConfigured,
  missingPlatformConfigKeys,
} from "../src/lib/platform-config.ts";

const SYNTHETIC_PASSWORD = "Synthetisches-Testpasswort-2026!";

// ---------------------------------------------------------------------------
// Argon2id (ADR-011 / 2.3)
// ---------------------------------------------------------------------------

test("Argon2id-Parameter erfuellen die OWASP-Mindestempfehlung", () => {
  assert.equal(ARGON2_OPTIONS.algorithm, 2, "Algorithm.Argon2id");
  assert.ok(
    ARGON2_OPTIONS.memoryCost >= 19_456,
    `memoryCost ${ARGON2_OPTIONS.memoryCost} liegt unter 19456 KiB`,
  );
  assert.ok(ARGON2_OPTIONS.timeCost >= 2, "timeCost muss mindestens 2 sein");
  assert.equal(ARGON2_OPTIONS.parallelism, 1);
  assert.equal(PASSWORD_HASH_VERSION, 1);
});

test("Hash ist ein kodierter Argon2id-Hash mit den konfigurierten Parametern", async () => {
  const hash = await hashPassword(SYNTHETIC_PASSWORD);
  assert.ok(hash.startsWith("$argon2id$"), hash.slice(0, 12));
  assert.match(hash, /\$v=19\$m=19456,t=2,p=1\$/);
  // Das Passwort darf im Hash nicht wiedererkennbar sein.
  assert.ok(!hash.includes(SYNTHETIC_PASSWORD));
});

test("Passwortpruefung nimmt nur das richtige Passwort an", async () => {
  const hash = await hashPassword(SYNTHETIC_PASSWORD);
  assert.equal(await verifyPassword(hash, SYNTHETIC_PASSWORD), true);
  assert.equal(await verifyPassword(hash, `${SYNTHETIC_PASSWORD}x`), false);
  assert.equal(await verifyPassword(hash, ""), false);
});

test("uebernommene Konten sind nicht anmeldefaehig", async () => {
  assert.equal(isVerifiableHash(MIGRATED_PASSWORD_MARKER), false);
  assert.equal(await verifyPassword(MIGRATED_PASSWORD_MARKER, SYNTHETIC_PASSWORD), false);
  // Auch ein leerer Wert oder ein fremdes Hashformat bleibt nicht pruefbar:
  // sonst koennte ein unvollstaendig angelegtes Konto still anmeldefaehig sein.
  assert.equal(isVerifiableHash(""), false);
  assert.equal(isVerifiableHash("$2b$12$abcdefghijklmnopqrstuv"), false);
  assert.equal(isVerifiableHash("$argon2i$v=19$m=19456,t=2,p=1$abc$def"), false);
  assert.equal(await verifyPassword("nicht-lesbar", SYNTHETIC_PASSWORD), false);
});

test("Aufwandsangleichung laeuft und kostet messbare Zeit", async () => {
  // Ohne diesen Leerlauf antwortet die Anmeldung fuer eine unbekannte Adresse
  // messbar schneller als fuer eine bekannte (Benutzeraufzaehlung).
  const started = process.hrtime.bigint();
  await equalizeVerifyCost(SYNTHETIC_PASSWORD);
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
  assert.ok(elapsedMs > 1, `Leerlauf dauerte nur ${elapsedMs.toFixed(2)} ms`);
});

test("veralteter Parametersatz wird zur Erneuerung gemeldet", () => {
  assert.equal(needsRehash(PASSWORD_HASH_VERSION), false);
  assert.equal(needsRehash(PASSWORD_HASH_VERSION + 1), false);
  assert.equal(needsRehash(PASSWORD_HASH_VERSION - 1), true);
});

// ---------------------------------------------------------------------------
// Zentrale Passwortregeln (ADR-011 / 2.3; dieselbe Quelle fuer Bootstrap und
// Passwortwechsel)
// ---------------------------------------------------------------------------

test("Passwortregeln weisen zu kurze, zu lange und leere Eingaben ab", () => {
  assert.equal(MIN_PASSWORD_LENGTH, 12);
  assert.equal(MAX_PASSWORD_LENGTH, 1024);

  assert.equal(checkPasswordRules(SYNTHETIC_PASSWORD), null);
  assert.equal(checkPasswordRules("a".repeat(MIN_PASSWORD_LENGTH)), null);

  assert.equal(checkPasswordRules(""), "too_short");
  assert.equal(checkPasswordRules("a".repeat(MIN_PASSWORD_LENGTH - 1)), "too_short");
  assert.equal(checkPasswordRules("a".repeat(MAX_PASSWORD_LENGTH + 1)), "too_long");
  // Genau an der Grenze noch zulaessig.
  assert.equal(checkPasswordRules("a".repeat(MAX_PASSWORD_LENGTH)), null);
  // Lang genug, aber ohne Inhalt.
  assert.equal(checkPasswordRules(" ".repeat(MIN_PASSWORD_LENGTH)), "blank");
});

test("Regelmeldungen nennen die Grenze und niemals die Eingabe", () => {
  for (const violation of ["too_short", "too_long", "blank"]) {
    const message = passwordRuleMessage(violation);
    assert.ok(message.length > 0, violation);
    assert.ok(!message.includes(SYNTHETIC_PASSWORD), message);
    // Ohne Umlaute: derselbe Text erscheint im Browser und auf der
    // Windows-Konsole des Bootstrap-Werkzeugs.
    assert.ok(!/[äöüÄÖÜß]/.test(message), message);
  }
  assert.match(passwordRuleMessage("too_short"), new RegExp(`${MIN_PASSWORD_LENGTH}`));
  assert.match(passwordRuleMessage("too_long"), new RegExp(`${MAX_PASSWORD_LENGTH}`));
});

// ---------------------------------------------------------------------------
// Normalisierung und Pseudonymisierung
// ---------------------------------------------------------------------------

test("E-Mail-Normalisierung passt zum Index lower(email)", () => {
  assert.equal(normalizeEmail("  Vorname.Nachname@Beispiel.INVALID "), "vorname.nachname@beispiel.invalid");
  assert.equal(normalizeEmail(""), "");
  // Kein locale-abhaengiges Kleinschreiben: das tuerkische I darf nicht zu
  // einem punktlosen i werden, sonst findet lower(email) die Adresse nicht.
  assert.equal(normalizeEmail("IST@beispiel.invalid"), "ist@beispiel.invalid");
});

test("Herkunftsmerkmale werden nur mit AUTH_SECRET pseudonymisiert", () => {
  const previous = process.env.AUTH_SECRET;
  try {
    delete process.env.AUTH_SECRET;
    assert.equal(hashClientHint("203.0.113.7"), null);

    process.env.AUTH_SECRET = "synthetisches-testgeheimnis";
    const first = hashClientHint("203.0.113.7");
    assert.match(String(first), /^[0-9a-f]{64}$/);
    // Deterministisch bei gleichem Geheimnis, aber an das Geheimnis gebunden.
    assert.equal(hashClientHint("203.0.113.7"), first);
    process.env.AUTH_SECRET = "anderes-synthetisches-geheimnis";
    assert.notEqual(hashClientHint("203.0.113.7"), first);

    assert.equal(hashClientHint(null), null);
    assert.equal(hashClientHint("   "), null);
  } finally {
    if (previous === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previous;
  }
});

test("Anmeldekontext nimmt nur die erste Station der Proxykette", () => {
  const previous = process.env.AUTH_SECRET;
  try {
    process.env.AUTH_SECRET = "synthetisches-testgeheimnis";
    const request = new Request("https://beispiel.invalid/login", {
      headers: {
        "x-forwarded-for": "203.0.113.7, 198.51.100.9",
        "user-agent": "SyntheticAgent/1.0",
      },
    });
    const context = loginContextFromRequest(request);
    assert.equal(context.ipHash, hashClientHint("203.0.113.7"));
    assert.notEqual(context.ipHash, hashClientHint("203.0.113.7, 198.51.100.9"));
    assert.equal(context.userAgentHash, hashClientHint("SyntheticAgent/1.0"));

    const empty = loginContextFromRequest(undefined);
    assert.deepEqual(empty, { ipHash: null, userAgentHash: null });
  } finally {
    if (previous === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previous;
  }
});

// ---------------------------------------------------------------------------
// Routeneinstufung des Proxys
// ---------------------------------------------------------------------------

test("oeffentliche Routen bleiben ohne Sitzung erreichbar", () => {
  for (const path of [
    "/login",
    "/offline",
    "/sw.js",
    "/manifest.webmanifest",
    "/favicon.ico",
    "/api/health",
    "/_next/static/chunk.js",
    "/icons/icon-192.png",
    "/branding/wus-technik.svg",
    "/api/auth/session",
    "/auth/signout",
  ]) {
    assert.equal(isPublicPath(path), true, path);
  }
});

test("geschuetzte Routen sind nicht oeffentlich", () => {
  for (const path of [
    "/",
    "/dashboard",
    "/vorgaenge",
    "/vorgaenge/neu",
    "/benutzer",
    "/api/sync",
    "/api/images/upload",
  ]) {
    assert.equal(isPublicPath(path), false, path);
  }
});

test("Praefixe wirken nur an einer Pfadgrenze", () => {
  // Die abgeloeste Supabase-Middleware pruefte zusaetzlich startsWith ohne
  // Trennzeichen. Damit waren diese Pfade versehentlich oeffentlich.
  for (const path of [
    "/loginfremd",
    "/logins",
    "/authentifizierung",
    "/api/authentisch",
    "/offline-bericht",
    "/iconsammlung/geheim",
  ]) {
    assert.equal(isPublicPath(path), false, path);
    assert.equal(isAuthEndpoint(path), false, path);
  }
});

test("Auth-Endpunkte werden vom Proxy unberuehrt gelassen", () => {
  for (const path of [
    "/api/auth",
    "/api/auth/session",
    "/api/auth/callback/credentials",
    "/auth",
    "/auth/signout",
  ]) {
    assert.equal(isAuthEndpoint(path), true, path);
  }
  assert.equal(isAuthEndpoint("/dashboard"), false);
});

test("Anmeldeseite wird als solche erkannt", () => {
  assert.equal(isLoginPath("/login"), true);
  assert.equal(isLoginPath("/login/hilfe"), true);
  assert.equal(isLoginPath("/loginfremd"), false);
  assert.equal(isLoginPath("/dashboard"), false);
});

// ---------------------------------------------------------------------------
// Erzwungener Passwortwechsel sperrt jede andere Route
// (ADR-011 / 2.3 und Pflichtnachweis 2.12 e)
// ---------------------------------------------------------------------------

/** Geschuetzte Routen, die ein Konto mit Wechselzwang NICHT erreichen darf. */
const PROTECTED_PATHS = [
  "/",
  "/dashboard",
  "/vorgaenge",
  "/vorgaenge/neu",
  "/vorgaenge/a9000000-0000-0000-0000-000000000001",
  "/benutzer",
  "/bestand",
  "/export",
  "/lager",
  "/material",
  "/materialhistorie",
  "/meine-einsaetze",
  "/stammdaten/kunden",
  "/stammdaten/monteure",
  "/api/sync",
  "/api/images/upload",
  "/api/incidents/a9000000-0000-0000-0000-000000000001/meta",
];

test("Wechselpfad wird nur an einer Pfadgrenze erkannt", () => {
  assert.equal(PASSWORD_CHANGE_PATH, "/passwort-aendern");
  assert.equal(isPasswordChangePath(PASSWORD_CHANGE_PATH), true);
  assert.equal(isPasswordChangePath(`${PASSWORD_CHANGE_PATH}/hilfe`), true);
  assert.equal(isPasswordChangePath(`${PASSWORD_CHANGE_PATH}x`), false);
  assert.equal(isPasswordChangePath("/passwort"), false);
  assert.equal(isPasswordChangePath("/dashboard"), false);
  // Der Wechselpfad ist ausdruecklich NICHT oeffentlich.
  assert.equal(isPublicPath(PASSWORD_CHANGE_PATH), false);
});

test("ADR-011/2.12(e): must_change_password sperrt jede andere Route", () => {
  for (const path of PROTECTED_PATHS) {
    assert.equal(
      evaluateAccess({ path, isSignedIn: true, mustChangePassword: true }),
      "to-password-change",
      path,
    );
  }
  // Auch die scheinbar aehnlichen Pfade bleiben gesperrt und fuehren nicht
  // versehentlich in die oeffentliche Einstufung.
  for (const path of ["/loginfremd", "/authentifizierung", "/offline-bericht"]) {
    assert.equal(
      evaluateAccess({ path, isSignedIn: true, mustChangePassword: true }),
      "to-password-change",
      path,
    );
  }
});

test("mit Wechselzwang bleiben genau drei Wege offen", () => {
  // 1) der Wechselpfad selbst
  assert.equal(
    evaluateAccess({
      path: PASSWORD_CHANGE_PATH,
      isSignedIn: true,
      mustChangePassword: true,
    }),
    "allow",
  );
  // 2) die Auth.js-Route und die Abmeldung - sonst waere das Konto
  //    handlungsunfaehig
  for (const path of ["/api/auth/session", "/api/auth/callback/credentials", "/auth/signout"]) {
    assert.equal(
      evaluateAccess({ path, isSignedIn: true, mustChangePassword: true }),
      "allow",
      path,
    );
  }
  // 3) unveraenderte oeffentliche Ressourcen (PWA, Offlineseite, Health)
  for (const path of ["/offline", "/sw.js", "/manifest.webmanifest", "/api/health", "/_next/static/x.js"]) {
    assert.equal(
      evaluateAccess({ path, isSignedIn: true, mustChangePassword: true }),
      "allow",
      path,
    );
  }
  // Die Anmeldeseite fuehrt zurueck auf den Wechsel, nicht ins Dashboard.
  assert.equal(
    evaluateAccess({ path: "/login", isSignedIn: true, mustChangePassword: true }),
    "to-password-change",
  );
});

test("ohne Wechselzwang bleibt die bisherige Weiche unveraendert", () => {
  for (const path of PROTECTED_PATHS) {
    assert.equal(
      evaluateAccess({ path, isSignedIn: true, mustChangePassword: false }),
      "allow",
      path,
    );
    assert.equal(
      evaluateAccess({ path, isSignedIn: false, mustChangePassword: false }),
      "to-login",
      path,
    );
  }
  assert.equal(AFTER_LOGIN_PATH, "/dashboard");
  assert.equal(
    evaluateAccess({ path: "/login", isSignedIn: true, mustChangePassword: false }),
    "to-after-login",
  );
  assert.equal(
    evaluateAccess({ path: "/login", isSignedIn: false, mustChangePassword: false }),
    "allow",
  );
});

test("der Wechselpfad ist ohne Sitzung gesperrt", () => {
  // Sonst waere ein Formular fuer den Passwortwechsel ohne Anmeldung erreichbar.
  assert.equal(
    evaluateAccess({
      path: PASSWORD_CHANGE_PATH,
      isSignedIn: false,
      mustChangePassword: false,
    }),
    "to-login",
  );
  assert.equal(
    evaluateAccess({
      path: `${PASSWORD_CHANGE_PATH}/hilfe`,
      isSignedIn: false,
      mustChangePassword: true,
    }),
    "to-login",
  );
});

// ---------------------------------------------------------------------------
// Sperre fuer Transaktionssteuerung im Datenbank-Wrapper (ADR-011 / 2.5)
// ---------------------------------------------------------------------------

test("fachliche Anweisungen sind erlaubt", () => {
  for (const statement of [
    "select 1",
    "  select * from public.profiles where id = $1",
    "insert into public.auth_sessions (account_id) values ($1)",
    "update public.auth_accounts set failed_attempts = 0 where id = $1",
    "delete from public.incident_images where id = $1",
    "with touched as (update public.auth_sessions set last_seen_at = now() returning id) select 1",
    "-- Kommentar\nselect 1",
    "/* Block */ select 1",
  ]) {
    assert.equal(isAllowedStatement(statement), true, statement);
  }
});

test("Transaktions- und Sitzungssteuerung ist gesperrt", () => {
  for (const statement of [
    "commit",
    "COMMIT",
    "  rollback ",
    "begin",
    "start transaction",
    "savepoint s1",
    "release savepoint s1",
    "end",
    "abort",
    "reset all",
    "discard all",
    "set local app.user_id = 'fremd'",
    "SET app.user_id = 'fremd'",
    "listen kanal",
    "-- harmlos\ncommit",
    "/* harmlos */ rollback",
    "",
    "   ",
  ]) {
    assert.equal(isAllowedStatement(statement), false, JSON.stringify(statement));
    assert.throws(() => assertAllowedStatement(statement));
  }
});

test("die Fehlermeldung nennt nur das Schluesselwort, nicht die Anweisung", () => {
  assert.throws(
    () => assertAllowedStatement("set app.user_id = 'a9000000-0000-0000-0000-000000000001'"),
    (error) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /"set"/);
      assert.ok(!error.message.includes("a9000000"), error.message);
      return true;
    },
  );
});

test("Mehrfachanweisungen sind gesperrt", () => {
  // Die Schluesselwortpruefung allein genuegt hier NICHT: gelesen wird nur
  // `select`. Ohne die strukturelle Sperre koennte eine solche Zeichenkette im
  // Simple-Query-Protokoll beide Anweisungen ausfuehren.
  for (const statement of [
    "select 1; set app.user_id = 'a9000000-0000-0000-0000-000000000001'",
    "select 1;\nupdate public.auth_sessions set revoked_at = null",
    "select 1 ; select 2",
    "select 1; -- Kommentar\nselect 2",
    "select 1; /* Block */ select 2",
    "select $1::text;drop table public.auth_sessions",
    "select 1;;select 2",
  ]) {
    assert.equal(hasMultipleStatements(statement), true, statement);
    assert.equal(isAllowedStatement(statement), false, statement);
    assert.throws(() => assertAllowedStatement(statement), /Mehrere Anweisungen/);
  }
});

test("ein abschliessendes Semikolon bleibt zulaessig", () => {
  for (const statement of [
    "select 1;",
    "select 1;   ",
    "select 1; -- Ende",
    "select 1;\n/* Ende */\n",
  ]) {
    assert.equal(hasMultipleStatements(statement), false, statement);
    assert.equal(isAllowedStatement(statement), true, statement);
  }
});

test("ein Semikolon in einem Literal ist kein Trennzeichen", () => {
  // Andernfalls waere die Sperre unbrauchbar: sie muesste fachlich gueltige
  // Abfragen abweisen.
  for (const statement of [
    "select ';'::text",
    "select 'a'';b'::text",
    'select 1 as ";"',
    "select $1::text where $2::text = ';'",
    String.raw`select E'\';' as x`,
  ]) {
    assert.equal(hasMultipleStatements(statement), false, statement);
    assert.equal(isAllowedStatement(statement), true, statement);
  }
});

test("das Schluesselwort wiegt schwerer als die Mehrfachanweisung", () => {
  // Beide Regeln greifen; gemeldet wird die konkretere.
  assert.throws(() => assertAllowedStatement("commit; select 1"), /"commit"/);
});

test("Kommentare koennen die Sperre nicht umgehen", () => {
  assert.equal(leadingKeyword("-- nur ein Kommentar"), "");
  assert.equal(leadingKeyword("/* unbeendet"), "");
  assert.equal(leadingKeyword("/* a */ -- b\n select 1"), "select");
  assert.equal(leadingKeyword("\n\t COMMIT;"), "commit");
});

// ---------------------------------------------------------------------------
// Lexikalische Haertung der Anweisungsschranke (Befund H1)
//
// Die Schranke prueft nicht mehr nur das erste Schluesselwort gegen eine
// Verbotsliste, sondern
//   1. das fuehrende Kommando gegen eine ALLOW-Liste,
//   2. die vollstaendige Lesbarkeit der Anweisung (fail-closed),
//   3. verbotene Bezeichner an JEDER Position.
// Die Faelle hier sind adversarial: jeder von ihnen kam an dem alten Stand
// vorbei. Es kommen ausschliesslich synthetische Werte vor.
// ---------------------------------------------------------------------------

/** Synthetische, untergeschobene Identitaet - gehoert zu keinem echten Konto. */
const SMUGGLED_ID = "ac140b00-0000-0000-0000-0000000000a1";

/**
 * Formen, mit denen `set_config` erreichbar waere. Alle setzen "app.user_id"
 * und damit die Identitaet, die saemtliche RLS-Policies auswerten.
 */
const SET_CONFIG_FORMS = [
  // einfach
  `select set_config('app.user_id', '${SMUGGLED_ID}', true)`,
  // Gross-/Kleinschreibung
  `SELECT SET_CONFIG('app.user_id', '${SMUGGLED_ID}', TRUE)`,
  // schemaqualifiziert
  `select pg_catalog.set_config('app.user_id', '${SMUGGLED_ID}', true)`,
  // begrenzter Bezeichner
  `select "set_config"('app.user_id', '${SMUGGLED_ID}', true)`,
  // schemaqualifiziert UND begrenzt
  `select pg_catalog."set_config"('app.user_id', '${SMUGGLED_ID}', true)`,
  // Blockkommentar zwischen Name und Klammer
  `select set_config/* dazwischen */('app.user_id', '${SMUGGLED_ID}', true)`,
  // Zeilenumbruch zwischen Name und Klammer
  `select set_config\n('app.user_id', '${SMUGGLED_ID}', true)`,
  // Zeilenkommentar zwischen Name und Klammer
  `select set_config -- dazwischen\n('app.user_id', '${SMUGGLED_ID}', true)`,
  // in einer CTE
  `with gesetzt as (select set_config('app.user_id', '${SMUGGLED_ID}', true) as wert)
   select wert from gesetzt`,
  // in einer Unterabfrage in where
  `select 1 where (select set_config('app.user_id', '${SMUGGLED_ID}', true)) is not null`,
  // als Wert in insert ... values (...)
  `insert into public.audit_events (entity)
   values (set_config('app.user_id', '${SMUGGLED_ID}', true))`,
  // in der where-Klausel eines update
  `update public.profiles set full_name = 'unveraendert'
   where id::text = set_config('app.user_id', '${SMUGGLED_ID}', true)`,
  // in der where-Klausel eines select
  `select 1 where set_config('app.user_id', '${SMUGGLED_ID}', true) is not null`,
];

test("jede Form von set_config wird abgewiesen, an jeder Position", () => {
  for (const statement of SET_CONFIG_FORMS) {
    assert.equal(isAllowedStatement(statement), false, statement);
    assert.throws(
      () => assertAllowedStatement(statement),
      /"set_config"/,
      statement,
    );
  }
  // Vierzehnte Form: als eigenstaendiges `values`-Kommando. Hier greift bereits
  // die Allow-Liste des fuehrenden Kommandos - `values` ist fachlich nicht in
  // Gebrauch.
  const asValues = `values (set_config('app.user_id', '${SMUGGLED_ID}', true))`;
  assert.equal(isAllowedStatement(asValues), false, asValues);
  assert.throws(() => assertAllowedStatement(asValues), /"values"/);
});

test("ein Bezeichner mit Unicode-Escapes wird abgewiesen", () => {
  // `U&"\0073et_config"` ist fuer PostgreSQL derselbe Name, enthaelt die
  // Zeichenfolge `set_config` aber nicht. Jede Namenspruefung waere unterlaufen;
  // deshalb ist diese Form als Ganzes abgewiesen.
  const statement =
    String.raw`select U&"\0073et_config"('app.user_id', '` + SMUGGLED_ID + `', true)`;
  assert.ok(!statement.includes("set_config"), statement);
  assert.equal(isAllowedStatement(statement), false, statement);
  assert.throws(() => assertAllowedStatement(statement), /Unicode-Escapes/);

  // Die Zeichenkettenform U&'...' ist dagegen ein Literal und bleibt zulaessig.
  assert.equal(isAllowedStatement(String.raw`select U&'\0073' as x`), true);
});

test("pg_settings wird abgewiesen, obwohl update erlaubt ist", () => {
  // Die Katalogsicht ist ueber eine Regel aktualisierbar und wirkt wie SET,
  // also SITZUNGSWEIT und damit ueber die Poolverbindung hinaus.
  for (const statement of [
    `update pg_settings set setting = '${SMUGGLED_ID}' where name = 'app.user_id'`,
    `update pg_catalog.pg_settings set setting = '${SMUGGLED_ID}' where name = 'app.user_id'`,
    `update pg_catalog."pg_settings" set setting = '${SMUGGLED_ID}' where name = 'app.user_id'`,
  ]) {
    assert.equal(leadingKeyword(statement), "update", statement);
    assert.equal(isAllowedStatement(statement), false, statement);
    assert.throws(() => assertAllowedStatement(statement), /"pg_settings"/);
  }
});

test("die Allow-Liste weist jedes andere Kommando ab", () => {
  // Jeder dieser Faelle kam an der alten Verbotsliste vorbei. Gepruefte
  // Erwartung: das fuehrende Wort wird erkannt UND in der Meldung genannt.
  const cases = [
    ["alter", `alter role current_user set "app.user_id" = '${SMUGGLED_ID}'`],
    ["do", `do $$ begin perform set_config('app.user_id', '${SMUGGLED_ID}', true); end $$`],
    ["explain", "explain (analyze) select 1"],
    ["create", "create temp table zz_synthetisch as select 1 as x"],
    ["copy", "copy (select 1) to stdout"],
    ["declare", "declare zz_synthetisch cursor with hold for select 1"],
    ["fetch", "fetch all from zz_synthetisch"],
    ["move", "move all in zz_synthetisch"],
    ["close", "close zz_synthetisch"],
    ["execute", "execute zz_synthetisch"],
    ["deallocate", "deallocate all"],
    ["call", "call public.zz_synthetisch()"],
    ["values", "values (1)"],
    ["table", "table public.profiles"],
    ["lock", "lock table public.profiles in access exclusive mode"],
    ["truncate", "truncate table public.profiles"],
    ["grant", "grant select on public.profiles to app_user"],
    ["revoke", "revoke select on public.profiles from app_user"],
    ["drop", "drop table public.profiles"],
    ["security", "security label for synthetisch on table public.profiles is 'x'"],
  ];
  for (const [keyword, statement] of cases) {
    assert.equal(leadingKeyword(statement), keyword, statement);
    assert.equal(isAllowedStatement(statement), false, statement);
    assert.throws(
      () => assertAllowedStatement(statement),
      new RegExp(`"${keyword}"`),
      statement,
    );
  }
});

test("sitzungsweite Sperren, Abbrueche und dblink sind gesperrt", () => {
  // Alle stehen in einem fuehrend zulaessigen `select` und waeren sonst offen.
  // Sitzungsweite Sperren ueberleben die Transaktion und koennen den
  // Schutztrigger aus Migration 0017 in das statement_timeout laufen lassen.
  for (const [token, statement] of [
    ["pg_advisory_lock", "select pg_advisory_lock(1)"],
    ["pg_advisory_lock_shared", "select pg_advisory_lock_shared(1)"],
    ["pg_advisory_unlock", "select pg_advisory_unlock(1)"],
    ["pg_advisory_unlock_all", "select pg_advisory_unlock_all()"],
    ["pg_terminate_backend", "select pg_terminate_backend(1)"],
    ["pg_reload_conf", "select pg_reload_conf()"],
    ["dblink_exec", "select dblink_exec('dbname=synthetisch', 'select 1')"],
    ["dblink", "select * from dblink('dbname=synthetisch', 'select 1') as t(x integer)"],
  ]) {
    assert.equal(isAllowedStatement(statement), false, statement);
    assert.throws(
      () => assertAllowedStatement(statement),
      new RegExp(`"${token}"`),
      statement,
    );
  }
  // Der transaktionslokale Bruder bleibt zulaessig: er endet mit der
  // Transaktion und ist genau das Mittel des Schutztriggers.
  assert.equal(isAllowedStatement("select pg_advisory_xact_lock(1)"), true);
});

test("der Zeilenkommentar endet auch an einem einzelnen CR", () => {
  // Belegter Scannerdefekt: gesucht wurde ausschliesslich \n. Damit verschluckte
  // der Kommentar den Rest der Zeichenkette, waehrend PostgreSQLs Lexer den
  // Kommentar am CR beendet und ZWEI Anweisungen sieht.
  const statement = `select 1 --x\r;select set_config('app.user_id','${SMUGGLED_ID}',true)`;
  assert.ok(statement.includes("\r"), "das CR fehlt im Testfall");
  assert.ok(!statement.includes("\n"), "der Fall braucht ein CR OHNE LF");
  assert.equal(hasMultipleStatements(statement), true, statement);
  assert.equal(isAllowedStatement(statement), false, statement);
  assert.throws(() => assertAllowedStatement(statement), /Mehrere Anweisungen/);
});

test("ein Dollar-Quote wird abgewiesen statt nachgebildet", () => {
  // Bewusste Verschaerfung gegenueber dem Vorgaengerstand: der las Dollar-Quotes
  // exakt wie PostgreSQL, um sie zu ERLAUBEN. Kein Anweisungstext des Fachcodes
  // enthaelt eines - fuer eingeschleusten Text ist Zulassen nie das Ziel.
  for (const statement of [
    "select $$a;b$$::text",
    "select $tag$erste;zweite$tag$::text",
    "select $tag$set_config('app.user_id','x',true)$tag$::text",
    "select $tag$unbeendet",
  ]) {
    assert.equal(isAllowedStatement(statement), false, statement);
    assert.throws(() => assertAllowedStatement(statement), /Dollar-Quotes/, statement);
  }
});

test("ein Dollarzeichen in einem Bezeichner beginnt kein Dollar-Quote", () => {
  // Belegter Scannerdefekt: bei jedem `$` begann die Quote-Erkennung. In
  // `a$b$` erkannte sie einen Quote-Beginn und uebersprang das Semikolon;
  // PostgreSQL liest `a$b$` als EINEN Bezeichner.
  const statement = `select 1 as a$b$; select set_config('app.user_id','${SMUGGLED_ID}',true)`;
  assert.equal(hasMultipleStatements(statement), true, statement);
  assert.equal(isAllowedStatement(statement), false, statement);
  assert.throws(() => assertAllowedStatement(statement), /Mehrere Anweisungen/);

  // Die Parameterform bleibt unberuehrt - der Fachcode erzeugt sie massenhaft.
  assert.equal(isAllowedStatement("select $1::text, $2::uuid where $3::boolean"), true);
});

test("unbeendete Konstrukte sind ein Abweisungsgrund, kein stilles Ende", () => {
  // Die Schranke darf ihr Urteil nicht auf einen Text stuetzen, den sie nicht
  // vollstaendig gelesen hat. `select 1 /* /* */ ; select 1` galt zuvor als
  // EINE Anweisung, weil der geschachtelte Kommentar nicht endet.
  for (const statement of [
    "select 1 /* unbeendet",
    "select 1 /* /* */ ; select 1",
    "select 'unbeendet",
    'select "unbeendet',
  ]) {
    assert.equal(isAllowedStatement(statement), false, JSON.stringify(statement));
    assert.throws(() => assertAllowedStatement(statement), /unbeendet/, statement);
  }
});

test("fachliche Anweisungen mit verbotenen Woertern im Inhalt bleiben zulaessig", () => {
  // Der wichtigste Fall: eine Schranke, die fachlich gueltige Abfragen abweist,
  // wird umgangen statt benutzt. Geprueft werden ausschliesslich Bezeichner -
  // niemals Literale, Dollar-Quotes oder Kommentartext.
  for (const statement of [
    // verbotenes Wort in einem Zeichenkettenliteral
    "select 'set_config'::text",
    "update public.incidents set notes = 'set_config app.user_id' where id = $1::uuid",
    // verbotenes Wort in einem Zeilenkommentar
    "select 1 -- setzt app.user_id nicht, kein set_config hier",
    // verbotenes Wort in einem Blockkommentar
    "/* set_config pg_settings */ select 1",
    // `set` als Teil eines update
    "update public.auth_accounts set failed_attempts = 0, locked_until = null where id = $1::uuid",
    // `end` in einem case - die echte Anweisung der Fehlversuchszaehlung
    `update public.auth_accounts
         set failed_attempts = $2::integer,
             locked_until = case
               when $2::integer >= $3::integer
                 then now() + make_interval(mins => $4::integer)
               else null
             end
         where id = $1::uuid`,
    // `values` in einem insert, mit fuenf Parametern und einem begrenzten
    // Bezeichner - die echte Kontaktanweisung der Stammdaten
    `insert into public.contacts (customer_id, name, "function", email, is_active)
           values ($1::uuid, $2, $3, $4, $5)
           returning id`,
    // das echte `with` der Sitzungspruefung
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
    // Escape-Zeichenkette der Suchfilter
    String.raw`select 1 where search_text like $1 escape E'\\'`,
    // begrenzter Bezeichner
    `update public.contacts set "function" = $1 where id = $2::uuid`,
    // abschliessendes Semikolon
    "select 1;",
  ]) {
    assert.equal(isAllowedStatement(statement), true, statement);
    assert.doesNotThrow(() => assertAllowedStatement(statement), statement);
  }
});

test("die Meldung nennt nur den Bezeichner, niemals den Wert", () => {
  assert.throws(
    () =>
      assertAllowedStatement(
        `select set_config('app.user_id', '${SMUGGLED_ID}', true)`,
      ),
    (error) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /"set_config"/);
      assert.ok(!error.message.includes(SMUGGLED_ID), error.message);
      assert.ok(!error.message.includes("ac140b00"), error.message);
      assert.ok(!error.message.includes("app.user_id"), error.message);
      return true;
    },
  );
});

test("die uebrigen verbotenen Bezeichner werden ebenfalls abgewiesen", () => {
  // Bisher belegten die Faelle oben nur einen Teil der Liste. Jeder Name hier
  // steht in einem fuehrend ZULAESSIGEN `select` und waere ohne die
  // positionsunabhaengige Namenspruefung offen. Alle Argumente sind
  // synthetisch; keine Verbindung, kein Zeiger und keine Sitzung existiert.
  for (const [token, statement] of [
    ["pg_try_advisory_lock", "select pg_try_advisory_lock(1)"],
    ["pg_try_advisory_lock_shared", "select pg_try_advisory_lock_shared(1)"],
    ["pg_advisory_unlock_shared", "select pg_advisory_unlock_shared(1)"],
    ["pg_cancel_backend", "select pg_cancel_backend(1)"],
    // Diese drei fuehren ihr Textargument ueber SPI aus - die Wirkung von
    // set_config waere ohne das Token set_config erreichbar.
    ["query_to_xml", "select query_to_xml('select 1', true, false, '')"],
    ["query_to_xmlschema", "select query_to_xmlschema('select 1', true, false, '')"],
    [
      "query_to_xml_and_xmlschema",
      "select query_to_xml_and_xmlschema('select 1', true, false, '')",
    ],
    ["dblink_connect", "select dblink_connect('synthetisch', 'dbname=synthetisch')"],
    ["dblink_connect_u", "select dblink_connect_u('synthetisch', 'dbname=synthetisch')"],
    ["dblink_open", "select dblink_open('synthetisch', 'zeiger', 'select 1')"],
    ["dblink_send_query", "select dblink_send_query('synthetisch', 'select 1')"],
    ["dblink_fetch", "select * from dblink_fetch('synthetisch', 'zeiger', 1) as t(x integer)"],
  ]) {
    assert.equal(isAllowedStatement(statement), false, statement);
    assert.throws(
      () => assertAllowedStatement(statement),
      new RegExp(`"${token}"`),
      statement,
    );
  }
});

test("ein Zahlenliteral kann keinen verbotenen Bezeichner maskieren", () => {
  // Belegter Scannerdefekt: der Lexer kannte keine Tokenklasse fuer Zahlen.
  // Ziffern fielen einzeln in den Restzweig, das Wort-Token begann erst am
  // ersten Buchstaben. Aus `1e0set_config` wurde deshalb das unverdaechtige
  // Token `e0set_config`, und die Anweisung passierte die Schranke.
  // PostgreSQL weist solche Texte ab Fassung 16 mit "trailing junk after
  // numeric literal" ab; die Schranke urteilt jetzt nicht laxer als der Server.
  for (const statement of [
    `select 1 where 1e0set_config('app.user_id','${SMUGGLED_ID}',true) is not null`,
    `select 1 where 0x1set_config('app.user_id','${SMUGGLED_ID}',true) is not null`,
    `select 1 where 1_0set_config('app.user_id','${SMUGGLED_ID}',true) is not null`,
  ]) {
    assert.equal(isAllowedStatement(statement), false, statement);
    assert.throws(() => assertAllowedStatement(statement), /Zahlenliteral/, statement);
  }

  // Gegenprobe: gueltige Zahlen in jeder gebraeuchlichen Form bleiben
  // zulaessig - sonst waere die Regel im Fachbetrieb unbrauchbar.
  for (const statement of [
    "select 1, 1.5, 1e3 where $1::integer > 0",
    "select 1e-3, 0x1f, 0b1010, 1_000 where $1::integer > 0",
    "select now() - interval '1 minute' where $1::integer > 0",
  ]) {
    assert.equal(isAllowedStatement(statement), true, statement);
    assert.doesNotThrow(() => assertAllowedStatement(statement), statement);
  }
});

test("ein verdoppeltes Anfuehrungszeichen ergibt einen ANDEREN Namen", () => {
  // Festgehalten wird das TATSAECHLICHE Verhalten: `"set""_config"` ist
  // entquotet der Name `set"_config` und damit NICHT `set_config`. Auch
  // PostgreSQL loest ihn nicht dorthin auf - der Aufruf liefe in "function
  // set"_config(...) does not exist". Die Schranke weist deshalb nicht ab; sie
  // ist an dieser Stelle so genau wie der Server und nicht laxer.
  const doubled = `select "set""_config"('app.user_id', '${SMUGGLED_ID}', true)`;
  assert.equal(hasMultipleStatements(doubled), false, doubled);
  assert.equal(isAllowedStatement(doubled), true, doubled);

  // Gegenprobe: OHNE Verdopplung ist es derselbe Name wie set_config.
  const plain = `select "set_config"('app.user_id', '${SMUGGLED_ID}', true)`;
  assert.equal(isAllowedStatement(plain), false, plain);
  assert.throws(() => assertAllowedStatement(plain), /"set_config"/);
});

test("die Praefixliterale B und X bleiben zulaessig", () => {
  // Sie brauchen keinen eigenen Zweig: es entsteht das Wort-Token `b` bzw. `x`
  // - keines steht auf der Verbotsliste - und danach eine gewoehnliche,
  // uebersprungene Zeichenkette.
  for (const statement of [
    "select b'0101'::bit(4)",
    "select B'0101'::bit(4)",
    "select x'ff'::bit(8)",
    "select X'FF'::bit(8)",
  ]) {
    assert.equal(isAllowedStatement(statement), true, statement);
  }

  // Ein Semikolon IM Literal ist kein Trennzeichen - sonst wuerde die Schranke
  // fachlich gueltige Abfragen abweisen.
  for (const statement of ["select b'0;1'", "select x';'"]) {
    assert.equal(hasMultipleStatements(statement), false, statement);
    assert.equal(isAllowedStatement(statement), true, statement);
  }
});

test('u&"..." wird auch klein geschrieben und schemaqualifiziert abgewiesen', () => {
  // Die Form ist als GANZES abgewiesen; Schreibweise und Schemaqualifizierung
  // duerfen daran nichts aendern.
  for (const statement of [
    String.raw`select u&"\0073et_config"('app.user_id', '` + SMUGGLED_ID + `', true)`,
    String.raw`select pg_catalog.U&"\0073et_config"('app.user_id', '` +
      SMUGGLED_ID +
      `', true)`,
  ]) {
    assert.ok(!statement.includes("set_config"), statement);
    assert.equal(isAllowedStatement(statement), false, statement);
    assert.throws(() => assertAllowedStatement(statement), /Unicode-Escapes/, statement);
  }
});

test("ein mit CRLF formatierter Fachtext bleibt zulaessig", () => {
  // Windows- und OneDrive-Realitaet: ein Anweisungstext kann mit \r\n
  // formatiert sein. Das CR ist Leerraum und darf am Urteil nichts aendern -
  // sonst schluege die Schranke ausgerechnet auf der Entwicklungsmaschine an.
  const statement =
    "update public.auth_accounts\r\n" +
    "   set failed_attempts = 0,\r\n" +
    "       locked_until = null\r\n" +
    " where id = $1::uuid\r\n";
  assert.ok(statement.includes("\r\n"), "das CRLF fehlt im Testfall");
  assert.equal(leadingKeyword(statement), "update", statement);
  assert.equal(hasMultipleStatements(statement), false, statement);
  assert.equal(isAllowedStatement(statement), true, statement);
  assert.doesNotThrow(() => assertAllowedStatement(statement), statement);
});

// ---------------------------------------------------------------------------
// Sitzungs-ID verlaesst den Server nicht
// ---------------------------------------------------------------------------

test("die Sitzungsauskunft an den Browser enthaelt kein sid", async () => {
  const original = Response.json(
    {
      user: {
        id: "a9000000-0000-0000-0000-000000000001",
        sid: "b9000000-0000-0000-0000-0000000000ff",
        email: "person@beispiel.invalid",
        name: "Synthetische Person",
        role: "disponent",
        mustChangePassword: false,
      },
      expires: "2026-07-28T12:00:00.000Z",
    },
    { status: 200 },
  );
  original.headers.append("set-cookie", "authjs.session-token=erstes; Path=/; HttpOnly");
  original.headers.append("set-cookie", "authjs.csrf-token=zweites; Path=/; HttpOnly");

  const filtered = await withoutSessionId(original);
  const body = await filtered.json();

  assert.equal("sid" in body.user, false);
  assert.equal(body.user.id, "a9000000-0000-0000-0000-000000000001");
  assert.equal(body.user.role, "disponent");
  assert.equal(body.expires, "2026-07-28T12:00:00.000Z");
  assert.equal(filtered.status, 200);

  // Die stille Tokenerneuerung darf nicht verloren gehen: beide Cookies
  // bleiben getrennt erhalten.
  const cookies = filtered.headers.getSetCookie();
  assert.equal(cookies.length, 2);
  assert.ok(cookies[0].startsWith("authjs.session-token="), cookies[0]);
  assert.ok(cookies[1].startsWith("authjs.csrf-token="), cookies[1]);

  // Und die Kennung steht auch nicht mehr irgendwo im Rumpf.
  assert.ok(!JSON.stringify(body).includes("b9000000"));
});

test("regulaere Antworten ohne Sitzungs-ID bleiben unveraendert", async () => {
  // "keine Sitzung" ist genau JSON `null` - die einzige regulaere Auskunft
  // ohne `user`-Objekt.
  const noSession = Response.json(null, { status: 200 });
  assert.equal(await withoutSessionId(noSession), noSession);

  // Ein `user` ohne `sid` enthaelt nichts, was entfernt werden muesste.
  const withoutSid = Response.json({ user: { id: "a9000000-0000-0000-0000-000000000001" } });
  assert.equal(await withoutSessionId(withoutSid), withoutSid);

  // Eine Antwort ohne Rumpf kann keine Auskunft tragen.
  const noBody = new Response(null, { status: 204 });
  assert.equal(await withoutSessionId(noBody), noBody);
});

test("nicht auswertbare Antworten werden fail-closed ersetzt", async () => {
  // Kern der Anforderung: was der Filter nicht als geprueftes Sitzungsobjekt
  // gelesen hat, darf er nicht vorsorglich durchreichen - es koennte genau die
  // interne Sitzungsauskunft sein, die er entfernen soll.
  const cases = [
    [
      "kein JSON-Inhaltstyp",
      () =>
        new Response('{"user":{"sid":"b9000000-0000-0000-0000-0000000000ff"}}', {
          status: 200,
          headers: { "content-type": "text/plain" },
        }),
    ],
    [
      "unlesbares JSON",
      () =>
        new Response('{"user":{"sid":"b9000000-0000-0000-0000-0000000000ff"', {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    ],
    ["Array statt Objekt", () => Response.json([{ sid: "b9000000" }], { status: 200 })],
    ["Zeichenkette statt Objekt", () => Response.json("b9000000", { status: 200 })],
    ["user ist kein Objekt", () => Response.json({ user: "b9000000" }, { status: 200 })],
    ["user ist ein Array", () => Response.json({ user: [{ sid: "b9000000" }] }, { status: 200 })],
    // Ein Objekt ohne `user` ist keine pruefbare Sitzungsauskunft: es kann
    // beliebige weitere Felder tragen - hier ein `sid` auf oberster Ebene, das
    // der Browser nicht sehen darf.
    [
      "Objekt ohne user, aber mit sid",
      () =>
        Response.json(
          { expires: "2026-07-28T12:00:00.000Z", sid: "b9000000-0000-0000-0000-0000000000ff" },
          { status: 200 },
        ),
    ],
    ["Objekt ohne user", () => Response.json({ expires: "2026-07-28T12:00:00.000Z" }, { status: 200 })],
    ["user ist null", () => Response.json({ user: null, sid: "b9000000" }, { status: 200 })],
    ["leeres Objekt", () => Response.json({}, { status: 200 })],
  ];

  for (const [label, build] of cases) {
    const original = build();
    original.headers.append("set-cookie", "authjs.session-token=erstes; Path=/; HttpOnly");
    original.headers.append("set-cookie", "authjs.csrf-token=zweites; Path=/; HttpOnly");

    const filtered = await withoutSessionId(original);
    assert.notEqual(filtered, original, label);

    const text = await filtered.text();
    assert.equal(text, "null", `${label}: Rumpf ist "${text}"`);
    assert.ok(!text.includes("b9000000"), label);
    assert.equal(filtered.headers.get("content-type"), "application/json", label);

    // Status und Cookies bleiben erhalten: die stille Tokenerneuerung darf auch
    // im Fehlerfall nicht verloren gehen.
    assert.equal(filtered.status, 200, label);
    const cookies = filtered.headers.getSetCookie();
    assert.equal(cookies.length, 2, label);
    assert.ok(cookies[0].startsWith("authjs.session-token="), label);
    assert.ok(cookies[1].startsWith("authjs.csrf-token="), label);
  }
});

test("der Status einer Fehlerantwort bleibt erhalten", async () => {
  // Ohne AUTH_SECRET antwortet Auth.js mit einem Konfigurationsfehler. Der
  // Status muss durchkommen, damit der Fehler ueberhaupt erkennbar bleibt -
  // ersetzt wird nur der nicht auswertbare Rumpf.
  const error = new Response("<html>Fehler</html>", {
    status: 500,
    statusText: "Internal Server Error",
    headers: { "content-type": "text/html" },
  });
  const filtered = await withoutSessionId(error);
  assert.equal(filtered.status, 500);
  assert.equal(await filtered.text(), "null");
});

// ---------------------------------------------------------------------------
// Pflichtkonfiguration
// ---------------------------------------------------------------------------

test("fehlende Pflichtvariablen werden mit Namen, nie mit Werten gemeldet", () => {
  const previousUrl = process.env.DATABASE_URL;
  const previousSecret = process.env.AUTH_SECRET;
  try {
    delete process.env.DATABASE_URL;
    delete process.env.AUTH_SECRET;
    assert.deepEqual(missingPlatformConfigKeys(), ["DATABASE_URL", "AUTH_SECRET"]);
    assert.equal(isPlatformConfigured(), false);

    process.env.DATABASE_URL = "postgresql://synthetisch@localhost:5432/test";
    assert.deepEqual(missingPlatformConfigKeys(), ["AUTH_SECRET"]);
    assert.equal(isPlatformConfigured(), false);

    // Leer und nur Leerzeichen gelten als nicht gesetzt.
    process.env.AUTH_SECRET = "   ";
    assert.deepEqual(missingPlatformConfigKeys(), ["AUTH_SECRET"]);

    process.env.AUTH_SECRET = "synthetisches-testgeheimnis";
    assert.deepEqual(missingPlatformConfigKeys(), []);
    assert.equal(isPlatformConfigured(), true);
  } finally {
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
    if (previousSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previousSecret;
  }
});
