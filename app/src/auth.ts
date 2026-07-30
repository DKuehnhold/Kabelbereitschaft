import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { JWT } from "@auth/core/jwt";

import { loginContextFromRequest } from "@/lib/auth-identity";
import {
  authenticateCredentials,
  revokeSession,
  validateSession,
  type ValidatedSession,
} from "@/lib/auth-service";

// AP14/B: Auth.js v5 mit Credentials-Provider gemaess ADR-011 / 2.1.
//
// Verbindliche Eigenschaften:
//   - Der JWT traegt ausschliesslich `sub` und `sid`. Auth.js ergaenzt lediglich
//     `iat`, `exp` und `jti`. Keine Rolle, keine Berechtigung, kein Name.
//   - Der JWT ist verschluesselt: Auth.js verwendet standardmaessig JWE mit
//     A256CBC-HS512 (abgeleitet aus AUTH_SECRET), nicht nur eine Signatur.
//   - Lebensdauer 10 Minuten mit stiller Erneuerung. Bei der jwt-Strategie
//     stellt Auth.js das Token bei jeder Sitzungsauswertung neu aus; die
//     Erneuerung wirkt nur, wenn die Auswertung in einem Kontext laeuft, der
//     Cookies schreiben darf - deshalb wertet `proxy.ts` die Sitzung aus.
//   - Der serverseitige Widerruf wird bei JEDER Auswertung geprueft
//     (jwt-Callback -> validateSession). Ein Widerruf wirkt beim naechsten
//     Request, nicht erst beim Ablauf des Tokens.
//   - Rolle, Anzeigename und `mustChangePassword` stammen ausschliesslich aus
//     der Datenbank. Sie stehen im serverseitigen Sitzungsobjekt, niemals im
//     Token.

/** Kurze Tokenlebensdauer gemaess ADR-011 / 2.1 (Vorschlag: 10 Minuten). */
const JWT_MAX_AGE_SECONDS = 10 * 60;

/**
 * Uebergabe des in `jwt` bereits geprueften Ergebnisses an `session`.
 *
 * Auth.js ruft `session({ session, token })` mit genau dem Objekt auf, das
 * `jwt` zurueckgegeben hat. Ein `WeakMap` auf diesem Objekt vermeidet die
 * zweite, identische Datenbankabfrage im selben Request und kann - anders als
 * ein Modul-Cache mit Schluessel - nichts zwischen Requests vermischen.
 */
const validatedByToken = new WeakMap<JWT, ValidatedSession>();

/** Liest einen Zeichenketten-Claim, ohne dem Token zu vertrauen. */
function stringClaim(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Betrieb hinter dem internen Reverse-Proxy: die Host-Kopfzeile der
  // Weiterleitung ist maessgeblich (ADR-011 / Containerbetrieb).
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: JWT_MAX_AGE_SECONDS,
  },
  jwt: {
    maxAge: JWT_MAX_AGE_SECONDS,
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-Mail", type: "email" },
        password: { label: "Passwort", type: "password" },
      },
      async authorize(credentials, request) {
        const email = typeof credentials.email === "string" ? credentials.email : "";
        const password =
          typeof credentials.password === "string" ? credentials.password : "";

        const session = await authenticateCredentials(
          email,
          password,
          loginContextFromRequest(request),
        );
        if (!session) return null;

        // Nur `id` und `sid` werden weitergegeben. `email` und `name` traegt
        // Auth.js sonst in den Token; das ist hier ausdruecklich nicht gewollt
        // (siehe jwt-Callback: der Token wird vollstaendig neu aufgebaut).
        return { id: session.userId, sid: session.sessionId };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Anmeldung: der Token wird vollstaendig neu aufgebaut, damit keine von
      // Auth.js ergaenzten Felder (name, email, picture) im Token landen.
      if (user) {
        const sub = stringClaim(user.id);
        const sid = stringClaim(user.sid);
        if (!sub || !sid) return null;
        return { sub, sid };
      }

      const sub = stringClaim(token.sub);
      const sid = stringClaim(token.sid);
      // `null` loescht das Sitzungscookie. Ein leeres Token wuerde dagegen
      // weiterbestehen und bei jedem Request erneut geprueft werden.
      if (!sub || !sid) return null;

      const validated = await validateSession(sub, sid);
      if (!validated) return null;

      const next: JWT = { sub, sid };
      validatedByToken.set(next, validated);
      return next;
    },

    async session({ session, token }) {
      const sub = stringClaim(token.sub);
      const sid = stringClaim(token.sid);
      if (!sub || !sid) return { ...session, user: undefined };

      // Regelfall: Ergebnis aus dem jwt-Callback desselben Requests. Der
      // Rueckfall deckt Aufrufwege ab, in denen `jwt` das Token nicht neu
      // erzeugt hat, und bleibt damit fail-closed statt fail-open.
      const validated = validatedByToken.get(token) ?? (await validateSession(sub, sid));
      if (!validated) return { ...session, user: undefined };

      return {
        ...session,
        user: {
          id: validated.userId,
          // `sid` ist kein Zugangsmerkmal: eine Sitzung laesst sich damit nicht
          // uebernehmen, weil dafuer das verschluesselte Cookie noetig ist. Er
          // wird serverseitig fuer den Widerruf bei der Abmeldung benoetigt.
          sid: validated.sessionId,
          email: validated.email,
          name: validated.fullName,
          role: validated.role,
          mustChangePassword: validated.mustChangePassword,
        },
      };
    },
  },
  events: {
    /**
     * Sicherheitsnetz fuer jede von Auth.js ausgeloeste Abmeldung.
     *
     * Der fachliche Weg ist `/auth/signout`: dort wird zuerst widerrufen und
     * ein Fehlschlag ist sichtbar. Auth.js faengt Fehler in diesem Ereignis ab
     * und loescht das Cookie trotzdem - ein hier verlorener Widerruf wuerde
     * also unbemerkt bleiben. Deshalb wird er zusaetzlich protokolliert.
     */
    async signOut(message) {
      if (!("token" in message)) return;
      const sub = stringClaim(message.token?.sub);
      const sid = stringClaim(message.token?.sid);
      if (!sub || !sid) return;
      try {
        await revokeSession(sub, sid, "signout");
      } catch (error) {
        console.error(
          "Abmeldung: serverseitiger Sitzungswiderruf fehlgeschlagen",
          error instanceof Error ? error.message : "unbekannter Fehler",
        );
        throw error;
      }
    },
  },
});
