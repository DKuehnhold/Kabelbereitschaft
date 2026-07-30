// AP14/B: Pflichtkonfiguration der internen Plattform (ADR-011).
//
// Es werden ausschliesslich NAMEN gefuehrt und gemeldet - niemals Werte.
//
// Bewusst KEIN "server-only", aber ebenso bewusst kein Import in einer
// Client-Komponente: die beiden Variablen sind serverseitige Geheimnisse und
// duerfen nicht in ein Client-Bundle geraten. Die Anmeldeseite ermittelt den
// Zustand deshalb in der Server-Komponente und uebergibt nur ein boolean.
//
// Die Werte werden bei jedem Aufruf frisch aus process.env gelesen, nicht beim
// Modulimport. Damit ist der Zustand zur Laufzeit maessgeblich und kein
// Buildzeitzustand - wichtig fuer den Produktions-Build, der ohne Geheimnisse
// laeuft.

export const PLATFORM_ENV_KEYS = ["DATABASE_URL", "AUTH_SECRET"] as const;

/** Namen der fehlenden Pflichtvariablen. Enthaelt niemals Werte. */
export function missingPlatformConfigKeys(): string[] {
  return PLATFORM_ENV_KEYS.filter((name) => {
    const value = process.env[name];
    return value === undefined || value.trim() === "";
  });
}

/** True, wenn Datenbank und Auth-Geheimnis zur Laufzeit gesetzt sind. */
export function isPlatformConfigured(): boolean {
  return missingPlatformConfigKeys().length === 0;
}

/**
 * Bricht mit klarer Meldung ab, wenn die Pflichtkonfiguration fehlt.
 * Bewusst kein Fallback: ein Zugriff ohne Konfiguration ist ein Fehler.
 */
export function assertPlatformConfigured(): void {
  const missing = missingPlatformConfigKeys();
  if (missing.length === 0) return;
  throw new Error(
    `Konfiguration fehlt: ${missing.join(", ")}. ` +
      "Werte in der Environment-Datei der Umgebung setzen " +
      "(Vorlage: deploy/env/app.env.example bzw. app/.env.example).",
  );
}
