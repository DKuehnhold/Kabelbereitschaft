import "server-only";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { readMinioConfig, type MinioConfig } from "@/lib/minio-config";

// AP14/B: Zugriffsschicht auf den internen Objektspeicher (MinIO/S3, ADR-011).
//
// SERVER-ONLY, hart abgesichert. Dieses Modul darf NIEMALS aus einer
// Client-Komponente importiert werden: es liest Zugangsdaten und den internen
// Endpunkt aus der Laufzeit. Der Import "server-only" bricht den Build ab, falls
// es doch in ein Client-Bundle geraet - dasselbe Muster wie lib/db/index.ts,
// lib/db/pg-errors.ts und lib/auth-service.ts. Aufrufer sind ausschliesslich
// Server Actions, Route Handler und Server-Komponenten.
//
// Verbindliche Eigenschaften:
//   - Es gibt keinen Export, der den S3Client, die Konfiguration, den Bucket
//     oder einen Endpunkt herausgibt. Der Aufrufer sieht ausschliesslich
//     Objektschluessel und signierte URLs.
//   - Jeder Fehler verlaesst dieses Modul als ImageStorageError ohne Bucket-,
//     Endpunkt-, Schluessel- oder SDK-Rohtext. Die Einordnung bleibt
//     serverseitig (logStorageFailure).
//   - Kein ACL-Parameter, keine oeffentliche Freigabe. Der Bucket ist privat;
//     Lesen geschieht ausschliesslich ueber kurzlebige signierte URLs.

/**
 * Gueltigkeitsdauer signierter GET-URLs (Sekunden).
 *
 * Unveraenderter Wert der frueheren Konstante images.ts:SIGNED_URL_TTL, damit
 * sich die Gueltigkeitsdauer beim Wechsel des Objektspeichers nicht still
 * aendert. Die Wahl der TTL ist eine offene fachliche Entscheidung (Nutzbarkeit
 * einer geoeffneten Galerie gegen Weitergabbarkeit der URL) und wird hier
 * bewusst NICHT geaendert.
 */
export const SIGNED_URL_TTL_SECONDS = 3600;

/** Operationen dieses Moduls; Kennung fuer Fehler und Protokoll. */
export type StorageOperation = "put" | "delete" | "sign";

/**
 * Fehler des Objektspeichers - die einzige Fehlerart, die dieses Modul verlaesst.
 *
 * `message` enthaelt ausschliesslich die Operation. Bucket, Endpunkt,
 * Objektschluessel und SDK-Rohtext bleiben draussen: der Text kann in einer
 * Server Action oder HTTP-Antwort landen. Der urspruengliche Fehler haengt als
 * `cause` und bleibt damit serverseitig auswertbar.
 */
export class ImageStorageError extends Error {
  readonly operation: StorageOperation;

  constructor(operation: StorageOperation, cause?: unknown) {
    super(`Objektspeicher: Operation "${operation}" fehlgeschlagen.`, { cause });
    this.name = "ImageStorageError";
    this.operation = operation;
  }
}

type StorageClients = {
  /** Cache-Schluessel aus den NICHT geheimen Konfigurationsfeldern. */
  key: string;
  bucket: string;
  /** Gegen den internen Endpunkt: Schreiben und Loeschen. */
  internal: S3Client;
  /** Gegen die oeffentliche Basis-URL: ausschliesslich Signieren. */
  signer: S3Client;
};

let cached: StorageClients | null = null;

/**
 * Cache-Schluessel aus den nicht geheimen Feldern.
 *
 * Das Geheimnis geht bewusst NICHT in den Schluessel ein. Folge, hier
 * ausdruecklich benannt: eine reine Rotation der Zugangsdaten ohne Aenderung von
 * Endpunkt, Bucket, Region oder Adressierungsart wird von einem laufenden
 * Prozess nicht bemerkt und erfordert einen Neustart.
 */
function cacheKey(config: MinioConfig): string {
  return JSON.stringify([
    config.endpoint,
    config.publicBaseUrl,
    config.bucket,
    config.region,
    config.forcePathStyle,
  ]);
}

/**
 * Lazy erzeugte Clientinstanzen. Die Konfiguration wird bei jedem Aufruf frisch
 * gelesen; aendert sie sich, werden beide Instanzen verworfen und neu gebaut.
 *
 * Warum ZWEI Instanzen: SigV4 signiert den Host. Eine mit dem internen
 * Dienstnamen signierte URL ist im Browser weder auflösbar noch gueltig - die
 * Signatur wuerde beim Aufruf ueber einen anderen Host nicht passen. Ausserdem
 * darf der interne Endpunkt ueberhaupt nicht in den Browser gelangen. Der
 * Signier-Client zeigt deshalb auf die oeffentliche Basis-URL und wird
 * ausschliesslich zum Erzeugen presignierter GET-URLs benutzt; er fuehrt selbst
 * keinen Netzaufruf aus.
 */
function clients(): StorageClients {
  const config = readMinioConfig();
  const key = cacheKey(config);
  if (cached !== null && cached.key === key) return cached;

  if (cached !== null) {
    cached.internal.destroy();
    cached.signer.destroy();
  }

  const shared = {
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  };

  cached = {
    key,
    bucket: config.bucket,
    internal: new S3Client({ ...shared, endpoint: config.endpoint }),
    signer: new S3Client({ ...shared, endpoint: config.publicBaseUrl }),
  };
  return cached;
}

/** Objekt schreiben. Kein ACL, keine oeffentliche Freigabe. */
export async function putImageObject(
  key: string,
  body: Uint8Array,
  contentType: string,
): Promise<void> {
  const { internal, bucket } = clients();
  try {
    await internal.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  } catch (error) {
    throw new ImageStorageError("put", error);
  }
}

/**
 * Objekt loeschen. Wird fuer die Kompensation eines fehlgeschlagenen
 * Metadatenschreibens benutzt (verwaistes Objekt vermeiden).
 */
export async function deleteImageObject(key: string): Promise<void> {
  const { internal, bucket } = clients();
  try {
    await internal.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  } catch (error) {
    throw new ImageStorageError("delete", error);
  }
}

/**
 * Kurzlebige signierte GET-URL. Erzeugt keinen Netzaufruf; die Signatur
 * entsteht lokal gegen die oeffentliche Basis-URL.
 */
export async function createImageSignedUrl(
  key: string,
  ttlSeconds: number = SIGNED_URL_TTL_SECONDS,
): Promise<string> {
  const { signer, bucket } = clients();
  try {
    return await getSignedUrl(signer, new GetObjectCommand({ Bucket: bucket, Key: key }), {
      expiresIn: ttlSeconds,
    });
  } catch (error) {
    throw new ImageStorageError("sign", error);
  }
}

/** Fehlername eines SDK- bzw. HTTP-Fehlers, ohne dessen Text. */
function errorName(error: unknown): string {
  if (typeof error !== "object" || error === null) return "unbekannt";
  if (!("name" in error)) return "unbekannt";
  const name: unknown = error.name;
  return typeof name === "string" && name !== "" ? name : "unbekannt";
}

/** HTTP-Status aus `$metadata` eines SDK-Fehlers, sonst "-". */
function httpStatus(error: unknown): string {
  if (typeof error !== "object" || error === null) return "-";
  if (!("$metadata" in error)) return "-";
  const metadata: unknown = error.$metadata;
  if (typeof metadata !== "object" || metadata === null) return "-";
  if (!("httpStatusCode" in metadata)) return "-";
  const status: unknown = metadata.httpStatusCode;
  return typeof status === "number" ? String(status) : "-";
}

/**
 * Fehlschlag einer Speicheroperation ausschliesslich SERVERSEITIG protokollieren.
 *
 * Protokolliert werden Operation, Fehlername und HTTP-Status. Bewusst NICHT
 * protokolliert werden:
 *   - der Objektschluessel: er enthaelt die Vorgangs-ID und den (bereinigten)
 *     Dateinamen und damit einen Personen- bzw. Vorgangsbezug,
 *   - Bucket und Endpunkt: interne Infrastrukturangaben,
 *   - der SDK-Rohtext: er kann Bucket, Endpunkt und Request-ID enthalten.
 *
 * Traegt der Fehler einen `cause` (ImageStorageError), wird dessen Ursache
 * eingeordnet - der Wrapper selbst hat immer denselben Namen.
 */
export function logStorageFailure(operation: string, error: unknown): void {
  const inner =
    error instanceof ImageStorageError && error.cause !== undefined ? error.cause : error;
  console.error(
    "Objektspeicher: Operation fehlgeschlagen",
    operation,
    errorName(inner),
    httpStatus(inner),
  );
}
