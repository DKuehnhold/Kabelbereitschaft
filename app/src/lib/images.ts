import type { ImageCategory } from "@/lib/status";

// ---------------------------------------------------------------------
// Client-sichere Konfiguration, Typen und reine Hilfsfunktionen.
// (Keine Server-Imports – darf im Client-Bundle landen.)
// Serverseitige Abfragen: siehe images-server.ts
// ---------------------------------------------------------------------
export const IMAGE_BUCKET = "incident-images";

// Maximale Dateigröße – zentral über NEXT_PUBLIC_MAX_IMAGE_MB konfigurierbar,
// Standard 15 MB. Serverseitig/Storage-seitig ist die Prüfung maßgeblich;
// die clientseitige Prüfung dient nur der Benutzerführung.
export const MAX_IMAGE_MB = Number(process.env.NEXT_PUBLIC_MAX_IMAGE_MB) || 15;
export const MAX_IMAGE_BYTES = Math.round(MAX_IMAGE_MB * 1024 * 1024);

// Unterstützte Formate. HEIC bewusst NICHT enthalten: keine zuverlässige
// Browser-Vorschau/Verarbeitung in der aktuellen Laufzeit (siehe BILDDOKUMENTATION.md).
export const ALLOWED_IMAGE_MIME = ["image/jpeg", "image/png"] as const;
export const ALLOWED_IMAGE_EXT = [".jpg", ".jpeg", ".png"] as const;

// Gültigkeitsdauer signierter URLs (Sekunden).
export const SIGNED_URL_TTL = 3600;

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

// Stabiler, kollisionsfreier Pfad: incidents/{incident_id}/{image_id}/{filename}
export function buildStoragePath(
  incidentId: string,
  imageId: string,
  filename: string,
): string {
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
