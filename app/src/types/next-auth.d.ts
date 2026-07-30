import type { UserRole } from "@/lib/roles";

// AP14/B: Typerweiterungen fuer Auth.js v5.
//
// Bewusst NICHT erweitert wird `JWT`: `@auth/core/jwt` definiert
// `interface JWT extends Record<string, unknown>`, damit ist `token.sid`
// bereits als `unknown` lesbar. Eine Modulerweiterung auf `next-auth/jwt`
// (reiner Re-Export) wuerde ausserdem nicht in die urspruengliche Schnittstelle
// einfliessen und nur den Anschein von Typsicherheit erzeugen. Der Wert wird
// stattdessen in `src/auth.ts` zur Laufzeit geprueft.

declare module "next-auth" {
  /** Rueckgabe von `authorize()`: Konto-ID plus ausgestellte Sitzungs-ID. */
  interface User {
    sid?: string;
  }

  /**
   * Serverseitiges Sitzungsobjekt.
   *
   * Rolle und `mustChangePassword` stehen hier, weil sie in derselben
   * Datenbankauswertung wie der Sitzungswiderruf gelesen werden - nicht, weil
   * sie aus einem Token-Claim stammen (ADR-011 / 2.1).
   */
  interface Session {
    user?: {
      id: string;
      sid: string;
      email: string;
      name: string;
      role: UserRole;
      mustChangePassword: boolean;
    };
  }
}
