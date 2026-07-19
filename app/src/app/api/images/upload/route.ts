import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { uploadIncidentImages, isImageCategory } from "@/lib/image-upload-core";

// Bild-Upload per multipart/form-data. Wird sowohl vom interaktiven Upload als
// auch vom Offline-Replay (Upload-Warteschlange) genutzt. Auth + RLS serverseitig.
export async function POST(req: Request) {
  const session = await getSessionProfile();
  if (!session) return NextResponse.json({ ok: false, error: "Nicht angemeldet." }, { status: 401 });

  const fd = await req.formData();
  const incidentId = String(fd.get("incident_id") ?? "").trim();
  const category = String(fd.get("category") ?? "").trim();
  const description = String(fd.get("description") ?? "").trim() || null;
  const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);

  if (!incidentId) return NextResponse.json({ ok: false, error: "Kein Vorgang." }, { status: 400 });
  if (!isImageCategory(category)) return NextResponse.json({ ok: false, error: "Ungültige Kategorie." }, { status: 400 });
  if (files.length === 0) return NextResponse.json({ ok: false, error: "Keine Datei." }, { status: 400 });

  const { ok, errors } = await uploadIncidentImages({
    incidentId, category, description, files, uploadedBy: session.userId,
  });
  return NextResponse.json({ ok: ok > 0, uploaded: ok, errors }, { status: ok > 0 ? 200 : 400 });
}
