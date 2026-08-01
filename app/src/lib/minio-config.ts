import "server-only";

// AP14/B: Pflichtkonfiguration des internen Objektspeichers (MinIO/S3, ADR-011).
//
// Es werden ausschliesslich NAMEN gefuehrt und gemeldet - niemals Werte. Weder
// Endpunkt noch Bucket noch Zugangsdaten erscheinen in einer Meldung, einem Log
// oder einer Antwort.
//
// Struktur bewusst gleich zu platform-config.ts: dieselbe Trennung von
// "fehlende Namen", "ist konfiguriert" und "bricht ab".
//
// ABWEICHUNG von platform-config.ts, mit Absicht: dort steht bewusst KEIN
// "server-only", weil das Modul nur Variablennamen und ein boolean liefert und
// von einer Server-Komponente der Anmeldeseite benutzt wird. Hier ist es
// anders - readMinioConfig() gibt die Zugangsdaten selbst heraus. Deshalb
// greift hier der harte Waechter: ein versehentlicher Import in einer
// Client-Komponente bricht den Build ab, statt sich auf eine Konvention zu
// verlassen. Dasselbe Muster benutzen lib/db/index.ts, lib/db/pg-errors.ts und
// lib/auth-service.ts.
//
// Die Werte werden bei jedem Aufruf frisch aus process.env gelesen, nicht beim
// Modulimport. Damit ist der Zustand zur Laufzeit maessgeblich und kein
// Buildzeitzustand - wichtig fuer den Produktions-Build, der ohne Geheimnisse
// laeuft.

/**
 * Pflichtvariablen des Objektspeichers. Die Namen sind in
 * deploy/env/app.env.example reserviert und werden hier nicht neu erfunden.
 *
 * S3_PUBLIC_BASE_URL steht bewusst als Pflicht direkt hinter S3_ENDPOINT und
 * hat KEINEN Rueckfall auf den Endpunkt: der interne Endpunkt ist ein
 * Dienstname im Containernetz. Faellt die Signierbasis auf ihn zurueck, geraet
 * er in jede signierte URL und damit in den Browser - dort ist er weder
 * aufloesbar noch darf er ueberhaupt sichtbar werden.
 */
export const MINIO_REQUIRED_ENV_KEYS = [
  "S3_ENDPOINT",
  "S3_PUBLIC_BASE_URL",
  "S3_BUCKET",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
] as const;

type MinioEnvKey = (typeof MINIO_REQUIRED_ENV_KEYS)[number];

/** Region-Vorgabe: MinIO ignoriert die Region, SigV4 braucht aber einen Wert. */
const DEFAULT_REGION = "us-east-1";

/**
 * Loopback-Hostnamen.
 *
 * Nur fuer diese darf der interne Endpunkt mit der oeffentlichen Signierbasis
 * zusammenfallen (siehe readMinioConfig).
 *
 * "::1" steht hier OHNE eckige Klammern, der Vergleich in isLoopback() entfernt
 * sie deshalb vorher. Das ist noetig, weil URL.hostname eine IPv6-Adresse GENAU
 * SO serialisiert, wie sie in der Autoritaet steht - mit Klammern:
 * new URL("http://[::1]:9000").hostname liefert "[::1]", nicht "::1".
 * Nachgemessen mit node -e in dieser Laufzeit.
 */
const LOOPBACK_HOSTNAMES = ["127.0.0.1", "localhost", "::1"] as const;

/**
 * Platzhaltererkennung, fail-closed.
 *
 * Ein aus der Vorlage uebernommener, aber nicht ersetzter Wert ist so
 * unbrauchbar wie ein fehlender - er darf nicht zu einem Verbindungsversuch
 * fuehren. Erkannt werden diese Teilzeichenfolgen (ohne Beachtung der
 * Gross-/Kleinschreibung): PLATZHALTER, CHANGE_ME, CHANGEME, BEISPIEL,
 * EXAMPLE.INVALID sowie die Klammerzeichen "<" und ">" aus Vorlagen wie
 * "<hier eintragen>".
 */
const PLACEHOLDER_SUBSTRINGS = [
  "platzhalter",
  "change_me",
  "changeme",
  "beispiel",
  "example.invalid",
  "<",
  ">",
] as const;

/**
 * Zusaetzlich als Platzhalter gelten diese vollstaendigen Werte: BENUTZER,
 * PASSWORT. Als Teilzeichenfolge waeren sie zu scharf - ein echter Bucketname
 * darf "benutzer" enthalten.
 */
const PLACEHOLDER_VALUES = ["benutzer", "passwort"] as const;

/**
 * True, wenn der Wert erkennbar ein Platzhalter ist.
 *
 * Diese Funktion meldet und protokolliert NIEMALS den geprueften Wert; sie gibt
 * ausschliesslich ein boolean zurueck.
 */
function isPlaceholder(value: string): boolean {
  const lowered = value.toLowerCase();
  if ((PLACEHOLDER_VALUES as readonly string[]).includes(lowered)) return true;
  return PLACEHOLDER_SUBSTRINGS.some((needle) => lowered.includes(needle));
}

/**
 * Getrimmter Wert einer Laufzeitvariablen, oder NULL wenn er fehlt, leer ist
 * oder ein Platzhalter ist.
 */
function readValue(name: string): string | null {
  const raw = process.env[name];
  if (raw === undefined) return null;
  const value = raw.trim();
  if (value === "" || isPlaceholder(value)) return null;
  return value;
}

/** Namen der fehlenden bzw. noch mit einem Platzhalter belegten Pflichtvariablen. */
export function missingMinioConfigKeys(): string[] {
  return MINIO_REQUIRED_ENV_KEYS.filter((name) => readValue(name) === null);
}

/** True, wenn der Objektspeicher zur Laufzeit vollstaendig konfiguriert ist. */
export function isMinioConfigured(): boolean {
  return missingMinioConfigKeys().length === 0;
}

/**
 * Bricht mit klarer Meldung ab, wenn die Pflichtkonfiguration fehlt.
 * Bewusst kein Fallback: ein Zugriff ohne Konfiguration ist ein Fehler.
 * Die Meldung nennt ausschliesslich Namen.
 */
export function assertMinioConfigured(): void {
  const missing = missingMinioConfigKeys();
  if (missing.length === 0) return;
  throw new Error(
    `Konfiguration fehlt: ${missing.join(", ")}. ` +
      "Werte in der Environment-Datei der Umgebung setzen " +
      "(Vorlage: deploy/env/app.env.example).",
  );
}

/**
 * Gelesene Konfiguration des Objektspeichers.
 *
 * Dieses Objekt darf NIRGENDS in ein Log, eine Meldung, eine HTTP-Antwort oder
 * das Ergebnis einer Server Action geraten - `accessKeyId` und
 * `secretAccessKey` sind Geheimnisse, `endpoint` und `bucket` sind interne
 * Infrastrukturangaben.
 */
export type MinioConfig = {
  /** Intern erreichbarer Endpunkt; ausschliesslich fuer Server-zu-Server-Aufrufe. */
  endpoint: string;
  /**
   * Browserseitig erreichbare Basis-URL fuer signierte GET-URLs. Sie liegt
   * unter dem Origin der Anwendung; der Reverse-Proxy routet den Bucket-Pfad
   * auf den privaten MinIO-Dienst (siehe readMinioConfig).
   */
  publicBaseUrl: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  forcePathStyle: boolean;
};

/**
 * Wert einer Pflichtvariablen.
 *
 * Nach assertMinioConfigured() kann der NULL-Fall nicht mehr eintreten; die
 * Pruefung haelt den Typ ohne Zusicherung eng und nennt im Ausnahmefall
 * ausschliesslich den Namen.
 */
function requiredValue(name: MinioEnvKey): string {
  const value = readValue(name);
  if (value === null) throw new Error(`Konfiguration fehlt: ${name}.`);
  return value;
}

/**
 * EIN Meldungstext fuer JEDEN Ablehnungsgrund einer Basis-URL.
 *
 * Bewusst nicht nach Grund unterschieden: eine Meldung, die nennt, WELCHER
 * Bestandteil des Werts falsch war, liesse auf den Wert zurueckschliessen. Die
 * Meldung nennt deshalb ausschliesslich den Variablennamen.
 */
function invalidBaseMessage(name: string): string {
  return (
    `Konfiguration ungueltig: ${name} muss eine absolute http(s)-URL ohne ` +
    "Benutzerinfo, Query und Fragment sein."
  );
}

/**
 * Wert als absolute http(s)-Basis-URL, fail-closed.
 *
 * Abgewiesen wird: kein absoluter URL, ein anderes Schema als http/https, eine
 * Benutzerinfo (sie waere ein Zugangsdatum in einer Basis-URL), ein Query, ein
 * Fragment sowie ein leerer Hostname. Die Meldung ist fuer alle diese Faelle
 * dieselbe und enthaelt NIEMALS den Wert.
 */
function parseHttpBase(name: string, value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(invalidBaseMessage(name));
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(invalidBaseMessage(name));
  }
  if (url.username !== "" || url.password !== "") throw new Error(invalidBaseMessage(name));
  if (url.search !== "" || url.hash !== "") throw new Error(invalidBaseMessage(name));
  if (url.hostname === "") throw new Error(invalidBaseMessage(name));
  return url;
}

/**
 * Geprueftes URL-Objekt einer Pflichtvariablen.
 *
 * Das Objekt dient AUSSCHLIESSLICH der Pruefung und dem Origin-Vergleich. In
 * die Konfiguration geht weiterhin die getrimmte Zeichenkette (siehe
 * readMinioConfig).
 */
function requiredHttpBase(name: MinioEnvKey): URL {
  return parseHttpBase(name, requiredValue(name));
}

/**
 * True, wenn der Hostname der URL ein Loopback-Name ist.
 *
 * Die eckigen Klammern einer IPv6-Autoritaet werden vorher entfernt: URL.hostname
 * liefert fuer "http://[::1]:9000" den Wert "[::1]" einschliesslich Klammern.
 */
function isLoopback(url: URL): boolean {
  const hostname = url.hostname.startsWith("[") && url.hostname.endsWith("]")
    ? url.hostname.slice(1, -1)
    : url.hostname;
  return (LOOPBACK_HOSTNAMES as readonly string[]).includes(hostname);
}

/**
 * Vollstaendige Konfiguration des Objektspeichers. Bricht ab, wenn eine
 * Pflichtvariable fehlt oder eine der beiden Basis-URLs unbrauchbar ist.
 *
 * Optionale Variablen mit dokumentiertem Standard:
 *   - S3_REGION: Standard "us-east-1".
 *   - S3_FORCE_PATH_STYLE: Standard true; nur ein ausdrueckliches "false"
 *     schaltet ab. MinIO wird ueblicherweise ohne Bucket-Subdomains betrieben.
 *
 * S3_ENDPOINT und S3_PUBLIC_BASE_URL sind BEIDE Pflicht und beide werden als
 * absolute http(s)-URL geprueft. Ein Rueckfall der Signierbasis auf den
 * Endpunkt gibt es nicht.
 *
 * ANFORDERUNG AN DEN INTERNEN REVERSE-PROXY (fuer die IT, ohne konkrete Adresse
 * an dieser Stelle): die oeffentliche Signierbasis liegt unter DEMSELBEN Origin
 * wie die Anwendung (AUTH_URL). Der Reverse-Proxy routet den Bucket-Pfad auf den
 * privaten MinIO-Dienst weiter. Path-Style (S3_FORCE_PATH_STYLE) bedeutet dabei,
 * dass der Pfad einer signierten URL mit dem Bucketnamen beginnt. Folge: die
 * Bilder werden vom eigenen Origin geladen, die CSP bleibt bei img-src 'self'
 * und es ist keine Wildcard noetig.
 */
export function readMinioConfig(): MinioConfig {
  assertMinioConfigured();

  // Die Zeichenkette ist der Konfigurationswert, das URL-Objekt nur der Pruefer.
  // new URL("http://host") normalisiert zu "http://host/"; ein so veraenderter
  // Endpunkt wuerde das SDK-Verhalten und den Cache-Schluessel in
  // minio-storage.ts still veraendern. Deshalb geht der urspruenglich getrimmte
  // Wert unveraendert nach aussen.
  const endpoint = requiredValue("S3_ENDPOINT");
  const publicBaseUrl = requiredValue("S3_PUBLIC_BASE_URL");
  const endpointUrl = requiredHttpBase("S3_ENDPOINT");
  const publicUrl = requiredHttpBase("S3_PUBLIC_BASE_URL");

  // Interner Endpunkt und oeffentliche Signierbasis muessen getrennt sein.
  //
  // Unterscheidungsmerkmal ist ausdruecklich LOOPBACK und NICHT NODE_ENV: der
  // Stage-/Produktionswert von S3_ENDPOINT ist ein interner Dienstname im
  // Containernetz und damit nie Loopback, waehrend die lokalen synthetischen
  // Tests nachweislich auf 127.0.0.1 binden
  // (app/test/integration/s3-test-endpoint.mjs). NODE_ENV wird von diesem Modul
  // nicht gelesen und waere in den Integrationstests ohnehin nicht gesetzt.
  //
  // Verglichen wird der ORIGIN, nicht die Zeichenkette: Schreibweise, Schraegstrich
  // am Ende und Standardport duerfen das Ergebnis nicht veraendern.
  if (
    endpointUrl.origin === publicUrl.origin &&
    !(isLoopback(endpointUrl) && isLoopback(publicUrl))
  ) {
    throw new Error(
      "Konfiguration ungueltig: S3_ENDPOINT und S3_PUBLIC_BASE_URL duerfen ausserhalb " +
        "von Loopback nicht denselben Origin haben.",
    );
  }

  // Same-Origin-Proxygrenze: die oeffentliche Signierbasis liegt unter dem
  // Origin der Anwendung.
  //
  // AUTH_URL ist heute optional (deploy/env/app.env.example) und wird von den
  // lokalen synthetischen Tests nicht gesetzt. Fehlt sie oder ist sie getrimmt
  // leer, findet deshalb KEIN Vergleich statt. Ist sie gesetzt, muss sie selbst
  // eine absolute http(s)-URL sein. AUTH_URL gehoert NICHT diesem Modul und
  // steht deshalb bewusst nicht in MINIO_REQUIRED_ENV_KEYS.
  const authUrlValue = process.env.AUTH_URL?.trim() ?? "";
  if (authUrlValue !== "") {
    const authUrl = parseHttpBase("AUTH_URL", authUrlValue);
    if (publicUrl.origin !== authUrl.origin) {
      throw new Error(
        "Konfiguration ungueltig: S3_PUBLIC_BASE_URL und AUTH_URL muessen denselben " +
          "Origin haben.",
      );
    }
  }

  return {
    endpoint,
    publicBaseUrl,
    bucket: requiredValue("S3_BUCKET"),
    accessKeyId: requiredValue("S3_ACCESS_KEY_ID"),
    secretAccessKey: requiredValue("S3_SECRET_ACCESS_KEY"),
    region: readValue("S3_REGION") ?? DEFAULT_REGION,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE?.trim().toLowerCase() !== "false",
  };
}
