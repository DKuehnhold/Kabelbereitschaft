// AP14/B: SYNTHETISCHER S3-KOMPATIBLER TESTENDPUNKT.
//
// ============================================================================
// DIES IST KEIN MinIO UND KEIN MinIO-NACHWEIS.
//
// Auf dem Entwicklungsrechner ist keine Containerlaufzeit vorhanden (kein
// docker, kein podman, kein minio- und kein mc-Binaer). Ein echter
// MinIO-Container ist damit nicht startbar. Dieser Endpunkt ist ein minimaler,
// im Arbeitsspeicher gehaltener HTTP-Dienst, der genau so viel des
// S3-Protokolls beherrscht, wie der Bildpfad der Anwendung benutzt:
// PutObject, DeleteObject und presignierte GetObject-Anfragen im Path-Style.
//
// Was er nachweist: der ECHTE Produktionscode (@/lib/minio-storage ueber das
// echte AWS SDK v3) spricht ueber echtes HTTP mit einem Gegenueber, das
// SigV4-Presign-Signaturen kryptografisch nachrechnet. Damit sind der
// Objektschluessel, die Kompensation, die Privatheit des Lesezugriffs und die
// Gueltigkeitsdauer der signierten URL messbar.
//
// Was er NICHT nachweist: das Verhalten von MinIO selbst - Bucket-Policies,
// Versionierung, Aufbewahrung, Fehlercodes im Detail, TLS, Mehrteil-Uploads und
// die Betriebseigenschaften des Containers. Eine Aussage darueber darf aus
// diesem Endpunkt NICHT abgeleitet werden.
//
// Die SCHREIBENDEN Aufrufe (PutObject, DeleteObject) werden ebenfalls
// kryptografisch geprueft, nur ueber den anderen Weg: das SDK signiert sie nicht
// presigned in der Abfrage, sondern header-basiert im Authorization-Header.
// Nachgerechnet werden Zugriffsschluessel, Gueltigkeitsbereich (Datum, Region,
// Dienst), das Zeitfenster aus x-amz-date, die canonicalHeaders aus GENAU den in
// SignedHeaders genannten Headern und die Signatur selbst. Eine unsignierte oder
// falsch signierte Schreib- bzw. Loeschanfrage wird mit 403 abgewiesen, bevor
// sich am Objektbestand etwas aendert - das ist der Nachweis "privater Bucket,
// kein anonymer Schreib- oder Loeschzugriff".
//
// Was die Nutzlastpruefung abdeckt und was nicht: ist der Wert des Headers
// x-amz-content-sha256 ein Hashwert, wird er gegen den TATSAECHLICH empfangenen
// Rumpf geprueft - die Nutzlast ist dann nachweislich die signierte. Traegt er
// eine Protokollkonstante (UNSIGNED-PAYLOAD oder ein mit STREAMING- beginnender
// Wert), deckt die Signatur den Rumpf ausdruecklich NICHT ab; dieser Endpunkt
// prueft ihn dann ebenfalls nicht und weist ihn auch nicht nach. Nachgewiesen
// ist in diesem Fall allein der Umschlag der Anfrage.
// ============================================================================
//
// Verbindliche Eigenschaften:
//   * Lauscht ausschliesslich auf 127.0.0.1 und einem vom Betriebssystem
//     zugewiesenen freien Port (listen(0)). Kein fester Port.
//   * Objekte liegen ausschliesslich im Arbeitsspeicher (Map). Es wird keine
//     Datei, kein Verzeichnis und kein Protokoll auf der Platte angelegt.
//   * close() beendet den Dienst vollstaendig; danach bleibt kein Prozess, kein
//     Port und kein Objekt zurueck.
//   * Die Zugangsdaten sind erkennbar synthetisch und stehen ausschliesslich im
//     Code. Sie werden nirgends ausgegeben.

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";

/** Fest vorgegebener Algorithmus beider SigV4-Varianten (Presign und Header). */
const ALGORITHM = "AWS4-HMAC-SHA256";

/**
 * Nutzlast-Kennzeichnung, mit der das SDK presignierte S3-Anfragen signiert
 * (@aws-sdk/s3-request-presigner setzt x-amz-content-sha256 auf diesen Wert).
 */
const UNSIGNED_PAYLOAD = "UNSIGNED-PAYLOAD";

/**
 * Zulaessige Abweichung zwischen x-amz-date und der Zeit des Endpunkts, in
 * Sekunden - fuer HEADER-signierte Anfragen (PUT, DELETE).
 *
 * Warum ueberhaupt ein Fenster: eine presignierte Anfrage traegt mit
 * X-Amz-Expires ihre eigene Gueltigkeitsdauer und wird daran gemessen. Eine
 * header-signierte Anfrage traegt das NICHT; sie ist nur ueber die Schiefe
 * zwischen Signierzeit und Empfangszeit begrenzbar. 300 Sekunden ist der Wert,
 * mit dem AWS diese Grenze zieht (RequestTimeTooSkewed). Die Grenze gilt in
 * BEIDE Richtungen: eine in der Zukunft datierte Anfrage ist ebenso ungueltig.
 */
const MAX_CLOCK_SKEW_SECONDS = 300;

/** Form eines Nutzlast-Hashwerts in x-amz-content-sha256 (SHA-256 als Hex). */
const PAYLOAD_HASH_PATTERN = /^[0-9a-fA-F]{64}$/;

/** Synthetische Vorgaben. Erkennbar synthetisch, ohne Bezug zu einer Umgebung. */
const DEFAULT_BUCKET = "kb-ap14b-objekte";
const DEFAULT_ACCESS_KEY_ID = "AP14BSYNTHETISCHKEY0";
const DEFAULT_SECRET_ACCESS_KEY = "ap14b-synthetischer-testschluessel-0000";
const DEFAULT_REGION = "us-east-1";

function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key, value) {
  return createHmac("sha256", key).update(value, "utf8").digest();
}

function hmacHex(key, value) {
  return createHmac("sha256", key).update(value, "utf8").digest("hex");
}

/**
 * RFC-3986-Kodierung eines einzelnen Namens bzw. Werts.
 *
 * Genau die Regel des SDK (@smithy/util-uri-escape): encodeURIComponent, dazu
 * die von encodeURIComponent NICHT kodierten Zeichen !'()* in ihrer
 * Prozentform.
 */
function escapeUri(value) {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/** S3-typischer Fehlerrumpf. Nennt weder Bucket noch Schluessel noch Signatur. */
function errorXml(code) {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    `<Error><Code>${code}</Code>` +
    "<Message>Synthetischer S3-kompatibler Testendpunkt</Message></Error>"
  );
}

function sendXmlError(res, status, code) {
  const body = Buffer.from(errorXml(code), "utf8");
  res.writeHead(status, {
    "content-type": "application/xml",
    "content-length": String(body.byteLength),
  });
  res.end(body);
  return status;
}

/**
 * `YYYYMMDDTHHMMSSZ` in Millisekunden seit Epoche, oder NULL bei falscher Form.
 */
function parseAmzDate(value) {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(value);
  if (match === null) return null;
  const [, year, month, day, hour, minute, second] = match;
  const parsed = Date.parse(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * canonicalQuery nach SigV4.
 *
 * Alle Parameter AUSSER X-Amz-Signature, RFC-3986-kodiert und nach dem
 * KODIERTEN Namen sortiert; bei gleichem Namen nach dem kodierten Wert.
 *
 * Gemeinsam benutzt von beiden Pruefwegen: bei der Presign-Variante steht hier
 * das gesamte Signaturmaterial, bei der Header-Variante ist die Abfrage der von
 * dieser Anwendung benutzten Aufrufe (PutObject, DeleteObject) leer.
 *
 * @param {URLSearchParams} params
 * @returns {string}
 */
function canonicalQueryFrom(params) {
  const pairs = [];
  for (const [name, value] of params.entries()) {
    if (name.toLowerCase() === "x-amz-signature") continue;
    pairs.push([escapeUri(name), escapeUri(value)]);
  }
  pairs.sort((left, right) =>
    left[0] === right[0]
      ? left[1] < right[1]
        ? -1
        : left[1] > right[1]
          ? 1
          : 0
      : left[0] < right[0]
        ? -1
        : 1,
  );
  return pairs.map(([name, value]) => `${name}=${value}`).join("&");
}

/**
 * canonicalHeaders nach SigV4: genau die Namen aus SignedHeaders, in dieser
 * Reihenfolge, mit den TATSAECHLICHEN Werten der Anfrage.
 *
 * @param {import("node:http").IncomingMessage} req
 * @param {string[]} names Bereits klein geschriebene Headernamen.
 * @param {object} [options]
 * @param {boolean} [options.allowMissingContentSha256] Dokumentierte Ausnahme,
 *   und nur diese eine, ausschliesslich fuer die PRESIGN-Variante: das SDK
 *   signiert x-amz-content-sha256 mit dem festen Wert UNSIGNED-PAYLOAD. Je nach
 *   SDK-Stand wandert der Wert in die Abfrage (dann steht er in canonicalQuery)
 *   oder er bleibt ein signierter Header - und den sendet ein Browser beim
 *   Aufruf der signierten URL nicht mit. Der Wert ist eine Konstante des
 *   Protokolls und kein Geheimnis; die Annahme schwaecht die Pruefung deshalb
 *   nicht. Bei der HEADER-Variante gibt es diese Ausnahme NICHT: dort sendet der
 *   Client jeden von ihm signierten Header selbst mit.
 * @returns {string|null} canonicalHeaders oder NULL, wenn ein signierter Header
 *   in der Anfrage fehlt.
 */
function canonicalHeadersFrom(req, names, options = {}) {
  let canonicalHeaders = "";
  for (const name of names) {
    let value = name === "host" ? req.headers.host : req.headers[name];
    if (Array.isArray(value)) value = value.join(",");
    if (value === undefined) {
      if (options.allowMissingContentSha256 === true && name === "x-amz-content-sha256") {
        value = UNSIGNED_PAYLOAD;
      } else {
        return null;
      }
    }
    canonicalHeaders += `${name}:${String(value).trim()}\n`;
  }
  return canonicalHeaders;
}

/** Zeitkonstanter Vergleich zweier Hexzeichenfolgen. */
function equalHex(actual, expected) {
  const a = Buffer.from(actual, "utf8");
  const b = Buffer.from(expected, "utf8");
  // Bei Laengenunterschied wuerde timingSafeEqual werfen; die Ablehnung
  // erfolgt deshalb unmittelbar und ohne Vergleich.
  if (a.byteLength !== b.byteLength) return false;
  return timingSafeEqual(a, b);
}

/**
 * Startet den synthetischen Endpunkt.
 *
 * @param {object} [options]
 * @param {() => number} [options.now] Einspeisbare Zeitquelle in Millisekunden.
 *   Standard ist Date.now. Damit laesst sich ein Ablauf der signierten URL OHNE
 *   echtes Warten erzeugen.
 * @param {string} [options.bucket]
 * @param {string} [options.accessKeyId]
 * @param {string} [options.secretAccessKey]
 * @param {string} [options.region]
 */
export async function startS3TestEndpoint(options = {}) {
  const bucket = options.bucket ?? DEFAULT_BUCKET;
  const accessKeyId = options.accessKeyId ?? DEFAULT_ACCESS_KEY_ID;
  const secretAccessKey = options.secretAccessKey ?? DEFAULT_SECRET_ACCESS_KEY;
  const region = options.region ?? DEFAULT_REGION;
  const now = options.now ?? (() => Date.now());

  /** Objektspeicher, ausschliesslich im Arbeitsspeicher. */
  const objects = new Map();

  /**
   * Fehlerinjektion. Veraenderbar, damit ein Test einen Speicherfehler und
   * einen fehlgeschlagenen Kompensationsloeschvorgang gezielt erzeugen kann.
   */
  const faults = { failPut: false, failDelete: false, failGet: false };

  /**
   * Protokoll der Anfragen fuer die Zaehlpruefungen der Tests.
   *
   * Bewusst OHNE Rumpf, ohne Header und ohne Signatur: hier darf kein Byte
   * eines Bildes und kein Signaturmaterial landen. `path` ist der Pfad OHNE
   * Abfrageteil - die Signatur steht bei presignierten Anfragen in der Abfrage.
   */
  const requests = [];

  /**
   * Erwartete Signatur zu einem bereits gebauten Canonical Request.
   *
   * stringToSign und Schluesselableitung nach SigV4; der Gueltigkeitsbereich
   * entsteht aus dem Datumsanteil von `amzDate` und der konfigurierten Region.
   * Gemeinsam benutzt von der Presign- und der Header-Pruefung.
   *
   * @param {string} amzDate `YYYYMMDDTHHMMSSZ`
   * @param {string} canonicalRequest
   * @returns {string} Signatur als Hex.
   */
  function expectedSignature(amzDate, canonicalRequest) {
    const shortDate = amzDate.slice(0, 8);
    const scope = `${shortDate}/${region}/s3/aws4_request`;
    const stringToSign =
      `${ALGORITHM}\n` + `${amzDate}\n` + `${scope}\n` + sha256Hex(canonicalRequest);

    const dateKey = hmac(`AWS4${secretAccessKey}`, shortDate);
    const regionKey = hmac(dateKey, region);
    const serviceKey = hmac(regionKey, "s3");
    const signingKey = hmac(serviceKey, "aws4_request");
    return hmacHex(signingKey, stringToSign);
  }

  /**
   * Presign-Pruefung einer GET-Anfrage.
   *
   * Reihenfolge der Pruefungen (jeder Fehlschlag fuehrt zu 403 AccessDenied):
   *   1. Vollstaendigkeit der Pflichtparameter. Fehlt einer, ist die Anfrage
   *      unsigniert - genau der Nachweis "privater Bucket, kein anonymer
   *      Lesezugriff".
   *   2. Der Zugriffsschluessel in X-Amz-Credential.
   *   3. Ablauf aus X-Amz-Date + X-Amz-Expires gegen die eingespeiste Zeit.
   *   4. Nachrechnen der Signatur (SigV4, Presign-Variante), zeitkonstant
   *      verglichen.
   *
   * @returns {string|null} Fehlercode oder NULL, wenn die Signatur gueltig ist.
   */
  function verifyPresignedGet(req, rawPath, params) {
    // --- 1) Pflichtparameter -------------------------------------------
    const algorithm = params.get("X-Amz-Algorithm");
    const credential = params.get("X-Amz-Credential");
    const amzDate = params.get("X-Amz-Date");
    const expires = params.get("X-Amz-Expires");
    const signedHeaders = params.get("X-Amz-SignedHeaders");
    const signature = params.get("X-Amz-Signature");
    if (
      algorithm === null ||
      credential === null ||
      amzDate === null ||
      expires === null ||
      signedHeaders === null ||
      signature === null
    ) {
      return "AccessDenied";
    }
    if (algorithm !== ALGORITHM) return "AccessDenied";

    // --- 2) Zugriffsschluessel -----------------------------------------
    const credentialKey = credential.split("/")[0];
    if (credentialKey !== accessKeyId) return "AccessDenied";

    // --- 3) Ablauf ------------------------------------------------------
    const signedAt = parseAmzDate(amzDate);
    if (signedAt === null) return "AccessDenied";
    const ttlSeconds = Number(expires);
    if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) return "AccessDenied";
    if (now() > signedAt + ttlSeconds * 1000) return "AccessDenied";

    // --- 4) Signatur nachrechnen ---------------------------------------
    const canonicalQuery = canonicalQueryFrom(params);

    // canonicalHeaders: genau die Namen aus X-Amz-SignedHeaders, in dieser
    // Reihenfolge. Der Wert kommt aus der tatsaechlichen Anfrage. Die einzige
    // Ausnahme (fehlendes x-amz-content-sha256) ist an canonicalHeadersFrom()
    // dokumentiert und gilt ausschliesslich hier.
    const names = signedHeaders.split(";").map((name) => name.trim().toLowerCase());
    const canonicalHeaders = canonicalHeadersFrom(req, names, {
      allowMissingContentSha256: true,
    });
    if (canonicalHeaders === null) return "AccessDenied";

    // Als Pfad GENAU der Pfad aus der Anfragezeile - bereits kodiert, nicht der
    // dekodierte. Doppelte Kodierung entfaellt: der S3-Signierer arbeitet mit
    // uriEscapePath = false.
    const canonicalRequest =
      "GET\n" +
      `${rawPath}\n` +
      `${canonicalQuery}\n` +
      `${canonicalHeaders}\n` +
      `${names.join(";")}\n` +
      UNSIGNED_PAYLOAD;

    return equalHex(signature, expectedSignature(amzDate, canonicalRequest))
      ? null
      : "AccessDenied";
  }

  /**
   * Header-Pruefung einer schreibenden Anfrage (PUT, DELETE).
   *
   * Das SDK signiert PutObject und DeleteObject NICHT presigned in der Abfrage,
   * sondern header-basiert:
   *   Authorization: AWS4-HMAC-SHA256 Credential=<AK>/<yyyymmdd>/<region>/s3/
   *                  aws4_request, SignedHeaders=<a;b;c>, Signature=<hex>
   *
   * Reihenfolge der Pruefungen (jeder Fehlschlag fuehrt zu 403 AccessDenied):
   *   1. Authorization-Header vorhanden und wohlgeformt. Fehlt er, ist die
   *      Anfrage unsigniert - genau der Nachweis "privater Bucket, kein anonymer
   *      Schreib- oder Loeschzugriff".
   *   2. Der Zugriffsschluessel im ersten Segment von Credential.
   *   3. Der Gueltigkeitsbereich: <yyyymmdd>/<region>/s3/aws4_request, wobei das
   *      Datum zum Datumsanteil von x-amz-date passen muss.
   *   4. Das Zeitfenster aus x-amz-date gegen die eingespeiste Zeit
   *      (MAX_CLOCK_SKEW_SECONDS in beide Richtungen).
   *   5. Der Nutzlast-Hash aus x-amz-content-sha256 gegen den TATSAECHLICH
   *      empfangenen Rumpf.
   *   6. Nachrechnen der Signatur, zeitkonstant verglichen.
   *
   * @param {import("node:http").IncomingMessage} req
   * @param {string} rawPath Pfad aus der Anfragezeile, bereits kodiert.
   * @param {string} rawQuery Abfrageteil ohne "?".
   * @param {Buffer} body Vollstaendig gelesener Anfragerumpf.
   * @returns {string|null} Fehlercode oder NULL, wenn die Signatur gueltig ist.
   */
  function verifySignedRequest(req, rawPath, rawQuery, body) {
    // --- 1) Authorization-Header ----------------------------------------
    const authorization = req.headers.authorization;
    if (typeof authorization !== "string") return "AccessDenied";
    const separator = authorization.indexOf(" ");
    if (separator === -1) return "AccessDenied";
    if (authorization.slice(0, separator) !== ALGORITHM) return "AccessDenied";

    // Credential, SignedHeaders und Signature sind durch Komma getrennt und
    // duerfen Leerzeichen tragen. Keiner der drei WERTE enthaelt ein Komma
    // (Schraegstriche, Semikola und Hex), das Zerlegen ist deshalb eindeutig.
    const fields = new Map();
    for (const part of authorization.slice(separator + 1).split(",")) {
      const trimmed = part.trim();
      if (trimmed === "") continue;
      const equals = trimmed.indexOf("=");
      if (equals <= 0) return "AccessDenied";
      const name = trimmed.slice(0, equals).trim();
      if (fields.has(name)) return "AccessDenied";
      fields.set(name, trimmed.slice(equals + 1).trim());
    }
    const credential = fields.get("Credential");
    const signedHeaders = fields.get("SignedHeaders");
    const signature = fields.get("Signature");
    if (
      credential === undefined ||
      signedHeaders === undefined ||
      signature === undefined ||
      signedHeaders === "" ||
      signature === ""
    ) {
      return "AccessDenied";
    }

    // --- 2) Zugriffsschluessel -----------------------------------------
    const credentialParts = credential.split("/");
    if (credentialParts[0] !== accessKeyId) return "AccessDenied";

    // --- 3) Gueltigkeitsbereich ----------------------------------------
    const amzDate = req.headers["x-amz-date"];
    if (typeof amzDate !== "string") return "AccessDenied";
    if (credentialParts.length !== 5) return "AccessDenied";
    const [, scopeDate, scopeRegion, scopeService, scopeTerminator] = credentialParts;
    if (scopeRegion !== region) return "AccessDenied";
    if (scopeService !== "s3") return "AccessDenied";
    if (scopeTerminator !== "aws4_request") return "AccessDenied";
    if (scopeDate !== amzDate.slice(0, 8)) return "AccessDenied";

    // --- 4) Zeitfenster --------------------------------------------------
    const signedAt = parseAmzDate(amzDate);
    if (signedAt === null) return "AccessDenied";
    if (Math.abs(now() - signedAt) > MAX_CLOCK_SKEW_SECONDS * 1000) return "AccessDenied";

    // --- 5) Nutzlast-Hash ------------------------------------------------
    // Der Wert geht unveraendert als Payload-Hash in den Canonical Request.
    // Zusaetzlich, und das ist der eigentliche Nutzlastnachweis: ist er ein
    // Hashwert, MUSS er zum tatsaechlich empfangenen Rumpf passen.
    //
    // Ausdrueckliche Grenze: bei UNSIGNED-PAYLOAD und bei den STREAMING-Formen
    // deckt die Signatur den Rumpf nicht ab. Der Rumpfvergleich entfaellt dann,
    // und die Nutzlast ist in diesem Fall NICHT nachgewiesen.
    const payloadHash = req.headers["x-amz-content-sha256"];
    if (typeof payloadHash !== "string" || payloadHash === "") return "AccessDenied";
    if (PAYLOAD_HASH_PATTERN.test(payloadHash)) {
      if (!equalHex(payloadHash.toLowerCase(), sha256Hex(body))) return "AccessDenied";
    } else if (payloadHash !== UNSIGNED_PAYLOAD && !payloadHash.startsWith("STREAMING-")) {
      return "AccessDenied";
    }

    // --- 6) Signatur nachrechnen -----------------------------------------
    const canonicalQuery = canonicalQueryFrom(new URLSearchParams(rawQuery));

    // KEINE Ausnahme fuer einen fehlenden Header: anders als beim Aufruf einer
    // presignierten URL durch einen Browser sendet der signierende Client hier
    // jeden von ihm signierten Header selbst mit.
    const names = signedHeaders.split(";").map((name) => name.trim().toLowerCase());
    const canonicalHeaders = canonicalHeadersFrom(req, names);
    if (canonicalHeaders === null) return "AccessDenied";

    // Pfad wie bei der Presign-Pruefung: GENAU der Pfad aus der Anfragezeile,
    // bereits kodiert, ohne zweite Kodierung (uriEscapePath = false).
    const canonicalRequest =
      `${req.method}\n` +
      `${rawPath}\n` +
      `${canonicalQuery}\n` +
      `${canonicalHeaders}\n` +
      `${names.join(";")}\n` +
      payloadHash;

    return equalHex(signature, expectedSignature(amzDate, canonicalRequest))
      ? null
      : "AccessDenied";
  }

  /**
   * Beantwortet eine Anfrage und liefert den gesetzten Status zurueck.
   *
   * Path-Style-Adressierung: /<bucket>/<key...>. Der Schluessel darf
   * Schraegstriche enthalten.
   */
  function handle(req, res, rawPath, rawQuery, body) {
    const segments = rawPath.split("/").filter((segment) => segment !== "");
    if (segments.length === 0) return sendXmlError(res, 404, "NoSuchBucket");

    let decoded;
    try {
      decoded = segments.map((segment) => decodeURIComponent(segment));
    } catch {
      return sendXmlError(res, 404, "NoSuchKey");
    }
    if (decoded[0] !== bucket) return sendXmlError(res, 404, "NoSuchBucket");

    const key = decoded.slice(1).join("/");
    if (key === "") return sendXmlError(res, 404, "NoSuchKey");

    if (req.method === "PUT" || req.method === "DELETE") {
      // Die Signaturpruefung steht VOR der Fehlerinjektion und VOR jeder
      // Zustandsaenderung - wie bei GET. Eine unsignierte Anfrage darf weder
      // einen Serverfehler noch eine Existenzaussage erhalten und den
      // Objektbestand nicht veraendern.
      const failure = verifySignedRequest(req, rawPath, rawQuery, body);
      if (failure !== null) return sendXmlError(res, 403, failure);
    }

    if (req.method === "PUT") {
      if (faults.failPut) return sendXmlError(res, 500, "InternalError");
      const contentType =
        typeof req.headers["content-type"] === "string"
          ? req.headers["content-type"]
          : "application/octet-stream";
      objects.set(key, { body, contentType });
      // Kein Ueberschreibungsschutz - S3 verhaelt sich ebenso.
      res.writeHead(200, {
        etag: `"${createHash("md5").update(body).digest("hex")}"`,
        "content-length": "0",
      });
      res.end();
      return 200;
    }

    if (req.method === "DELETE") {
      if (faults.failDelete) return sendXmlError(res, 500, "InternalError");
      objects.delete(key);
      res.writeHead(204);
      res.end();
      return 204;
    }

    if (req.method === "GET") {
      // Die Signaturpruefung steht VOR der Fehlerinjektion und VOR der
      // Existenzpruefung: eine unsignierte Anfrage darf weder einen
      // Serverfehler noch eine Existenzaussage erhalten.
      const failure = verifyPresignedGet(req, rawPath, new URLSearchParams(rawQuery));
      if (failure !== null) return sendXmlError(res, 403, failure);
      if (faults.failGet) return sendXmlError(res, 500, "InternalError");
      const object = objects.get(key);
      if (object === undefined) return sendXmlError(res, 404, "NoSuchKey");
      res.writeHead(200, {
        "content-type": object.contentType,
        "content-length": String(object.body.byteLength),
      });
      res.end(object.body);
      return 200;
    }

    return sendXmlError(res, 405, "MethodNotAllowed");
  }

  const server = createServer((req, res) => {
    const url = req.url ?? "/";
    const separator = url.indexOf("?");
    const rawPath = separator === -1 ? url : url.slice(0, separator);
    const rawQuery = separator === -1 ? "" : url.slice(separator + 1);

    // Der Rumpf wird IMMER vollstaendig gelesen, auch im Fehlerfall: sonst
    // haengt der Client an einem ungelesenen Anfragerumpf.
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const status = handle(req, res, rawPath, rawQuery, Buffer.concat(chunks));
      requests.push({ method: req.method, path: rawPath, status });
    });
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  const url = `http://127.0.0.1:${address.port}`;

  return {
    url,
    bucket,
    accessKeyId,
    secretAccessKey,
    region,
    objects,
    faults,
    requests,
    /**
     * Beendet den Dienst vollstaendig.
     *
     * closeAllConnections() ist noetig, weil das AWS SDK mit
     * keep-alive-Verbindungen arbeitet: ohne diesen Aufruf wartet close()
     * unbegrenzt auf ruhende Sockets und der Testprozess wuerde haengen.
     */
    close() {
      return new Promise((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      });
    },
  };
}
