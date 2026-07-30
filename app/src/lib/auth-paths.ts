// AP14/B: Einstufung der Routen fuer den Next-16-Proxy.
//
// Pur und ohne Laufzeitabhaengigkeit, damit die Regel isoliert testbar bleibt
// (app/test/ap14b-auth.test.mjs).
//
// Korrektur gegenueber der abgeloesten Supabase-Middleware: dort wurde
// zusaetzlich `path.startsWith(prefix)` OHNE Trennzeichen geprueft. Damit war
// z. B. `/loginfremd` oder `/authentifizierung` versehentlich oeffentlich.
// Hier gilt: entweder exakte Gleichheit oder Praefix mit `/`.

/** Vollstaendig oeffentlich, auch ohne jede Konfiguration. */
const PUBLIC_EXACT = new Set([
  "/login",
  "/offline",
  "/favicon.ico",
  "/manifest.webmanifest",
  "/sw.js",
  "/api/health",
]);

/** Oeffentliche Teilbaeume (PWA-Ressourcen, Auth-Endpunkte, Branding). */
const PUBLIC_PREFIXES = [
  "/_next",
  "/icons",
  "/branding",
  "/login",
  "/offline",
  // Auth.js-Route und die Abmelderoute muessen ohne gueltige Sitzung
  // erreichbar sein, sonst ist keine Anmeldung und keine Abmeldung moeglich.
  "/api/auth",
  "/auth",
] as const;

/**
 * Routen, die der Proxy vollstaendig unberuehrt durchlaesst.
 *
 * Wichtig: hier darf der Proxy die Sitzung NICHT auswerten. Auth.js setzt auf
 * diesen Routen selbst Cookies (Anmeldung, Abmeldung, Tokenerneuerung). Wuerde
 * der Proxy parallel das alte Sitzungscookie erneuern, koennte er das frisch
 * ausgestellte Cookie derselben Antwort ueberschreiben.
 */
export function isAuthEndpoint(path: string): boolean {
  return (
    path === "/api/auth" ||
    path.startsWith("/api/auth/") ||
    path === "/auth" ||
    path.startsWith("/auth/")
  );
}

/** True, wenn die Route ohne angemeldete Sitzung erreichbar sein muss. */
export function isPublicPath(path: string): boolean {
  if (PUBLIC_EXACT.has(path)) return true;
  return PUBLIC_PREFIXES.some((prefix) => path.startsWith(`${prefix}/`));
}

/** True fuer die Anmeldeseite selbst (dort wird umgekehrt weitergeleitet). */
export function isLoginPath(path: string): boolean {
  return path === "/login" || path.startsWith("/login/");
}

// ---------------------------------------------------------------------------
// Erzwungener Passwortwechsel (ADR-011 / 2.3: "bis dahin ist jede andere Route
// gesperrt")
// ---------------------------------------------------------------------------

/** Pfad des erzwungenen bzw. freiwilligen Passwortwechsels. */
export const PASSWORD_CHANGE_PATH = "/passwort-aendern";

/** Ziel nach erfolgreicher Anmeldung ohne Wechselzwang. */
export const AFTER_LOGIN_PATH = "/dashboard";

/**
 * True fuer den Passwortwechselpfad.
 *
 * Wie bei allen uebrigen Praefixen gilt: entweder exakte Gleichheit oder eine
 * echte Pfadgrenze. `/passwort-aendernx` ist ausdruecklich NICHT dieser Pfad.
 */
export function isPasswordChangePath(path: string): boolean {
  return path === PASSWORD_CHANGE_PATH || path.startsWith(`${PASSWORD_CHANGE_PATH}/`);
}

/** Entscheidung der groben Weiche im Proxy. */
export type AccessDecision =
  | "allow"
  | "to-login"
  | "to-password-change"
  | "to-after-login";

/**
 * Grobe Zugriffsweiche - pur und damit vollstaendig einzeln pruefbar.
 *
 * Die Funktion ist absichtlich frei von Next- und Auth.js-Bezug: sie ist der
 * Ort, an dem die Regel "ein Konto mit Wechselzwang erreicht keine andere
 * Route" als Tabelle nachweisbar ist (ADR-011 / 2.12 e). Der Proxy ist nur die
 * Huelle, die HTTP daraus macht.
 *
 * `mustChangePassword` wird vom Aufrufer fail-closed bestimmt: ein fehlender
 * oder unlesbarer Wert gilt als Wechselzwang, nicht als Freigabe.
 *
 * Sie ist NICHT die Autorisierungsgrenze. Verbindlich gesperrt wird
 * serverseitig in `requireSession()` / `getSessionProfile()` und in der
 * Datenbank durch RLS.
 */
export function evaluateAccess(input: {
  path: string;
  isSignedIn: boolean;
  mustChangePassword: boolean;
}): AccessDecision {
  const { path, isSignedIn, mustChangePassword } = input;

  // Auth.js-Route und Abmelderoute bleiben unberuehrt - sonst waere weder eine
  // Anmeldung noch eine Abmeldung moeglich, und ein Konto mit Wechselzwang
  // koennte sich nicht einmal abmelden.
  if (isAuthEndpoint(path)) return "allow";

  if (isLoginPath(path)) {
    if (!isSignedIn) return "allow";
    return mustChangePassword ? "to-password-change" : "to-after-login";
  }

  // Der Wechselpfad selbst ist die einzige geschuetzte Route, die ein Konto mit
  // Wechselzwang erreicht. Ohne Sitzung bleibt er gesperrt.
  if (isPasswordChangePath(path)) return isSignedIn ? "allow" : "to-login";

  if (isPublicPath(path)) return "allow";

  if (!isSignedIn) return "to-login";
  if (mustChangePassword) return "to-password-change";
  return "allow";
}
