import { createClient } from "@/lib/supabase/server";
import { IMAGE_BUCKET, SIGNED_URL_TTL, type GalleryImage } from "@/lib/images";
import type { ImageCategory } from "@/lib/status";

type ImageRecord = {
  id: string;
  incident_id: string;
  file_name: string;
  mime_type: string;
  file_size: number | string;
  storage_path: string;
  category: ImageCategory;
  description: string | null;
  taken_at: string | null;
  uploaded_at: string;
  uploaded_by: string | null;
  camera_model: string | null;
  gps_lat: number | string | null;
  gps_lon: number | string | null;
  orientation: number | null;
  width: number | null;
  height: number | null;
};

const numOrNull = (v: unknown): number | null =>
  v === null || v === undefined ? null : Number.isFinite(Number(v)) ? Number(v) : null;

// Nicht gelöschte Bilder eines Vorgangs inkl. signierter URLs. RLS greift.
export async function listIncidentImages(incidentId: string): Promise<GalleryImage[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("incident_images")
    .select(
      "id, incident_id, file_name, mime_type, file_size, storage_path, category, description, taken_at, uploaded_at, uploaded_by, camera_model, gps_lat, gps_lon, orientation, width, height",
    )
    .eq("incident_id", incidentId)
    .is("deleted_at", null)
    .order("uploaded_at", { ascending: false });

  const rows = (data ?? []) as unknown as ImageRecord[];
  if (rows.length === 0) return [];

  const uploaderIds = Array.from(
    new Set(rows.map((r) => r.uploaded_by).filter((v): v is string => !!v)),
  );
  const nameMap = new Map<string, string>();
  if (uploaderIds.length) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", uploaderIds);
    for (const p of (profs ?? []) as { id: string; full_name: string | null }[]) {
      nameMap.set(p.id, p.full_name ?? "—");
    }
  }

  // Signierte URLs nur für die tatsächlich gelisteten Bilder (bei Bedarf).
  const paths = rows.map((r) => r.storage_path);
  const signedMap = new Map<string, string>();
  const { data: signed } = await supabase.storage
    .from(IMAGE_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL);
  for (const s of signed ?? []) {
    if (s.signedUrl && s.path) signedMap.set(s.path, s.signedUrl);
  }

  return rows.map((r) => ({
    id: r.id,
    incident_id: r.incident_id,
    file_name: r.file_name,
    mime_type: r.mime_type,
    file_size: Number(r.file_size) || 0,
    storage_path: r.storage_path,
    category: r.category,
    description: r.description,
    taken_at: r.taken_at,
    uploaded_at: r.uploaded_at,
    uploaded_by: r.uploaded_by,
    uploader_name: r.uploaded_by ? nameMap.get(r.uploaded_by) ?? "—" : "—",
    camera_model: r.camera_model,
    gps_lat: numOrNull(r.gps_lat),
    gps_lon: numOrNull(r.gps_lon),
    orientation: r.orientation,
    width: r.width,
    height: r.height,
    signed_url: signedMap.get(r.storage_path) ?? null,
  }));
}

// Kennzahl „Heute hochgeladene Bilder" (nur nicht gelöschte). RLS greift.
export async function getTodaysImageCount(): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const supabase = await createClient();
  const { count } = await supabase
    .from("incident_images")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)
    .gte("uploaded_at", start.toISOString());
  return count ?? 0;
}
