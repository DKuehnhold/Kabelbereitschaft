import { createClient } from "@/lib/supabase/server";
import { IMAGE_CATEGORIES, type ImageCategory } from "@/lib/status";
import { IMAGE_BUCKET, MAX_IMAGE_BYTES, MAX_IMAGE_MB, buildStoragePath, isAllowedMime } from "@/lib/images";
import { extractExif } from "@/lib/exif";

export type UploadResult = { ok: number; errors: string[] };

export function isImageCategory(v: string): v is ImageCategory {
  return (IMAGE_CATEGORIES as readonly string[]).includes(v);
}

// Inhaltsbasierte Typprüfung (Magic Bytes) – Dateiendung/MIME allein nicht vertrauen.
export function sniffImageMime(buf: Uint8Array): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) return "image/png";
  return null;
}

// Gemeinsame Upload-Logik für interaktiven Upload (Server-Action) UND
// Offline-Replay (API-Route). RLS/Storage-RLS sind serverseitig maßgeblich.
export async function uploadIncidentImages(params: {
  incidentId: string;
  category: string;
  description: string | null;
  files: File[];
  uploadedBy: string;
}): Promise<UploadResult> {
  const { incidentId, category, description, files, uploadedBy } = params;
  if (!incidentId) return { ok: 0, errors: ["Kein Vorgang – Upload nicht möglich."] };
  if (!isImageCategory(category)) return { ok: 0, errors: ["Ungültige Kategorie."] };
  if (files.length === 0) return { ok: 0, errors: ["Keine Datei ausgewählt."] };

  const supabase = await createClient();
  let ok = 0;
  const errors: string[] = [];

  for (const file of files) {
    if (file.size > MAX_IMAGE_BYTES) {
      errors.push(`${file.name}: größer als ${MAX_IMAGE_MB} MB`);
      continue;
    }
    const buf = new Uint8Array(await file.arrayBuffer());
    const sniffed = sniffImageMime(buf);
    if (!sniffed || !isAllowedMime(sniffed)) {
      errors.push(`${file.name}: nicht unterstützter Dateityp (nur JPG/PNG)`);
      continue;
    }
    const exif = await extractExif(buf);
    const imageId = crypto.randomUUID();
    const path = buildStoragePath(incidentId, imageId, file.name);

    const up = await supabase.storage.from(IMAGE_BUCKET).upload(path, buf, {
      contentType: sniffed,
      upsert: false,
    });
    if (up.error) {
      errors.push(`${file.name}: Upload abgelehnt (${up.error.message})`);
      continue;
    }

    const ins = await supabase.from("incident_images").insert({
      id: imageId,
      incident_id: incidentId,
      file_name: file.name.slice(0, 200),
      mime_type: sniffed,
      file_size: file.size,
      storage_path: path,
      category: category as ImageCategory,
      description,
      exif_present: exif.exifPresent,
      taken_at: exif.takenAt,
      gps_lat: exif.gpsLat,
      gps_lon: exif.gpsLon,
      orientation: exif.orientation,
      camera_model: exif.cameraModel,
      width: exif.width,
      height: exif.height,
      uploaded_by: uploadedBy,
    });
    if (ins.error) {
      await supabase.storage.from(IMAGE_BUCKET).remove([path]);
      errors.push(`${file.name}: Speichern fehlgeschlagen (${ins.error.message})`);
      continue;
    }
    ok += 1;
  }
  return { ok, errors };
}
