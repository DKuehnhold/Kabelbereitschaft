// Zentrale Supabase-Konfiguration.
//
// AP14 / A3: Die frueheren stillen Platzhalter ("http://127.0.0.1:54321",
// "anon-key-placeholder") sind entfernt. Eine fehlende Konfiguration darf
// nicht wie eine vorhandene aussehen - sie fuehrt jetzt zu einer klaren
// Meldung statt zu Netzwerkaufrufen gegen einen Platzhalter.
//
// Wo die Pruefung greift:
//   - Containerstart: docker/verify-runtime-config.mjs bricht den Start bei
//     fehlenden Pflichtvariablen mit Exit-Code 78 ab.
//   - Laufzeit: assertSupabaseConfigured() in den Client-Fabriken
//     (client.ts, server.ts) wirft mit eindeutiger Meldung.
//   - Anzeige: isSupabaseConfigured steuert unveraendert den Hinweis auf der
//     Login-Seite und den Kurzschluss in middleware.ts. Dieses Verhalten
//     bleibt bewusst erhalten - der Build und die oeffentlichen Routen
//     funktionieren ohne Konfiguration weiter.
//
// Wichtig fuer Next.js: NEXT_PUBLIC_*-Variablen werden nur bei LITERALEM
// Zugriff (process.env.NEXT_PUBLIC_X) in die Client-Bundles eingesetzt.
// Ein dynamischer Zugriff (process.env[name]) wuerde im Browser undefined
// ergeben. Der Zugriff bleibt deshalb absichtlich ausgeschrieben.

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const rawAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const SUPABASE_URL = typeof rawUrl === "string" ? rawUrl.trim() : "";

export const SUPABASE_ANON_KEY =
  typeof rawAnonKey === "string" ? rawAnonKey.trim() : "";

export const isSupabaseConfigured = SUPABASE_URL !== "" && SUPABASE_ANON_KEY !== "";

/** Namen der fehlenden Pflichtvariablen. Enthaelt niemals Werte. */
export function missingSupabaseConfigKeys(): string[] {
  const missing: string[] = [];
  if (SUPABASE_URL === "") missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (SUPABASE_ANON_KEY === "") missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return missing;
}

/**
 * Bricht mit klarer Meldung ab, wenn die Pflichtkonfiguration fehlt.
 * Bewusst kein Fallback: ein Zugriff ohne Konfiguration ist ein Fehler,
 * kein Sonderfall. Die Meldung nennt ausschliesslich Variablennamen.
 */
export function assertSupabaseConfigured(): void {
  const missing = missingSupabaseConfigKeys();
  if (missing.length === 0) return;
  throw new Error(
    `Konfiguration fehlt: ${missing.join(", ")}. ` +
      "Werte in der Environment-Datei der Umgebung setzen " +
      "(Vorlage: deploy/env/app.env.example bzw. app/.env.example).",
  );
}
