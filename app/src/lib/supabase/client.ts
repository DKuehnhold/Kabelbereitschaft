"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import { SUPABASE_URL, SUPABASE_ANON_KEY, assertSupabaseConfigured } from "./config";

// Supabase-Client fuer Client-Komponenten (Browser).
export function createClient() {
  // AP14/A3: kein Client mit Platzhalterwerten. Fehlt die Konfiguration,
  // bricht der Aufruf mit klarer Meldung ab.
  assertSupabaseConfigured();

  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
}
