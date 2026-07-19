"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth";
import { IMAGE_CATEGORIES, type ImageCategory } from "@/lib/status";
import type { FormState } from "@/lib/incidents";
import {
  IMAGE_BUCKET,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_MB,
  buildStoragePath,
  isAllowedMime,
} from "@/lib/images";
import { extractExif } from "@/lib/exif";

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}
function strOrNull(fd: FormData, key: string): string | null {
  const v = str(fd, key);
  return v === "" ? null : v;
}
function isCategory(v: string): v is ImageCategory {
  return (IMAGE_CATEGORIES as readonly string[]).includes(v);
}
function revalidate(incidentId: string) {
  revalidatePath(`/vorgaenge/${incidentId}`);
  revalidatePath("/dashboard");
}

// Inhaltsbasierte Typprüfung (Magic Bytes) – Dateiendung/MIME allein nicht vertrauen.
function sniffMime(buf: Uint8Array): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) {
    return "image/png";
  }
  return null;
}

// ---------------------------------------------------------------------
// Mehrfach-Upload (privat). RLS/Storage-RLS sind serverseitig maßgeblich.
// ---------------------------------------------------------------------
export async function uploadImages(_prev: FormState, fd: FormData): Promise<FormState> {
  const session = await getSessionProfile();
  if (!session) return { ok: false, error: "Nicht angemeldet." };

  const incidentId = strOrNull(fd, "incident_id");
  if (!incidentId) return { ok: false, error: "Kein Vorgang – Upload nicht möglich." };

  const category = str(fd, "category");
  if (!isCategory(category)) return { ok: false, error: "Bitte eine gültige Kategorie wählen." };

  const description = strOrNull(fd, "description");

  const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { ok: false, error: "Keine Datei ausgewählt." };

  const supabase = await createClient();
  let ok = 0;
  const errors: string[] = [];

  for (const file of files) {
    if (file.size > MAX_IMAGE_BYTES) {
      errors.push(`${file.name}: größer als ${MAX_IMAGE_MB} MB`);
      continue;
    }
    const buf = new Uint8Array(await file.arrayBuffer());
    const sniffed = sniffMime(buf);
    if (!sniffed || !isAllowedMime(sniffed)) {
      errors.push(`${file.name}: nicht unterstützter Dateityp (nur JPG/PNG)`);
      continue;
    }

    const exif = await extractExif(buf);
    const imageId = crypto.randomUUID();
    const path = buildStoragePath(incidentId, imageId, file.name);

    const up = await supabase.storage
      .from(IMAGE_BUCKET)
      .upload(path, buf, { contentType: sniffed, upsert: false });
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
      category,
      description,
      exif_present: exif.exifPresent,
      taken_at: exif.takenAt,
      gps_lat: exif.gpsLat,
      gps_lon: exif.gpsLon,
      orientation: exif.orientation,
      camera_model: exif.cameraModel,
      width: exif.width,
      height: exif.height,
      uploaded_by: session.userId,
    });

    if (ins.error) {
      // Datensatz fehlgeschlagen → Storage-Objekt best effort entfernen.
      await supabase.storage.from(IMAGE_BUCKET).remove([path]);
      errors.push(`${file.name}: Speichern fehlgeschlagen (${ins.error.message})`);
      continue;
    }
    ok += 1;
  }

  revalidate(incidentId);

  if (ok === 0) return { ok: false, error: errors.join(" · ") || "Upload fehlgeschlagen." };
  if (errors.length) return { ok: true, error: `${ok} hochgeladen, ${errors.length} abgelehnt: ${errors.join(" · ")}` };
  return { ok: true, error: null };
}

// ---------------------------------------------------------------------
// Kategorie ändern (validiert; Trigger schreibt Chronik + Audit)
// ---------------------------------------------------------------------
export async function changeImageCategory(_prev: FormState, fd: FormData): Promise<FormState> {
  const session = await getSessionProfile();
  if (!session) return { ok: false, error: "Nicht angemeldet." };
  const id = strOrNull(fd, "image_id");
  const incidentId = strOrNull(fd, "incident_id");
  const category = str(fd, "category");
  if (!id || !incidentId) return { ok: false, error: "Bild/Vorgang fehlt." };
  if (!isCategory(category)) return { ok: false, error: "Ungültige Kategorie." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("incident_images")
    .update({ category })
    .eq("id", id)
    .is("deleted_at", null);
  if (error) return { ok: false, error: `Änderung fehlgeschlagen: ${error.message}` };
  revalidate(incidentId);
  return { ok: true, error: null };
}

// ---------------------------------------------------------------------
// Beschreibung ändern (optional; Trigger schreibt Chronik + Audit)
// ---------------------------------------------------------------------
export async function changeImageDescription(_prev: FormState, fd: FormData): Promise<FormState> {
  const session = await getSessionProfile();
  if (!session) return { ok: false, error: "Nicht angemeldet." };
  const id = strOrNull(fd, "image_id");
  const incidentId = strOrNull(fd, "incident_id");
  if (!id || !incidentId) return { ok: false, error: "Bild/Vorgang fehlt." };
  const description = strOrNull(fd, "description");

  const supabase = await createClient();
  const { error } = await supabase
    .from("incident_images")
    .update({ description })
    .eq("id", id)
    .is("deleted_at", null);
  if (error) return { ok: false, error: `Änderung fehlgeschlagen: ${error.message}` };
  revalidate(incidentId);
  return { ok: true, error: null };
}

// ---------------------------------------------------------------------
// Soft Delete (kein physisches Löschen; Trigger schreibt Chronik + Audit)
// ---------------------------------------------------------------------
export async function softDeleteImage(fd: FormData): Promise<void> {
  const session = await getSessionProfile();
  if (!session) return;
  const id = strOrNull(fd, "image_id");
  const incidentId = strOrNull(fd, "incident_id");
  if (!id || !incidentId) return;

  const supabase = await createClient();
  await supabase
    .from("incident_images")
    .update({ deleted_at: new Date().toISOString(), deleted_by: session.userId })
    .eq("id", id)
    .is("deleted_at", null);
  revalidate(incidentId);
}
