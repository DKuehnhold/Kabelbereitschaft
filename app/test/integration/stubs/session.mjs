// Ersatz fuer `@/lib/auth` in den Integrationstests der Fachmodule.
//
// `src/lib/auth.ts` importiert `@/auth` (vollstaendige Auth.js-Instanz),
// `next/navigation` und `react`'s `cache`. Alle drei verlangen eine
// Next-Laufzeit mit Request-Kontext. Fuer die Fachmodule ist davon genau eines
// wichtig: WELCHE Identitaet und WELCHE Rolle `getSessionProfile()` liefert.
// Genau das wird hier steuerbar gemacht.
//
// Was hier NICHT geprueft wird und auch nicht geprueft werden soll: die
// Sitzungsauswertung selbst. Sie ist abgedeckt durch
// `app/test/ap14b-auth.test.mjs`, `app/test/ap14b-session-guard.test.mjs`
// (echter `src/lib/auth.ts`) und `app/test/integration/ap14b-platform.int.mjs`
// (echter `validateSession()` gegen echtes PostgreSQL).
//
// Das Profil hat genau die Form von `SessionProfile` aus `src/lib/auth.ts`:
// userId, sessionId, email, fullName, role, mustChangePassword.

let profile = null;

/** Legt die Identitaet fest, mit der die Fachmodule als naechstes laufen. */
export function setSession(next) {
  profile = next ?? null;
}

/** Keine Sitzung - der fail-closed Pfad der Fachmodule. */
export function clearSession() {
  profile = null;
}

/**
 * Sitzung fuer Seiten, Server Actions und Route Handler.
 *
 * `mustChangePassword = true` wird wie im Produktionscode behandelt: der Wert
 * laesst diese Funktion NULL liefern (ADR-011 / 2.3, `src/lib/auth.ts`).
 * Dadurch ist der fail-closed Pfad auch im Test nachweisbar, ohne die
 * Sitzungssperre nachzubilden.
 */
export async function getSessionProfile() {
  if (!profile) return null;
  if (profile.mustChangePassword) return null;
  return profile;
}

/** Sitzung EINSCHLIESSLICH ausstehendem Passwortwechsel - wie im Original. */
export async function getSessionProfileForPasswordChange() {
  return profile;
}

/**
 * Sitzung fuer eine geschuetzte Seite.
 *
 * Das Original leitet mit `redirect()` um; `next/navigation` steht hier nicht
 * zur Verfuegung. Der Ersatz wirft deshalb einen erkennbaren Fehler. Kein
 * Fachmodul dieses Tests benutzt diesen Weg - die Funktion existiert nur, damit
 * die Schnittstelle vollstaendig ist.
 */
export async function requireSession() {
  if (!profile) throw new Error("requireSession: keine Sitzung (Umleitung /login)");
  if (profile.mustChangePassword) {
    throw new Error("requireSession: Passwortwechsel ausstehend (Umleitung)");
  }
  return profile;
}
