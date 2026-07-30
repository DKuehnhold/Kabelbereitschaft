// Ersatz fuer `@/auth` in den Einheitentests der Sitzungssperre.
//
// `src/auth.ts` baut beim Import eine vollstaendige Auth.js-Instanz auf und
// benoetigt dafuer Next-Laufzeit und Datenbank. Fuer die Pruefung von
// `src/lib/auth.ts` ist davon nur eines wichtig: was `auth()` zurueckgibt.
// Genau das wird hier steuerbar gemacht - der zu pruefende Code bleibt
// unveraendert der echte.

let nextResult = null;
let nextError = null;

/** Legt fest, was der naechste `auth()`-Aufruf liefert. */
export function setSession(session) {
  nextResult = session;
  nextError = null;
}

/** Legt fest, dass der naechste `auth()`-Aufruf scheitert. */
export function setFailure(error) {
  nextResult = null;
  nextError = error;
}

export async function auth() {
  if (nextError) throw nextError;
  return nextResult;
}

export const handlers = {};
export async function signIn() {}
export async function signOut() {}
