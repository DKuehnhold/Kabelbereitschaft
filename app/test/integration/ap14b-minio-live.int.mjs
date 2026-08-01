// AP14/B: ECHTER MinIO-NACHWEIS des Objektspeicherpfades.
//
// ============================================================================
// DIES IST - IM UNTERSCHIED ZU ./s3-test-endpoint.mjs - EIN ECHTER
// MinIO-NACHWEIS.
//
// ./s3-test-endpoint.mjs ist ein SYNTHETISCHER, im Arbeitsspeicher gehaltener
// S3-kompatibler HTTP-Dienst. Er rechnet SigV4 zwar kryptografisch nach, ist
// aber ausdruecklich KEIN MinIO und belegt weder Bucket-Policies noch die
// Benutzerverwaltung noch die Fehlercodes von MinIO (die Abgrenzung steht dort
// im Kopf der Datei).
//
// Diese Datei laeuft gegen einen WIRKLICHEN, digest-fest referenzierten
// MinIO-Container. Gestartet, provisioniert und ausgefuehrt wird sie vom Job
// "objectstore" in .github/workflows/ci.yml. Auf dem Entwicklungsrechner ist
// keine Containerlaufzeit vorhanden; sie laeuft dort nicht.
// ============================================================================
//
// Geprueft wird AUSSCHLIESSLICH ueber den Produktivcode @/lib/minio-storage
// (putImageObject, createImageSignedUrl, deleteImageObject) mit dem echten AWS
// SDK v3. Fuer die Positivfaelle wird KEIN eigener S3-Client und KEINE eigene
// Signierung nachgebaut. Die einzige, unten ausdruecklich gekennzeichnete
// Ausnahme ist der Fall zur Rechtebegrenzung: er misst die Policy und nicht den
// Produktivcode, und minio-storage.ts bietet dafuer bewusst keinen Weg an.
//
// Lauf (siehe Job "objectstore"):
//   S3_ENDPOINT, S3_PUBLIC_BASE_URL, S3_BUCKET, S3_ACCESS_KEY_ID,
//   S3_SECRET_ACCESS_KEY sowie AP14B_MINIO_FOREIGN_BUCKET setzen, dann
//   node --import ./test/integration/module-hooks.mjs \
//        test/integration/ap14b-minio-live.int.mjs
//
// FAIL-CLOSED, und genau darin unterscheidet sich diese Datei von den uebrigen
// Integrationstests: fehlt eine Pflichtvariable oder ist der Objektspeicher
// nicht erreichbar, BRICHT der Lauf ab. Es wird nichts uebersprungen - ein
// stiller Skip waere hier ein vorgetaeuschter Nachweis.
//
// Es kommen ausschliesslich synthetische Werte vor: die Vorgangskennung traegt
// den Praefix 24d00000- (er kommt in keiner anderen Test- oder Migrationsdatei
// vor - 20_ap14b_data.sql benutzt 20b00000-, 21_ap14b_masterdata_inventory.sql
// 21b00000-, 22_ap14b_images.sql 22b00000-, ap14b-images.int.mjs 23d00000-,
// ap14b-masterdata-inventory.int.mjs 21c00000- und ap14b-platform.int.mjs
// ac140b00-), es gibt keine echten Personen, keine echten Bilder und
// AUSDRUECKLICH KEINE EXIF- oder GPS-Daten: die Bildbytes bestehen aus den
// korrekten Magic Bytes und Fuellbytes.
//
// KEIN Zugangsdatenwert erscheint in einer Ausgabe. Auch eine signierte URL wird
// NIE vollstaendig ausgegeben - sie traegt Signaturmaterial und den
// Zugriffsschluessel; ausgegeben werden hoechstens Pfad und Statuscode.

import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// --------------------------------------------------------------------------
// Fail-closed: Pflichtumgebung
// --------------------------------------------------------------------------

/**
 * Pflichtvariablen dieses Laufs.
 *
 * Die ersten fuenf sind die Pflichtnamen aus src/lib/minio-config.ts; sie werden
 * hier NICHT neu erfunden und auch nicht mit Standardwerten aufgefuellt.
 * AP14B_MINIO_FOREIGN_BUCKET ist der Gegenprobe-Bucket der Rechtebegrenzung.
 */
const REQUIRED_ENV_KEYS = [
  "S3_ENDPOINT",
  "S3_PUBLIC_BASE_URL",
  "S3_BUCKET",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "AP14B_MINIO_FOREIGN_BUCKET",
];

/** Getrimmter Wert einer Pflichtvariablen; meldet ausschliesslich den NAMEN. */
function requiredEnv(name) {
  const value = process.env[name]?.trim() ?? "";
  if (value === "") throw new Error(`Pflichtvariable fehlt: ${name}.`);
  return value;
}

const missing = REQUIRED_ENV_KEYS.filter(
  (name) => (process.env[name]?.trim() ?? "") === "",
);
if (missing.length > 0) {
  // Abbruch statt Skip. Die Meldung nennt ausschliesslich Namen.
  throw new Error(
    `MinIO-Live-Nachweis nicht lauffaehig, Pflichtvariablen fehlen: ${missing.join(", ")}. ` +
      "Dieser Lauf wird ausdruecklich NICHT uebersprungen (siehe Kopf der Datei).",
  );
}

const ENDPOINT = requiredEnv("S3_ENDPOINT");
const BUCKET = requiredEnv("S3_BUCKET");
const FOREIGN_BUCKET = requiredEnv("AP14B_MINIO_FOREIGN_BUCKET");
const REGION = process.env.S3_REGION?.trim() || "us-east-1";

// AUTH_URL wird ausdruecklich ENTFERNT: ist sie gesetzt, vergleicht
// readMinioConfig() ihren Origin mit dem der oeffentlichen Signierbasis. Ein in
// der Laufumgebung gesetzter Wert wuerde jeden Fall dieser Datei an dieser
// Pruefung scheitern lassen - die Signierbasis ist hier der Loopback-Port des
// MinIO-Containers. Der Job setzt AUTH_URL nicht; das hier ist die Absicherung.
delete process.env.AUTH_URL;

/**
 * Erreichbarkeit, fail-closed und VOR dem ersten Fall.
 *
 * /minio/health/live ist der Lebendigkeitsendpunkt von MinIO - derselbe, den
 * deploy/compose.yml im Healthcheck des Dienstes benutzt. Antwortet er nicht,
 * bricht der Lauf ab, statt spaeter mit unklaren Fehlern zu scheitern.
 */
const health = await fetch(new URL("/minio/health/live", ENDPOINT), {
  signal: AbortSignal.timeout(10_000),
});
if (!health.ok) {
  throw new Error(
    `MinIO ist unter S3_ENDPOINT nicht bereit (HTTP ${health.status}). ` +
      "Dieser Lauf wird ausdruecklich NICHT uebersprungen.",
  );
}

// Erst nach der Umgebungspruefung importieren: minio-config.ts liest die Werte
// beim ersten Speicherzugriff frisch aus process.env.
const { putImageObject, deleteImageObject, createImageSignedUrl, ImageStorageError } =
  await import("../../src/lib/minio-storage.ts");

// --------------------------------------------------------------------------
// Synthetische Fixtures
// --------------------------------------------------------------------------

/** Synthetische Vorgangskennung, Praefix 24d00000- (siehe Kopf der Datei). */
const INCIDENT_ID = "24d00000-0000-0000-0000-0000000000b1";

const FILE_NAME = "i24-minio-live-nachweis.jpg";
const CONTENT_TYPE = "image/jpeg";

/**
 * Objektschluessel im Stil des Produktivpfades
 * incidents/<incidentId>/<uuid>/<bereinigter Dateiname> - genau die Form, die
 * buildStoragePath() aus src/lib/images.ts erzeugt. Er wird hier bewusst selbst
 * gebildet: dieser Lauf prueft den Objektspeicher und nicht die Namensbildung
 * (die misst ap14b-images.int.mjs).
 */
const OBJECT_KEY = `incidents/${INCIDENT_ID}/${randomUUID()}/${FILE_NAME}`;

/**
 * Synthetische JPEG-Bytes: korrekte Magic Bytes FF D8 FF, danach Fuellbytes.
 *
 * Die Fuellbytes vermeiden 0xFF vollstaendig. Damit entsteht hinter dem
 * Startmarker kein weiterer JPEG-Segmentmarker - die Bytes tragen also
 * ausdruecklich KEINE EXIF-, GPS- oder Kameradaten.
 */
function jpegBytes(size = 2048) {
  const bytes = new Uint8Array(Math.max(size, 3));
  bytes[0] = 0xff;
  bytes[1] = 0xd8;
  bytes[2] = 0xff;
  for (let index = 3; index < bytes.length; index += 1) {
    bytes[index] = 0x41 + (index % 26);
  }
  return bytes;
}

const BYTES = jpegBytes();

/** Objektpfad im Path-Style: /<bucket>/<key>. */
function objectPath(key) {
  return `/${BUCKET}/${key}`;
}

/** Rumpf einer HTTP-Antwort als Uint8Array. */
async function responseBytes(response) {
  return new Uint8Array(await response.arrayBuffer());
}

/** HTTP-Status aus `$metadata` eines SDK-Fehlers, sonst NULL. */
function sdkHttpStatus(error) {
  const status = error?.$metadata?.httpStatusCode;
  return typeof status === "number" ? status : null;
}

/**
 * Fuehrt einen Aufruf aus, der scheitern MUSS, und liefert den Fehler.
 *
 * Bewusst ohne assert.fail() im try-Block: eine dort geworfene AssertionError
 * liefe in den eigenen catch-Zweig und ein Erfolg wuerde als erwartete
 * Ablehnung durchgehen.
 */
async function mustReject(run, label) {
  let caught = null;
  let resolved = false;
  try {
    await run();
    resolved = true;
  } catch (error) {
    caught = error;
  }
  assert.equal(resolved, false, `${label}: der Aufruf ist unerwartet GELUNGEN.`);
  return caught;
}

/** Zustand, den mehrere Faelle nacheinander benutzen. */
let signedUrl = null;

// --------------------------------------------------------------------------

test.after(async () => {
  // Aufraeumen und ausdruecklich melden, ob es gelungen ist. Das Loeschen ist
  // idempotent: ML7 hat dasselbe Objekt bereits entfernt, ein DELETE auf einen
  // nicht vorhandenen Schluessel ist in S3 erfolgreich.
  try {
    await deleteImageObject(OBJECT_KEY);
    console.log(`Aufraeumen erfolgreich: ${objectPath(OBJECT_KEY)} ist entfernt.`);
  } catch (error) {
    // Kein Rohtext des SDK und kein Zugangsdatum in der Ausgabe.
    const operation = error instanceof ImageStorageError ? error.operation : "unbekannt";
    console.error(
      `Aufraeumen FEHLGESCHLAGEN fuer ${objectPath(OBJECT_KEY)} (Operation ${operation}).`,
    );
    throw error;
  }
});

// ==========================================================================
// A) Positivweg ueber den Produktivcode (ML1-ML2)
// ==========================================================================

test("ML1 putImageObject schreibt das Objekt in den echten MinIO-Bucket", async () => {
  // putImageObject() hat den Rueckgabetyp void; ein Fehlschlag verliesse die
  // Funktion als ImageStorageError. Der Nachweis, dass die Bytes wirklich
  // angekommen sind, folgt in ML2 ueber den signierten Lesezugriff.
  assert.equal(await putImageObject(OBJECT_KEY, BYTES, CONTENT_TYPE), undefined);
});

test("ML2 die signierte URL liefert 200 und byteweise genau die geschriebenen Bytes", async () => {
  // DER Kernnachweis: die im Produktivcode erzeugte SigV4-Signatur wird von
  // MinIO nachgerechnet und angenommen, und der Rumpf ist unveraendert.
  signedUrl = await createImageSignedUrl(OBJECT_KEY);
  assert.equal(typeof signedUrl, "string");

  const parsed = new URL(signedUrl);
  // Bucket- und Schluesselpfad (Path-Style). Der Schluessel besteht
  // ausschliesslich aus Zeichen, die keine Prozentkodierung ausloesen.
  assert.equal(parsed.pathname, objectPath(OBJECT_KEY));
  assert.equal(parsed.searchParams.get("X-Amz-Algorithm"), "AWS4-HMAC-SHA256");
  const signature = parsed.searchParams.get("X-Amz-Signature");
  assert.ok(signature, "die signierte URL enthaelt keine Signatur");
  assert.match(signature, /^[0-9a-f]{64}$/, "die Signatur hat nicht die erwartete Form");
  // Die URL signiert nachweislich die Anwendungsidentitaet - nicht die
  // Root-Identitaet. Geprueft wird ohne jede Ausgabe des Werts.
  assert.ok(
    (parsed.searchParams.get("X-Amz-Credential") ?? "").startsWith(
      requiredEnv("S3_ACCESS_KEY_ID"),
    ),
    "die signierte URL traegt nicht den Zugriffsschluessel der Anwendungsidentitaet",
  );

  const response = await fetch(signedUrl);
  console.log(`GET ${parsed.pathname} (signiert) -> ${response.status}`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), CONTENT_TYPE);
  assert.deepEqual(await responseBytes(response), BYTES);
});

// ==========================================================================
// B) Privatheit und Signatur (ML3-ML5)
//
// Diese Faelle laufen VOR dem Loeschen (ML7): das Objekt existiert dabei
// nachweislich, eine Antwort 200 waere also moeglich. Wuerde erst geloescht,
// liesse sich eine Abweisung nicht von "Objekt nicht vorhanden" unterscheiden.
// ==========================================================================

test("ML3 ein unsignierter GET auf denselben Objektpfad wird abgewiesen", async () => {
  // Nachweis "privater Bucket, keine anonyme Freigabe": derselbe Pfad, der mit
  // gueltiger Signatur in ML2 200 geliefert hat, ist ohne Signatur nicht lesbar.
  const path = objectPath(OBJECT_KEY);
  const response = await fetch(new URL(path, ENDPOINT));
  console.log(`GET ${path} (unsigniert) -> ${response.status}`);
  assert.notEqual(response.status, 200, "der Bucket ist anonym lesbar");
  assert.equal(response.status, 403);
});

test("ML4 eine manipulierte Signatur wird mit 403 abgewiesen", async () => {
  assert.ok(signedUrl, "ML2 hat keine signierte URL hinterlassen");
  const signature = new URL(signedUrl).searchParams.get("X-Amz-Signature");
  assert.match(signature, /^[0-9a-f]{64}$/);

  // Genau EIN Zeichen der Signatur veraendern, sonst nichts. Die Ersetzung
  // geschieht bewusst auf der ZEICHENKETTE und nicht ueber URLSearchParams: eine
  // erneute Serialisierung koennte den Abfrageteil anders kodieren und die
  // Ablehnung dann aus einem anderen Grund als der manipulierten Signatur
  // erfolgen.
  const last = signature.slice(-1);
  const flipped = `${signature.slice(0, -1)}${last === "0" ? "1" : "0"}`;
  const tampered = signedUrl.replace(
    `X-Amz-Signature=${signature}`,
    `X-Amz-Signature=${flipped}`,
  );
  assert.notEqual(tampered, signedUrl, "die Signatur wurde nicht ersetzt");

  const response = await fetch(tampered);
  console.log(
    `GET ${new URL(tampered).pathname} (Signatur manipuliert) -> ${response.status}`,
  );
  // Harter Fehlschlag bei Erfolg: eine angenommene Fremdsignatur waere der
  // schwerste denkbare Befund dieses Nachweises.
  assert.notEqual(response.status, 200, "MinIO hat eine manipulierte Signatur angenommen");
  assert.equal(response.status, 403);
  assert.match(await response.text(), /<Code>(SignatureDoesNotMatch|AccessDenied)<\/Code>/);
});

test("ML5 ein veraenderter Objektschluessel bei unveraenderter Signatur wird abgewiesen", async () => {
  assert.ok(signedUrl, "ML2 hat keine signierte URL hinterlassen");
  // Zweite Variante: die Signatur bleibt exakt, veraendert wird ausschliesslich
  // der Objektschluessel im Pfad. SigV4 deckt den kanonischen Pfad mit ab; die
  // Signatur passt danach nicht mehr.
  const tampered = signedUrl.replace(FILE_NAME, "i24-fremder-schluessel.jpg");
  assert.notEqual(tampered, signedUrl, "der Objektschluessel wurde nicht ersetzt");

  const response = await fetch(tampered);
  console.log(
    `GET ${new URL(tampered).pathname} (Schluessel veraendert) -> ${response.status}`,
  );
  assert.notEqual(response.status, 200, "MinIO hat einen fremden Schluessel ausgeliefert");
  // Ausdruecklich 403 und NICHT 404: die Signaturpruefung greift VOR der Suche
  // nach dem Objekt. Ein 404 wuerde bedeuten, dass zuerst nachgesehen und die
  // Signatur erst danach (oder gar nicht) geprueft wurde.
  assert.equal(response.status, 403);
});

// ==========================================================================
// C) Rechtebegrenzung der Anwendungsidentitaet (ML6)
// ==========================================================================

test("ML6 die Anwendungsidentitaet kommt nicht ueber ihren Bucket hinaus", async () => {
  // ================== BEWUSSTE AUSNAHME ==================
  // Hier wird ausnahmsweise DIREKT das SDK benutzt und nicht der Produktivcode.
  // Begruendung: src/lib/minio-storage.ts bietet fuer Auflistungen und fuer
  // fremde Buckets ABSICHTLICH keinen Weg an (es gibt dort nur Put, Signieren
  // und Delete auf genau einen Bucket). Dieser Fall misst deshalb die POLICY
  // deploy/minio/incident-images-app.policy.json und ausdruecklich NICHT den
  // Produktivcode. Alle uebrigen Faelle laufen unveraendert ueber ihn.
  // =======================================================
  const {
    S3Client,
    ListBucketsCommand,
    ListObjectsV2Command,
    GetObjectCommand,
    PutObjectCommand,
  } = await import("@aws-sdk/client-s3");

  const client = new S3Client({
    endpoint: ENDPOINT,
    region: REGION,
    forcePathStyle: true,
    credentials: {
      accessKeyId: requiredEnv("S3_ACCESS_KEY_ID"),
      secretAccessKey: requiredEnv("S3_SECRET_ACCESS_KEY"),
    },
  });

  try {
    // 1) Auflisten des EIGENEN Buckets: die Policy erlaubt GetObject, PutObject
    //    und DeleteObject, aber KEIN s3:ListBucket. Der Inhalt darf also nicht
    //    aufzaehlbar sein.
    const listOwn = await mustReject(
      () => client.send(new ListObjectsV2Command({ Bucket: BUCKET })),
      "Auflisten des eigenen Buckets",
    );
    console.log(`ListObjectsV2 auf /${BUCKET} -> abgewiesen (${sdkHttpStatus(listOwn)})`);
    assert.equal(sdkHttpStatus(listOwn), 403);

    // 2) Lesen und Schreiben in einem FREMDEN Bucket. Der Gegenprobe-Bucket
    //    existiert nachweislich (der Job legt ihn an) - eine Abweisung ist
    //    deshalb eine Rechte- und keine Existenzaussage.
    const readForeign = await mustReject(
      () => client.send(new GetObjectCommand({ Bucket: FOREIGN_BUCKET, Key: "i24-probe.txt" })),
      "Lesen im fremden Bucket",
    );
    assert.equal(sdkHttpStatus(readForeign), 403);

    const writeForeign = await mustReject(
      () =>
        client.send(
          new PutObjectCommand({
            Bucket: FOREIGN_BUCKET,
            Key: "i24-probe.txt",
            Body: new Uint8Array([0x49, 0x32, 0x34]),
            ContentType: "application/octet-stream",
          }),
        ),
      "Schreiben im fremden Bucket",
    );
    assert.equal(sdkHttpStatus(writeForeign), 403);
    console.log(`Zugriff auf /${FOREIGN_BUCKET} -> abgewiesen (403).`);

    // 3) Auflisten ALLER Buckets. Hier sind zwei Ausgaenge zulaessig und beide
    //    belegen die Begrenzung:
    //      - Abweisung, weil s3:ListAllMyBuckets fehlt, oder
    //      - eine Liste, die den fremden Bucket NICHT enthaelt (MinIO
    //        beschraenkt die Antwort in diesem Fall auf die zugaenglichen
    //        Buckets).
    //    Ein Erfolg MIT dem fremden Bucket in der Antwort ist ein harter
    //    Fehlschlag.
    let listing = null;
    let listError = null;
    try {
      listing = await client.send(new ListBucketsCommand({}));
    } catch (error) {
      listError = error;
    }
    if (listError !== null) {
      console.log(`ListBuckets -> abgewiesen (${sdkHttpStatus(listError)})`);
    } else {
      const names = (listing.Buckets ?? []).map((bucket) => bucket.Name);
      console.log(`ListBuckets -> ${names.length} Bucket(s) sichtbar.`);
      assert.equal(
        names.includes(FOREIGN_BUCKET),
        false,
        "die Anwendungsidentitaet sieht einen fremden Bucket",
      );
    }
  } finally {
    client.destroy();
  }
});

// ==========================================================================
// D) Loeschen (ML7)
// ==========================================================================

test("ML7 deleteImageObject entfernt das Objekt; eine frische Signatur laeuft danach ins Leere", async () => {
  assert.equal(await deleteImageObject(OBJECT_KEY), undefined);

  // FRISCH signieren, nicht die URL aus ML2 wiederverwenden: sonst waere nicht
  // unterscheidbar, ob die Ablehnung am fehlenden Objekt oder an der Signatur
  // liegt.
  const afterDelete = await createImageSignedUrl(OBJECT_KEY);
  const parsed = new URL(afterDelete);
  const response = await fetch(afterDelete);
  console.log(`GET ${parsed.pathname} (nach dem Loeschen) -> ${response.status}`);
  // Harte Zusicherung ist ausschliesslich "nicht 200". Der genaue Code wird
  // bewusst NICHT festgeschrieben: fuer ein fehlendes Objekt ist 404 (NoSuchKey)
  // zu erwarten, ohne s3:ListBucket antwortet ein S3-Dienst aber auch mit 403.
  // Beides belegt gleichermassen, dass das Objekt nicht mehr auslieferbar ist.
  assert.notEqual(response.status, 200, "das geloeschte Objekt wird weiter ausgeliefert");
});
