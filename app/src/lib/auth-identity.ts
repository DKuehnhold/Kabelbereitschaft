import { createHmac } from "node:crypto";

// AP14/B: Normalisierung und Pseudonymisierung der Anmeldemerkmale.
//
// Bewusst ohne "server-only" und ohne Datenbankbezug, damit die Regeln isoliert
// testbar bleiben (app/test/ap14b-auth.test.mjs). Verwendet wird das Modul
// ausschliesslich serverseitig.

/** Pseudonymisierte Herkunftsmerkmale einer Anmeldung. */
export type LoginContext = {
  ipHash: string | null;
  userAgentHash: string | null;
};

/**
 * Normalisierung der E-Mail-Adresse.
 *
 * Bewusst `toLowerCase()` ohne Locale: der eindeutige Index in Migration `0012`
 * ist `lower(email)` in der Datenbankkollation. Ein locale-abhaengiges
 * Kleinschreiben (z. B. "de-DE") kann davon abweichen und dann eine Adresse
 * erzeugen, die der Index nicht findet.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Pseudonymisiert ein Herkunftsmerkmal mit HMAC-SHA256 unter AUTH_SECRET.
 *
 * Ein reiner SHA-256 ueber eine IP-Adresse ist keine Pseudonymisierung: der
 * Wertebereich ist klein genug, um ihn vollstaendig durchzurechnen. Ohne
 * AUTH_SECRET wird deshalb bewusst NULL gespeichert statt eines umkehrbaren
 * Hashes.
 *
 * Vertrauensgrenze: `x-forwarded-for` ist clientseitig faelschbar, solange der
 * Header nicht vom internen Reverse-Proxy gesetzt und ueberschrieben wird. Der
 * Wert ist deshalb ausschliesslich ein Diagnosemerkmal und traegt keine
 * Sicherheitsentscheidung.
 */
export function hashClientHint(value: string | null | undefined): string | null {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret) return null;
  const input = value?.trim();
  if (!input) return null;
  return createHmac("sha256", secret).update(input).digest("hex");
}

/** Baut den Anmeldekontext aus den Kopfzeilen einer Anfrage. */
export function loginContextFromRequest(request: Request | undefined): LoginContext {
  const headers = request?.headers;
  // Nur die erste Station: die weiteren Eintraege einer Proxykette sind fuer die
  // Diagnose ohne Wert und vergroessern nur die gespeicherte Datenmenge.
  const forwardedFor = headers?.get("x-forwarded-for")?.split(",")[0] ?? null;
  return {
    ipHash: hashClientHint(forwardedFor),
    userAgentHash: hashClientHint(headers?.get("user-agent")),
  };
}
