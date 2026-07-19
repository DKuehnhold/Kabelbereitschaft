import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth";
import { uploadIncidentImages, isImageCategory } from "@/lib/image-upload-core";

// Bild-Upload per multipart/form-data. Wird sowohl vom interaktiven Upload als
// auch vom Offline-Replay (Upload-Warteschlange) genutzt. Auth + RLS serverseitig.
// Optionales Feld `client_action_id` aktiviert die Deduplizierung (Idempotenz) über
// public.sync_actions – ein Retry desselben Warteschlangeneintrags lädt nicht doppelt hoch.
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

  const supabase = await createClient();
  let markerId: string | null = null;

  // Dedup-Marker (nur wenn eine stabile Client-Action-ID mitgeliefert wird).
  if (clientActionId) {
    const marker = await supabase
      .from("sync_actions")
      .insert({ client_action_id: clientActionId, kind: "image", incident_id: incidentId })
      .select("id")
      .single();
    if (marker.error) {
      if (marker.error.code === "23505") {
        return NextResponse.json({ ok: true, uploaded: 0, duplicate: true, errors: [] });
      }
      return NextResponse.json({ ok: false, error: marker.error.message }, { status: 400 });
    }
    markerId = marker.data.id as string;
  }

  const { ok, errors } = await uploadIncidentImages({
    incidentId, category, description, files, uploadedBy: session.userId,
  });

  if (ok === 0 && markerId) {
    // Anwendung fehlgeschlagen → Marker entfernen, damit ein Retry erneut versucht.
    await supabase.from("sync_actions").delete().eq("id", markerId);
  }
  return NextResponse.json({ ok: ok > 0, uploaded: ok, errors }, { status: ok > 0 ? 200 : 400 });
}
