import { cache } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { PASSWORD_CHANGE_PATH } from "@/lib/auth-paths";
import type { UserRole } from "@/lib/roles";

// AP14/B: zentrale Sitzungsauswertung fuer Seiten, Server Actions und Route
// Handler. Der Supabase-Auth-Zugriff ist hier vollstaendig abgeloest; die
// Schnittstelle (`getSessionProfile`, `requireSession`) bleibt unveraendert,
// damit die noch nicht migrierten Datenmodule unberuehrt bleiben.
//
// Was bei jedem Aufruf tatsaechlich geprueft wird (ADR-011 / 2.2):
//   1. Cookie lesen, JWE entschluesseln, Ablauf pruefen  (Auth.js)
//   2. `sid` in `auth_sessions`: vorhanden, nicht widerrufen, nicht abgelaufen
//   3. Konto nicht deaktiviert, Profil aktiv
//   4. Rolle aus `profiles` - aus der Datenbank, nicht aus einem Claim
// Schritte 2 bis 4 laufen in einer Anweisung im Transaktions-Wrapper
// (`validateSession`).

export type SessionProfile = {
  userId: string;
  sessionId: string;
  email: string;
  fullName: string;
  role: UserRole;
  /**
   * Konto verlangt einen Passwortwechsel (ADR-011 / 2.3).
   *
   * Solange der Wert `true` ist, ist jede andere Route gesperrt: `requireSession()`
   * leitet auf den Wechselpfad um und `getSessionProfile()` liefert NULL.
   */
  mustChangePassword: boolean;
};

/**
 * Rohe Sitzungsauswertung - OHNE die Sperre des erzwungenen Passwortwechsels.
 *
 * Pro Request gecached, damit mehrere Aufrufe innerhalb einer Anfrage nicht
 * mehrfach gegen die Datenbank laufen. Faellt fail-closed aus: jeder Fehler
 * ergibt "nicht angemeldet".
 *
 * Bewusst modulprivat. Es gibt genau zwei Aufrufwege, die eine Sitzung mit
 * ausstehendem Passwortwechsel sehen duerfen (siehe
 * `getSessionProfileForPasswordChange`); alles andere geht ueber
 * `getSessionProfile()` bzw. `requireSession()`.
 */
const readSessionProfile = cache(async (): Promise<SessionProfile | null> => {
  try {
    const session = await auth();
    const user = session?.user;
    if (!user?.id || !user.sid) return null;

    return {
      userId: user.id,
      sessionId: user.sid,
      email: user.email,
      fullName: user.name,
      role: user.role,
      // Fail-closed: nur ein ausdrueckliches `false` hebt den Zwang auf.
      mustChangePassword: user.mustChangePassword !== false,
    };
  } catch (error) {
    // Kein Weiterwerfen: eine nicht auswertbare Sitzung ist "nicht angemeldet".
    // Die Meldung nennt keine Werte.
    console.error(
      "Sitzungsauswertung fehlgeschlagen",
      error instanceof Error ? error.message : "unbekannter Fehler",
    );
    return null;
  }
});

/**
 * Sitzung fuer Seiten, Server Actions und Route Handler.
 *
 * Liefert NULL, solange das Konto einen Passwortwechsel erzwingt (ADR-011 / 2.3:
 * "bis dahin ist jede andere Route gesperrt"). Das ist die eigentliche Sperre
 * und nicht die Weiche im Proxy:
 *
 *   * Sie wirkt serverseitig und liegt nicht in einer Client-Komponente.
 *   * Sie wirkt in JEDER bestehenden Server Action und JEDEM geschuetzten Route
 *     Handler, ohne dass dort etwas ergaenzt werden muss - alle behandeln NULL
 *     bereits als "nicht berechtigt" und antworten fail-closed.
 *   * Sie kann nicht vergessen werden: es gibt keinen zweiten Weg zur Sitzung.
 *
 * Bewusst nicht unterschieden wird nach aussen zwischen "nicht angemeldet" und
 * "Passwortwechsel ausstehend". Der Benutzer wird ueber den Seitenweg gelenkt
 * (`requireSession()` bzw. Proxy); eine API-Antwort soll ueber den Kontozustand
 * nichts aussagen.
 */
export async function getSessionProfile(): Promise<SessionProfile | null> {
  const profile = await readSessionProfile();
  if (!profile) return null;
  if (profile.mustChangePassword) return null;
  return profile;
}

/**
 * Sitzung EINSCHLIESSLICH ausstehendem Passwortwechsel.
 *
 * Ausschliesslich fuer die beiden Wege, die einem gesperrten Konto offen stehen
 * muessen: der Passwortwechsel selbst (`/passwort-aendern` samt Server Action)
 * und die Abmeldung (`/auth/signout`). Ohne diese Ausnahme waere ein Konto mit
 * Wechselzwang vollstaendig handlungsunfaehig - es koennte den Zwang nicht
 * erfuellen und sich nicht abmelden.
 */
export async function getSessionProfileForPasswordChange(): Promise<SessionProfile | null> {
  return readSessionProfile();
}

/**
 * Sitzung fuer eine geschuetzte Seite. Leitet fail-closed um:
 * keine Sitzung -> `/login`, ausstehender Passwortwechsel -> Wechselpfad.
 */
export async function requireSession(): Promise<SessionProfile> {
  const profile = await readSessionProfile();
  if (!profile) redirect("/login");
  if (profile.mustChangePassword) redirect(PASSWORD_CHANGE_PATH);
  return profile;
}
