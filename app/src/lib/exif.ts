import exifr from "exifr";

// Serverseitige EXIF-/GPS-Auswertung fuer den Bild-Upload (AP4).
// Grundsätze:
//  - Fehlende EXIF-/GPS-Daten sind KEIN Fehler.
//  - Ungültige Metadaten brechen den Upload NICHT ab (Fallback auf null).
//  - GPS-Werte werden auf gültige Wertebereiche geprüft, sonst verworfen.
//  - Ausrichtung wird nur als gültiger EXIF-Wert (1..8) übernommen.
export type ImageExif = {
  exifPresent: boolean;
  takenAt: string | null;
  gpsLat: number | null;
  gpsLon: number | null;
  orientation: number | null;
  cameraModel: string | null;
  width: number | null;
  height: number | null;
};

function empty(): ImageExif {
  return {
    exifPresent: false,
    takenAt: null,
    gpsLat: null,
    gpsLon: null,
    orientation: null,
    cameraModel: null,
    width: null,
    height: null,
  };
}

function validLat(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= -90 && v <= 90 ? v : null;
}
function validLon(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= -180 && v <= 180 ? v : null;
}
function validDim(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v > 0 && v <= 100000
    ? Math.round(v)
    : null;
}
function validDate(v: unknown): string | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v as string);
  const t = d.getTime();
  if (!Number.isFinite(t)) return null;
  // Plausibilitaet: zwischen 1990 und "jetzt + 1 Tag".
  const min = new Date("1990-01-01").getTime();
  const max = Date.now() + 24 * 3600 * 1000;
  return t >= min && t <= max ? d.toISOString() : null;
}

export async function extractExif(
  input: Buffer | ArrayBuffer | Uint8Array,
): Promise<ImageExif> {
  try {
    const data = (await exifr.parse(input as ArrayBuffer, {
      gps: true,
      pick: [
        "DateTimeOriginal",
        "CreateDate",
        "Orientation",
        "Model",
        "Make",
        "latitude",
        "longitude",
        "ExifImageWidth",
        "ExifImageHeight",
        "ImageWidth",
        "ImageHeight",
        "PixelXDimension",
        "PixelYDimension",
      ],
    })) as Record<string, unknown> | undefined;

    if (!data) return empty();

    const lat = validLat(data.latitude);
    const lon = validLon(data.longitude);
    // GPS nur übernehmen, wenn BEIDE Werte gültig sind.
    const gpsOk = lat !== null && lon !== null;

    const orientationRaw =
      typeof data.Orientation === "number" ? data.Orientation : null;
    const orientation =
      orientationRaw !== null && orientationRaw >= 1 && orientationRaw <= 8
        ? orientationRaw
        : null;

    const model =
      typeof data.Model === "string" && data.Model.trim() !== ""
        ? data.Model.trim()
        : typeof data.Make === "string" && data.Make.trim() !== ""
          ? data.Make.trim()
          : null;

    const width =
      validDim(data.ExifImageWidth) ??
      validDim(data.ImageWidth) ??
      validDim(data.PixelXDimension);
    const height =
      validDim(data.ExifImageHeight) ??
      validDim(data.ImageHeight) ??
      validDim(data.PixelYDimension);

    return {
      exifPresent: true,
      takenAt: validDate(data.DateTimeOriginal) ?? validDate(data.CreateDate),
      gpsLat: gpsOk ? lat : null,
      gpsLon: gpsOk ? lon : null,
      orientation,
      cameraModel: model,
      width,
      height,
    };
  } catch {
    // Defekte/fehlende Metadaten: Upload soll trotzdem moeglich sein.
    return empty();
  }
}
