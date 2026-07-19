// Zentrale Supabase-Konfiguration.
// Fallback-Platzhalter, damit Build/Dev auch ohne .env.local nicht abstuerzen.
// Netzwerkaufrufe schlagen mit Platzhaltern bewusst fehl -> App zeigt Hinweis auf Login.
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "anon-key-placeholder";

export const isSupabaseConfigured =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
