// AP14/B: Einheitentests der serverseitigen Sitzungssperre (ADR-011 / 2.3).
//
// Lauf:  node --test app/test/ap14b-session-guard.test.mjs   (Node >= 22.18)
//
// Geprueft wird der ECHTE `src/lib/auth.ts` - also genau der Code, den jede
// Seite, jede Server Action und jeder geschuetzte Route Handler benutzt. Ersetzt
// werden ausschliesslich die beiden Abhaengigkeiten, die eine Next-Laufzeit
// verlangen: `@/auth` (Auth.js-Instanz) und `next/navigation` (`redirect()`).
// Die Sperre selbst ist unveraendert die der Anwendung.
//
// Warum das eine eigene Datei ist: die Auflösungsregeln gelten prozessweit und
// duerfen die uebrigen Einheitentests nicht beeinflussen.

import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SOURCE_ROOT = new URL("../src/", import.meta.url);
const STUB_AUTH = new URL("./stubs/auth-module.mjs", import.meta.url).href;
const STUB_NAVIGATION = new URL("./stubs/next-navigation.mjs", import.meta.url).href;

function resolveFile(base) {
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
    try {
      if (statSync(fileURLToPath(candidate)).isFile()) return candidate;
    } catch {
      // naechster Kandidat
    }
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/auth") return { url: STUB_AUTH, shortCircuit: true };
    if (specifier === "next/navigation") {
      return { url: STUB_NAVIGATION, shortCircuit: true };
    }
    if (specifier.startsWith("@/")) {
      const found = resolveFile(new URL(specifier.slice(2), SOURCE_ROOT).href);
      if (found) return { url: found, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

const { setFailure, setSession } = await import("./stubs/auth-module.mjs");
const { RedirectSignal } = await import("./stubs/next-navigation.mjs");
const { PASSWORD_CHANGE_PATH } = await import("../src/lib/auth-paths.ts");
const { getSessionProfile, getSessionProfileForPasswordChange, requireSession } =
  await import("../src/lib/auth.ts");

/** Synthetisches Sitzungsobjekt in der Form des `session`-Rueckrufs. */
function session(overrides = {}) {
  return {
    user: {
      id: "a9000000-0000-0000-0000-000000000001",
      sid: "b9000000-0000-0000-0000-0000000000ff",
      email: "person@beispiel.invalid",
      name: "Synthetische Person",
      role: "disponent",
      mustChangePassword: false,
      ...overrides,
    },
  };
}

/** Fuehrt `work()` aus und gibt das Ziel der ausgeloesten Umleitung zurueck. */
async function redirectTargetOf(work) {
  try {
    await work();
  } catch (error) {
    assert.ok(error instanceof RedirectSignal, `keine Umleitung: ${error?.message}`);
    return error.target;
  }
  assert.fail("es wurde keine Umleitung ausgeloest");
}

// ---------------------------------------------------------------------------
// Regelfall ohne Wechselzwang
// ---------------------------------------------------------------------------

test("ohne Wechselzwang liefern beide Wege die Sitzung", async () => {
  setSession(session());

  const profile = await getSessionProfile();
  assert.ok(profile);
  assert.equal(profile.userId, "a9000000-0000-0000-0000-000000000001");
  assert.equal(profile.sessionId, "b9000000-0000-0000-0000-0000000000ff");
  assert.equal(profile.role, "disponent");
  assert.equal(profile.mustChangePassword, false);

  const required = await requireSession();
  assert.equal(required.userId, profile.userId);
});

// ---------------------------------------------------------------------------
// Sperre bei erzwungenem Passwortwechsel (ADR-011 / 2.3, Nachweis 2.12 e)
// ---------------------------------------------------------------------------

test("mit Wechselzwang liefert getSessionProfile() keine Sitzung", async () => {
  // Das ist die eigentliche Sperre: JEDE Server Action und JEDER geschuetzte
  // Route Handler dieser Anwendung liest die Sitzung ueber diesen Weg und
  // behandelt NULL als "nicht berechtigt". Die Sperre liegt damit serverseitig
  // und nicht in einer Client-Komponente.
  setSession(session({ mustChangePassword: true }));
  assert.equal(await getSessionProfile(), null);
});

test("mit Wechselzwang leitet requireSession() auf den Wechselpfad", async () => {
  setSession(session({ mustChangePassword: true }));
  assert.equal(await redirectTargetOf(() => requireSession()), PASSWORD_CHANGE_PATH);
});

test("der Passwortwechsel selbst erhaelt die Sitzung weiterhin", async () => {
  // Ohne diese Ausnahme koennte das Konto den Zwang nicht erfuellen.
  setSession(session({ mustChangePassword: true }));
  const profile = await getSessionProfileForPasswordChange();
  assert.ok(profile);
  assert.equal(profile.mustChangePassword, true);
  assert.equal(profile.email, "person@beispiel.invalid");
});

test("ein fehlender Wert gilt als Wechselzwang, nicht als Freigabe", async () => {
  // Fail-closed: nur ein ausdrueckliches `false` hebt den Zwang auf. Ein
  // fehlendes Feld - etwa nach einer Aenderung am Sitzungsrueckruf - darf nicht
  // versehentlich alle Routen oeffnen.
  for (const value of [undefined, null, "false", 0]) {
    setSession(session({ mustChangePassword: value }));
    assert.equal(await getSessionProfile(), null, String(value));
    assert.equal(
      await redirectTargetOf(() => requireSession()),
      PASSWORD_CHANGE_PATH,
      String(value),
    );
  }
});

// ---------------------------------------------------------------------------
// Fail-closed bei fehlender oder unbrauchbarer Sitzung
// ---------------------------------------------------------------------------

test("ohne Sitzung fuehrt requireSession() auf die Anmeldeseite", async () => {
  for (const value of [null, {}, { user: undefined }, { user: { id: "x" } }]) {
    setSession(value);
    assert.equal(await getSessionProfile(), null, JSON.stringify(value));
    assert.equal(
      await redirectTargetOf(() => requireSession()),
      "/login",
      JSON.stringify(value),
    );
  }
});

test("eine gescheiterte Auswertung gilt als nicht angemeldet", async () => {
  setFailure(new Error("synthetischer Auswertungsfehler"));
  assert.equal(await getSessionProfile(), null);

  setFailure(new Error("synthetischer Auswertungsfehler"));
  assert.equal(await getSessionProfileForPasswordChange(), null);

  setFailure(new Error("synthetischer Auswertungsfehler"));
  assert.equal(await redirectTargetOf(() => requireSession()), "/login");
});
