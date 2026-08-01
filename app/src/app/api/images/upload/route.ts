import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { uploadIncidentImages, isImageCategory } from "@/lib/image-upload-core";

// Bild-Upload per multipart/form-data. Wird sowohl vom interaktiven Upload als
// auch vom Offline-Replay (Upload-Warteschlange) genutzt. Auth + RLS serverseitig.
// Optionales Feld `client_action_id` aktiviert die Deduplizierung (Idempotenz) über
// public.sync_actions – ein Retry desselben Warteschlangeneintrags lädt nicht doppelt hoch.
//
// AP14/B: dieser Handler enthält KEINE eigene Markerlogik mehr. Der Dedup-Marker
// ist vollständig in @/lib/image-upload-core gewandert und liegt dort in
// DERSELBEN Transaktion wie der Metadatensatz des Bildes. Warum das zwingend ist:
//
//   * Bisher wurde der Marker VOR dem Upload in einer eigenen Anweisung gesetzt
//     und bei `ok === 0` per Kompensations-DELETE wieder entfernt. Genau dieses
//     DELETE kann app_user nicht ausführen: 0014_ap14b_data_grants.sql:66 vergibt
//     auf public.sync_actions bewusst nur `select, insert`, und der Smoke prüft
//     das ausdrücklich negativ (20_ap14b_data.sql:699).
//   * Ein ignoriertes Kompensations-DELETE hätte einen dauerhaft gesetzten Marker
//     hinterlassen. Der nächste Retry desselben Warteschlangeneintrags hätte dann
//     `duplicate: true` gemeldet, der Client hätte seinen Eintrag als angewendet
//     gelöscht – und das Bild wäre ohne jede Fehleranzeige verloren gegangen.
//   * In einer gemeinsamen Transaktion entfällt die Kompensation: ein Fehlschlag
//     rollt zurück und nimmt den Marker damit selbst mit. Das ist dasselbe
//     Muster wie in app/src/app/api/sync/route.ts:28-32.
//
// Alle Antwortformen, Statuscodes und Meldungstexte bleiben unverändert.
export async function POST(req: Request) {
  const session = await getSessionProfile();
  if (!session) return NextResponse.json({ ok: false, error: "Nicht angemeldet." }, { status: 401 });

  const fd = await req.formData();
  const incidentId = String(fd.get("incident_id") ?? "").trim();
  const category = String(fd.get("category") ?? "").trim();
  const description = String(fd.get("description") ?? "").trim() || null;
  const clientActionId = String(fd.get("client_action_id") ?? "").trim();
  const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);

  if (!incidentId) return NextResponse.json({ ok: false, error: "Kein Vorgang." }, { status: 400 });
  if (!isImageCategory(category)) return NextResponse.json({ ok: false, error: "Ungültige Kategorie." }, { status: 400 });
  if (files.length === 0) return NextResponse.json({ ok: false, error: "Keine Datei." }, { status: 400 });

  // Die Identität stammt ausschließlich aus der geprüften Sitzung und wird nie in
  // einen INSERT geschrieben (Spaltendefaults uploaded_by/actor).
  const { ok, errors, duplicate } = await uploadIncidentImages({
    incidentId,
    category,
    description,
    files,
    userId: session.userId,
    clientActionId,
  });

  // Bereits angewendet: unveränderte Antwortform. Der Client darf seinen
  // Warteschlangeneintrag daraufhin löschen.
  if (duplicate) {
    return NextResponse.json({ ok: true, uploaded: 0, duplicate: true, errors: [] });
  }

  return NextResponse.json({ ok: ok > 0, uploaded: ok, errors }, { status: ok > 0 ? 200 : 400 });
}
