import { isUuid, withUserTransaction, type DatabaseClient } from "@/lib/db";
import { isPgError, PG_UNIQUE_VIOLATION } from "@/lib/db/pg-errors";
import { IMAGE_CATEGORIES, type ImageCategory } from "@/lib/status";
import { MAX_IMAGE_BYTES, MAX_IMAGE_MB, buildStoragePath, isAllowedMime } from "@/lib/images";
import { extractExif } from "@/lib/exif";
import { deleteImageObject, logStorageFailure, putImageObject } from "@/lib/minio-storage";

export type UploadResult = { ok: number; errors: string[]; duplicate: boolean };

// Einzige Meldung für „kein Vorgang". Sie gilt bewusst auch für eine
// unbrauchbare Kennung und für einen Vorgang, den RLS nicht freigibt: die
// Meldung darf keine Existenzaussage über einen fremden Vorgang treffen.
const NO_INCIDENT = "Kein Vorgang – Upload nicht möglich.";

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

/**
 * Bereits angewendeter Upload – modulprivates Sentinel.
 *
 * Es wird AUSSCHLIESSLICH an der Unique-Verletzung des Dedup-Markers geworfen
 * und bedeutet genau „bereits angewendet". withUserTransaction() committet,
 * sobald der Rückruf normal zurückkehrt; das Duplikat muss aber ZURÜCKROLLEN und
 * trotzdem ein fachliches Ergebnis liefern. Deshalb wird es geworfen, außerhalb
 * des Wrappers gefangen und dort in `duplicate: true` übersetzt. Ein Sentinel
 * ist kein technischer Fehler und wird nicht protokolliert.
 *
 * Muster und Begründung wie in app/src/app/api/sync/route.ts.
 */
class ImageUploadDuplicate extends Error {
  constructor() {
    super("Dedup-Marker bereits vorhanden");
    this.name = "ImageUploadDuplicate";
  }
}

function failure(message: string): UploadResult {
  return { ok: 0, errors: [message], duplicate: false };
}

/**
 * Dedup-Marker setzen – erste Anweisung der Transaktion.
 *
 * `actor` wird NICHT gesetzt: die Spalte trägt den Default
 * app.current_user_id() (Migration 0012 hat den historischen Default auth.uid()
 * generisch umgeschrieben). Die Identität ist nie eine Angabe des Aufrufers.
 *
 * Die Unique-Verletzung (actor, client_action_id) wird HIER ausgewertet,
 * unmittelbar an der Anweisung, die sie erzeugen darf – nur so ist 23505
 * eindeutig dem Marker zugeordnet und nicht etwa einem Trigger. Nach der
 * Verletzung ist die Transaktion abgebrochen: es folgt in ihr keine weitere
 * Anweisung, das Sentinel wird sofort geworfen, der Wrapper rollt zurück.
 */
async function insertDedupMarker(
  client: DatabaseClient,
  clientActionId: string,
  incidentId: string,
): Promise<void> {
  try {
    await client.query(
      `insert into public.sync_actions (client_action_id, kind, incident_id)
       values ($1::uuid, $2, $3::uuid)`,
      [clientActionId, "image", incidentId],
    );
  } catch (error) {
    if (isPgError(error, PG_UNIQUE_VIOLATION)) throw new ImageUploadDuplicate();
    throw error;
  }
}

type ImageMetadata = {
  imageId: string;
  incidentId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  storagePath: string;
  category: ImageCategory;
  description: string | null;
  exifPresent: boolean;
  takenAt: string | null;
  gpsLat: number | null;
  gpsLon: number | null;
  orientation: number | null;
  cameraModel: string | null;
  width: number | null;
  height: number | null;
};

/**
 * Bildmetadaten schreiben – vollständig parametrisiert.
 *
 * `uploaded_by` wird NICHT gesetzt: die Spalte trägt nach Migration 0012 den
 * Default app.current_user_id(). Damit ist eine Herkunft aus Form- oder
 * Requestdaten strukturell ausgeschlossen und nicht nur Konvention – die
 * Insert-Policy images_insert (0001_init.sql:569-570) prüft `uploaded_by`
 * nämlich gar nicht, sondern nur die Zuständigkeit für den Vorgang.
 *
 * Die Spaltenliste ist ein festes Literal; jeder Wert ist ein Parameter. Kein
 * Request-, Datei- oder Benutzerwert wird in den Anweisungstext interpoliert.
 */
async function insertImageMetadata(
  client: DatabaseClient,
  meta: ImageMetadata,
): Promise<void> {
  await client.query(
    `insert into public.incident_images (
       id, incident_id, file_name, mime_type, file_size, storage_path,
       category, description, exif_present, taken_at, gps_lat, gps_lon,
       orientation, camera_model, width, height
     ) values (
       $1::uuid, $2::uuid, $3, $4, $5, $6,
       $7::public.image_category, $8, $9, $10::timestamptz, $11, $12,
       $13, $14, $15, $16
     )`,
    [
      meta.imageId,
      meta.incidentId,
      meta.fileName,
      meta.mimeType,
      meta.fileSize,
      meta.storagePath,
      meta.category,
      meta.description,
      meta.exifPresent,
      meta.takenAt,
      meta.gpsLat,
      meta.gpsLon,
      meta.orientation,
      meta.cameraModel,
      meta.width,
      meta.height,
    ],
  );
}

/**
 * Kompensation: ein Objekt entfernen, dessen Metadatensatz nicht zustande kam.
 *
 * Best effort und bewusst ohne Weitergabe des Fehlers: der Ablauf darf daran
 * nicht abbrechen. Ein Fehlschlag wird getrennt und deutlich als verwaistes
 * Objekt protokolliert (Objekt ohne Metadatensatz), damit er in einer
 * Aufräumroutine auffindbar bleibt. Der Objektschlüssel wird nicht
 * protokolliert (siehe minio-storage.ts:logStorageFailure).
 */
async function discardObject(key: string): Promise<void> {
  try {
    await deleteImageObject(key);
  } catch (error) {
    logStorageFailure("delete-kompensation-verwaistes-objekt", error);
  }
}

// Gemeinsame Upload-Logik für interaktiven Upload (Server-Action) UND
// Offline-Replay (API-Route).
//
// AP14/B: Objektspeicher ist MinIO/S3 (ADR-011), Metadaten laufen über
// PostgreSQL mit RLS in withUserTransaction(). Die Identität stammt
// ausschließlich aus der serverseitig geprüften Auth.js-Sitzung
// (getSessionProfile) und wird nie in einen INSERT geschrieben – dafür stehen
// die Spaltendefaults uploaded_by/actor = app.current_user_id().
export async function uploadIncidentImages(params: {
  incidentId: string;
  category: string;
  description: string | null;
  files: File[];
  userId: string;
  clientActionId?: string | null;
}): Promise<UploadResult> {
  const { incidentId, category, description, files, userId, clientActionId } = params;

  if (!incidentId) return failure(NO_INCIDENT);
  // Unbrauchbare Kennung: dieselbe Meldung wie „kein Vorgang" – kein neues
  // Vokabular und keine Aussage darüber, ob es den Vorgang gibt.
  if (!isUuid(incidentId)) return failure(NO_INCIDENT);
  if (!isImageCategory(category)) return failure("Ungültige Kategorie.");
  if (files.length === 0) return failure("Keine Datei ausgewählt.");
  if (!isUuid(userId)) return failure("Nicht angemeldet.");

  // Unbrauchbare Warteschlangenkennung: fail-closed, und zwar HIER – vor der
  // Vorabberechtigungs-Transaktion und damit vor jedem Objekt-PUT, jedem
  // Datenbankzugriff und jeder Datenbankänderung.
  //
  // Unterschieden wird zwischen „keine Kennung" und „kaputte Kennung":
  //   * `undefined`/`null`: der interaktive Weg. image-actions.ts:120-124
  //     übergibt das Feld bewusst nicht – ein Upload ohne Deduplizierung ist
  //     dort richtig.
  //   * leerer String: ebenfalls „keine Kennung". Die Route bildet das Feld mit
  //     `String(fd.get("client_action_id") ?? "").trim()` ab
  //     (app/src/app/api/images/upload/route.ts:36) und liefert damit auch dann
  //     "", wenn es gar nicht mitgeschickt wurde.
  //   * nicht leer und nicht kanonisch: kaputte Kennung. Ein solcher Aufruf lief
  //     bisher OHNE Deduplizierung durch – genau das ist der Fehler, denn ein
  //     Retry hätte dann beliebig viele Bildzeilen erzeugt.
  //
  // Dokumentierte Folge: offline/manager.ts:19-20 erzeugt die
  // Warteschlangenkennung über crypto.randomUUID() mit dem Rückfall
  // String(Date.now() + Math.random()). Dieser Rückfall ist KEINE kanonische
  // UUID. Ein in einer Laufzeit ohne crypto.randomUUID erzeugter Eintrag wird
  // deshalb künftig abgewiesen statt ohne Deduplizierung hochgeladen; er
  // scheitert nach manager.ts:179 höchstens fünfmal und bleibt danach als
  // sichtbarer Fehler stehen – es entsteht keine Endlosschleife. Das ist die
  // beabsichtigte Wirkung.
  //
  // Rückgabeform bewusst wie beim technischen Fehler der Vorabprüfung
  // (`{ ok: 0, errors: [] }`): die Route antwortet damit mit 400 ohne interne
  // Details, image-actions.ts mit dem bereits bestehenden Text
  // „Upload fehlgeschlagen." – kein neues Meldungsvokabular. Ausdrücklich NICHT
  // failure(NO_INCIDENT): „Kein Vorgang" wäre für eine kaputte
  // Warteschlangenkennung sachlich falsch.
  if (
    clientActionId !== undefined &&
    clientActionId !== null &&
    clientActionId !== "" &&
    !isUuid(clientActionId)
  ) {
    // Der WERT der Kennung wird nicht protokolliert.
    console.error(
      "Bild-Upload: client_action_id ist keine kanonische UUID – Aufruf abgewiesen",
    );
    return { ok: 0, errors: [], duplicate: false };
  }

  // Vorabberechtigungsprüfung, BEVOR ein einziges Byte in den Objektspeicher
  // geht. RLS entscheidet: liefert die Abfrage keine Zeile, ist der Vorgang für
  // diesen Benutzer nicht sichtbar.
  //
  // Warum diese Prüfung neu ist: bis Migration 0013 verweigerte die
  // Storage-Policy incident_images_insert (0002_storage.sql:24-33) das Schreiben
  // eines Objekts für einen nicht zugewiesenen Monteur bereits im
  // Objektspeicher. MinIO hat keine solche Ebene – es kennt weder Vorgänge noch
  // Zuweisungen. Ohne diese Vorprüfung würde ein unberechtigter Aufrufer erst
  // ein Objekt schreiben und dessen Ablehnung erst am Metadaten-Insert erfahren;
  // das Objekt bliebe bis zur Kompensation im Bucket liegen.
  //
  // Ein technischer Fehler (Datenbank nicht erreichbar, Recht entzogen) wird
  // serverseitig eingeordnet und nach außen zu einem LEEREN Ergebnis. Diese
  // Funktion wirft grundsätzlich nicht: beide Aufrufer verlassen sich darauf.
  // `image-actions.ts` bildet `ok === 0` mit leerer Fehlerliste auf den bereits
  // bestehenden Text "Upload fehlgeschlagen." ab, die Route auf 400 – kein neues
  // Meldungsvokabular und keine Fehlergrenze der Server Action, die vorher nie
  // erreichbar war.
  let permitted = false;
  try {
    permitted = await withUserTransaction(userId, async (client) => {
      const found = await client.query<{ id: string }>(
        `select id from public.incidents where id = $1::uuid`,
        [incidentId],
      );
      return found.rows.length > 0;
    });
  } catch (error) {
    console.error(
      "Bild-Upload: Vorabprüfung des Vorgangs fehlgeschlagen",
      error instanceof Error ? error.message : "unbekannter Fehler",
    );
    return { ok: 0, errors: [], duplicate: false };
  }
  if (!permitted) return failure(NO_INCIDENT);

  // Dedup-Marker nur mit kanonischer UUID. sync_actions.client_action_id ist
  // `uuid not null` (0006:12); ein nicht kanonischer Wert würde die Transaktion
  // mit 22P02 abbrechen. Dieser Fall kann hier nicht mehr eintreten: eine nicht
  // leere, nicht kanonische Kennung ist oben bereits abgewiesen worden. Übrig
  // bleiben genau zwei Möglichkeiten – eine kanonische Kennung (Deduplizierung)
  // oder gar keine (interaktiver Upload ohne Marker).
  const dedupId = isUuid(clientActionId) ? clientActionId : null;
  // Der Marker gehört genau einmal je Aufruf gesetzt, und zwar in derselben
  // Transaktion wie das erste erfolgreich geschriebene Objekt. Vorher gesetzt
  // (wie bisher in der Route) würde ein anschließender Fehlschlag einen Marker
  // hinterlassen, den nur ein Kompensations-DELETE wieder entfernt – und
  // app_user hat auf sync_actions bewusst kein delete-Recht (Migration 0014).
  let markerPending = dedupId !== null;

  let ok = 0;
  let duplicate = false;
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
    // Beide Kennungen sind an dieser Stelle geprüft bzw. selbst erzeugt; die
    // Sperre in buildStoragePath() kann hier nicht greifen.
    const key = buildStoragePath(incidentId, imageId, file.name);

    // 1) Objekt schreiben. Die Rohmeldung des SDK gelangt NICHT nach außen: sie
    // kann Bucket, Endpunkt und Request-ID preisgeben. Die Einordnung bleibt
    // serverseitig.
    try {
      await putImageObject(key, buf, sniffed);
    } catch (error) {
      logStorageFailure("put", error);
      errors.push(`${file.name}: Upload abgelehnt.`);
      continue;
    }

    // 2) Metadaten in EINER Transaktion, zusammen mit dem Dedup-Marker.
    try {
      await withUserTransaction(userId, async (client) => {
        if (markerPending && dedupId !== null) {
          await insertDedupMarker(client, dedupId, incidentId);
        }
        await insertImageMetadata(client, {
          imageId,
          incidentId,
          // Der rohe Clientname (gekürzt) wie bisher; der Objektschlüssel
          // benutzt getrennt davon sanitizeFilename().
          fileName: file.name.slice(0, 200),
          mimeType: sniffed,
          fileSize: file.size,
          storagePath: key,
          category,
          description,
          exifPresent: exif.exifPresent,
          takenAt: exif.takenAt,
          gpsLat: exif.gpsLat,
          gpsLon: exif.gpsLon,
          orientation: exif.orientation,
          cameraModel: exif.cameraModel,
          width: exif.width,
          height: exif.height,
        });
      });
    } catch (error) {
      // Bereits angewendet: kein Fehler, aber auch kein zweiter Upload. Das
      // eben geschriebene Objekt wird zurückgenommen und die Schleife beendet –
      // der ganze Aufruf ist eine Wiederholung.
      if (error instanceof ImageUploadDuplicate) {
        duplicate = true;
        await discardObject(key);
        break;
      }
      // Technischer Fehler: die Einordnung bleibt serverseitig, nach außen geht
      // ausschließlich die neutrale Meldung. Eine Datenbankmeldung nennt
      // Tabellen-, Spalten- und Constraint-Namen (siehe lib/db/pg-errors.ts).
      console.error(
        "Bild-Upload: Metadaten konnten nicht gespeichert werden",
        error instanceof Error ? error.message : "unbekannter Fehler",
      );
      await discardObject(key);
      errors.push(`${file.name}: Speichern fehlgeschlagen.`);
      continue;
    }

    // Erst nach dem Commit gilt der Upload als erfolgt.
    markerPending = false;
    ok += 1;
  }

  return { ok, errors, duplicate };
}
