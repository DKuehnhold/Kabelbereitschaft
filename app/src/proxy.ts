import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import {
  AFTER_LOGIN_PATH,
  PASSWORD_CHANGE_PATH,
  evaluateAccess,
  isAuthEndpoint,
  isPublicPath,
} from "@/lib/auth-paths";
import { isPlatformConfigured } from "@/lib/platform-config";

// AP14/B: Next-16-Proxy als Ersatz fuer `middleware.ts` samt
// Supabase-Sessionerneuerung (Roadmap B.1 Punkt 5, ADR-011).
//
// Der Proxy laeuft in Next 16 immer auf der Node.js-Laufzeit; eine
// Laufzeitangabe ist hier deshalb nicht zulaessig.
//
// Aufgabenteilung - bewusst und nicht beliebig:
//   - Der Proxy ist die GROBE Weiche: nicht angemeldet -> /login, angemeldet
//     auf /login -> /dashboard, ausstehender Passwortwechsel -> Wechselpfad.
//     Er ist NICHT die Autorisierungsgrenze.
//   - Er ist zugleich der einzige Ort, an dem die stille Tokenerneuerung
//     tatsaechlich beim Browser ankommt: Auth.js stellt den JWT bei jeder
//     Sitzungsauswertung neu aus, aber nur Proxy und Route Handler duerfen
//     Cookies schreiben. Wuerde die Sitzung ausschliesslich in Server-
//     Komponenten ausgewertet, waere der Benutzer nach 10 Minuten abgemeldet.
//   - Verbindlich autorisiert wird serverseitig: `requireSession()` in jeder
//     Seite und jeder Server Action, dazu RLS in der Datenbank.
//   - Der erzwungene Passwortwechsel (ADR-011 / 2.3) wird hier ebenfalls nur
//     GELENKT. Gesperrt wird er in `src/lib/auth.ts`: `requireSession()` leitet
//     um und `getSessionProfile()` liefert NULL, solange der Wechsel aussteht.
//     Die Weiche im Proxy ist Bedienkomfort, nicht die Sperre.
//
// Die Regel selbst liegt in `lib/auth-paths.ts` (`evaluateAccess`) und ist dort
// pur und vollstaendig einzeln geprueft.

/**
 * Sitzungsauswertung von Auth.js. Ruft `validateSession()` und damit die
 * serverseitige Widerrufspruefung; das erneuerte Sitzungscookie wird an die
 * Antwort angehaengt.
 */
const withSession = auth(async (request) => {
  const user = request.auth?.user;
  const isSignedIn = Boolean(user?.id);

  const decision = evaluateAccess({
    path: request.nextUrl.pathname,
    isSignedIn,
    // Fail-closed: nur ein ausdrueckliches `false` aus der Datenbank hebt den
    // Wechselzwang auf. Ein fehlendes oder unerwartetes Feld gilt als Zwang.
    mustChangePassword: isSignedIn && user?.mustChangePassword !== false,
  });

  switch (decision) {
    case "allow":
      return NextResponse.next();
    case "to-login":
      return redirectTo(request, "/login");
    case "to-password-change":
      return redirectTo(request, PASSWORD_CHANGE_PATH);
    case "to-after-login":
      return redirectTo(request, AFTER_LOGIN_PATH);
  }
});

function redirectTo(request: NextRequest, pathname: string): NextResponse {
  const target = request.nextUrl.clone();
  target.pathname = pathname;
  target.search = "";
  return NextResponse.redirect(target);
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Auth.js-Route und Abmelderoute setzen selbst Cookies (Anmeldung,
  // Abmeldung). Der Proxy darf die Sitzung hier nicht auswerten, sonst koennte
  // er das frisch ausgestellte Cookie derselben Antwort ueberschreiben.
  if (isAuthEndpoint(path)) return NextResponse.next();

  // Ohne Laufzeitkonfiguration kann keine Sitzung bestehen. Auth.js wuerde mit
  // fehlendem AUTH_SECRET bei jedem Request abbrechen; statt eines
  // Serverfehlers bleiben die oeffentlichen Routen erreichbar und alles andere
  // fuehrt auf die Anmeldeseite (unveraendertes Verhalten gegenueber der
  // abgeloesten Middleware).
  if (!isPlatformConfigured()) {
    return isPublicPath(path) ? NextResponse.next() : redirectTo(request, "/login");
  }

  // `auth()` mit einer einparametrigen Rueckrufsignatur ergibt die
  // Route-Handler-Fassung. Auth.js gibt den zweiten Parameter unveraendert an
  // den Rueckruf weiter; der Proxy braucht ihn nicht und uebergibt deshalb
  // einen leeren Kontext.
  return withSession(request, { params: Promise.resolve({}) });
}

export const config = {
  matcher: [
    // Alles ausser statischen Assets und PWA-Ressourcen (sw.js, Manifest).
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|api/health|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
