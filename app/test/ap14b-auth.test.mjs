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
    "select $tag$erste;zweite$tag$::text",
    "select $$a;b$$::text",
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
