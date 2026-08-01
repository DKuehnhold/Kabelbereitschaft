import type { ImageCategory } from "@/lib/status";

// ---------------------------------------------------------------------
// Client-sichere Konfiguration, Typen und reine Hilfsfunktionen.
// (Keine Server-Imports – darf im Client-Bundle landen.)
// Serverseitige Abfragen: siehe images-server.ts
//
// AP14/B: Der Bucketname und die Gültigkeitsdauer signierter URLs stehen hier
// bewusst NICHT mehr. Der Bucket kommt aus S3_BUCKET (minio-config.ts) und ist
// serverseitig; die TTL lebt als SIGNED_URL_TTL_SECONDS in minio-storage.ts.
// ---------------------------------------------------------------------

// Maximale Dateigröße – zentral über NEXT_PUBLIC_MAX_IMAGE_MB konfigurierbar,
// Standard 15 MB. Serverseitig/Storage-seitig ist die Prüfung maßgeblich;
// die clientseitige Prüfung dient nur der Benutzerführung.
export const MAX_IMAGE_MB = Number(process.env.NEXT_PUBLIC_MAX_IMAGE_MB) || 15;
export const MAX_IMAGE_BYTES = Math.round(MAX_IMAGE_MB * 1024 * 1024);

// Unterstützte Formate. HEIC bewusst NICHT enthalten: keine zuverlässige
// Browser-Vorschau/Verarbeitung in der aktuellen Laufzeit (siehe 03-Architektur/STORAGE.md).
export const ALLOWED_IMAGE_MIME = ["image/jpeg", "image/png"] as const;
export const ALLOWED_IMAGE_EXT = [".jpg", ".jpeg", ".png"] as const;

export function isAllowedMime(mime: string): boolean {
  return (ALLOWED_IMAGE_MIME as readonly string[]).includes(mime);
}

// Dateinamen bereinigen: nur Basisname, sichere Zeichen, Länge begrenzt.
// Die interne Speicherung hängt zusätzlich an der Bild-ID (kollisionsfrei).
export function sanitizeFilename(name: string): string {
  const base = (name.split("/").pop() ?? name).split("\\").pop() ?? name;
  const cleaned = base
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[._]+/, "")
    .slice(0, 120);
  return cleaned || "bild";
}

// Kanonische UUID. Bewusst eine modulprivate Regex und KEIN Import von isUuid
// aus @/lib/db: diese Datei muss client-sicher bleiben, @/lib/db ist server-only.
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Stabiler, kollisionsfreier Pfad: incidents/{incident_id}/{image_id}/{filename}
//
// AP14/B: Beide Kennungen müssen kanonische UUIDs sein, sonst Abbruch. Die
// fachliche Prüfung (existiert der Vorgang, darf der Benutzer darauf schreiben)
// liegt beim Aufrufer; das hier ist die strukturelle Sperre gegen einen frei
// gewählten Objektschlüssel (Pfad-Traversal über „..“ oder eine fremde
// Vorgangs-ID). Bisher haben das allein die Storage-Policy in
// 0002_storage.sql:19,31 (Prüfung des zweiten Pfadsegments als uuid) und der
// Spaltentyp geleistet – beides ist mit Migration 0013 entfallen, und MinIO hat
// keine vergleichbare Ebene.
export function buildStoragePath(
  incidentId: string,
  imageId: string,
  filename: string,
): string {
  if (!UUID_PATTERN.test(incidentId) || !UUID_PATTERN.test(imageId)) {
    // Nennt bewusst keinen der beiden Werte.
    throw new Error("Ungültige Kennung für den Objektpfad.");
  }
  return `incidents/${incidentId}/${imageId}/${sanitizeFilename(filename)}`;
}

export type GalleryImage = {
  id: string;
  incident_id: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  storage_path: string;
  category: ImageCategory;
  description: string | null;
  taken_at: string | null;
  uploaded_at: string;
  uploaded_by: string | null;
  uploader_name: string;
  camera_model: string | null;
  gps_lat: number | null;
  gps_lon: number | null;
  orientation: number | null;
  width: number | null;
  height: number | null;
  signed_url: string | null;
};
