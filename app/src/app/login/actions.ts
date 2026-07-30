"use server";

import { AuthError } from "next-auth";

import { signIn as authSignIn } from "@/auth";
import { isPlatformConfigured } from "@/lib/platform-config";

// AP14/B: Anmeldung ueber Auth.js v5 (Credentials) gegen PostgreSQL.
// Der Supabase-Anmeldepfad ist damit abgeloest.

export type LoginState = { error: string | null };

/**
 * Bewusst eine einzige, nicht unterscheidende Meldung.
 *
 * Unterschiedliche Texte fuer "Konto unbekannt", "Passwort falsch", "Konto
 * gesperrt" oder "Profil inaktiv" waeren eine Benutzeraufzaehlung.
 */
const GENERIC_ERROR = "Anmeldung fehlgeschlagen. Bitte Zugangsdaten prüfen.";

export async function signIn(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  if (!isPlatformConfigured()) {
    return {
      error:
        "Die Anwendung ist noch nicht vollständig konfiguriert. " +
        "Anmeldung erst nach Eintrag der Laufzeitvariablen möglich.",
    };
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Bitte E-Mail und Passwort eingeben." };
  }

  try {
    // Bei Erfolg leitet Auth.js selbst weiter; der Aufruf endet dann mit einem
    // NEXT_REDIRECT-Fehler, der unveraendert nach oben laufen muss.
    await authSignIn("credentials", {
      email,
      password,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      // Der Benutzer sieht ausschliesslich die neutrale Meldung. Fuer den
      // Betrieb wird die Fehlerart protokolliert - ohne Eingabewerte -, weil
      // "Zugangsdaten falsch" und "Datenbank nicht erreichbar" hier sonst
      // ununterscheidbar waeren.
      console.error("Anmeldung abgewiesen", error.type);
      return { error: GENERIC_ERROR };
    }
    throw error;
  }

  // Wird im Regelfall nicht erreicht (Weiterleitung oben).
  return { error: null };
}
