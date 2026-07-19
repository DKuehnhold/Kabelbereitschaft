"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth";
import { IMAGE_CATEGORIES, type ImageCategory } from "@/lib/status";
import type { FormState } from "@/lib/incidents";
import { uploadIncidentImages } from "@/lib/image-upload-core";

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

// ---------------------------------------------------------------------
// Mehrfach-Upload (privat). Nutzt die gemeinsame Upload-Logik (image-upload-core),
// die auch der Offline-Replay-Endpunkt /api/images/upload verwendet.
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

  const { ok, errors } = await uploadIncidentImages({
    incidentId,
    category,
    description,
    files,
    uploadedBy: session.userId,
  });

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
