import type { NextRequest } from "next/server";

import { handlers } from "@/auth";
import { withoutSessionId } from "@/lib/auth-session-response";

// AP14/B: Auth.js-Routen. Die Sitzungsauskunft an den Browser wird um die
// Sitzungs-ID gekuerzt (Begruendung in src/lib/auth-session-response.ts).
//
// Betroffen ist ausschliesslich dieser HTTP-Weg. Die serverseitige Auswertung
// `auth()` ruft `@auth/core` unmittelbar auf und laeuft nicht durch diesen
// Handler; `getSessionProfile()` erhaelt die Sitzungs-ID also weiterhin und die
// Abmeldung kann unveraendert genau die eigene Sitzung widerrufen.

/** Sitzungsauskunft von Auth.js (Basispfad `/api/auth`). */
function isSessionRequest(request: NextRequest): boolean {
  const path = new URL(request.url).pathname.replace(/\/+$/, "");
  return path.endsWith("/api/auth/session");
}

export async function GET(request: NextRequest): Promise<Response> {
  const response = await handlers.GET(request);
  return isSessionRequest(request) ? withoutSessionId(response) : response;
}

// POST /api/auth/session ist die Sitzungsaktualisierung von Auth.js und
// antwortet ebenfalls mit dem Sitzungsobjekt.
export async function POST(request: NextRequest): Promise<Response> {
  const response = await handlers.POST(request);
  return isSessionRequest(request) ? withoutSessionId(response) : response;
}
