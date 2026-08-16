import { getSessionProfile } from "@/lib/auth";
import { isUuid, withUserTransaction } from "@/lib/db";
import { startOfTodayBerlinIso } from "@/lib/date-local";
import type { GalleryImage } from "@/lib/images";
import { createImageSignedUrl, logStorageFailure } from "@/lib/minio-storage";
import type { ImageCategory } from "@/lib/status";

// =====================================================================
// AP4 – Bilddokumentation: serverseitige Lesewege.
//
// AP14/B: die Reads laufen auf PostgreSQL mit RLS (ADR-011 / 2.5) über
// withUserTransaction(); die Identität stammt ausschließlich aus der
// serverseitig geprüften Auth.js-Sitzung. Der Objektspeicher ist MinIO/S3, die
// signierten URLs entstehen in @/lib/minio-storage.
//
// Fail-closed heißt in einem LESEWEG bewusst „leeres Ergebnis" und nicht
// „Ausnahme": beide Funktionen haben schon bisher nie geworfen, und die
// aufrufenden Server-Komponenten (IncidentImages, Dashboard) verlassen sich
// darauf. getSessionProfile() liefert auch bei ausstehendem Passwortwechsel
// NULL – die Sperre wirkt hier also mit.
//
// Die Zeilen werden wie bei den Vorgangs- und Aufgaben-Reads als JSON projiziert
// (`to_json`): der Treiber liefert `timestamptz` sonst als JS-Date, was dem
// Sichtmodell GalleryImage (taken_at/uploaded_at als ISO-8601-Text)
// widerspräche. Die JSON-Serialisierung von PostgreSQL erzeugt genau die
// bisherigen Werte; die Spaltenliste in der Unterabfrage bleibt ein festes
// Literal.
//
// In den SQL-Text gelangt kein Eingabewert: Spaltenlisten und `order by` sind
// Modulkonstanten, jeder Wert ist Parameter ($1).
// =====================================================================

type ImageRecord = {
  id: string;
  incident_id: string;
  file_name: string;
  mime_type: string;
  // file_size ist in der Datenbank ganzzahlig; die Union bleibt wie bisher
  // stehen, damit der Mapper unabhängig von der Zahlendarstellung des Treibers
  // arbeitet.
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

// Genau die bisherigen 17 Spalten, als festes Literal.
const IMAGE_SELECT =
  "id, incident_id, file_name, mime_type, file_size, storage_path, category, " +
  "description, taken_at, uploaded_at, uploaded_by, camera_model, gps_lat, " +
  "gps_lon, orientation, width, height";

// Sortierung UNVERÄNDERT: allein `uploaded_at desc`.
//
// Es gibt hier bewusst KEINEN Zweitschlüssel. Die bisherige Abfrage lautete
// genau so; ein ergänzter Tiebreaker (etwa `id`) würde die Anzeigereihenfolge
// gleichzeitig hochgeladener Bilder still verändern. Ob die Reihenfolge einen
// stabilen Zweitschlüssel bekommen soll, ist eine sichtbare fachliche
// Entscheidung und nicht Teil dieser Migration.
const LIST_INCIDENT_IMAGES_SQL = `
  select to_json(r) as image
  from (
    select ${IMAGE_SELECT}
    from public.incident_images
    where incident_id = $1::uuid and deleted_at is null
  ) r
  order by r.uploaded_at desc`;

// Uploadernamen. Über die Sichtbarkeit entscheidet ausschließlich die Policy
// profiles_select (`id = app.current_user_id() or is_staff()`): ein Monteur
// bekommt hier weiterhin nur seine eigene Zeile und sieht Fremdnamen nicht. Für
// jede nicht gelieferte Zeile bleibt der Rückfall "—" wie bisher.
const LIST_UPLOADER_NAMES_SQL = `
  select id, full_name
    from public.profiles
   where id = any($1::uuid[])`;

// Kennzahl „heute hochgeladene Bilder" (nur nicht gelöschte).
const TODAYS_IMAGE_COUNT_SQL = `
  select count(*)::int as n
    from public.incident_images
   where deleted_at is null and uploaded_at >= $1::timestamptz`;

type UploaderRow = { id: string; full_name: string | null };
type ImageResult = { image: ImageRecord };
type CountResult = { n: number };

/** Metadaten und Uploadernamen aus EINER Transaktion. */
type ImageMetadataResult = {
  rows: ImageRecord[];
  uploaderNames: Map<string, string>;
};

// Nicht gelöschte Bilder eines Vorgangs inkl. signierter URLs. RLS greift.
export async function listIncidentImages(incidentId: string): Promise<GalleryImage[]> {
  const session = await getSessionProfile();
  if (!session) return [];
  // Unbrauchbare Kennung: kein SQL, leeres Ergebnis. Ohne diese Prüfung würde
  // `$1::uuid` erst in der Datenbank mit 22P02 abbrechen.
  if (!isUuid(incidentId)) return [];

  let metadata: ImageMetadataResult;
  try {
    // GENAU EINE Transaktion für beide Abfragen: die Uploadernamen gehören zum
    // gelesenen Bildstand und werden auf demselben Snapshot ermittelt.
    metadata = await withUserTransaction(session.userId, async (client) => {
      const result = await client.query<ImageResult>(LIST_INCIDENT_IMAGES_SQL, [incidentId]);
      const rows = result.rows.map((row) => row.image);

      const uploaderNames = new Map<string, string>();
      const uploaderIds = Array.from(
        new Set(rows.map((r) => r.uploaded_by).filter((v): v is string => !!v)),
      );
      // Zweite Abfrage nur, wenn überhaupt eine Uploader-ID vorkommt.
      if (uploaderIds.length) {
        const profiles = await client.query<UploaderRow>(LIST_UPLOADER_NAMES_SQL, [uploaderIds]);
        for (const p of profiles.rows) uploaderNames.set(p.id, p.full_name ?? "—");
      }
      return { rows, uploaderNames };
    });
  } catch (error) {
    // Technischer Fehler (Datenbank nicht erreichbar, Recht entzogen): die
    // Einordnung bleibt serverseitig, das Ergebnis ist wie bisher leer. Bisher
    // wurde `error` überhaupt nicht ausgewertet – die Anzeige verhält sich also
    // unverändert, der Fehler ist jetzt aber im Serverprotokoll auffindbar.
    console.error(
      "Bilder eines Vorgangs konnten nicht gelesen werden",
      error instanceof Error ? error.message : "unbekannter Fehler",
    );
    return [];
  }

  const { rows, uploaderNames } = metadata;
  if (rows.length === 0) return [];

  // Signieren geschieht NACH der Transaktion: es ist kein Datenbankvorgang und
  // hat in einer offenen Transaktion nichts zu suchen.
  //
  // Je Zeile einzeln, damit ein Fehlschlag genau dieses eine Bild betrifft und
  // nicht die ganze Galerie: `signed_url: null` führt in ImageGallery zum
  // bestehenden Ersatztext, die übrigen Bilder bleiben nutzbar. Das ist
  // dasselbe Verhalten wie bisher, wo eine fehlende signierte URL ebenfalls
  // NULL wurde. Die SDK-Rohmeldung bleibt draußen (logStorageFailure nennt
  // weder Bucket noch Endpunkt noch Objektschlüssel).
  const signedUrls = await Promise.all(
    rows.map(async (r) => {
      try {
        return await createImageSignedUrl(r.storage_path);
      } catch (error) {
        logStorageFailure("sign", error);
        return null;
      }
    }),
  );

  return rows.map((r, index) => ({
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
    uploader_name: r.uploaded_by ? uploaderNames.get(r.uploaded_by) ?? "—" : "—",
    camera_model: r.camera_model,
    gps_lat: numOrNull(r.gps_lat),
    gps_lon: numOrNull(r.gps_lon),
    orientation: r.orientation,
    width: r.width,
    height: r.height,
    signed_url: signedUrls[index] ?? null,
  }));
}

// Kennzahl „Heute hochgeladene Bilder" (nur nicht gelöschte). RLS greift.
export async function getTodaysImageCount(): Promise<number> {
  const session = await getSessionProfile();
  if (!session) return 0;

  // AP15-b (Entscheidung getroffen, siehe date-local.ts und PROJEKT_WISSEN.md):
  // die fachliche Zeitzone ist Europe/Berlin, nicht die Zeitzone des
  // Node-Prozesses. Der frühere Kommentar hier hielt diese Entscheidung
  // ausdrücklich offen ("ist eine eigene Entscheidung und nicht Gegenstand
  // dieser Migration") - sie ist mit AP15-b getroffen und folgt derselben
  // Festlegung wie bereits `incident_list_view.created_date_local`.
  //
  // Bewusst weiterhin in der Anwendung berechnet und als Parameter übergeben
  // (nicht datenbankseitig über `now()`/`date_trunc`): die Datenbank kann in
  // einer anderen Zeitzone stehen als der Anwendungsprozess, und eine
  // serverseitige Grenze würde sich dadurch still verschieben.
  const startIso = startOfTodayBerlinIso();

  try {
    return await withUserTransaction(session.userId, async (client) => {
      const result = await client.query<CountResult>(TODAYS_IMAGE_COUNT_SQL, [
        startIso,
      ]);
      return result.rows[0]?.n ?? 0;
    });
  } catch (error) {
    // Wie bisher: die Kennzahl fällt auf 0 zurück und wirft nicht. Ein
    // Dashboard darf an einer Kennzahl nicht scheitern.
    console.error(
      "Kennzahl der heute hochgeladenen Bilder konnte nicht gelesen werden",
      error instanceof Error ? error.message : "unbekannter Fehler",
    );
    return 0;
  }
}
