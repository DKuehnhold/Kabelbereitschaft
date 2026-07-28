import { NextResponse } from "next/server";

// Öffentlicher, minimaler Health-Check (AP7). Liefert KEINE internen Details,
// keine Secrets, keine Datenbankinformationen. Für erweiterte Diagnose siehe
// Offline-/Dashboard-Ansicht (nur für angemeldete Nutzer/Administratoren).
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      app: "kabelbereitschaft",
      // AP14/A4: serverseitig gelesen, damit die Version zur LAUFZEIT gesetzt
      // werden kann (ein Image, mehrere Umgebungen). NEXT_PUBLIC_APP_VERSION
      // bleibt uebergangsweise als Rueckfall erhalten, wird aber nicht mehr
      // empfohlen: NEXT_PUBLIC_* wird zur Buildzeit eingebrannt.
      version: process.env.APP_VERSION ?? process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0",
      time: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
