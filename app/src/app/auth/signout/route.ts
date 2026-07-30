import { NextResponse } from "next/server";

import { signOut } from "@/auth";
import { getSessionProfileForPasswordChange } from "@/lib/auth";
import { revokeSession } from "@/lib/auth-service";
import { isPlatformConfigured } from "@/lib/platform-config";

// AP14/B: Abmeldung mit serverseitigem Sitzungswiderruf (ADR-011 / 2.2).
// Der Supabase-Abmeldepfad ist damit abgeloest. Die URL bleibt unveraendert,
// damit die bestehenden Abmelde-Formulare nicht angepasst werden muessen.

export const dynamic = "force-dynamic";

/**
 * Same-Origin-Pruefung.
 *
 * Route Handler haben - anders als Server Actions - keinen eingebauten
 * Herkunftsschutz. Ohne diese Pruefung koennte eine fremde Seite eine
 * Abmeldung ausloesen (Logout-CSRF). Gepruefte Reihenfolge: `Sec-Fetch-Site`
 * (von aktuellen Browsern gesetzt), sonst `Origin` gegen den eigenen Host.
 */
function isSameOrigin(request: Request): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite !== null) return fetchSite === "same-origin" || fetchSite === "none";

  const origin = request.headers.get("origin");
  if (origin === null) return true; // klassisches Formular ohne Origin-Kopfzeile
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const loginUrl = new URL("/login", request.url);

  if (!isSameOrigin(request)) {
    return new NextResponse("Abmeldung nur von derselben Herkunft möglich.", {
      status: 403,
    });
  }

  // Ohne Laufzeitkonfiguration kann keine Sitzung bestehen; Auth.js wuerde beim
  // Abmelden mit fehlendem AUTH_SECRET abbrechen.
  if (!isPlatformConfigured()) {
    return NextResponse.redirect(loginUrl, { status: 303 });
  }

  // Zuerst der fachliche Widerruf: hier ist ein Fehlschlag sichtbar. Auth.js
  // faengt Fehler in `events.signOut` ab und loescht das Cookie trotzdem, ein
  // dort verlorener Widerruf wuerde also unbemerkt bleiben.
  //
  // Ausdruecklich die Fassung MIT ausstehendem Passwortwechsel: ein Konto, das
  // noch wechseln muss, ist nach ADR-011 / 2.3 fuer jede andere Route gesperrt -
  // aber die Abmeldung muss ihm offen bleiben. Sonst koennte es sich nicht
  // abmelden und die Sitzung bliebe bis zum Ablauf serverseitig offen.
  const profile = await getSessionProfileForPasswordChange();
  if (profile) {
    try {
      await revokeSession(profile.userId, profile.sessionId, "signout");
    } catch (error) {
      console.error(
        "Abmeldung: Sitzungswiderruf fehlgeschlagen",
        error instanceof Error ? error.message : "unbekannter Fehler",
      );
      return new NextResponse(
        "Abmeldung nicht möglich: die Sitzung konnte serverseitig nicht " +
          "widerrufen werden. Bitte erneut versuchen.",
        { status: 503 },
      );
    }
  }

  // Loescht das Sitzungscookie. `events.signOut` laeuft dabei erneut; der
  // Widerruf ist idempotent und erzeugt keinen zweiten Auditeintrag.
  await signOut({ redirect: false });

  return NextResponse.redirect(loginUrl, { status: 303 });
}
