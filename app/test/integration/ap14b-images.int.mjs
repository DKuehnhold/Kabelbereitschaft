// AP14/B Integrationstests des BILDPFADES gegen ein synthetisches PostgreSQL 18
// und einen synthetischen S3-kompatiblen Testendpunkt.
//
// Lauf (siehe app/supabase/test/run_ap14b_local.ps1, dritter Node-Aufruf im
// Schritt "Integrationstests"):
//   AP14B_APP_DATABASE_URL=...   Verbindung der Anwendung (Rolle erbt app_user,
//                                kein SUPERUSER, kein BYPASSRLS)
//   AP14B_ADMIN_DATABASE_URL=... Verbindung der Migrations-/Eigentuemerrolle,
//                                ausschliesslich fuer Fixtures und Gegenproben
//   node --import ./test/integration/module-hooks-app.mjs \
//        test/integration/ap14b-images.int.mjs
//
// Ohne diese beiden Variablen werden alle Pruefungen uebersprungen; die Datei
// ist damit in einer Umgebung ohne Datenbank harmlos.
//
// WARUM DIESE DATEI NOETIG IST: der SQL-Smoke 22 misst die Datenbankseite
// (Rechte, RLS, Trigger, Chronik) und spricht den Objektspeicher ausdruecklich
// NICHT an (22_ap14b_images.sql:34-39). Der Objektschluessel, die signierte URL,
// die Kompensation eines verwaisten Objekts und die Idempotenz des Uploads
// laufen aber ausschliesslich im TypeScript. Hier laufen deshalb die ECHTEN
// Modulfunktionen aus src/lib/image-upload-core.ts, src/lib/image-actions.ts und
// src/lib/images-server.ts - einschliesslich src/lib/minio-storage.ts mit dem
// ECHTEN AWS SDK v3 - gegen echtes PostgreSQL und echtes HTTP. Im Test wird KEIN
// Anwendungs-SQL nachgebaut; die ADMIN-Verbindung dient ausschliesslich
// Fixtures und Gegenproben.
//
// ============================================================================
// DER OBJEKTSPEICHER IST HIER KEIN MinIO UND DIESE DATEI IST KEIN MinIO-NACHWEIS.
//
// Auf dem Entwicklungsrechner ist keine Containerlaufzeit vorhanden; ein echter
// MinIO-Container ist nicht startbar. Gegenueber ist deshalb der synthetische
// S3-kompatible Testendpunkt aus ./s3-test-endpoint.mjs (dort steht die
// vollstaendige Abgrenzung, was er nachweist und was nicht). Der gepruefte
// ANWENDUNGSCODE ist unveraendert der echte; ersetzt ist ausschliesslich das
// Gegenueber.
// ============================================================================
//
// Ersetzt sind ausserdem genau die beiden Abhaengigkeiten, die eine
// Next-Laufzeit verlangen (siehe module-hooks-app.mjs): `next/cache` und
// `@/lib/auth`. Die Identitaet wird ueber setSession() eingespeist; die
// Sitzungsauswertung selbst ist an anderer Stelle geprueft.
//
// Es kommen ausschliesslich synthetische Werte vor: Kennungen mit dem Praefix
// 23d00000- (er kommt in keiner anderen Test- oder Migrationsdatei vor -
// 20_ap14b_data.sql benutzt 20b00000-, 21_ap14b_masterdata_inventory.sql
// 21b00000-, 22_ap14b_images.sql 22b00000-, ap14b-masterdata-inventory.int.mjs
// 21c00000- und ap14b-platform.int.mjs ac140b00-), Namen mit dem Praefix "I23",
// E-Mail-Adressen auf @beispiel.invalid, keine echten Personen, keine echten
// Bilder und AUSDRUECKLICH KEINE EXIF- oder GPS-Daten: die Bildbytes bestehen
// aus den korrekten Magic Bytes und Fuellbytes.

import test from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";

import { Client } from "pg";

import { startS3TestEndpoint } from "./s3-test-endpoint.mjs";

const APP_URL = process.env.AP14B_APP_DATABASE_URL?.trim();
const ADMIN_URL = process.env.AP14B_ADMIN_DATABASE_URL?.trim();
const ENABLED = Boolean(APP_URL && ADMIN_URL);

/**
 * Verschiebung der Uhr, die der Testendpunkt fuer die Ablaufpruefung benutzt.
 *
 * Sie ist der einzige Weg, einen Ablauf der signierten URL OHNE echtes Warten zu
 * erzeugen (Fall IB10). Der Anwendungscode sieht diese Verschiebung nicht - er
 * signiert immer mit der echten Uhr.
 */
let clockOffsetMs = 0;

// Der Endpunkt muss VOR dem Setzen der Laufzeitvariablen stehen: erst nach dem
// listen(0) ist der vom Betriebssystem zugewiesene Port bekannt.
const s3 = ENABLED
  ? await startS3TestEndpoint({ now: () => Date.now() + clockOffsetMs })
  : null;

// Muss vor dem ersten Import der Anwendungsmodule stehen: der Pool in
// src/lib/db liest DATABASE_URL beim ersten Verbindungsaufbau, und
// src/lib/minio-config liest die S3-Variablen beim ersten Speicherzugriff.
//
// Keiner dieser Werte darf die Platzhaltererkennung aus minio-config.ts
// ausloesen (PLATZHALTER, CHANGE_ME, CHANGEME, BEISPIEL, EXAMPLE.INVALID, "<",
// ">" sowie die vollstaendigen Werte BENUTZER und PASSWORT).
if (ENABLED) {
  process.env.DATABASE_URL = APP_URL;
  process.env.S3_ENDPOINT = s3.url;
  // Bewusst DERSELBE Wert wie S3_ENDPOINT: SigV4 signiert den Host. Ein
  // abweichender Signierhost wuerde jede signierte URL beim Aufruf ungueltig
  // machen - genau die Eigenschaft, die minio-storage.ts mit zwei getrennten
  // Clientinstanzen abbildet.
  //
  // Das ist mit der Trennungsregel aus minio-config.ts vereinbar: derselbe
  // Origin ist genau dann zulaessig, wenn BEIDE Hostnamen Loopback sind, und der
  // Testendpunkt bindet nachweislich auf 127.0.0.1 (s3-test-endpoint.mjs).
  process.env.S3_PUBLIC_BASE_URL = s3.url;
  process.env.S3_BUCKET = s3.bucket;
  process.env.S3_ACCESS_KEY_ID = s3.accessKeyId;
  process.env.S3_SECRET_ACCESS_KEY = s3.secretAccessKey;
  process.env.S3_REGION = s3.region;
  process.env.S3_FORCE_PATH_STYLE = "true";

  // AUTH_URL wird ausdruecklich ENTFERNT: ist sie gesetzt, vergleicht
  // readMinioConfig() ihren Origin mit dem der oeffentlichen Signierbasis. Ein
  // in der Laufumgebung des Testlaufs gesetzter Wert wuerde jeden Fall dieser
  // Datei an dieser Pruefung scheitern lassen - die Signierbasis ist hier der
  // synthetische Testendpunkt auf einem zufaellig vergebenen Loopback-Port.
  delete process.env.AUTH_URL;
}

const { setSession, clearSession } = await import("./stubs/session.mjs");

const { uploadIncidentImages } = await import("../../src/lib/image-upload-core.ts");

const {
  uploadImages,
  changeImageCategory,
  changeImageDescription,
  softDeleteImage,
} = await import("../../src/lib/image-actions.ts");

const { listIncidentImages, getTodaysImageCount } = await import(
  "../../src/lib/images-server.ts"
);

const { MAX_IMAGE_BYTES, MAX_IMAGE_MB } = await import("../../src/lib/images.ts");

const { SIGNED_URL_TTL_SECONDS } = await import("../../src/lib/minio-storage.ts");

// --------------------------------------------------------------------------
// Unveraenderte Meldungstexte des Anwendungscodes.
//
// Sie stehen bewusst als Konstanten hier: aendert sich ein Text im
// Produktionscode, scheitert dieser Test und die Aenderung wird sichtbar.
// --------------------------------------------------------------------------

const NOT_SIGNED_IN = "Nicht angemeldet.";
// Gedankenstrich wie im Code (image-upload-core.ts:13, image-actions.ts:111).
const NO_INCIDENT = "Kein Vorgang – Upload nicht möglich.";
const NO_FILE = "Keine Datei ausgewählt.";
const UNSUPPORTED_TYPE = "nicht unterstützter Dateityp (nur JPG/PNG)";
const UPLOAD_REJECTED = "Upload abgelehnt.";
const SAVE_FAILED = "Speichern fehlgeschlagen.";

const unsupported = (name) => `${name}: ${UNSUPPORTED_TYPE}`;
const tooLarge = (name) => `${name}: größer als ${MAX_IMAGE_MB} MB`;
const uploadRejected = (name) => `${name}: ${UPLOAD_REJECTED}`;
const saveFailed = (name) => `${name}: ${SAVE_FAILED}`;

const ACTION_OK = { ok: true, error: null };
/** Ergebnis eines bereits angewendeten Uploads (Dedup-Marker vorhanden). */
const UPLOAD_DUPLICATE = { ok: 0, errors: [], duplicate: true };

// --------------------------------------------------------------------------
// Synthetische Fixtures
// --------------------------------------------------------------------------

const ID = {
  // Identitaeten
  admin: "23d00000-0000-0000-0000-000000000001",
  dispo: "23d00000-0000-0000-0000-000000000002",
  monteur: "23d00000-0000-0000-0000-000000000003",
  fremd: "23d00000-0000-0000-0000-000000000004",
  // Stammdaten
  stage: "23d00000-0000-0000-0000-0000000000a1",
  vzgLine: "23d00000-0000-0000-0000-0000000000a2",
  // Vorgaenge
  incident: "23d00000-0000-0000-0000-0000000000b1",
  incidentForeign: "23d00000-0000-0000-0000-0000000000b2",
  // Syntaktisch gueltige Kennung OHNE Zeile in public.incidents. Wird von IB19
  // ueber die ADMIN-Verbindung nachgewiesen und NICHT als Fixture angelegt.
  incidentUnknown: "23d00000-0000-0000-0000-0000000000b9",
};

/** Kennungen der Warteschlange (client_action_id) - je Fall eine eigene. */
const CLIENT_ACTION = {
  race: "23d00000-0000-0000-0000-0000000000c1",
  retry: "23d00000-0000-0000-0000-0000000000c2",
  partial: "23d00000-0000-0000-0000-0000000000c3",
};

/**
 * Platzhalter aus Migration 0012: absichtlich kein anmeldefaehiger Hash.
 *
 * Begruendung uebernommen aus 20_ap14b_data.sql, 22_ap14b_images.sql und
 * ap14b-masterdata-inventory.int.mjs: usableAdminCount() in
 * ap14b-platform.int.mjs und das Bootstrap-Gate in scripts/bootstrap-admin.mjs
 * zaehlen jedes aktive Admin-Profil, dessen password_hash auf '$argon2id$'
 * passt. Ein solcher Wert liesse deren Bootstrap-Faelle scheitern. Dieser Test
 * braucht keinen Hash: die Identitaet kommt aus setSession() bzw. aus dem
 * userId-Parameter, und von auth_accounts nur der Fremdschluessel auf die id.
 * Diesen Wert NICHT auf einen '$argon2id$'-Wert aendern.
 */
const ACCOUNT_MARKER = "!MIGRATED-ACCOUNT-REQUIRES-RESET!";

// `sid` ist nur der Formtreue wegen gesetzt: die Fachmodule benutzen aus
// SessionProfile ausschliesslich userId und role. Es gibt zu diesen Kennungen
// bewusst KEINE Zeile in public.auth_sessions.
const ADMIN = {
  id: ID.admin,
  sid: "23d00000-0000-0000-0000-00000000d101",
  email: "i23.admin@beispiel.invalid",
  name: "I23 Administrator",
  role: "admin",
};
const DISPO = {
  id: ID.dispo,
  sid: "23d00000-0000-0000-0000-00000000d102",
  email: "i23.dispo@beispiel.invalid",
  name: "I23 Disposition",
  role: "disponent",
};
const MONTEUR = {
  id: ID.monteur,
  sid: "23d00000-0000-0000-0000-00000000d103",
  email: "i23.monteur@beispiel.invalid",
  name: "I23 Monteur zugewiesen",
  role: "monteur",
};
const FREMD = {
  id: ID.fremd,
  sid: "23d00000-0000-0000-0000-00000000d104",
  email: "i23.fremd@beispiel.invalid",
  name: "I23 Monteur fremd",
  role: "monteur",
};
const PEOPLE = [ADMIN, DISPO, MONTEUR, FREMD];

/**
 * Dateinamen der Faelle. Jeder Name kommt genau einmal vor; die Gegenprobe ueber
 * die ADMIN-Verbindung und die Suche im Objektspeicher laufen ueber ihn.
 */
const FILE = {
  positive: "i23-a-positivweg.jpg",
  second: "i23-b-zweites-bild.png",
  lifecycle: "i23-c-lebenszyklus.jpg",
  counted: "i23-d-kennzahl.jpg",
  orphanRow: "i23-e-objekt-entfernt.jpg",
  garbage: "i23-f-fremde-magic-bytes.bin",
  heic: "i23-g-fremdformat.heic",
  tooLarge: "i23-h-zu-gross.jpg",
  empty: "i23-i-leer.jpg",
  // Traversal-Versuch. Ein reiner PFADNAME, kein Zugangsdatum: die Pruefung
  // gilt sanitizeFilename() aus src/lib/images.ts.
  traversal: "../../etc/passwort.jpg",
  noIncident: "i23-j-ohne-vorgang.jpg",
  identity: "i23-k-identitaet.jpg",
  storageFailure: "i23-l-speicherfehler.jpg",
  dbFailure: "i23-m-datenbankfehler.jpg",
  afterRestore: "i23-n-nach-wiederherstellung.jpg",
  compensationFailure: "i23-o-kompensation-fehlgeschlagen.jpg",
  race: "i23-p-parallel.jpg",
  retry: "i23-q-retry.jpg",
  partialOk: "i23-r-teilerfolg-gueltig.jpg",
  partialBad: "i23-s-teilerfolg-ungueltig.bin",
  // "i23-t-ungueltige-kennung.jpg" gehoert zu IB21 und steht dort unmittelbar
  // im Fall; die beiden folgenden Namen gehoeren zu IB28 und IB29.
  invalidAction: "i23-u-unbrauchbare-aktionskennung.jpg",
  emptyAction: "i23-v-leere-aktionskennung.jpg",
  // "i23-w-*.jpg" ist fuer die Rohanfragen der Faelle IB30-IB36 reserviert
  // (siehe rawKey()); diese Dateien duerfen NIE entstehen und haben deshalb
  // keinen Eintrag hier. Der folgende Name gehoert zu IB37.
  counterProof: "i23-x-gegenprobe.jpg",
};

let admin;

/** Zustand, den mehrere Faelle nacheinander benutzen. */
let imageIdA = null;
let storagePathA = null;
let bytesA = null;
let signedUrlA = null;

// --------------------------------------------------------------------------
// Hilfsmittel
// --------------------------------------------------------------------------

/** Sitzungsobjekt in der Form von SessionProfile (src/lib/auth.ts). */
function sessionFor(person, overrides = {}) {
  return {
    userId: person.id,
    sessionId: person.sid,
    email: person.email,
    fullName: person.name,
    role: person.role,
    mustChangePassword: false,
    ...overrides,
  };
}

/**
 * Synthetische JPEG-Bytes: korrekte Magic Bytes FF D8 FF, danach Fuellbytes.
 *
 * Die Fuellbytes vermeiden 0xFF vollstaendig. Damit entsteht hinter dem
 * Startmarker kein weiterer JPEG-Segmentmarker - die Bytes tragen also
 * ausdruecklich KEINE EXIF-, GPS- oder Kameradaten.
 */
function jpegBytes(size = 1024) {
  const bytes = new Uint8Array(Math.max(size, 3));
  bytes[0] = 0xff;
  bytes[1] = 0xd8;
  bytes[2] = 0xff;
  for (let index = 3; index < bytes.length; index += 1) {
    bytes[index] = 0x41 + (index % 26);
  }
  return bytes;
}

/** Synthetische PNG-Bytes: 8-Byte-Signatur, danach Fuellbytes. */
function pngBytes(size = 1024) {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const bytes = new Uint8Array(Math.max(size, signature.length));
  bytes.set(signature, 0);
  for (let index = signature.length; index < bytes.length; index += 1) {
    bytes[index] = 0x61 + (index % 26);
  }
  return bytes;
}

/**
 * Synthetische HEIC-Bytes: ISO-BMFF-Kopf mit dem Markentyp `ftypheic`.
 *
 * Bewusst KEIN JPEG und KEIN PNG: HEIC ist in ALLOWED_IMAGE_MIME nicht
 * enthalten (src/lib/images.ts:21) und muss an der Magic-Byte-Pruefung
 * scheitern.
 */
function heicBytes(size = 256) {
  const header = [
    0x00, 0x00, 0x00, 0x20, // Boxlaenge
    0x66, 0x74, 0x79, 0x70, // "ftyp"
    0x68, 0x65, 0x69, 0x63, // "heic"
    0x00, 0x00, 0x00, 0x00,
    0x6d, 0x69, 0x66, 0x31, // "mif1"
  ];
  const bytes = new Uint8Array(Math.max(size, header.length));
  bytes.set(header, 0);
  for (let index = header.length; index < bytes.length; index += 1) {
    bytes[index] = 0x30 + (index % 10);
  }
  return bytes;
}

/** Bytes mit falschen Magic Bytes - weder JPEG noch PNG noch HEIC. */
function garbageBytes(size = 128) {
  const bytes = new Uint8Array(Math.max(size, 8));
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = (index * 3 + 1) % 200;
  }
  return bytes;
}

/**
 * File-Objekt aus synthetischen Bytes.
 *
 * Der angegebene MIME-Typ ist bei den Negativfaellen bewusst FALSCH
 * ("image/jpeg" fuer HEIC und fuer Fremdbytes): der Produktionscode darf ihm
 * nicht glauben, sondern muss den Inhalt schnueffeln (sniffImageMime).
 */
function fileOf(name, bytes, type = "image/jpeg") {
  return new File([bytes], name, { type });
}

/** FormData eines Uploads ueber die Server Action. */
function uploadForm({ incidentId, category, description, files, extra = {} }) {
  const fd = new FormData();
  if (incidentId !== undefined && incidentId !== null) fd.set("incident_id", incidentId);
  if (category !== undefined) fd.set("category", category);
  if (description !== undefined && description !== null) fd.set("description", description);
  for (const [key, value] of Object.entries(extra)) fd.set(key, String(value));
  for (const file of files ?? []) fd.append("files", file);
  return fd;
}

/** FormData aus einem flachen Objekt; NULL und undefined bleiben weg. */
function form(fields) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    fd.set(key, String(value));
  }
  return fd;
}

/** Upload ueber die gemeinsame Kernfunktion, mit der Identitaet einer Person. */
function uploadAs(person, { incidentId, category, description, files, clientActionId }) {
  return uploadIncidentImages({
    incidentId,
    category,
    description: description ?? null,
    files,
    userId: person.id,
    clientActionId: clientActionId ?? null,
  });
}

// Alle Gegenproben laufen ueber die Eigentuemerrolle und mit festen
// SQL-Literalen; es wird nichts in einen Anweisungstext hineingebaut.
const IMAGE_ROWS_BY_FILE_NAME = `
  select id, incident_id, file_name, mime_type, file_size::text as file_size,
         storage_path, category::text as category, description, uploaded_by,
         deleted_at, deleted_by, exif_present, taken_at, gps_lat, gps_lon,
         camera_model
    from public.incident_images
   where file_name = $1::text
   order by uploaded_at asc`;
const COUNT_MARKERS = `
  select count(*)::integer as rows
    from public.sync_actions
   where actor = $1::uuid and client_action_id = $2::uuid`;
// Ohne Einschraenkung auf eine Kennung: fuer die Faelle, in denen gar keine
// gueltige Kennung vorliegt (IB28, IB29) und trotzdem nachzuweisen ist, dass
// KEINE Zeile entstanden ist. Ein `client_action_id = 'kein-uuid'::uuid` waere
// hier nicht moeglich - die Spalte ist `uuid not null`.
const COUNT_MARKERS_BY_ACTOR = `
  select count(*)::integer as rows
    from public.sync_actions
   where actor = $1::uuid`;
const COUNT_INCIDENTS_BY_ID = `
  select count(*)::integer as rows from public.incidents where id = $1::uuid`;

/** Bildzeilen zu einem Dateinamen - ueber die ADMIN-Verbindung, ohne RLS. */
async function imageRows(fileName) {
  const result = await admin.query(IMAGE_ROWS_BY_FILE_NAME, [fileName]);
  return result.rows;
}

async function markerCount(actorId, clientActionId) {
  const result = await admin.query(COUNT_MARKERS, [actorId, clientActionId]);
  return result.rows[0].rows;
}

/** Alle Marker einer Identitaet - relativ gemessen (siehe COUNT_MARKERS_BY_ACTOR). */
async function markerCountForActor(actorId) {
  const result = await admin.query(COUNT_MARKERS_BY_ACTOR, [actorId]);
  return result.rows[0].rows;
}

async function incidentCount(incidentId) {
  const result = await admin.query(COUNT_INCIDENTS_BY_ID, [incidentId]);
  return result.rows[0].rows;
}

async function tablePrivilege(object, privilege) {
  const result = await admin.query(
    `select has_table_privilege('app_user', $1::text, $2::text) as granted`,
    [object, privilege],
  );
  return result.rows[0].granted;
}

/**
 * Objektpfad des Testendpunkts zu einem Objektschluessel (Path-Style).
 *
 * Alle hier erzeugten Schluessel bestehen ausschliesslich aus Zeichen, die
 * sanitizeFilename() zulaesst ([a-zA-Z0-9._-]) sowie den Trennern "/". Sie
 * werden von der Anfragezeile also unveraendert uebernommen; eine
 * Prozentkodierung tritt nicht auf.
 */
function objectPath(key) {
  return `/${s3.bucket}/${key}`;
}

/** Objektschluessel im Speicher des Endpunkts, die auf diesen Dateinamen enden. */
function objectKeysFor(fileName) {
  return [...s3.objects.keys()].filter((key) => key.endsWith(`/${fileName}`));
}

/** Anfragen ab einer Marke, gefiltert nach Methode und Dateiname. */
function requestsFor(fromIndex, method, fileName) {
  return s3.requests
    .slice(fromIndex)
    .filter((entry) => entry.method === method && entry.path.endsWith(`/${fileName}`));
}

/** Alle Anfragen einer Methode ab einer Marke. */
function requestsOf(fromIndex, method) {
  return s3.requests.slice(fromIndex).filter((entry) => entry.method === method);
}

/** Aktuelle Marke im Anfrageprotokoll - jeder Fall zaehlt relativ zu ihr. */
function mark() {
  return s3.requests.length;
}

/** Rumpf einer HTTP-Antwort als Uint8Array. */
async function responseBytes(response) {
  return new Uint8Array(await response.arrayBuffer());
}

// --------------------------------------------------------------------------
// Fixtures ueber die ADMIN-Verbindung (Eigentuemerrolle; RLS gilt fuer den
// Eigentuemer nicht - genau darum laufen ALLE Pruefungen ueber die
// Anwendungsverbindung).
//
// Vier Identitaeten: Admin, Disposition, zugewiesener Monteur, fremder Monteur.
// Jedes Profil braucht ein Auth-Konto, weil 0012 den Fremdschluessel
// public.profiles.id auf public.auth_accounts umgehaengt hat.
//
// Zwei Vorgaenge:
//   ...b1 ist dem Monteur ...0003 zugewiesen und traegt alle Bildzeilen.
//   ...b2 hat KEINE Zuweisung und ist damit fuer BEIDE Monteure fremd.
//
// `on conflict (id) do nothing` haelt die Fixtures wiederholbar, ohne fremde
// Zeilen zu beruehren.
// --------------------------------------------------------------------------

async function setUpFixtures() {
  for (const person of PEOPLE) {
    await admin.query(
      `insert into public.auth_accounts (id, email, password_hash, must_change_password)
       values ($1::uuid, $2::text, $3::text, false)
       on conflict (id) do nothing`,
      [person.id, person.email, ACCOUNT_MARKER],
    );
    await admin.query(
      `insert into public.profiles (id, full_name, role, is_active)
       values ($1::uuid, $2::text, $3::public.user_role, true)
       on conflict (id) do nothing`,
      [person.id, person.name, person.role],
    );
  }

  await admin.query(
    `insert into public.construction_stages (id, code, name)
     values ($1::uuid, 'I23', 'I23 Bauabschnitt')
     on conflict (id) do nothing`,
    [ID.stage],
  );

  await admin.query(
    `insert into public.vzg_lines (id, line_number, construction_stage_id)
     values ($1::uuid, '2231', $2::uuid)
     on conflict (id) do nothing`,
    [ID.vzgLine, ID.stage],
  );

  // Beide Vorgaenge tragen eine aufgeloeste VzG-Zuordnung (vzg_line_id gesetzt),
  // damit die abgeleitete Aufgabe historic_vzg nicht entsteht.
  await admin.query(
    `insert into public.incidents
       (id, construction_stage_id, vzg_line_number, vzg_line_id, km_from, status, description)
     values ($1::uuid, $3::uuid, '2231', $4::uuid, 23.100, 'monteur_zugewiesen',
             'AP14B Integrationstest Bildpfad - zugewiesener Vorgang'),
            ($2::uuid, $3::uuid, '2231', $4::uuid, 23.200, 'neu',
             'AP14B Integrationstest Bildpfad - Vorgang ohne Zuweisung')
     on conflict (id) do nothing`,
    [ID.incident, ID.incidentForeign, ID.stage, ID.vzgLine],
  );

  await admin.query(
    `insert into public.incident_assignments (incident_id, monteur_id)
     values ($1::uuid, $2::uuid)
     on conflict do nothing`,
    [ID.incident, ID.monteur],
  );
}

// --------------------------------------------------------------------------

test.before(async () => {
  if (!ENABLED) return;
  admin = new Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await setUpFixtures();
});

test.after(async () => {
  if (!ENABLED) return;
  // KEIN Aufraeumen der eigenen Fixtures - gleiche Begruendung wie in
  // 22_ap14b_images.sql und ap14b-masterdata-inventory.int.mjs:
  // public.incidents traegt eine Loeschsperre, und beide Startskripte entfernen
  // die temporaere Testdatenbank nach dem Lauf immer. Alle Kennungen tragen den
  // Praefix 23d00000-, alle Namen den Praefix "I23"; fremde Fixtures bleiben
  // unberuehrt.
  //
  // Einzige Ausnahme: das in IB23 und IB24 voruebergehend entzogene
  // insert-Recht wird hier defensiv noch einmal erteilt. Das `finally` dort
  // deckt jede Ausnahme und jede fehlgeschlagene Zusicherung ab, NICHT aber
  // einen Abbruch des Prozesses zwischen Entzug und Wiederherstellung
  // (Zeitlimit, Ctrl-C, Kill durch den Runner). `grant` ist idempotent, der
  // Aufruf im Normalfall also wirkungslos.
  await admin.query("grant insert on public.incident_images to app_user");
  await admin.end();

  // Der synthetische Endpunkt wird vollstaendig beendet: danach bleibt kein
  // Prozess, kein Port und kein Objekt zurueck. Die Objekte lagen ausschliesslich
  // im Arbeitsspeicher, es gibt also auch kein temporaeres Verzeichnis.
  await s3.close();

  // Der Pool in src/lib/db exportiert bewusst keine Verbindung und auch keinen
  // Abschluss. Fuer das Ende des Testprozesses wird der modulprivate Anker
  // benutzt; ein offener Client liesse den Testlauf haengen.
  await globalThis.__kabelbereitschaftPool?.end();
});

const options = {
  skip: ENABLED ? false : "AP14B_APP_DATABASE_URL/AP14B_ADMIN_DATABASE_URL fehlen",
};

// ==========================================================================
// A) Positivweg (IB1-IB7)
// ==========================================================================

test("IB1 Upload als Disposition legt Objekt unter dem erwarteten Schluessel und die Metadatenzeile an", options, async () => {
  setSession(sessionFor(DISPO));
  const from = mark();
  bytesA = jpegBytes(2048);

  const result = await uploadAs(DISPO, {
    incidentId: ID.incident,
    category: "schadstelle",
    description: "I23 Positivweg",
    files: [fileOf(FILE.positive, bytesA)],
  });
  assert.deepEqual(result, { ok: 1, errors: [], duplicate: false });

  const rows = await imageRows(FILE.positive);
  assert.equal(rows.length, 1, "genau eine Metadatenzeile");
  const row = rows[0];
  imageIdA = row.id;
  storagePathA = row.storage_path;

  // Schluesselmuster incidents/<incidentId>/<uuid>/<bereinigter Name> - genau
  // buildStoragePath() aus src/lib/images.ts.
  const pattern = new RegExp(
    `^incidents/${ID.incident}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/${FILE.positive.replace(".", "\\.")}$`,
  );
  assert.match(storagePathA, pattern);
  assert.equal(row.mime_type, "image/jpeg");
  assert.equal(row.file_size, String(bytesA.byteLength));
  assert.equal(row.category, "schadstelle");
  assert.equal(row.description, "I23 Positivweg");
  // Synthetische Bytes ohne EXIF: keine Aufnahmezeit, keine GPS-Werte, kein
  // Kameramodell.
  assert.equal(row.taken_at, null);
  assert.equal(row.gps_lat, null);
  assert.equal(row.gps_lon, null);
  assert.equal(row.camera_model, null);

  // Das Objekt liegt im Endpunkt, byteweise unveraendert.
  const stored = s3.objects.get(storagePathA);
  assert.ok(stored, "Objekt fehlt im synthetischen Endpunkt");
  assert.deepEqual(new Uint8Array(stored.body), bytesA);
  assert.equal(stored.contentType, "image/jpeg");

  // Genau eine erfolgreiche PUT-Anfrage auf diesen Pfad.
  const puts = requestsFor(from, "PUT", FILE.positive);
  assert.equal(puts.length, 1, JSON.stringify(puts));
  assert.equal(puts[0].path, objectPath(storagePathA));
  assert.equal(puts[0].status, 200);
});

test("IB2 uploaded_by traegt die Identitaet der Transaktion aus dem Spaltendefault", options, async () => {
  // insertImageMetadata() in src/lib/image-upload-core.ts setzt uploaded_by
  // AUSDRUECKLICH NICHT (Spaltenliste dort ist ein festes Literal ohne diese
  // Spalte). Der Wert entsteht allein aus dem Spaltendefault
  // app.current_user_id(), den withUserTransaction() transaktionslokal setzt.
  const rows = await imageRows(FILE.positive);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].uploaded_by, DISPO.id);
  assert.equal(rows[0].deleted_at, null);
  assert.equal(rows[0].deleted_by, null);
});

test("IB3 listIncidentImages liefert absteigend nach uploaded_at und mit nicht leerer signed_url", options, async () => {
  setSession(sessionFor(DISPO));
  // Zweites Bild, damit die Sortierung ueberhaupt messbar ist. Es entsteht in
  // einer eigenen Transaktion und traegt deshalb einen spaeteren
  // uploaded_at-Wert (Spaltendefault now()).
  const second = await uploadAs(DISPO, {
    incidentId: ID.incident,
    category: "uebersicht",
    description: null,
    files: [fileOf(FILE.second, pngBytes(512), "image/png")],
  });
  assert.deepEqual(second, { ok: 1, errors: [], duplicate: false });

  const images = await listIncidentImages(ID.incident);
  assert.ok(images.length >= 2, `nur ${images.length} Bilder gelesen`);

  const times = images.map((image) => Date.parse(image.uploaded_at));
  for (let index = 1; index < times.length; index += 1) {
    assert.ok(
      times[index - 1] >= times[index],
      `Reihenfolge nicht absteigend an Position ${index}`,
    );
  }

  const indexSecond = images.findIndex((image) => image.file_name === FILE.second);
  const indexFirst = images.findIndex((image) => image.file_name === FILE.positive);
  assert.ok(indexSecond >= 0 && indexFirst >= 0, "beide Bilder muessen gelesen werden");
  assert.ok(indexSecond < indexFirst, "das neuere Bild muss vorn stehen");

  const first = images[indexFirst];
  assert.equal(first.id, imageIdA);
  assert.equal(first.storage_path, storagePathA);
  assert.equal(first.uploaded_by, DISPO.id);
  assert.equal(first.uploader_name, DISPO.name);
  assert.equal(typeof first.signed_url, "string");
  assert.ok(first.signed_url.length > 0, "signed_url ist leer");
  assert.ok(
    first.signed_url.startsWith(`${s3.url}${objectPath(storagePathA)}?`),
    "signed_url zeigt nicht auf den Objektpfad des Endpunkts",
  );
  signedUrlA = first.signed_url;
});

test("IB4 die signierte URL liefert 200 und byteweise genau die hochgeladenen Bytes", options, async () => {
  // DER Kernnachweis: die im Produktionscode erzeugte SigV4-Signatur wird vom
  // Gegenueber nachgerechnet und angenommen, und der Rumpf ist unveraendert.
  const from = mark();
  const response = await fetch(signedUrlA);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/jpeg");
  assert.deepEqual(await responseBytes(response), bytesA);

  const gets = requestsFor(from, "GET", FILE.positive);
  assert.equal(gets.length, 1);
  assert.equal(gets[0].status, 200);
});

test("IB5 Kategorie und Beschreibung lassen sich ueber die Server Actions aendern", options, async () => {
  setSession(sessionFor(DISPO));
  const upload = await uploadAs(DISPO, {
    incidentId: ID.incident,
    category: "zugang",
    description: "I23 Lebenszyklus",
    files: [fileOf(FILE.lifecycle, jpegBytes(256))],
  });
  assert.deepEqual(upload, { ok: 1, errors: [], duplicate: false });

  const created = await imageRows(FILE.lifecycle);
  assert.equal(created.length, 1);
  const imageId = created[0].id;

  assert.deepEqual(
    await changeImageCategory(
      null,
      form({ image_id: imageId, incident_id: ID.incident, category: "reparatur" }),
    ),
    ACTION_OK,
  );
  assert.deepEqual(
    await changeImageDescription(
      null,
      form({
        image_id: imageId,
        incident_id: ID.incident,
        description: "I23 Beschreibung geaendert",
      }),
    ),
    ACTION_OK,
  );

  const changed = await imageRows(FILE.lifecycle);
  assert.equal(changed[0].category, "reparatur");
  assert.equal(changed[0].description, "I23 Beschreibung geaendert");
});

test("IB6 Soft-Delete entfernt die Zeile aus der Galerie, das Objekt bleibt liegen", options, async () => {
  setSession(sessionFor(DISPO));
  const rows = await imageRows(FILE.lifecycle);
  assert.equal(rows.length, 1, "IB5 hat die Zeile nicht hinterlassen");
  const imageId = rows[0].id;
  const key = rows[0].storage_path;
  assert.ok(s3.objects.has(key), "Objekt fehlt vor dem Soft-Delete");

  const from = mark();
  // softDeleteImage() hat den Rueckgabetyp void; die Wirkung wird ueber die
  // Datenbank und den Objektspeicher gemessen.
  assert.equal(await softDeleteImage(form({ image_id: imageId, incident_id: ID.incident })), undefined);

  const after = await imageRows(FILE.lifecycle);
  assert.equal(after.length, 1);
  assert.notEqual(after[0].deleted_at, null, "deleted_at wurde nicht gesetzt");
  assert.equal(after[0].deleted_by, DISPO.id);

  const images = await listIncidentImages(ID.incident);
  assert.equal(
    images.some((image) => image.id === imageId),
    false,
    "die geloeschte Zeile erscheint weiter in der Galerie",
  );

  // Kein physisches Loeschen: das Objekt ist unveraendert vorhanden, und es ging
  // keine DELETE-Anfrage an den Objektspeicher.
  assert.ok(s3.objects.has(key), "das Objekt wurde physisch entfernt");
  assert.equal(requestsOf(from, "DELETE").length, 0);
});

test("IB7 getTodaysImageCount zaehlt nur nicht geloeschte Zeilen", options, async () => {
  // Relativ gemessen: die Kennzahl zaehlt alle heute hochgeladenen Bilder und
  // damit auch die Fixtures der Smokes. Gemessen wird ausschliesslich die
  // Veraenderung durch diesen Fall.
  setSession(sessionFor(DISPO));
  const before = await getTodaysImageCount();

  const upload = await uploadAs(DISPO, {
    incidentId: ID.incident,
    category: "material",
    description: null,
    files: [fileOf(FILE.counted, jpegBytes(128))],
  });
  assert.deepEqual(upload, { ok: 1, errors: [], duplicate: false });
  assert.equal(await getTodaysImageCount(), before + 1);

  const rows = await imageRows(FILE.counted);
  assert.equal(rows.length, 1);
  await softDeleteImage(form({ image_id: rows[0].id, incident_id: ID.incident }));

  assert.equal(
    await getTodaysImageCount(),
    before,
    "die geloeschte Zeile wird weiter gezaehlt",
  );
});

// ==========================================================================
// B) Privatheit und Signatur (IB8-IB13)
// ==========================================================================

test("IB8 ein unsignierter GET auf denselben Objektpfad wird mit 403 abgewiesen", options, async () => {
  // Nachweis "privater Bucket, kein anonymer Lesezugriff": derselbe Pfad, der
  // mit gueltiger Signatur in IB4 200 geliefert hat, ist ohne Signatur nicht
  // lesbar.
  const from = mark();
  const response = await fetch(`${s3.url}${objectPath(storagePathA)}`);
  assert.equal(response.status, 403);
  assert.match(await response.text(), /<Code>AccessDenied<\/Code>/);

  const gets = requestsFor(from, "GET", FILE.positive);
  assert.equal(gets.length, 1);
  assert.equal(gets[0].status, 403);
});

test("IB9 eine manipulierte Signatur wird mit 403 abgewiesen", options, async () => {
  const signature = new URL(signedUrlA).searchParams.get("X-Amz-Signature");
  assert.ok(signature, "die signierte URL enthaelt keine Signatur");
  assert.match(signature, /^[0-9a-f]{64}$/, "die Signatur hat nicht die erwartete Form");

  // Genau EIN Zeichen veraendern. Die Ersetzung geschieht bewusst auf der
  // ZEICHENKETTE und nicht ueber URLSearchParams: eine erneute Serialisierung
  // koennte den Abfrageteil anders kodieren und die Ablehnung dann aus einem
  // anderen Grund als der manipulierten Signatur erfolgen.
  const last = signature.slice(-1);
  const flipped = `${signature.slice(0, -1)}${last === "0" ? "1" : "0"}`;
  const tampered = signedUrlA.replace(
    `X-Amz-Signature=${signature}`,
    `X-Amz-Signature=${flipped}`,
  );
  assert.notEqual(tampered, signedUrlA, "die Signatur wurde nicht ersetzt");

  const response = await fetch(tampered);
  assert.equal(response.status, 403);
  assert.match(await response.text(), /<Code>AccessDenied<\/Code>/);
});

test("IB10 eine abgelaufene Signatur wird ohne echtes Warten mit 403 abgewiesen", options, async () => {
  // Die Gueltigkeitsdauer stammt aus SIGNED_URL_TTL_SECONDS
  // (src/lib/minio-storage.ts). Statt zu warten, wird die Uhr DES ENDPUNKTS
  // vorgestellt; der Anwendungscode signiert unveraendert mit der echten Uhr.
  assert.ok(SIGNED_URL_TTL_SECONDS > 0);
  try {
    clockOffsetMs = (SIGNED_URL_TTL_SECONDS + 60) * 1000;
    const expired = await fetch(signedUrlA);
    assert.equal(expired.status, 403);
    assert.match(await expired.text(), /<Code>AccessDenied<\/Code>/);
  } finally {
    clockOffsetMs = 0;
  }

  // Gegenprobe: dieselbe URL ist ohne die Verschiebung wieder gueltig. Damit ist
  // belegt, dass die Ablehnung allein am Ablauf lag.
  const again = await fetch(signedUrlA);
  assert.equal(again.status, 200);
  assert.deepEqual(await responseBytes(again), bytesA);
});

test("IB11 ein fremder Monteur erhaelt weder Metadaten noch eine signierte URL", options, async () => {
  // Gegenprobe zuerst: Zeile und Objekt existieren nachweislich.
  const rows = await imageRows(FILE.positive);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].deleted_at, null);
  assert.ok(s3.objects.has(storagePathA));

  setSession(sessionFor(FREMD));
  const images = await listIncidentImages(ID.incident);
  assert.deepEqual(images, [], "der fremde Monteur sieht Bildzeilen");

  // Der zugewiesene Monteur sieht dieselben Zeilen sehr wohl - die Abgrenzung
  // liegt an der Zuweisung und nicht an der Rolle.
  setSession(sessionFor(MONTEUR));
  const allowed = await listIncidentImages(ID.incident);
  assert.ok(
    allowed.some((image) => image.id === imageIdA),
    "der zugewiesene Monteur sieht das Bild nicht",
  );
});

test("IB12 ohne Sitzung bleiben die Lesewege leer und die Server Actions weisen ab", options, async () => {
  clearSession();

  assert.deepEqual(await listIncidentImages(ID.incident), []);
  assert.equal(await getTodaysImageCount(), 0);

  assert.deepEqual(
    await uploadImages(
      null,
      uploadForm({
        incidentId: ID.incident,
        category: "sonstiges",
        files: [fileOf("i23-ohne-sitzung.jpg", jpegBytes(64))],
      }),
    ),
    { ok: false, error: NOT_SIGNED_IN },
  );
  assert.deepEqual(
    await changeImageCategory(
      null,
      form({ image_id: imageIdA, incident_id: ID.incident, category: "abschluss" }),
    ),
    { ok: false, error: NOT_SIGNED_IN },
  );
  assert.deepEqual(
    await changeImageDescription(
      null,
      form({ image_id: imageIdA, incident_id: ID.incident, description: "I23 ohne Sitzung" }),
    ),
    { ok: false, error: NOT_SIGNED_IN },
  );

  // softDeleteImage() liefert void und meldet deshalb nichts; die Wirkung muss
  // ausbleiben.
  assert.equal(
    await softDeleteImage(form({ image_id: imageIdA, incident_id: ID.incident })),
    undefined,
  );
  const rows = await imageRows(FILE.positive);
  assert.equal(rows[0].deleted_at, null, "ohne Sitzung wurde geloescht");
  assert.equal(rows[0].category, "schadstelle", "ohne Sitzung wurde geaendert");
  assert.equal(rows[0].description, "I23 Positivweg");
});

test("IB13 fehlendes Objekt: die signierte URL liefert 404, listIncidentImages wirft nicht", options, async () => {
  setSession(sessionFor(DISPO));
  const upload = await uploadAs(DISPO, {
    incidentId: ID.incident,
    category: "sonstiges",
    description: null,
    files: [fileOf(FILE.orphanRow, jpegBytes(96))],
  });
  assert.deepEqual(upload, { ok: 1, errors: [], duplicate: false });

  const rows = await imageRows(FILE.orphanRow);
  assert.equal(rows.length, 1);
  const key = rows[0].storage_path;

  // Das Objekt wird UNMITTELBAR im Speicher des Endpunkts entfernt, nicht ueber
  // HTTP: so entsteht keine DELETE-Anfrage, die einen Anwendungspfad
  // vortaeuschen wuerde.
  const from = mark();
  assert.equal(s3.objects.delete(key), true);
  assert.equal(requestsOf(from, "DELETE").length, 0);

  const images = await listIncidentImages(ID.incident);
  const image = images.find((entry) => entry.id === rows[0].id);
  assert.ok(image, "die Zeile fehlt, obwohl nur das Objekt entfernt wurde");
  assert.equal(typeof image.signed_url, "string");
  assert.ok(image.signed_url.length > 0);

  const response = await fetch(image.signed_url);
  assert.equal(response.status, 404);
  assert.match(await response.text(), /<Code>NoSuchKey<\/Code>/);
});

// ==========================================================================
// C) Negativfaelle des Uploads (IB14-IB24)
// ==========================================================================

test("IB14 falsche Magic Bytes werden abgewiesen - kein Objekt und keine Zeile", options, async () => {
  setSession(sessionFor(DISPO));
  const from = mark();

  const result = await uploadAs(DISPO, {
    incidentId: ID.incident,
    category: "schadstelle",
    description: null,
    // Der angegebene MIME-Typ ist bewusst "image/jpeg": ihm darf der Code nicht
    // glauben.
    files: [fileOf(FILE.garbage, garbageBytes(), "image/jpeg")],
  });
  assert.deepEqual(result, {
    ok: 0,
    errors: [unsupported(FILE.garbage)],
    duplicate: false,
  });

  assert.equal((await imageRows(FILE.garbage)).length, 0);
  assert.deepEqual(objectKeysFor(FILE.garbage), []);
  assert.equal(requestsOf(from, "PUT").length, 0, "es ging ein Objekt in den Speicher");
});

test("IB15 HEIC wird mit demselben Text abgewiesen - kein Objekt und keine Zeile", options, async () => {
  setSession(sessionFor(DISPO));
  const from = mark();

  const result = await uploadAs(DISPO, {
    incidentId: ID.incident,
    category: "schadstelle",
    description: null,
    files: [fileOf(FILE.heic, heicBytes(), "image/heic")],
  });
  assert.deepEqual(result, {
    ok: 0,
    errors: [unsupported(FILE.heic)],
    duplicate: false,
  });

  assert.equal((await imageRows(FILE.heic)).length, 0);
  assert.deepEqual(objectKeysFor(FILE.heic), []);
  assert.equal(requestsOf(from, "PUT").length, 0);
});

test("IB16 eine zu grosse Datei wird abgewiesen, bevor ein Byte gelesen wird", options, async () => {
  setSession(sessionFor(DISPO));
  const from = mark();

  // Die Groessenpruefung steht VOR file.arrayBuffer(); der Inhalt ist deshalb
  // ohne Bedeutung und bleibt eine reine Nullfuellung.
  const oversized = new File([new Uint8Array(MAX_IMAGE_BYTES + 1)], FILE.tooLarge, {
    type: "image/jpeg",
  });
  assert.equal(oversized.size, MAX_IMAGE_BYTES + 1);

  const result = await uploadAs(DISPO, {
    incidentId: ID.incident,
    category: "schadstelle",
    description: null,
    files: [oversized],
  });
  assert.deepEqual(result, {
    ok: 0,
    errors: [tooLarge(FILE.tooLarge)],
    duplicate: false,
  });

  assert.equal((await imageRows(FILE.tooLarge)).length, 0);
  assert.deepEqual(objectKeysFor(FILE.tooLarge), []);
  assert.equal(requestsOf(from, "PUT").length, 0);
});

test("IB17 eine leere Datei wird abgewiesen - im Kern an der Magic-Byte-Pruefung, in der Server Action am Groessenfilter", options, async () => {
  setSession(sessionFor(DISPO));
  const from = mark();
  const emptyFile = () => new File([], FILE.empty, { type: "image/jpeg" });
  assert.equal(emptyFile().size, 0);

  // 1) Kernfunktion: die Groessenpruefung greift nicht (0 ist nicht groesser als
  // MAX_IMAGE_BYTES), also faellt die Datei an sniffImageMime() durch - ein
  // leerer Puffer hat keine Magic Bytes.
  assert.deepEqual(
    await uploadAs(DISPO, {
      incidentId: ID.incident,
      category: "schadstelle",
      description: null,
      files: [emptyFile()],
    }),
    { ok: 0, errors: [unsupported(FILE.empty)], duplicate: false },
  );

  // 2) Server Action: dort wird die Datei bereits von
  // `fd.getAll("files").filter(f => f.size > 0)` entfernt und die Liste ist
  // leer - deshalb die andere Meldung.
  assert.deepEqual(
    await uploadImages(
      null,
      uploadForm({
        incidentId: ID.incident,
        category: "schadstelle",
        files: [emptyFile()],
      }),
    ),
    { ok: false, error: NO_FILE },
  );

  assert.equal((await imageRows(FILE.empty)).length, 0);
  assert.deepEqual(objectKeysFor(FILE.empty), []);
  assert.equal(requestsOf(from, "PUT").length, 0);
});

test("IB18 ein Traversal-Dateiname bleibt unter dem Praefix des Vorgangs", options, async () => {
  setSession(sessionFor(DISPO));
  const result = await uploadAs(DISPO, {
    incidentId: ID.incident,
    category: "sonstiges",
    description: null,
    files: [fileOf(FILE.traversal, jpegBytes(64))],
  });
  assert.deepEqual(result, { ok: 1, errors: [], duplicate: false });

  const rows = await imageRows(FILE.traversal);
  assert.equal(rows.length, 1);
  // file_name traegt den ROHEN Clientnamen (gekuerzt) - so war es schon bisher.
  assert.equal(rows[0].file_name, FILE.traversal);

  const key = rows[0].storage_path;
  // Der Objektschluessel dagegen ist bereinigt: kein "..", kein zusaetzliches
  // Verzeichnis, genau vier Segmente unter dem Praefix des Vorgangs.
  assert.equal(key.includes(".."), false, key);
  assert.ok(key.startsWith(`incidents/${ID.incident}/`), key);
  const segments = key.split("/");
  assert.equal(segments.length, 4, key);
  assert.equal(segments[3], "passwort.jpg", key);
  assert.ok(s3.objects.has(key));
});

test("IB19 ein fremder und ein nicht vorhandener Vorgang werden ohne Objektschreiben abgewiesen", options, async () => {
  // Gegenprobe: die Kennung ist syntaktisch gueltig, aber es gibt keine Zeile.
  assert.equal(await incidentCount(ID.incidentUnknown), 0);
  assert.equal(await incidentCount(ID.incidentForeign), 1);

  const from = mark();

  // Fremder Vorgang: fuer den Monteur nicht sichtbar (keine Zuweisung). Die
  // Vorabberechtigungspruefung liest die Zeile nicht und bricht ab.
  assert.deepEqual(
    await uploadAs(MONTEUR, {
      incidentId: ID.incidentForeign,
      category: "schadstelle",
      description: null,
      files: [fileOf(FILE.noIncident, jpegBytes(64))],
    }),
    { ok: 0, errors: [NO_INCIDENT], duplicate: false },
  );

  // Nicht vorhandener Vorgang, hier sogar mit der Disposition: auch is_staff()
  // findet keine Zeile.
  assert.deepEqual(
    await uploadAs(DISPO, {
      incidentId: ID.incidentUnknown,
      category: "schadstelle",
      description: null,
      files: [fileOf(FILE.noIncident, jpegBytes(64))],
    }),
    { ok: 0, errors: [NO_INCIDENT], duplicate: false },
  );

  // DER Nachweis, dass die Vorabpruefung VOR dem Objektschreiben greift.
  assert.equal(requestsOf(from, "PUT").length, 0, "es ging ein Objekt in den Speicher");
  assert.equal((await imageRows(FILE.noIncident)).length, 0);
  assert.deepEqual(objectKeysFor(FILE.noIncident), []);
});

test("IB20 ein zusaetzliches Formfeld uploaded_by bleibt ohne Wirkung", options, async () => {
  // Die Signatur von uploadIncidentImages() nimmt kein uploaded_by mehr an; die
  // Server Action liest nur incident_id, category, description und files. Ein
  // zusaetzliches Feld darf deshalb keine Wirkung haben - die Zeile traegt die
  // Sitzungsidentitaet.
  setSession(sessionFor(DISPO));
  const result = await uploadImages(
    null,
    uploadForm({
      incidentId: ID.incident,
      category: "sonstiges",
      description: "I23 Identitaet",
      files: [fileOf(FILE.identity, jpegBytes(64))],
      extra: { uploaded_by: FREMD.id, user_id: FREMD.id, actor: FREMD.id },
    }),
  );
  assert.deepEqual(result, ACTION_OK);

  const rows = await imageRows(FILE.identity);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].uploaded_by, DISPO.id);
  assert.notEqual(rows[0].uploaded_by, FREMD.id);
});

test("IB21 eine unbrauchbare Vorgangskennung wird ohne Objektschreiben abgewiesen", options, async () => {
  setSession(sessionFor(DISPO));
  const from = mark();

  // Kernfunktion: isUuid() greift vor jedem SQL und vor jedem Objektzugriff.
  assert.deepEqual(
    await uploadAs(DISPO, {
      incidentId: "kein-uuid-wert",
      category: "schadstelle",
      description: null,
      files: [fileOf("i23-t-ungueltige-kennung.jpg", jpegBytes(64))],
    }),
    { ok: 0, errors: [NO_INCIDENT], duplicate: false },
  );

  // Server Action mit demselben Wert: dieselbe Meldung, kein neues Vokabular.
  assert.deepEqual(
    await uploadImages(
      null,
      uploadForm({
        incidentId: "kein-uuid-wert",
        category: "schadstelle",
        files: [fileOf("i23-t-ungueltige-kennung.jpg", jpegBytes(64))],
      }),
    ),
    { ok: false, error: NO_INCIDENT },
  );

  assert.equal(requestsOf(from, "PUT").length, 0);
  assert.equal((await imageRows("i23-t-ungueltige-kennung.jpg")).length, 0);
});

test("IB22 ein Speicherfehler hinterlaesst keine Metadatenzeile", options, async () => {
  setSession(sessionFor(DISPO));
  const from = mark();

  let result;
  try {
    s3.faults.failPut = true;
    result = await uploadAs(DISPO, {
      incidentId: ID.incident,
      category: "schadstelle",
      description: null,
      files: [fileOf(FILE.storageFailure, jpegBytes(64))],
    });
  } finally {
    s3.faults.failPut = false;
  }

  assert.deepEqual(result, {
    ok: 0,
    errors: [uploadRejected(FILE.storageFailure)],
    duplicate: false,
  });

  // Der Versuch hat stattgefunden (das SDK wiederholt einen 500er mehrfach),
  // aber kein Objekt und keine Zeile ist entstanden.
  const puts = requestsFor(from, "PUT", FILE.storageFailure);
  assert.ok(puts.length >= 1, "es wurde kein PUT versucht");
  assert.ok(
    puts.every((entry) => entry.status === 500),
    JSON.stringify(puts),
  );
  assert.deepEqual(objectKeysFor(FILE.storageFailure), []);
  assert.equal((await imageRows(FILE.storageFailure)).length, 0);
});

test("IB23 ein Datenbankfehler nach dem Objektschreiben wird kompensiert - keine Zeile, kein verwaistes Objekt", options, async () => {
  // Der wichtigste Atomaritaetsfall des Uploadpfads. Der Fehlschlag wird NICHT
  // im Produktionscode erzeugt, sondern in der Datenbank: der Anwendungsrolle
  // wird voruebergehend das insert-Recht auf public.incident_images entzogen
  // (Muster aus ap14b-masterdata-inventory.int.mjs, Fall IM7). Das select-Recht
  // bleibt - die Vorabberechtigungspruefung gelingt also, das Objekt wird
  // geschrieben, und erst der Metadaten-Insert scheitert.
  setSession(sessionFor(DISPO));
  const from = mark();

  let result;
  await admin.query("revoke insert on public.incident_images from app_user");
  try {
    result = await uploadAs(DISPO, {
      incidentId: ID.incident,
      category: "schadstelle",
      description: null,
      files: [fileOf(FILE.dbFailure, jpegBytes(64))],
    });
  } finally {
    await admin.query("grant insert on public.incident_images to app_user");
  }

  // Der Rechtestand ist wiederhergestellt, BEVOR irgendeine Zusicherung greifen
  // kann - sonst liefe der Rest der Datei auf einer degradierten Datenbank.
  assert.equal(await tablePrivilege("public.incident_images", "insert"), true);

  // Neutrale Meldung: die Datenbankmeldung gelangt nicht nach aussen.
  assert.deepEqual(result, {
    ok: 0,
    errors: [saveFailed(FILE.dbFailure)],
    duplicate: false,
  });

  // Keine Metadatenzeile ...
  assert.equal((await imageRows(FILE.dbFailure)).length, 0);

  // ... und das Objekt ist durch die Kompensation wieder entfernt.
  const puts = requestsFor(from, "PUT", FILE.dbFailure);
  assert.equal(puts.length, 1, JSON.stringify(puts));
  assert.equal(puts[0].status, 200);
  const deletes = requestsFor(from, "DELETE", FILE.dbFailure);
  assert.equal(deletes.length, 1, JSON.stringify(deletes));
  assert.equal(deletes[0].status, 204);
  assert.equal(deletes[0].path, puts[0].path);
  assert.deepEqual(objectKeysFor(FILE.dbFailure), [], "verwaistes Objekt geblieben");

  // Gegenprobe: mit wiederhergestelltem Recht gelingt der naechste Upload wieder
  // vollstaendig.
  const again = await uploadAs(DISPO, {
    incidentId: ID.incident,
    category: "schadstelle",
    description: null,
    files: [fileOf(FILE.afterRestore, jpegBytes(64))],
  });
  assert.deepEqual(again, { ok: 1, errors: [], duplicate: false });
  const restored = await imageRows(FILE.afterRestore);
  assert.equal(restored.length, 1);
  assert.ok(s3.objects.has(restored[0].storage_path));
});

test("IB24 ein fehlgeschlagener Kompensationsloeschvorgang aendert das Ergebnis nicht und hinterlaesst ein verwaistes Objekt", options, async () => {
  // Wie IB23, zusaetzlich scheitert das Kompensations-DELETE. discardObject()
  // faengt den Fehler bewusst und protokolliert ihn nur - der Ablauf darf daran
  // nicht abbrechen, und es darf KEIN falscher Erfolg gemeldet werden.
  setSession(sessionFor(DISPO));
  const from = mark();

  let result;
  await admin.query("revoke insert on public.incident_images from app_user");
  try {
    s3.faults.failDelete = true;
    result = await uploadAs(DISPO, {
      incidentId: ID.incident,
      category: "schadstelle",
      description: null,
      files: [fileOf(FILE.compensationFailure, jpegBytes(64))],
    });
  } finally {
    s3.faults.failDelete = false;
    await admin.query("grant insert on public.incident_images to app_user");
  }

  assert.equal(await tablePrivilege("public.incident_images", "insert"), true);

  // Unveraendertes Ergebnis: kein falscher Erfolg, keine zweite Meldung.
  assert.deepEqual(result, {
    ok: 0,
    errors: [saveFailed(FILE.compensationFailure)],
    duplicate: false,
  });
  assert.equal((await imageRows(FILE.compensationFailure)).length, 0);

  const puts = requestsFor(from, "PUT", FILE.compensationFailure);
  assert.equal(puts.length, 1, JSON.stringify(puts));
  assert.equal(puts[0].status, 200);
  const deletes = requestsFor(from, "DELETE", FILE.compensationFailure);
  assert.ok(deletes.length >= 1, "es wurde keine Kompensation versucht");
  assert.ok(
    deletes.every((entry) => entry.status === 500),
    JSON.stringify(deletes),
  );

  // Das Objekt bleibt als VERWAISTES Objekt liegen (Objekt ohne Metadatensatz).
  // Genau dieser Zustand wird von discardObject() als solcher protokolliert und
  // bleibt fuer eine Aufraeumroutine auffindbar; er wird hier bewusst nicht
  // beseitigt, weil er der Nachweis ist.
  const orphans = objectKeysFor(FILE.compensationFailure);
  assert.equal(orphans.length, 1, JSON.stringify(orphans));
  assert.equal(objectPath(orphans[0]), puts[0].path);
});

// ==========================================================================
// D) Idempotenz und Nebenlaeufigkeit (IB25-IB29)
// ==========================================================================

test("IB25 zwei gleichzeitige Uploads mit derselben clientActionId erzeugen genau eine Zeile", options, async () => {
  // Echte Parallelprobe, bewusst OHNE Zeitannahme: kein setTimeout, keine
  // Barriere. Beide Promises werden erst erzeugt und dann GEMEINSAM abgewartet.
  // Die Serialisierung entsteht allein aus der Eindeutigkeit
  // sync_actions_actor_client_uniq (Migration 0006) - die zweite Transaktion
  // wartet an diesem Index, bis die erste festgeschrieben ist, und scheitert
  // danach mit 23505.
  setSession(sessionFor(DISPO));
  assert.equal(await markerCount(DISPO.id, CLIENT_ACTION.race), 0);
  const from = mark();

  const uploadRace = () =>
    uploadAs(DISPO, {
      incidentId: ID.incident,
      category: "schadstelle",
      description: null,
      files: [fileOf(FILE.race, jpegBytes(64))],
      clientActionId: CLIENT_ACTION.race,
    });
  const first = uploadRace();
  const second = uploadRace();
  const results = await Promise.all([first, second]);

  const applied = results.filter((entry) => entry.ok === 1 && entry.duplicate === false);
  const duplicates = results.filter((entry) => entry.duplicate === true);
  assert.equal(applied.length, 1, JSON.stringify(results));
  assert.equal(duplicates.length, 1, JSON.stringify(results));
  assert.deepEqual(applied[0], { ok: 1, errors: [], duplicate: false });
  assert.deepEqual(duplicates[0], UPLOAD_DUPLICATE);

  // Genau EINE Metadatenzeile und genau EIN Marker.
  assert.equal((await imageRows(FILE.race)).length, 1);
  assert.equal(await markerCount(DISPO.id, CLIENT_ACTION.race), 1);

  // Beide Aufrufe haben ein Objekt geschrieben; das des Duplikats ist
  // zurueckgenommen worden. Es bleibt genau eines uebrig.
  assert.equal(requestsFor(from, "PUT", FILE.race).length, 2);
  assert.equal(requestsFor(from, "DELETE", FILE.race).length, 1);
  const keys = objectKeysFor(FILE.race);
  assert.equal(keys.length, 1, JSON.stringify(keys));
  assert.equal((await imageRows(FILE.race))[0].storage_path, keys[0]);
});

test("IB26 nach einem vollstaendigen Fehlschlag bleibt kein Marker und der Retry gelingt", options, async () => {
  setSession(sessionFor(DISPO));
  assert.equal(await markerCount(DISPO.id, CLIENT_ACTION.retry), 0);

  let failed;
  try {
    s3.faults.failPut = true;
    failed = await uploadAs(DISPO, {
      incidentId: ID.incident,
      category: "schadstelle",
      description: null,
      files: [fileOf(FILE.retry, jpegBytes(64))],
      clientActionId: CLIENT_ACTION.retry,
    });
  } finally {
    s3.faults.failPut = false;
  }
  assert.deepEqual(failed, {
    ok: 0,
    errors: [uploadRejected(FILE.retry)],
    duplicate: false,
  });

  // Entscheidend: der Marker wird erst in derselben Transaktion wie der
  // Metadatensatz gesetzt. Nach dem Fehlschlag am Objektspeicher existiert er
  // deshalb GAR NICHT - der Retry wird nicht faelschlich als Duplikat erkannt.
  assert.equal(await markerCount(DISPO.id, CLIENT_ACTION.retry), 0);
  assert.equal((await imageRows(FILE.retry)).length, 0);
  assert.deepEqual(objectKeysFor(FILE.retry), []);

  const retried = await uploadAs(DISPO, {
    incidentId: ID.incident,
    category: "schadstelle",
    description: null,
    files: [fileOf(FILE.retry, jpegBytes(64))],
    clientActionId: CLIENT_ACTION.retry,
  });
  assert.deepEqual(retried, { ok: 1, errors: [], duplicate: false });
  assert.equal(await markerCount(DISPO.id, CLIENT_ACTION.retry), 1);
  const rows = await imageRows(FILE.retry);
  assert.equal(rows.length, 1);
  assert.ok(s3.objects.has(rows[0].storage_path));
});

test("IB27 ein definierter Teilerfolg erzeugt beim Retry kein Duplikat", options, async () => {
  setSession(sessionFor(DISPO));
  assert.equal(await markerCount(DISPO.id, CLIENT_ACTION.partial), 0);

  const files = () => [
    fileOf(FILE.partialOk, jpegBytes(64)),
    fileOf(FILE.partialBad, garbageBytes(), "image/jpeg"),
  ];

  const partial = await uploadAs(DISPO, {
    incidentId: ID.incident,
    category: "schadstelle",
    description: null,
    files: files(),
    clientActionId: CLIENT_ACTION.partial,
  });
  assert.deepEqual(partial, {
    ok: 1,
    errors: [unsupported(FILE.partialBad)],
    duplicate: false,
  });
  assert.equal((await imageRows(FILE.partialOk)).length, 1);
  assert.equal((await imageRows(FILE.partialBad)).length, 0);
  assert.equal(await markerCount(DISPO.id, CLIENT_ACTION.partial), 1);

  const from = mark();
  const retried = await uploadAs(DISPO, {
    incidentId: ID.incident,
    category: "schadstelle",
    description: null,
    files: files(),
    clientActionId: CLIENT_ACTION.partial,
  });
  // Der Retry ist eine Wiederholung des GANZEN Aufrufs: die Schleife bricht am
  // Marker ab, bevor die zweite Datei ueberhaupt geprueft wird. Deshalb eine
  // leere Fehlerliste.
  assert.deepEqual(retried, UPLOAD_DUPLICATE);

  // Keine zweite Metadatenzeile fuer die erste Datei, kein zweiter Marker.
  assert.equal((await imageRows(FILE.partialOk)).length, 1);
  assert.equal(await markerCount(DISPO.id, CLIENT_ACTION.partial), 1);
  // Das im Retry erneut geschriebene Objekt ist zurueckgenommen worden; es
  // bleibt genau eines uebrig.
  assert.equal(requestsFor(from, "PUT", FILE.partialOk).length, 1);
  assert.equal(requestsFor(from, "DELETE", FILE.partialOk).length, 1);
  const keys = objectKeysFor(FILE.partialOk);
  assert.equal(keys.length, 1, JSON.stringify(keys));
  assert.equal((await imageRows(FILE.partialOk))[0].storage_path, keys[0]);
});

test("IB28 eine nicht kanonische client_action_id wird fail-closed abgewiesen - kein Objekt, keine Zeile, kein Marker", options, async () => {
  // Bisher lief ein solcher Aufruf OHNE Deduplizierung durch; ein Retry haette
  // beliebig viele Bildzeilen erzeugt. Jetzt greift die Abweisung VOR der
  // Vorabberechtigungspruefung und damit vor jedem Objekt- und
  // Datenbankzugriff.
  setSession(sessionFor(DISPO));
  const from = mark();
  const markersBefore = await markerCountForActor(DISPO.id);

  const result = await uploadAs(DISPO, {
    incidentId: ID.incident,
    category: "schadstelle",
    description: null,
    files: [fileOf(FILE.invalidAction, jpegBytes(64))],
    // Bewusst KEIN kanonischer Wert - dieselbe Form, die offline/manager.ts
    // ohne crypto.randomUUID erzeugen wuerde.
    clientActionId: "23d00000-keine-kanonische-uuid",
  });

  // Genau die Form des technischen Fehlschlags der Vorabpruefung: leere
  // Fehlerliste, kein neues Meldungsvokabular.
  assert.deepEqual(result, { ok: 0, errors: [], duplicate: false });

  assert.equal(requestsOf(from, "PUT").length, 0, "es ging ein Objekt in den Speicher");
  assert.deepEqual(objectKeysFor(FILE.invalidAction), []);
  assert.equal((await imageRows(FILE.invalidAction)).length, 0);
  assert.equal(
    await markerCountForActor(DISPO.id),
    markersBefore,
    "es ist eine Zeile in public.sync_actions entstanden",
  );
});

test("IB29 eine LEERE client_action_id laeuft durch - genau eine Zeile, kein Marker", options, async () => {
  // Die Route bildet ein fehlendes Formfeld mit
  // `String(fd.get("client_action_id") ?? "").trim()` auf "" ab. Ein leerer Wert
  // ist deshalb "keine Kennung" und keine kaputte Kennung: der Upload laeuft
  // ohne Deduplizierung durch.
  setSession(sessionFor(DISPO));
  const markersBefore = await markerCountForActor(DISPO.id);

  const result = await uploadAs(DISPO, {
    incidentId: ID.incident,
    category: "schadstelle",
    description: null,
    files: [fileOf(FILE.emptyAction, jpegBytes(64))],
    clientActionId: "",
  });
  assert.deepEqual(result, { ok: 1, errors: [], duplicate: false });

  const rows = await imageRows(FILE.emptyAction);
  assert.equal(rows.length, 1);
  assert.ok(s3.objects.has(rows[0].storage_path));
  assert.equal(
    await markerCountForActor(DISPO.id),
    markersBefore,
    "ohne Kennung darf kein Marker entstehen",
  );
});

// ==========================================================================
// E) Signaturpflicht der SCHREIBENDEN Zugriffe (IB30-IB37)
//
// IB8-IB10 messen die Privatheit des LESENS. Hier geht es um die andere Haelfte:
// Schreiben und Loeschen. Das SDK signiert PutObject und DeleteObject nicht
// presigned in der Abfrage, sondern header-basiert im Authorization-Header; der
// Testendpunkt rechnet diese Signatur nach (s3-test-endpoint.mjs,
// verifySignedRequest).
//
// Diese Faelle sprechen den Endpunkt deshalb mit ROHEM HTTP an und nicht ueber
// das SDK: nur so lassen sich eine unsignierte und eine absichtlich falsch
// signierte Anfrage ueberhaupt erzeugen. Am Anwendungscode aendert das nichts -
// er bleibt in jedem anderen Fall dieser Datei der einzige Absender.
//
// Die benutzten Zugangsdaten sind die des synthetischen Testendpunkts und
// erkennbar synthetisch (s3-test-endpoint.mjs). Weder ein Schluessel noch eine
// Signatur wird ausgegeben, auch nicht in einer Fehlermeldung.
//
// Nach JEDEM Negativfall wird der Objektbestand vollstaendig nachgemessen:
// objectDigest() vergleicht Anzahl UND Inhalt aller Schluessel.
// ==========================================================================

/** Erkennbar synthetischer FREMDER Zugriffsschluessel - gehoert zu keinem Konto. */
const FOREIGN_ACCESS_KEY_ID = "AP14BFREMDERKEY00000";

/**
 * Objektschluessel der Rohanfragen (IB30-IB36).
 *
 * Form wie buildStoragePath(), aber mit einer festen, erkennbar synthetischen
 * Kennung statt einer zufaelligen: kein Anwendungscode erzeugt diese Schluessel,
 * und sie duerfen nie im Objektspeicher auftauchen.
 */
function rawKey(suffix) {
  return `incidents/${ID.incident}/23d00000-0000-0000-0000-0000000000e1/i23-w-${suffix}.jpg`;
}

function sha256HexOf(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Momentaufnahme des GESAMTEN Objektbestands: je Schluessel ein Hashwert.
 *
 * Deckt Anzahl und Inhalt in einer Zusicherung ab. Bewusst ein Hashwert und
 * nicht die Bytes: eine fehlgeschlagene Zusicherung darf keine Bildbytes in die
 * Testausgabe schreiben.
 */
function objectDigest() {
  return [...s3.objects.entries()]
    .map(([key, value]) => `${key}:${sha256HexOf(value.body)}`)
    .sort();
}

/** `YYYYMMDDTHHMMSSZ` auf der Zeitbasis, die auch der Endpunkt benutzt. */
function amzDateNow() {
  return new Date(Date.now() + clockOffsetMs)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

/**
 * Baut eine SigV4-HEADER-signierte Rohanfrage gegen den Testendpunkt.
 *
 * Reine Testhilfe. Signiert werden host, x-amz-content-sha256, x-amz-date und
 * bei PUT zusaetzlich content-type.
 *
 * Bewusst NICHT signiert wird content-length: den setzt fetch selbst, und was
 * nicht in SignedHeaders steht, geht auch nicht in die canonicalHeaders ein.
 * `host` wird nur signiert und NICHT als Header gesetzt: fetch sendet ihn aus
 * der URL und laesst ihn nicht ueberschreiben - genau der Wert, der hier
 * signiert wird.
 *
 * @param {object} input
 * @param {"PUT"|"DELETE"} input.method
 * @param {string} input.key Objektschluessel ohne Bucket.
 * @param {Uint8Array} [input.body] Rumpf, fuer den signiert wird.
 * @returns {{url: string, headers: Record<string, string>}}
 */
function signedRawRequest({ method, key, body = new Uint8Array(0) }) {
  const path = objectPath(key);
  const amzDate = amzDateNow();
  const shortDate = amzDate.slice(0, 8);
  const payloadHash = sha256HexOf(body);

  /** Header, die tatsaechlich gesendet werden. */
  const headers = { "x-amz-content-sha256": payloadHash, "x-amz-date": amzDate };
  if (method === "PUT") headers["content-type"] = "image/jpeg";

  /** Header, die SIGNIERT werden - zusaetzlich host aus der URL. */
  const signed = { host: new URL(s3.url).host, ...headers };
  const names = Object.keys(signed).sort();
  const canonicalHeaders = names.map((name) => `${name}:${signed[name].trim()}\n`).join("");
  const signedHeaders = names.join(";");

  // Der Abfrageteil ist leer - daher die Leerzeile zwischen Pfad und
  // canonicalHeaders.
  const canonicalRequest =
    `${method}\n` +
    `${path}\n` +
    "\n" +
    `${canonicalHeaders}\n` +
    `${signedHeaders}\n` +
    payloadHash;

  const scope = `${shortDate}/${s3.region}/s3/aws4_request`;
  const stringToSign =
    "AWS4-HMAC-SHA256\n" +
    `${amzDate}\n` +
    `${scope}\n` +
    sha256HexOf(Buffer.from(canonicalRequest, "utf8"));

  const dateKey = createHmac("sha256", `AWS4${s3.secretAccessKey}`)
    .update(shortDate)
    .digest();
  const regionKey = createHmac("sha256", dateKey).update(s3.region).digest();
  const serviceKey = createHmac("sha256", regionKey).update("s3").digest();
  const signingKey = createHmac("sha256", serviceKey).update("aws4_request").digest();
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");

  headers.authorization =
    `AWS4-HMAC-SHA256 Credential=${s3.accessKeyId}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return { url: `${s3.url}${path}`, headers };
}

/**
 * Ersetzt genau EIN Zeichen der Signatur im Authorization-Header.
 *
 * Der Header bleibt vollstaendig und wohlgeformt; abgelehnt werden darf er
 * deshalb nur wegen der Signatur selbst. Die Signatur wird nicht ausgegeben.
 */
function tamperSignature(authorization) {
  const match = /Signature=([0-9a-f]{64})$/.exec(authorization);
  assert.ok(match, "der Authorization-Header traegt keine Signatur der erwarteten Form");
  const signature = match[1];
  const last = signature.slice(-1);
  const flipped = `${signature.slice(0, -1)}${last === "0" ? "1" : "0"}`;
  return authorization.replace(`Signature=${signature}`, `Signature=${flipped}`);
}

/** Tauscht den Zugriffsschluessel in Credential gegen einen fremden aus. */
function withForeignAccessKey(authorization) {
  const replaced = authorization.replace(
    `Credential=${s3.accessKeyId}/`,
    `Credential=${FOREIGN_ACCESS_KEY_ID}/`,
  );
  assert.notEqual(replaced, authorization, "der Zugriffsschluessel wurde nicht ersetzt");
  return replaced;
}

/** Rohanfrage ausfuehren; liefert Status und Rumpftext. */
async function sendRaw(url, init) {
  const response = await fetch(url, init);
  return { status: response.status, text: await response.text() };
}

/** Zusicherung "403 AccessDenied" - immer mit demselben Rumpf des Endpunkts. */
function assertAccessDenied(result) {
  assert.equal(result.status, 403);
  assert.match(result.text, /<Code>AccessDenied<\/Code>/);
}

test("IB30 ein unsignierter PUT wird mit 403 abgewiesen - kein neues Objekt", options, async () => {
  const key = rawKey("unsigniert");
  const before = objectDigest();
  const from = mark();

  assertAccessDenied(
    await sendRaw(`${s3.url}${objectPath(key)}`, {
      method: "PUT",
      headers: { "content-type": "image/jpeg" },
      body: jpegBytes(64),
    }),
  );

  assert.equal(s3.objects.has(key), false, "ein unsignierter PUT hat geschrieben");
  assert.deepEqual(objectDigest(), before, "der Objektbestand hat sich geaendert");

  const puts = requestsOf(from, "PUT");
  assert.equal(puts.length, 1, JSON.stringify(puts));
  assert.equal(puts[0].status, 403);
});

test("IB31 ein unsignierter DELETE auf ein vorhandenes Objekt wird mit 403 abgewiesen", options, async () => {
  // Gegenprobe zuerst: das Objekt aus IB1 liegt nachweislich im Speicher.
  const stored = s3.objects.get(storagePathA);
  assert.ok(stored, "das Objekt aus IB1 fehlt");
  const bytesBefore = new Uint8Array(stored.body);
  const before = objectDigest();
  const from = mark();

  assertAccessDenied(
    await sendRaw(`${s3.url}${objectPath(storagePathA)}`, { method: "DELETE" }),
  );

  const after = s3.objects.get(storagePathA);
  assert.ok(after, "ein unsignierter DELETE hat geloescht");
  assert.deepEqual(new Uint8Array(after.body), bytesBefore, "die Bytes haben sich geaendert");
  assert.deepEqual(objectDigest(), before, "der Objektbestand hat sich geaendert");

  const deletes = requestsOf(from, "DELETE");
  assert.equal(deletes.length, 1, JSON.stringify(deletes));
  assert.equal(deletes[0].status, 403);
});

test("IB32 ein PUT mit manipulierter Signatur wird mit 403 abgewiesen - kein neues Objekt", options, async () => {
  const key = rawKey("falsche-signatur");
  const body = jpegBytes(64);
  const request = signedRawRequest({ method: "PUT", key, body });
  const before = objectDigest();
  const from = mark();

  assertAccessDenied(
    await sendRaw(request.url, {
      method: "PUT",
      headers: {
        ...request.headers,
        authorization: tamperSignature(request.headers.authorization),
      },
      body,
    }),
  );

  assert.equal(s3.objects.has(key), false, "eine falsche Signatur hat geschrieben");
  assert.deepEqual(objectDigest(), before);

  const puts = requestsOf(from, "PUT");
  assert.equal(puts.length, 1, JSON.stringify(puts));
  assert.equal(puts[0].status, 403);
});

test("IB33 ein DELETE mit manipulierter Signatur laesst das vorhandene Objekt unveraendert", options, async () => {
  const stored = s3.objects.get(storagePathA);
  assert.ok(stored, "das Objekt aus IB1 fehlt");
  const bytesBefore = new Uint8Array(stored.body);
  const before = objectDigest();
  const request = signedRawRequest({ method: "DELETE", key: storagePathA });
  const from = mark();

  assertAccessDenied(
    await sendRaw(request.url, {
      method: "DELETE",
      headers: {
        ...request.headers,
        authorization: tamperSignature(request.headers.authorization),
      },
    }),
  );

  const after = s3.objects.get(storagePathA);
  assert.ok(after, "eine falsche Signatur hat geloescht");
  assert.deepEqual(new Uint8Array(after.body), bytesBefore);
  assert.deepEqual(objectDigest(), before);

  const deletes = requestsOf(from, "DELETE");
  assert.equal(deletes.length, 1, JSON.stringify(deletes));
  assert.equal(deletes[0].status, 403);
});

test("IB34 ein fremder Zugriffsschluessel wird bei PUT und bei DELETE mit 403 abgewiesen", options, async () => {
  // Der Rest der Anfrage ist unveraendert korrekt signiert; abgelehnt wird sie
  // allein wegen des Schluessels in Credential.
  const key = rawKey("fremder-schluessel");
  const body = jpegBytes(64);
  const stored = s3.objects.get(storagePathA);
  assert.ok(stored, "das Objekt aus IB1 fehlt");
  const bytesBefore = new Uint8Array(stored.body);
  const before = objectDigest();
  const from = mark();

  const put = signedRawRequest({ method: "PUT", key, body });
  assertAccessDenied(
    await sendRaw(put.url, {
      method: "PUT",
      headers: {
        ...put.headers,
        authorization: withForeignAccessKey(put.headers.authorization),
      },
      body,
    }),
  );

  const remove = signedRawRequest({ method: "DELETE", key: storagePathA });
  assertAccessDenied(
    await sendRaw(remove.url, {
      method: "DELETE",
      headers: {
        ...remove.headers,
        authorization: withForeignAccessKey(remove.headers.authorization),
      },
    }),
  );

  assert.equal(s3.objects.has(key), false, "ein fremder Schluessel hat geschrieben");
  const after = s3.objects.get(storagePathA);
  assert.ok(after, "ein fremder Schluessel hat geloescht");
  assert.deepEqual(new Uint8Array(after.body), bytesBefore);
  assert.deepEqual(objectDigest(), before);

  assert.equal(requestsOf(from, "PUT")[0].status, 403);
  assert.equal(requestsOf(from, "DELETE")[0].status, 403);
});

test("IB35 ein Rumpf, der nicht zum signierten Nutzlast-Hash passt, wird mit 403 abgewiesen", options, async () => {
  // Ohne diesen Fall belegt die Pruefung nur den Umschlag der Anfrage. Hier ist
  // die Anfrage vollstaendig gueltig signiert - aber fuer ANDERE Bytes.
  const key = rawKey("rumpf-abweichend");
  const signedBody = jpegBytes(64);
  // Gleiche LAENGE, ein anderes Byte: die Ablehnung kann damit nicht aus einer
  // abweichenden content-length folgen, sondern nur aus dem Nutzlast-Hash.
  const sentBody = jpegBytes(64);
  sentBody[10] ^= 0x01;
  assert.equal(sentBody.byteLength, signedBody.byteLength);
  assert.notDeepEqual(sentBody, signedBody);

  const request = signedRawRequest({ method: "PUT", key, body: signedBody });
  const before = objectDigest();
  const from = mark();

  assertAccessDenied(
    await sendRaw(request.url, { method: "PUT", headers: request.headers, body: sentBody }),
  );

  assert.equal(s3.objects.has(key), false, "ein abweichender Rumpf wurde geschrieben");
  assert.deepEqual(objectDigest(), before);

  const puts = requestsOf(from, "PUT");
  assert.equal(puts.length, 1, JSON.stringify(puts));
  assert.equal(puts[0].status, 403);
});

test("IB36 ein in SignedHeaders genannter, aber nicht gesendeter Header fuehrt zu 403", options, async () => {
  const key = rawKey("fehlender-header");
  const body = jpegBytes(64);
  const request = signedRawRequest({ method: "PUT", key, body });
  // content-type steht in SignedHeaders (siehe signedRawRequest), wird hier aber
  // nicht gesendet. Der Endpunkt darf ihn NICHT ergaenzen - anders als beim
  // Aufruf einer presignierten URL gibt es hier keine Ausnahme.
  assert.match(request.headers.authorization, /SignedHeaders=[^,]*content-type/);
  const { "content-type": omitted, ...headers } = request.headers;
  assert.equal(omitted, "image/jpeg");

  const before = objectDigest();
  const from = mark();

  assertAccessDenied(await sendRaw(request.url, { method: "PUT", headers, body }));

  assert.equal(s3.objects.has(key), false);
  assert.deepEqual(objectDigest(), before);

  const puts = requestsOf(from, "PUT");
  assert.equal(puts.length, 1, JSON.stringify(puts));
  assert.equal(puts[0].status, 403);
});

test("IB37 Gegenprobe: korrekt signierte Schreib- und Loeschzugriffe gelingen weiterhin", options, async () => {
  // ZWINGENDE Gegenprobe zu IB30-IB36: eine fehlerhafte Signaturpruefung koennte
  // sonst stillschweigend "alles 403" bedeuten.
  //
  // Fuer den SDK-Weg fuehren diese Gegenprobe bereits IB1 (PUT 200), IB23
  // (Kompensations-DELETE 204) sowie IB25 und IB27 (Ruecknahme des Duplikats per
  // DELETE) - alle laufen in diesem Prozess mit aktiver Pruefung. Hier steht sie
  // noch einmal unmittelbar nach den Negativfaellen.
  setSession(sessionFor(DISPO));
  const from = mark();
  const bytes = jpegBytes(192);

  // 1) Der ECHTE Weg ueber das SDK: der Anwendungscode signiert selbst.
  const upload = await uploadAs(DISPO, {
    incidentId: ID.incident,
    category: "sonstiges",
    description: null,
    files: [fileOf(FILE.counterProof, bytes)],
  });
  assert.deepEqual(upload, { ok: 1, errors: [], duplicate: false });

  const rows = await imageRows(FILE.counterProof);
  assert.equal(rows.length, 1);
  const key = rows[0].storage_path;
  const stored = s3.objects.get(key);
  assert.ok(stored, "das Objekt fehlt trotz erfolgreichem Upload");
  assert.deepEqual(new Uint8Array(stored.body), bytes);

  const puts = requestsFor(from, "PUT", FILE.counterProof);
  assert.equal(puts.length, 1, JSON.stringify(puts));
  assert.equal(puts[0].status, 200);

  // 2) Ein korrekt signierter DELETE derselben Testhilfe, die in IB33 und IB34
  //    manipuliert wurde: unmanipuliert wird er angenommen. Damit ist belegt,
  //    dass dort die Manipulation und nicht der Weg ueber rohes HTTP zur
  //    Ablehnung gefuehrt hat.
  const remove = signedRawRequest({ method: "DELETE", key });
  const result = await sendRaw(remove.url, { method: "DELETE", headers: remove.headers });
  assert.equal(result.status, 204);
  assert.equal(result.text, "");
  assert.equal(s3.objects.has(key), false, "das Objekt wurde nicht geloescht");

  // Die Metadatenzeile bleibt bewusst stehen: derselbe Zustand wie in IB13 (Zeile
  // ohne Objekt). Er ist hier ohne Folge - dies ist der letzte Fall der Datei,
  // und die temporaere Datenbank wird nach dem Lauf entfernt.
  assert.equal((await imageRows(FILE.counterProof)).length, 1);
});
