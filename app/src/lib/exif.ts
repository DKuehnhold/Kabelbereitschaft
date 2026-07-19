import exifr from "exifr";

// Serverseitige EXIF-/GPS-Auswertung.
// Vorbereitet fuer den Bild-Upload (spaeteres Arbeitspaket).
// Fehlende EXIF-/GPS-Daten fuehren NICHT zu einem Fehler.
export type ImageExif = {
  exifPresent: boolean;
  takenAt: string | null;
  gpsLat: number | null;
  gpsLon: number | null;
  orientation: number | null;
  cameraModel: string | null;
};

function empty(): ImageExif {
  return {
    exifPresent: false,
    takenAt: null,
    gpsLat: null,
    gpsLon: null,
    orientation: null,
    cameraModel: null,
  };
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
        "latitude",
        "longitude",
      ],
    })) as Record<string, unknown> | undefined;

    if (!data) return empty();

    const lat = typeof data.latitude === "number" ? data.latitude : null;
    const lon = typeof data.longitude === "number" ? data.longitude : null;
    const takenRaw =
      (data.DateTimeOriginal as Date | undefined) ??
      (data.CreateDate as Date | undefined) ??
      null;

    return {
      exifPresent: true,
      takenAt: takenRaw ? new Date(takenRaw).toISOString() : null,
      gpsLat: lat,
      gpsLon: lon,
      orientation:
        typeof data.Orientation === "number" ? data.Orientation : null,
      cameraModel: typeof data.Model === "string" ? data.Model : null,
    };
  } catch {
    // Defekte/fehlende Metadaten: Upload soll trotzdem moeglich sein.
    return empty();
  }
}
