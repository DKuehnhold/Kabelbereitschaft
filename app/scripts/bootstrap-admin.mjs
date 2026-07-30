// AP14/B: einmaliges Bootstrap des ersten Administrators (ADR-011 / 2.11).
//
// Aufruf (Betreiberablauf: 07-Betrieb/BENUTZERVERWALTUNG.md):
//   BOOTSTRAP_DATABASE_URL=... node scripts/bootstrap-admin.mjs \
//     --email admin@example.invalid --name "Vorname Nachname"
//
// Verbindliche Eigenschaften:
//   * KEIN Kennwort in Argumenten, Umgebungsvariablen, Dateien oder Ausgaben.
//     Die Eingabe erfolgt verdeckt am Terminal (zweimal, mit Vergleich); ohne
//     Terminal wird eine Zeile von der Standardeingabe gelesen, damit ein
//     Secret-Manager oder ein Test das Kennwort ohne Zwischendatei uebergeben
//     kann. Das Kennwort erscheint in keiner Protokollzeile.
//   * Argon2id ausschliesslich ueber die zentrale Implementierung
//     `src/lib/auth-password.ts` - kein zweiter Parametersatz.
//   * Fail-closed: gibt es bereits einen anmeldefaehigen Administrator, wird
//     nichts geaendert (Ausnahme: es ist genau das angeforderte Konto - dann
//     ist der Lauf ein idempotenter Leerlauf).
//   * Genau eine Transaktion mit Vorschaltsperre; bei jedem Fehler wird
//     zurueckgerollt.
//
// Warum nicht ueber `src/lib/db`: dieser Wrapper ist "server-only" und arbeitet
// mit der nicht privilegierten Rolle `app_user`. Der erste Administrator kann
// darueber nicht entstehen - `profiles_insert` verlangt `is_admin()`, und genau
// den gibt es noch nicht. Das Bootstrap ist deshalb ein Betreiberwerkzeug mit
// der Migrationsrolle, gleiche Klasse wie ein Migrationslauf.
//
// Exit-Codes: 0 erfolgreich oder unveraendert, 1 Aufruf-/Konfigurationsfehler,
// 2 Kennwortregel verletzt, 3 Ausgangslage nicht zulaessig, 4 Datenbankfehler.

import { Client } from "pg";

import {
  checkPasswordRules,
  hashPassword,
  passwordRuleMessage,
  PASSWORD_HASH_VERSION,
} from "../src/lib/auth-password.ts";
import { normalizeEmail } from "../src/lib/auth-identity.ts";

/** Fester Schluessel der Vorschaltsperre: zwei Laeufe gleichzeitig sind Unsinn. */
const ADVISORY_LOCK_KEY = 4914001;

/** Platzhalter aus der endlichen Kompatibilitaetsschicht (Migration 0012). */
const MIGRATED_MARKER = "!MIGRATED-ACCOUNT-REQUIRES-RESET!";

/** Steuerzeichen der verdeckten Eingabe (im Rohmodus liest Node sie selbst). */
const CTRL_C = "\u0003";
const BACKSPACE = "\u007f";

class BootstrapError extends Error {
  constructor(message, exitCode) {
    super(message);
    this.exitCode = exitCode;
  }
}

function usage() {
  return [
    "Aufruf: BOOTSTRAP_DATABASE_URL=... node scripts/bootstrap-admin.mjs --email <adresse> [--name <anzeigename>]",
    "",
    "Das Kennwort wird verdeckt abgefragt und niemals als Argument uebergeben.",
    "BOOTSTRAP_DATABASE_URL ist die Verbindung der Migrationsrolle, nicht die der Anwendung.",
  ].join("\n");
}

function parseArguments(argv) {
  const parsed = { email: null, name: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--email" || argument === "--name") {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new BootstrapError(`Zu "${argument}" fehlt der Wert.\n\n${usage()}`, 1);
      }
      parsed[argument === "--email" ? "email" : "name"] = value;
      index += 1;
      continue;
    }
    if (argument === "--help" || argument === "-h") {
      throw new BootstrapError(usage(), 1);
    }
    throw new BootstrapError(`Unbekanntes Argument "${argument}".\n\n${usage()}`, 1);
  }
  if (!parsed.email) {
    throw new BootstrapError(`--email fehlt.\n\n${usage()}`, 1);
  }
  return parsed;
}

/**
 * Verdeckte Eingabe einer Zeile am Terminal.
 *
 * Der Rohmodus wird in jedem Fall wieder abgeschaltet, damit das Terminal auch
 * nach einem Abbruch benutzbar bleibt. Es wird kein Echo und kein Platzhalter
 * ausgegeben - die Laenge des Kennworts soll nicht ablesbar sein.
 */
function readHiddenLine(promptText) {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    process.stderr.write(promptText);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    let value = "";
    const finish = (error, result) => {
      stdin.removeListener("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      process.stderr.write("\n");
      if (error) reject(error);
      else resolve(result);
    };
    const onData = (chunk) => {
      for (const character of chunk) {
        if (character === "\r" || character === "\n") {
          finish(null, value);
          return;
        }
        if (character === CTRL_C) {
          finish(new BootstrapError("Abgebrochen.", 1));
          return;
        }
        if (character === BACKSPACE || character === "\b") {
          value = value.slice(0, -1);
          continue;
        }
        if (character < " ") continue;
        value += character;
      }
    };
    stdin.on("data", onData);
  });
}

/** Erste Zeile der Standardeingabe (nicht interaktiver Weg, z. B. Test). */
async function readPipedLine() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8").split(/\r?\n/)[0] ?? "";
}

async function readPassword() {
  if (process.stdin.isTTY) {
    const first = await readHiddenLine("Kennwort fuer den ersten Administrator: ");
    const second = await readHiddenLine("Kennwort wiederholen: ");
    if (first !== second) {
      throw new BootstrapError("Die beiden Eingaben stimmen nicht ueberein.", 2);
    }
    return first;
  }
  return readPipedLine();
}

/**
 * Wendet die ZENTRALEN Passwortregeln an (src/lib/auth-password.ts).
 *
 * Bewusst keine eigene Regel und kein eigener Text: Bootstrap und
 * Passwortwechsel muessen dieselbe Untergrenze durchsetzen, sonst koennte ein
 * Weg schwaechere Passwoerter zulassen als der andere.
 */
function assertPasswordRules(password) {
  const violation = checkPasswordRules(password);
  if (violation !== null) {
    throw new BootstrapError(passwordRuleMessage(violation), 2);
  }
}

/** Die Zielobjekte aus Migration 0012 muessen vorhanden sein. */
async function assertSchemaReady(client) {
  const result = await client.query(
    `select
       to_regclass('public.auth_accounts') is not null as accounts,
       to_regclass('public.auth_sessions') is not null as sessions,
       to_regclass('public.profiles') is not null as profiles`,
  );
  const row = result.rows[0];
  if (!row.accounts || !row.sessions || !row.profiles) {
    throw new BootstrapError(
      "Die Zielobjekte fehlen. Migration 0012 zuerst anwenden (ADR-011 / 2.10).",
      3,
    );
  }
}

/**
 * Ermittelt die Ausgangslage.
 *
 * "Anmeldefaehig" heisst: kodierter Argon2id-Hash (also nicht der Platzhalter
 * der Kompatibilitaetsschicht), Konto nicht deaktiviert, Profil aktiv mit
 * Rolle admin.
 */
async function readState(client, email) {
  const usableAdmins = await client.query(
    `select a.id, a.email
     from public.auth_accounts a
     join public.profiles p on p.id = a.id
     where p.role = 'admin'
       and p.is_active
       and not a.is_disabled
       and a.password_hash like '$argon2id$%'
     order by a.created_at`,
  );

  const requested = await client.query(
    `select
       a.id,
       a.password_hash,
       a.is_disabled,
       p.id is not null as has_profile,
       p.role::text as role,
       p.is_active
     from public.auth_accounts a
     left join public.profiles p on p.id = a.id
     where lower(a.email) = $1::text`,
    [email],
  );

  return { usableAdmins: usableAdmins.rows, account: requested.rows[0] ?? null };
}

/**
 * Legt das Konto samt Profil an bzw. vervollstaendigt ein uebernommenes Konto.
 *
 * `must_change_password` bleibt bewusst `false`: das Kennwort hat der Betreiber
 * selbst verdeckt eingegeben, es wurde niemandem uebergeben. Der Wechselzwang
 * aus ADR-011 / 2.3 gilt fuer administrativ gesetzte Uebergangskennwoerter.
 */
async function applyBootstrap(client, { email, name, passwordHash, account }) {
  if (account === null) {
    const created = await client.query(
      `insert into public.auth_accounts (
         email, password_hash, password_hash_version, must_change_password
       )
       values ($1::text, $2::text, $3::integer, false)
       returning id`,
      [email, passwordHash, PASSWORD_HASH_VERSION],
    );
    const accountId = created.rows[0].id;
    await client.query(
      `insert into public.profiles (id, full_name, role, is_active)
       values ($1::uuid, $2::text, 'admin', true)`,
      [accountId, name ?? email],
    );
    return { accountId, action: "angelegt" };
  }

  await client.query(
    `update public.auth_accounts
     set password_hash = $2::text,
         password_hash_version = $3::integer,
         must_change_password = false,
         failed_attempts = 0,
         locked_until = null
     where id = $1::uuid`,
    [account.id, passwordHash, PASSWORD_HASH_VERSION],
  );
  if (!account.has_profile) {
    await client.query(
      `insert into public.profiles (id, full_name, role, is_active)
       values ($1::uuid, $2::text, 'admin', true)`,
      [account.id, name ?? email],
    );
  }
  return { accountId: account.id, action: "vervollstaendigt" };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const email = normalizeEmail(options.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new BootstrapError("Die E-Mail-Adresse ist nicht verwertbar.", 1);
  }

  const connectionString = process.env.BOOTSTRAP_DATABASE_URL?.trim();
  if (!connectionString) {
    throw new BootstrapError(
      `BOOTSTRAP_DATABASE_URL ist nicht gesetzt.\n\n${usage()}`,
      1,
    );
  }

  const password = await readPassword();
  assertPasswordRules(password);
  // Der Klartext liegt genau hier vor und wird ausschliesslich an Argon2id
  // uebergeben. Danach wird die Referenz aufgegeben.
  const passwordHash = await hashPassword(password);

  const client = new Client({ connectionString, connectionTimeoutMillis: 10_000 });
  await client.connect();
  let committed = false;
  try {
    await client.query("begin");
    await client.query(
      `select
         set_config('statement_timeout', '30000', true),
         set_config('idle_in_transaction_session_timeout', '30000', true)`,
    );
    await client.query("select pg_advisory_xact_lock($1::bigint)", [ADVISORY_LOCK_KEY]);

    await assertSchemaReady(client);
    const state = await readState(client, email);

    const alreadyRequested = state.usableAdmins.some(
      (row) => normalizeEmail(row.email) === email,
    );
    if (alreadyRequested) {
      await client.query("commit");
      committed = true;
      process.stdout.write(
        `Unveraendert: fuer ${email} besteht bereits ein anmeldefaehiger ` +
          "Administrator. Ein Kennwortwechsel gehoert nicht in das Bootstrap.\n",
      );
      return 0;
    }
    if (state.usableAdmins.length > 0) {
      throw new BootstrapError(
        `Es besteht bereits ein anmeldefaehiger Administrator ` +
          `(${state.usableAdmins.length}). Das Bootstrap ist damit verbraucht; ` +
          "weitere Konten werden ueber die Benutzerverwaltung angelegt.",
        3,
      );
    }

    const account = state.account;
    if (account !== null) {
      const completable =
        account.password_hash === MIGRATED_MARKER &&
        !account.is_disabled &&
        (!account.has_profile || (account.role === "admin" && account.is_active));
      if (!completable) {
        throw new BootstrapError(
          `Zur Adresse ${email} besteht bereits ein Konto, dessen Zustand kein ` +
            "Bootstrap zulaesst. Die Ausgangslage ist damit nicht eindeutig.",
          3,
        );
      }
    }

    const applied = await applyBootstrap(client, {
      email,
      name: options.name?.trim() || null,
      passwordHash,
      account,
    });
    await client.query("commit");
    committed = true;
    process.stdout.write(
      `Administrator ${applied.action}: ${email} (Profil ${applied.accountId}, ` +
        "Rolle admin, aktiv).\n",
    );
    return 0;
  } finally {
    if (!committed) {
      try {
        await client.query("rollback");
      } catch {
        // Der Verbindungszustand ist unbekannt; das Schliessen genuegt.
      }
    }
    await client.end();
  }
}

try {
  process.exitCode = await main();
} catch (error) {
  if (error instanceof BootstrapError) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = error.exitCode;
  } else {
    // Meldung ohne Verbindungszeichenfolge und ohne Werte.
    process.stderr.write(
      `Datenbankfehler: ${error instanceof Error ? error.message : "unbekannt"}\n`,
    );
    process.exitCode = 4;
  }
}
