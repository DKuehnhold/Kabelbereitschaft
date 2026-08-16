// AP15-b/B3 Integrationsnachweis des ANWENDUNGSPFADES der Fehlalarm-Semantik
// und des Vollmengen-Exports gegen ein synthetisches PostgreSQL 18.
//
// Lauf:
//   AP14B_APP_DATABASE_URL=...   Verbindung der Anwendung (Rolle erbt app_user,
//                                kein SUPERUSER, kein BYPASSRLS)
//   AP14B_ADMIN_DATABASE_URL=... Verbindung der Migrations-/Eigentuemerrolle,
//                                ausschliesslich fuer Fixtures und Gegenproben
//   node --import ./test/integration/module-hooks-app.mjs \
//        test/integration/ap15b-incident-list.int.mjs
//
// Ohne diese beiden Variablen werden alle Pruefungen uebersprungen; die Datei
// ist damit in einer Umgebung ohne Datenbank harmlos.
//
// BETRIEBSART "PFLICHTMODUS" (AP14B_REQUIRE_INTEGRATION=1): dann gilt das
// Ueberspringen ausdruecklich NICHT. Fehlt eine der beiden Verbindungsvariablen,
// bricht die Datei bereits beim Laden ab. Grund: in der GitHub-CI darf ein
// fehlender Verbindungswert nicht zu einem gruenen Lauf ohne Nachweis fuehren -
// ein stiller Skip waere dort ein vorgetaeuschter Nachweis. Dasselbe
// fail-closed Muster benutzen ap14b-admin-users.int.mjs,
// ap14b-minio-live.int.mjs und ap15-dashboard-metrics.int.mjs. Ohne den
// Schalter - also im lokalen Gebrauch ohne Datenbank - bleibt das
// Skip-Verhalten unveraendert.
//
// (a) WARUM DIESE DATEI NOETIG IST
// AP15-b hat vier neue Wege im Anwendungscode erzeugt, die von keiner
// bestehenden Pruefung mit echtem Produktivcode gegen echtes PostgreSQL
// belegt sind:
//   * `setIncidentFalseAlarm()` (src/lib/incidents.ts) mit seiner
//     Fehlerabbildung von SQLSTATE 42501 auf eine fachliche Meldung,
//   * `exportIncidentListFull()` (src/lib/incident-list-actions.ts) samt der
//     additiven CSV-Spalte "Fehlalarm",
//   * `listIncidentsForFullExport()` (src/lib/incidents.ts) mit der hoeheren
//     Obergrenze INCIDENT_FULL_EXPORT_CAP,
//   * der Fehlalarmfilter in fetchList() (`filters.falseAlarm`).
// TypeScript, ESLint und der Next-Build erkennen einen Fehler in einer
// SQL-Zeichenkette oder in einer Grenzwertrechnung nicht, und die
// Einheitentests laufen ohne Datenbank.
//
// (b) GEGENSTAND IST DER ANWENDUNGSPFAD, NICHT DIE DATENBANKSEITE
// Die Datenbankseite ist bereits belegt: app/supabase/test/
// 25_ap15b_incident_metrics.sql prueft Spaltenzielzustand und
// Wiederholbarkeit der Migration 0018 (W1/W2), den Triggerbereich
// `before insert or update` (W3) und die Disponent-only-Regel unter
// `set role app_user` mit aktiver RLS (W4-W12) - alles in SQL, ohne eine
// Zeile Anwendungscode. Diese Datei baut KEIN Anwendungs-SQL nach. Geprueft
// werden die ECHTEN Modulfunktionen; die ADMIN-Verbindung dient
// ausschliesslich Fixtures und Gegenproben. Ersetzt sind ausschliesslich die
// beiden Abhaengigkeiten, die eine Next-Laufzeit verlangen (siehe
// module-hooks-app.mjs): `next/cache` und `@/lib/auth`. Die Identitaet wird
// ueber setSession() eingespeist; die Sitzungsauswertung selbst ist an
// anderer Stelle geprueft.
//
// (c) BEFUND F7 IST DURCH DIESE DATEI NICHT BEHOBEN - AUSDRUECKLICH
// Diese Suite gibt `setIncidentFalseAlarm()` und `exportIncidentListFull()`
// ihren ersten nachgewiesenen Aufrufer, aber es ist ein TESTAUFRUFER. Befund
// F7 lautet: beide Funktionen haben im Anwendungspfad (UI/Export) KEINEN
// produktiven Aufrufer - keine Schaltflaeche, kein Menuepunkt, keine
// Server-Action-Anbindung. Dieser Befund bleibt als fachlicher Blocker offen.
// Die Verdrahtung ist eine sichtbare GUI- und Rollenentscheidung und Dennis
// vorbehalten (kein Agent und kein Test entscheidet sie). Wer diese
// Testabdeckung fuer eine Verdrahtung haelt, liest mehr hinein, als hier
// steht.
//
// (d) SYNTHETISCHE WERTE UND UUID-PRAEFIX
// Es kommen ausschliesslich synthetische Werte vor: Kennungen mit dem Praefix
// 26a00000- (er kommt in keiner anderen Test- oder Migrationsdatei vor -
// 20_ap14b_data.sql benutzt 20b00000-, 21_ap14b_masterdata_inventory.sql
// 21b00000-, ap14b-masterdata-inventory.int.mjs 21c00000-,
// ap14b-platform.int.mjs ac140b00-, ap14b-images.int.mjs 23d00000-,
// ap14b-minio-live.int.mjs 24d00000-, 24_ap15_dashboard_metrics.sql 24c00000-,
// ap15-dashboard-metrics.int.mjs 24f00000-, 25_ap15b_incident_metrics.sql
// 25c00000-, ap14b-admin-users.int.mjs 25e00000-), Namen mit dem Praefix
// "W26", E-Mail-Adressen auf @beispiel.invalid, keine echten Personen, keine
// Telefonnummern, keine Lager-, GPS-/EXIF- oder Zugangsdaten, kein Passwort
// und kein Hashmaterial.
//
// (e) AUFRAEUMEN - BEWUSSTE UND BEGRUENDETE GRENZE
// `public.incidents` und `public.incident_tasks` werden NICHT geloescht, und
// das ist eine Entscheidung aus der Schemalage, keine Nachlaessigkeit:
//   * `public.incident_tasks.incident_id` verweist mit `on delete cascade` auf
//     `public.incidents` (0011_ap13_tasks_bulk.sql:28);
//   * `trg_incident_tasks_no_delete` ist eine UNBEDINGTE
//     BEFORE-DELETE-Regel in `security definer`
//     (0011_ap13_tasks_bulk.sql:113-123). Sie greift auch im
//     Eigentuemerkontext und auch bei der Kaskade aus `public.incidents`;
//   * `trg_sync_tasks_incidents` erzeugt beim Einfuegen JEDES Vorgangs
//     abgeleitete Aufgaben (0011_ap13_tasks_bulk.sql:200-220, 267-269) - ein
//     Vorgang ohne Aufgabenzeilen ist nicht herstellbar.
// Ein `delete from public.incidents` waere deshalb nur nach einer Aufweichung
// dieser Sperre moeglich, und die ist ausgeschlossen. Es ist genau die
// dokumentierte Entscheidung aus supabase/test/20_ap14b_data.sql:28-43, die
// auch ap15-dashboard-metrics.int.mjs uebernimmt. Aus derselben Sperre folgt,
// dass auch die eigenen Zeilen in `public.construction_stages`,
// `public.vzg_lines` und `public.customers` stehen bleiben muessen: die
// verbleibenden Vorgaenge verweisen darauf. Beide Startskripte
// (run_db_tests.sh, run_ap14b_local.ps1) entfernen die Testdatenbank am
// Laufende; die Aufraeumbilanz wird fuer diese Tabellen also auf Datenbank-,
// Rollen-, Cluster- und Portebene erbracht und nicht auf Zeilenebene. Die
// verbleibende Zeilenzahl wird in test.after als "AUFRAEUMBILANZ AP15-b"
// ausgegeben, damit sie im Nachweis sichtbar bleibt und nicht als
// "aufgeraeumt" missverstanden wird. Alle Fixture-Inserts sind mit
// `on conflict ... do nothing` wiederholbar.
//
// AUSDRUECKLICH BENANNTE FOLGE DER VOLLMENGENFIXTURES: L10/L11 brauchen
// INCIDENT_FULL_EXPORT_CAP + 1 sichtbare Zeilen. Diese Zeilen ueberdauern den
// Lauf (Loeschsperre, siehe oben) und liegen bis zum Entfernen der
// Testdatenbank in `public.incidents`. Sie stehen in einem EIGENEN
// Bauabschnitt und tragen den Praefix 26a00000-; jede Zaehlung dieser Datei
// filtert darauf. Suiten, die ueber die GESAMTE sichtbare Menge zaehlen,
// werden dadurch langsamer - sachlich falsch werden sie nicht (sie
// vergleichen beide Seiten derselben Menge). Die Reihenfolge im Laeufer ist
// nicht Gegenstand dieser Datei.
//
// NICHT GEGENSTAND, ausdruecklich: eine Vorabtypprueferung von
// `filters.falseAlarm` fehlt in fetchList() (anders als bei `status`,
// `priority`, `date_from`/`date_to`, src/lib/incidents.ts:688-697). Dieser
// bekannte Mangel liegt ausserhalb dieses Scopes; er wird hier weder behoben
// noch mit einem Fall provoziert. Diese Datei uebergibt ausschliesslich
// `true`, `false` oder `undefined`.
//
// VERDRAHTUNG: diese Datei laeuft als SECHSTE und LETZTE Integrationssuite in
// supabase/test/run_db_tests.sh und in supabase/test/run_ap14b_local.ps1; der
// CI-Job "database" in .github/workflows/ci.yml faehrt denselben Laeufer und
// nennt sie im Kommentarblock ueber dem Job. Die letzte Position ist kein
// Zufall: der Vollmengenfall L10 legt INCIDENT_FULL_EXPORT_CAP + 1 Vorgaenge
// samt abgeleiteten Aufgabenzeilen an, und diese Zeilen ueberdauern den Lauf
// (Loeschsperre, siehe Aufraeumgrenze oben). Suiten, die ueber die gesamte
// sichtbare Menge zaehlen - namentlich ap15-dashboard-metrics.int.mjs -,
// wuerden dadurch deutlich langsamer und muessen deshalb vorher laufen.
//
// Meldungskennung: L (L1-L13, seit AP15B/RC1 Schritt 3: L12-L13). Der
// Buchstabe vermeidet zwei Verwechslungen -
// "F" waere mit den Befundnummern F1/F2/F7 verwechselbar, "V" gehoert
// ap15-dashboard-metrics.int.mjs und "W" gehoert
// 25_ap15b_incident_metrics.sql.
//
// "L" ist dabei NICHT frei: supabase/test/16_ap11_list.sql benutzt bereits
// Faelle der Form "SMOKE L..." (L1, L2a, L2b, L3 bis L7). Eine Kollision entsteht
// daraus trotzdem nicht, und zwar aus zwei nachgelesenen Gruenden:
//   * die FAIL-Suche der SQL-Kette liest ausschliesslich die Sammeldatei der
//     SQL-Laeufe (run_db_tests.sh:272-276 auf ${LOG}); die Ausgabe der
//     Node-Suiten geht ausdruecklich direkt auf die Konsole und NICHT in ${LOG}
//     (run_db_tests.sh:306-311);
//   * die Ausgabe dieser Suite hat gar nicht die Form "SMOKE L...": sie besteht
//     aus den node:test-Namen "L1" bis "L11" ohne das Praefix "SMOKE".
// Die Kennungen dieser Datei und die von 16_ap11_list.sql koennen sich damit
// weder gegenseitig gruen faerben noch gegenseitig zum Fehlschlag bringen.

import test from "node:test";
import assert from "node:assert/strict";

import { Client } from "pg";

const APP_URL = process.env.AP14B_APP_DATABASE_URL?.trim();
const ADMIN_URL = process.env.AP14B_ADMIN_DATABASE_URL?.trim();
const ENABLED = Boolean(APP_URL && ADMIN_URL);

/**
 * Pflichtmodus: der Lauf DARF nicht uebersprungen werden.
 *
 * Gesetzt wird er von der CI. Dort ist ein Skip kein harmloses "keine Datenbank
 * vorhanden", sondern ein gruener Lauf ohne jeden Nachweis. Lokal bleibt der
 * Schalter ungesetzt und das bisherige Verhalten unveraendert.
 */
const REQUIRE_INTEGRATION = process.env.AP14B_REQUIRE_INTEGRATION?.trim() === "1";

if (REQUIRE_INTEGRATION && !ENABLED) {
  // Abbruch statt Skip, und zwar SOFORT beim Laden des Moduls: ein `skip` liefe
  // mit Exitcode 0 durch. Die Meldung nennt ausschliesslich die NAMEN der
  // fehlenden Variablen - niemals einen Wert und niemals eine
  // Verbindungszeichenfolge.
  const missing = [
    ["AP14B_APP_DATABASE_URL", APP_URL],
    ["AP14B_ADMIN_DATABASE_URL", ADMIN_URL],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);
  throw new Error(
    `AP15-b-Integrationsnachweis nicht lauffaehig, Pflichtvariablen fehlen: ${missing.join(", ")}. ` +
      "Bei gesetztem AP14B_REQUIRE_INTEGRATION=1 wird dieser Lauf ausdruecklich NICHT uebersprungen.",
  );
}

// Muss vor der ersten Abfrage stehen: der Pool in src/lib/db liest die Variable
// beim ersten Verbindungsaufbau.
if (ENABLED) process.env.DATABASE_URL = APP_URL;

const { setSession, clearSession } = await import("./stubs/session.mjs");

const {
  setIncidentFalseAlarm,
  listIncidentsPaged,
  listIncidentsForExport,
  listIncidentsForFullExport,
} = await import("../../src/lib/incidents.ts");
const { exportIncidentListFull } = await import("../../src/lib/incident-list-actions.ts");
const { INCIDENT_EXPORT_CAP, INCIDENT_FULL_EXPORT_CAP } = await import(
  "../../src/lib/incident-list.ts"
);
const { CSV_BOM } = await import("../../src/lib/csv.ts");
// L13: die NEUE Produktiv-Server-Action, aufgeloest ueber die "next/navigation"-
// Umleitung aus module-hooks-app.mjs (Regel 5) - ohne sie schluege bereits
// dieser Import mit ERR_MODULE_NOT_FOUND fehl.
const { setFalseAlarm } = await import("../../src/lib/incident-actions.ts");

// --------------------------------------------------------------------------
// Erwartete Meldungen. Sie sind im Produktivcode keine Exporte, stehen hier
// deshalb als Literal MIT Belegstelle - und werden nicht neu erfunden:
//   * src/lib/incidents.ts:952 und :963  ("nicht gefunden")
//   * src/lib/incidents.ts:971           (Abbildung von SQLSTATE 42501)
//   * src/lib/incident-list-actions.ts:33 (EXPORT_STAFF_ONLY_ERROR)
// --------------------------------------------------------------------------
const MSG_NOT_FOUND = "Der Vorgang wurde nicht gefunden.";
const MSG_FALSE_ALARM_FORBIDDEN = "Die Fehlalarm-Kennzeichnung darf nur die Disposition ändern.";
const MSG_EXPORT_STAFF_ONLY = "Export ist der Disposition/Administration vorbehalten.";

/** Spaltenzahl der CSV-Kopfzeile (EXPORT_HEADERS, incident-list-actions.ts:37-41). */
const EXPORT_COLUMN_COUNT = 16;
/** Die neue, additiv am ENDE angehaengte Spalte. */
const EXPORT_LAST_COLUMN = "Fehlalarm";

// --------------------------------------------------------------------------
// Synthetische Fixtures
// --------------------------------------------------------------------------

const PREFIX = "26a00000-";
/** Musterwert fuer die praefixbezogenen Zaehl- und Aufraeumanweisungen. */
const PREFIX_PATTERN = `${PREFIX}%`;

const ID = {
  // Identitaeten
  admin: `${PREFIX}0000-0000-0000-000000000001`,
  dispo: `${PREFIX}0000-0000-0000-000000000002`,
  monteur: `${PREFIX}0000-0000-0000-000000000003`,
  // Stammdaten. ZWEI Bauabschnitte: der zweite traegt ausschliesslich die
  // Vollmenge aus L10/L11 und macht die Filterung `stage_id` dort trennscharf.
  stageSmall: `${PREFIX}0000-0000-0000-0000000000a1`,
  stageBulk: `${PREFIX}0000-0000-0000-0000000000a2`,
  lineSmall: `${PREFIX}0000-0000-0000-0000000000a3`,
  lineBulkA: `${PREFIX}0000-0000-0000-0000000000a4`,
  lineBulkB: `${PREFIX}0000-0000-0000-0000000000a5`,
  customer: `${PREFIX}0000-0000-0000-0000000000a6`,
  // Vorgaenge des kleinen Bauabschnitts
  incToggle: `${PREFIX}0000-0000-0000-0000000000b1`,
  incAdmin: `${PREFIX}0000-0000-0000-0000000000b2`,
  incMonteur: `${PREFIX}0000-0000-0000-0000000000b3`,
  incFlagged: `${PREFIX}0000-0000-0000-0000000000b4`,
  incNoSession: `${PREFIX}0000-0000-0000-0000000000b5`,
  // AP15B/RC1 Schritt 3: eigener Vorgang fuer L13 (setFalseAlarm end-to-end),
  // damit kein bestehender Fall (z. B. L1 ueber incToggle) mitgenutzt und
  // seine Ausgangslage riskiert wird.
  incAction: `${PREFIX}0000-0000-0000-0000000000b6`,
  // Aktive Zuweisung des Monteurs auf incMonteur
  assignment: `${PREFIX}0000-0000-0000-0000000000c1`,
  // Gueltige, aber ABSICHTLICH nicht angelegte Kennung (L5).
  unknown: `${PREFIX}0000-0000-0000-0000000000ff`,
};

/**
 * Platzhalter aus Migration 0012: absichtlich kein anmeldefaehiger Hash.
 *
 * Begruendung uebernommen aus ap15-dashboard-metrics.int.mjs:156-168:
 * usableAdminCount() in ap14b-platform.int.mjs und das Bootstrap-Gate in
 * scripts/bootstrap-admin.mjs zaehlen jedes aktive Admin-Profil, dessen
 * password_hash auf '$argon2id$' passt. Ein solcher Wert liesse deren
 * Bootstrap-Faelle scheitern. Dieser Test braucht keinen Hash: die Identitaet
 * kommt aus setSession(), und von auth_accounts wird nur der Fremdschluessel auf
 * die id gebraucht (0012 hat public.profiles.id darauf umgehaengt).
 * Diesen Wert NICHT auf einen '$argon2id$'-Wert aendern.
 */
const ACCOUNT_MARKER = "!MIGRATED-ACCOUNT-REQUIRES-RESET!";

// `sid` ist nur der Formtreue wegen gesetzt: die Fachmodule benutzen aus
// SessionProfile ausschliesslich userId und role. Es gibt zu diesen Kennungen
// bewusst KEINE Zeile in public.auth_sessions - eine echte Sitzung entsteht in
// diesem Test nicht.
const ADMIN = {
  id: ID.admin,
  sid: `${PREFIX}0000-0000-0000-00000000d101`,
  email: "w26.admin@beispiel.invalid",
  name: "W26 Administrator",
  role: "admin",
};
const DISPO = {
  id: ID.dispo,
  sid: `${PREFIX}0000-0000-0000-00000000d102`,
  email: "w26.dispo@beispiel.invalid",
  name: "W26 Disposition",
  role: "disponent",
};
/** Aktiv zugewiesen an ID.incMonteur - zeilenberechtigt, aber nicht spaltenberechtigt. */
const MONTEUR = {
  id: ID.monteur,
  sid: `${PREFIX}0000-0000-0000-00000000d103`,
  email: "w26.monteur@beispiel.invalid",
  name: "W26 Monteur",
  role: "monteur",
};
const PEOPLE = [ADMIN, DISPO, MONTEUR];
const PERSON_IDS = PEOPLE.map((person) => person.id);

/**
 * Die fuenf Vorgaenge des kleinen Bauabschnitts.
 *
 * `status` wird unmittelbar in der insert-Anweisung gesetzt. Das ist zulaessig
 * und braucht keinen Umweg: der Statuswaechter `tg_incident_guard` ist
 * ausschliesslich `before update on public.incidents` (0001_init.sql:415-417).
 *
 * is_false_alarm wird von KEINEM Fixture-Insert genannt. Das ist Pflicht: der
 * Waechter tg_incident_guard_false_alarm deckt auch INSERT ab, und im
 * Eigentuemerkontext liefert public.current_user_role() NULL - eine Anlage MIT
 * Kennzeichnung waere hier mit 42501 abgewiesen (0018:186-188). Der einzige Weg
 * zu `true` ist deshalb der ECHTE Anwendungspfad als Disponent, und genau das
 * ist erwuenscht.
 *
 * NOT NULL ist in public.incidents heute ausschliesslich
 * construction_stage_id (0001_init.sql:185). vzg_line_number und km_from waren
 * es in 0001_init.sql:186-187 auch, sind es aber seit
 * 0008_ap10_incident_master_data.sql:25-26 nicht mehr - dort werden beide
 * NOT-NULL-Bedingungen ausdruecklich aufgehoben. Diese Suite setzt sie
 * trotzdem, damit historic_vzg und der abgeleitete Aufgabenpfad
 * deterministisch bleiben. customer_id ist ebenfalls nullable
 * (0008_ap10_incident_master_data.sql:22) und wird gesetzt, damit die
 * CSV-Spalte "Kunde" in L6 nicht leer bleibt.
 */
const SMALL_INCIDENTS = [
  { key: "L-TOGGLE", id: ID.incToggle, km: 26.101 },
  { key: "L-ADMIN", id: ID.incAdmin, km: 26.102 },
  { key: "L-MONTEUR", id: ID.incMonteur, km: 26.103 },
  { key: "L-FLAGGED", id: ID.incFlagged, km: 26.104 },
  { key: "L-NOSESSION", id: ID.incNoSession, km: 26.105 },
  { key: "L-ACTION", id: ID.incAction, km: 26.106 },
];

/**
 * Kennungen der Vollmenge: 26a00000-0000-0000-0002-<12 Hex>.
 *
 * Die vierte Gruppe ist '0002' und damit von allen Einzelfixtures ('0000')
 * unterschieden; der Praefix 26a00000- bleibt erhalten, sodass die Aufraeum- und
 * Zaehlanweisungen sie mit erfassen.
 */
const BULK_ID_PREFIX = `${PREFIX}0000-0000-0002-`;

let admin;

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

/** IncidentListQuery mit leerer Sortierung (orderBy setzt die Standardordnung). */
function queryFor(filters, pageSize = 50) {
  return { filters, sort: [], page: 1, pageSize };
}

/** Gespeicherter Wert der Kennzeichnung - Gegenprobe ueber die ADMIN-Verbindung. */
async function readFlag(id) {
  const result = await admin.query(
    `select is_false_alarm from public.incidents where id = $1::uuid`,
    [id],
  );
  return result.rows[0]?.is_false_alarm ?? null;
}

/**
 * Kennzeichnung UND Aenderungszeitpunkt - fuer die Faelle, die "keine Wirkung"
 * behaupten. `updated_at::text` erhaelt die Mikrosekunden; jede wirksame
 * Anweisung wuerde ihn ueber trg_touch_incidents (0001_init.sql:449-450)
 * veraendern.
 */
async function readRowState(id) {
  const result = await admin.query(
    `select is_false_alarm, updated_at::text as updated_at
       from public.incidents where id = $1::uuid`,
    [id],
  );
  return result.rows[0] ?? null;
}

/** Vorgangsnummer als Text (bigint) - Anker der CSV-Zeilensuche in L6. */
async function readIncidentNo(id) {
  const result = await admin.query(
    `select incident_no::text as incident_no from public.incidents where id = $1::uuid`,
    [id],
  );
  return result.rows[0]?.incident_no ?? null;
}

/**
 * Bringt die Kennzeichnung ueber den ECHTEN Anwendungspfad auf einen Wert.
 *
 * Bewusst kein UPDATE ueber die ADMIN-Verbindung: dort wuerde der Waechter die
 * Anweisung mit 42501 abweisen (current_user_role() ist NULL). Der Aufruf laeuft
 * deshalb als Disponent durch `setIncidentFalseAlarm()` und macht jeden Fall
 * unabhaengig von der Reihenfolge der uebrigen Faelle.
 */
async function ensureFlag(id, value, label) {
  setSession(sessionFor(DISPO));
  const result = await setIncidentFalseAlarm(id, value);
  assert.deepEqual(
    result,
    { ok: true, error: null },
    `${label}: die Ausgangslage (is_false_alarm = ${value}) liess sich nicht herstellen`,
  );
  assert.equal(
    await readFlag(id),
    value,
    `${label}: die Ausgangslage (is_false_alarm = ${value}) ist nicht gespeichert`,
  );
}

async function countBy(sql, values) {
  const result = await admin.query(sql, values);
  return result.rows[0].rows;
}

// --------------------------------------------------------------------------
// Fixtures ueber die ADMIN-Verbindung (Eigentuemerrolle; RLS gilt fuer den
// Eigentuemer nicht - genau darum laufen ALLE Pruefungen ueber die
// Anwendungsverbindung).
//
// Jedes Profil braucht ein Auth-Konto, weil 0012 den Fremdschluessel
// public.profiles.id von auth.users auf public.auth_accounts umgehaengt hat
// (0012_ap14b_platform_auth.sql:230-278; dieselbe Schleife haengt die uebrigen
// Actor-Spalten auf public.profiles um).
//
// `on conflict ... do nothing` haelt die Fixtures wiederholbar, ohne fremde
// Zeilen zu beruehren - und ohne die Vorgaenge eines vorherigen Laufs zu
// veraendern, die nach der Loeschsperre stehen bleiben (siehe Dateikopf).
// --------------------------------------------------------------------------

/**
 * Die Vollmenge in EINEM Bulk-INSERT.
 *
 * Verbindliche Leistungsvorgabe: EIN `insert ... select from generate_series`,
 * kein zeilenweiser Aufbau. Jeder Vorgang loest ueber
 * trg_sync_tasks_incidents (0011:267-269) abgeleitete Aufgaben aus - bei
 * gesetztem vzg_line_id sind es drei (no_monteur, no_images, no_cable;
 * 0011:200-206). Ein zeilenweiser Aufbau waere um Groessenordnungen langsamer.
 *
 * Die Menge ist in zwei Gruppen geteilt, damit BEIDE Seiten der Obergrenze mit
 * einem Filter aus der bestehenden Allow-List adressierbar sind:
 *   * Gruppe A: genau INCIDENT_FULL_EXPORT_CAP Zeilen, vzg_line_id = lineBulkA;
 *   * Gruppe B: eine einzige weitere Zeile, vzg_line_id = lineBulkB.
 * `stage_id` allein trifft damit CAP + 1 Zeilen, `stage_id` zusammen mit
 * `vzg_line_id` genau CAP.
 *
 * km_from ist fuer alle Zeilen gleich (kein Unique-Index auf der Spalte) und
 * bleibt sicher innerhalb von numeric(7,3) (0001_init.sql:187).
 */
const BULK_INSERT = `
  insert into public.incidents
    (id, customer_id, construction_stage_id, vzg_line_id, vzg_line_number,
     km_from, status, description)
  select
    ($1::text || lpad(to_hex(g), 12, '0'))::uuid,
    $2::uuid,
    $3::uuid,
    case when g <= $6::int then $4::uuid else $5::uuid end,
    case when g <= $6::int then '2601' else '2602' end,
    26.900,
    'neu'::public.incident_status,
    'AP15-b Vollmengengrenze - synthetische Zeile ' || g
  from generate_series(1, $6::int + 1) as g
  on conflict (id) do nothing`;

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

  // public.construction_stages.code ist eindeutig (0001_init.sql:116); 'W26L'
  // und 'W26M' kommen in keiner anderen Test- oder Migrationsdatei vor.
  await admin.query(
    `insert into public.construction_stages (id, code, name)
     values ($1::uuid, 'W26L', 'W26 Bauabschnitt Fehlalarm und Export'),
            ($2::uuid, 'W26M', 'W26 Bauabschnitt Vollmengengrenze')
     on conflict (id) do nothing`,
    [ID.stageSmall, ID.stageBulk],
  );

  await admin.query(
    `insert into public.customers (id, name)
     values ($1::uuid, 'W26 Kunde AP15-b')
     on conflict (id) do nothing`,
    [ID.customer],
  );

  // line_number muss genau vier Ziffern tragen und ist je Bauabschnitt
  // eindeutig (0007_ap9_master_data.sql:63-64). Die VzG-Strecke wird gesetzt,
  // damit die abgeleitete Aufgabe historic_vzg nicht entsteht (0011:195).
  await admin.query(
    `insert into public.vzg_lines (id, line_number, construction_stage_id)
     values ($1::uuid, '2600', $4::uuid),
            ($2::uuid, '2601', $5::uuid),
            ($3::uuid, '2602', $5::uuid)
     on conflict (id) do nothing`,
    [ID.lineSmall, ID.lineBulkA, ID.lineBulkB, ID.stageSmall, ID.stageBulk],
  );

  for (const incident of SMALL_INCIDENTS) {
    await admin.query(
      `insert into public.incidents
         (id, customer_id, construction_stage_id, vzg_line_id, vzg_line_number,
          km_from, status, description)
       values ($1::uuid, $2::uuid, $3::uuid, $4::uuid, '2600', $5::numeric,
               'neu'::public.incident_status, $6::text)
       on conflict (id) do nothing`,
      [
        incident.id,
        ID.customer,
        ID.stageSmall,
        ID.lineSmall,
        incident.km,
        `AP15-b Anwendungspfad - Vorgang ${incident.key}`,
      ],
    );
  }

  // Aktive Zuweisung: erst sie macht den Monteur ueber incidents_update
  // zeilenberechtigt (0001_init.sql:544-546 ueber is_assigned_to_incident(),
  // 0001_init.sql:67-76). Ohne sie wuerde L3 eine Ablehnung der Policy statt der
  // Ablehnung des Waechters messen.
  await admin.query(
    `insert into public.incident_assignments (id, incident_id, monteur_id, is_active)
     values ($1::uuid, $2::uuid, $3::uuid, true)
     on conflict (id) do nothing`,
    [ID.assignment, ID.incMonteur, ID.monteur],
  );

  const started = Date.now();
  await admin.query(BULK_INSERT, [
    BULK_ID_PREFIX,
    ID.customer,
    ID.stageBulk,
    ID.lineBulkA,
    ID.lineBulkB,
    INCIDENT_FULL_EXPORT_CAP,
  ]);
  const seconds = ((Date.now() - started) / 1000).toFixed(1);

  // Gegenprobe der Ausgangslage: ohne exakt diese Zahlen haetten L10 und L11
  // keine Grundlage, und ein Rest eines abgebrochenen Vorlaufs waere hier
  // sichtbar.
  const bulkTotal = await countBy(
    `select count(*)::integer as rows from public.incidents
      where construction_stage_id = $1::uuid`,
    [ID.stageBulk],
  );
  const bulkGroupA = await countBy(
    `select count(*)::integer as rows from public.incidents
      where construction_stage_id = $1::uuid and vzg_line_id = $2::uuid`,
    [ID.stageBulk, ID.lineBulkA],
  );
  assert.equal(
    bulkTotal,
    INCIDENT_FULL_EXPORT_CAP + 1,
    "Fixtures: der Bauabschnitt der Vollmenge traegt nicht genau INCIDENT_FULL_EXPORT_CAP + 1 Vorgaenge",
  );
  assert.equal(
    bulkGroupA,
    INCIDENT_FULL_EXPORT_CAP,
    "Fixtures: Gruppe A der Vollmenge traegt nicht genau INCIDENT_FULL_EXPORT_CAP Vorgaenge",
  );

  const smallTotal = await countBy(
    `select count(*)::integer as rows from public.incidents
      where construction_stage_id = $1::uuid`,
    [ID.stageSmall],
  );
  assert.equal(
    smallTotal,
    SMALL_INCIDENTS.length,
    "Fixtures: der kleine Bauabschnitt traegt nicht genau die eigenen Vorgaenge",
  );

  console.log(
    `AP15-b Fixtures: ${bulkTotal} Vorgaenge der Vollmenge in einem Bulk-INSERT ` +
      `(${seconds} s) und ${smallTotal} Vorgaenge des kleinen Bauabschnitts stehen bereit.`,
  );
}

/**
 * Aufraeumen in fremdschluesselsicherer Reihenfolge.
 *
 * Reihenfolge und Begruendung (uebernommen aus
 * ap15-dashboard-metrics.int.mjs:409-437, nur auf den Praefix statt auf
 * Kennungslisten bezogen - die Vollmenge macht Listen mit 20001 Kennungen
 * unpraktisch):
 *   a) audit_events der eigenen Kennungen. `tg_audit` (0001_init.sql:89-97)
 *      schreibt die ZEILEN-id als entity_id; die Aufgabenzeilen tragen eine
 *      vergebene Kennung ohne eigenen Praefix und werden deshalb ueber ihren
 *      incident_id-Bezug gefunden.
 *   b) profiles-Verweise der BLEIBENDEN Zeilen loesen. public.incidents
 *      (created_by, updated_by, closed_by, call_taken_by) und
 *      public.incident_tasks (created_by/updated_by, assignee_profile_id,
 *      acknowledged_by) zeigen nach 0012 auf public.profiles. Alle Spalten sind
 *      nullable. Ohne dieses Loesen scheitert (e) am Fremdschluessel. Die
 *      `where`-Bedingung haelt die Anweisung im Regelfall auf die wenigen
 *      Zeilen begrenzt, die der Anwendungspfad tatsaechlich angefasst hat: die
 *      Fixtures schreiben ohne gesetzte Identitaet, `app.current_user_id()`
 *      liefert dann NULL (0012:9-26).
 *   c) incident_status_history je Vorgang (vom Chroniktrigger erzeugt).
 *   d) incident_assignments je Vorgang.
 *   e) profiles - erst jetzt zeigt keine bleibende Zeile mehr auf sie.
 *   f) auth_accounts - nach den Profilen, weil profiles.id auf sie verweist.
 *   g) audit_events ein ZWEITES Mal. Die Loeschungen in (b), (c) und (d)
 *      erzeugen selbst neue Auditsaetze: trg_audit_incidents
 *      (0001_init.sql:455-457), trg_audit_assignments (0001_init.sql:458-460)
 *      und - ueber trg_sync_tasks_assignments (0011:271-273) -
 *      trg_audit_incident_tasks (0011:109-111).
 *
 * NICHT geloescht werden public.incidents, public.incident_tasks,
 * public.construction_stages, public.vzg_lines und public.customers -
 * Begruendung mit Belegstellen im Dateikopf (0011:28, 0011:113-123, identisch
 * entschieden in 20_ap14b_data.sql:28-43). Es wird dafuer KEIN Trigger
 * abgeschaltet und KEIN Recht geaendert.
 */
async function tearDownFixtures() {
  await deleteOwnAuditEvents();

  await admin.query(
    `update public.incidents
        set created_by = null, updated_by = null, closed_by = null, call_taken_by = null
      where id::text like $1
        and (created_by is not null or updated_by is not null
             or closed_by is not null or call_taken_by is not null)`,
    [PREFIX_PATTERN],
  );
  await admin.query(
    `update public.incident_tasks
        set created_by = null, updated_by = null, assignee_profile_id = null
      where incident_id::text like $1
        and (created_by is not null or updated_by is not null
             or assignee_profile_id is not null)`,
    [PREFIX_PATTERN],
  );
  // `acknowledged_by` getrennt und nur fuer nicht quittierte Aufgaben: bei
  // status = 'acknowledged' muessen acknowledged_at UND acknowledged_by gesetzt
  // sein (Kohaerenz-Constraint 0011:69-76). Eine abgeleitete Fixture-Aufgabe
  // wird in diesem Test nie quittiert; bliebe eine solche Zeile doch stehen,
  // scheitert (e) sichtbar am Fremdschluessel statt still etwas zu verbiegen.
  await admin.query(
    `update public.incident_tasks
        set acknowledged_by = null
      where incident_id::text like $1
        and acknowledged_by is not null
        and status <> 'acknowledged'`,
    [PREFIX_PATTERN],
  );

  await admin.query(
    `delete from public.incident_status_history where incident_id::text like $1`,
    [PREFIX_PATTERN],
  );
  await admin.query(
    `delete from public.incident_assignments where incident_id::text like $1`,
    [PREFIX_PATTERN],
  );
  await admin.query(`delete from public.profiles where id = any($1::uuid[])`, [PERSON_IDS]);
  await admin.query(`delete from public.auth_accounts where id = any($1::uuid[])`, [PERSON_IDS]);

  await deleteOwnAuditEvents();
}

/** Auditsaetze der eigenen Kennungen und der Aufgaben der eigenen Vorgaenge. */
async function deleteOwnAuditEvents() {
  await admin.query(
    `delete from public.audit_events
      where actor::text like $1
         or entity_id::text like $1
         or (entity = 'incident_tasks'
             and entity_id in (
               select id from public.incident_tasks where incident_id::text like $1
             ))`,
    [PREFIX_PATTERN],
  );
}

// --------------------------------------------------------------------------
// Zaehlende Gegenproben des Aufraeumens
// --------------------------------------------------------------------------

const COUNT_AUDIT = `select count(*)::integer as rows
                       from public.audit_events
                      where actor::text like $1
                         or entity_id::text like $1
                         or (entity = 'incident_tasks'
                             and entity_id in (
                               select id from public.incident_tasks
                                where incident_id::text like $1
                             ))`;
const COUNT_HISTORY = `select count(*)::integer as rows
                         from public.incident_status_history
                        where incident_id::text like $1`;
const COUNT_ASSIGNMENTS = `select count(*)::integer as rows
                             from public.incident_assignments
                            where incident_id::text like $1`;
const COUNT_PROFILES = `select count(*)::integer as rows
                          from public.profiles where id = any($1::uuid[])`;
const COUNT_ACCOUNTS = `select count(*)::integer as rows
                          from public.auth_accounts where id = any($1::uuid[])`;
// Gegenprobe zu Schritt (b): keine bleibende Zeile verweist mehr auf ein
// eigenes Profil.
const COUNT_INCIDENT_REFS = `select count(*)::integer as rows
                               from public.incidents
                              where id::text like $1
                                and (created_by is not null or updated_by is not null
                                     or closed_by is not null or call_taken_by is not null)`;
const COUNT_TASK_REFS = `select count(*)::integer as rows
                           from public.incident_tasks
                          where incident_id::text like $1
                            and (created_by is not null or updated_by is not null
                                 or assignee_profile_id is not null
                                 or acknowledged_by is not null)`;
// Nicht leerbar - wird ausschliesslich BERICHTET, nicht zugesichert.
const COUNT_INCIDENTS = `select count(*)::integer as rows
                           from public.incidents where id::text like $1`;
const COUNT_TASKS = `select count(*)::integer as rows
                       from public.incident_tasks where incident_id::text like $1`;
const COUNT_STAGES = `select count(*)::integer as rows
                        from public.construction_stages where id::text like $1`;
const COUNT_LINES = `select count(*)::integer as rows
                       from public.vzg_lines where id::text like $1`;
const COUNT_CUSTOMERS = `select count(*)::integer as rows
                           from public.customers where id::text like $1`;

// --------------------------------------------------------------------------

test.before(async () => {
  if (!ENABLED) return;
  admin = new Client({ connectionString: ADMIN_URL });
  await admin.connect();
  // Erst aufraeumen, dann anlegen: ein abgebrochener Vorlauf darf die
  // Ausgangslage nicht verbrauchen.
  await tearDownFixtures();
  await setUpFixtures();
});

test.after(async () => {
  if (!ENABLED) return;
  await tearDownFixtures();

  // Zaehlende Gegenprobe ueber genau die Tabellen, die geleert werden konnten.
  const remaining = [
    ["audit_events", await countBy(COUNT_AUDIT, [PREFIX_PATTERN])],
    ["incident_status_history", await countBy(COUNT_HISTORY, [PREFIX_PATTERN])],
    ["incident_assignments", await countBy(COUNT_ASSIGNMENTS, [PREFIX_PATTERN])],
    ["profiles", await countBy(COUNT_PROFILES, [PERSON_IDS])],
    ["auth_accounts", await countBy(COUNT_ACCOUNTS, [PERSON_IDS])],
    ["incidents.profil-verweise", await countBy(COUNT_INCIDENT_REFS, [PREFIX_PATTERN])],
    ["incident_tasks.profil-verweise", await countBy(COUNT_TASK_REFS, [PREFIX_PATTERN])],
  ];
  const leftovers = remaining.filter(([, rows]) => rows > 0);

  // AUFRAEUMBILANZ der nicht leerbaren Tabellen: nur berichtet, KEIN assert.
  // Begruendung im Dateikopf (0011:28, 0011:113-123, 20_ap14b_data.sql:28-43).
  // Die Zeilen verschwinden mit der Testdatenbank.
  const stillThere = {
    incidents: await countBy(COUNT_INCIDENTS, [PREFIX_PATTERN]),
    incident_tasks: await countBy(COUNT_TASKS, [PREFIX_PATTERN]),
    construction_stages: await countBy(COUNT_STAGES, [PREFIX_PATTERN]),
    vzg_lines: await countBy(COUNT_LINES, [PREFIX_PATTERN]),
    customers: await countBy(COUNT_CUSTOMERS, [PREFIX_PATTERN]),
  };
  console.log(
    `AUFRAEUMBILANZ AP15-b: nicht leerbar wegen trg_incident_tasks_no_delete - ` +
      `public.incidents ${stillThere.incidents}, ` +
      `public.incident_tasks ${stillThere.incident_tasks}, ` +
      `public.construction_stages ${stillThere.construction_stages}, ` +
      `public.vzg_lines ${stillThere.vzg_lines}, ` +
      `public.customers ${stillThere.customers} ` +
      `Zeile(n) mit dem Praefix ${PREFIX}; sie entfallen mit der Testdatenbank.`,
  );

  await admin.end();
  // Der Pool in src/lib/db exportiert bewusst keine Verbindung und auch keinen
  // Abschluss. Fuer das Ende des Testprozesses wird der modulprivate Anker
  // benutzt; ein offener Client liesse den Testlauf haengen.
  await globalThis.__kabelbereitschaftPool?.end();

  if (leftovers.length > 0) {
    assert.fail(
      `Aufraeumen unvollstaendig: ${leftovers
        .map(([table, rows]) => `${table} ${rows} Zeile(n)`)
        .join(", ")} mit dem Praefix ${PREFIX}`,
    );
  }
});

const options = {
  skip: ENABLED ? false : "AP14B_APP_DATABASE_URL/AP14B_ADMIN_DATABASE_URL fehlen",
};

// ==========================================================================
// A) setIncidentFalseAlarm() - der Waechter durch den ECHTEN Anwendungspfad
// ==========================================================================

test("L1 Disponent: setIncidentFalseAlarm setzt true und nimmt es zurueck", options, async () => {
  await ensureFlag(ID.incToggle, false, "L1");

  setSession(sessionFor(DISPO));
  const setTrue = await setIncidentFalseAlarm(ID.incToggle, true);
  assert.deepEqual(setTrue, { ok: true, error: null }, "L1: der Disponent wurde abgewiesen");
  assert.equal(
    await readFlag(ID.incToggle),
    true,
    "L1: der gespeicherte Wert ist nach dem Setzen nicht true",
  );

  // Die Regel ist keine Einbahnstrasse: der Disponent darf die Kennzeichnung
  // auch zuruecknehmen.
  const setFalse = await setIncidentFalseAlarm(ID.incToggle, false);
  assert.deepEqual(setFalse, { ok: true, error: null }, "L1: das Zuruecknehmen wurde abgewiesen");
  assert.equal(
    await readFlag(ID.incToggle),
    false,
    "L1: der gespeicherte Wert ist nach dem Zuruecknehmen nicht false",
  );
});

test("L2 Administrator: setIncidentFalseAlarm wird mit der 42501-Meldung abgewiesen", options, async () => {
  // Die Ablehnung kann NICHT aus der Policy stammen: incidents_update erlaubt
  // is_staff() das UPDATE der Zeile (0001_init.sql:544-546). Sie stammt aus dem
  // spaltenscharfen Waechter tg_incident_guard_false_alarm (0018, Abschnitt 2),
  // und src/lib/incidents.ts:970-971 bildet dessen SQLSTATE 42501 auf die hier
  // erwartete Meldung ab. Damit ist der Waechter durch den ECHTEN
  // Anwendungspfad belegt - nicht nur in SQL.
  await ensureFlag(ID.incAdmin, false, "L2");

  setSession(sessionFor(ADMIN));
  const result = await setIncidentFalseAlarm(ID.incAdmin, true);
  assert.equal(result.ok, false, "L2: der Administrator durfte die Kennzeichnung setzen");
  assert.equal(result.error, MSG_FALSE_ALARM_FORBIDDEN, "L2: abweichende Meldung");
  assert.equal(
    await readFlag(ID.incAdmin),
    false,
    "L2: der gespeicherte Wert wurde trotz Ablehnung veraendert",
  );
});

test("L3 zugewiesener Monteur: setIncidentFalseAlarm wird abgewiesen", options, async () => {
  // Der Monteur ist AKTIV zugewiesen und damit zeilenberechtigt
  // (is_assigned_to_incident(), 0001_init.sql:67-76). tg_incident_guard laesst
  // ihn passieren, weil weder Status noch Abschluss- noch Stammfelder beruehrt
  // werden (0001_init.sql:394-414); abgewiesen wird erst der Fehlalarm-Waechter.
  await ensureFlag(ID.incMonteur, false, "L3");

  setSession(sessionFor(MONTEUR));
  const result = await setIncidentFalseAlarm(ID.incMonteur, true);
  assert.equal(result.ok, false, "L3: der zugewiesene Monteur durfte die Kennzeichnung setzen");
  assert.equal(result.error, MSG_FALSE_ALARM_FORBIDDEN, "L3: abweichende Meldung");
  assert.equal(
    await readFlag(ID.incMonteur),
    false,
    "L3: der gespeicherte Wert wurde trotz Ablehnung veraendert",
  );
});

test("L4 ohne Sitzung: nicht gefunden und keine Wirkung auf die Zeile", options, async () => {
  await ensureFlag(ID.incNoSession, false, "L4");

  const before = await readRowState(ID.incNoSession);
  assert.ok(before, "L4: die Fixturezeile fehlt");

  clearSession();
  const result = await setIncidentFalseAlarm(ID.incNoSession, true);
  assert.equal(result.ok, false, "L4: ohne Sitzung wurde geschrieben");
  // Ohne Identitaet sah die RLS bisher keinen Vorgang; die Meldung ist deshalb
  // dieselbe wie bei einem unbekannten Vorgang (src/lib/incidents.ts:951-952).
  assert.equal(result.error, MSG_NOT_FOUND, "L4: abweichende Meldung");

  const after = await readRowState(ID.incNoSession);
  assert.deepEqual(
    after,
    before,
    "L4: Kennzeichnung oder updated_at haben sich geaendert - es gab einen Zugriff mit Wirkung",
  );
});

test("L5 unbrauchbare und unbekannte Kennung: nicht gefunden, keine Ausnahme", options, async () => {
  setSession(sessionFor(DISPO));

  // Faellt hier eine Ausnahme, scheitert der Fall sichtbar - genau das ist die
  // Aussage. `isUuid()` bricht vor dem Verbindungsaufbau ab
  // (src/lib/incidents.ts:951-952, src/lib/db/index.ts:55-57).
  const broken = await setIncidentFalseAlarm("kein-uuid-wert-26a", true);
  assert.deepEqual(
    broken,
    { ok: false, error: MSG_NOT_FOUND },
    "L5: eine unbrauchbare Kennung ergibt nicht die Meldung 'nicht gefunden'",
  );

  // Gueltige Form, aber absichtlich nicht angelegt: das UPDATE trifft keine
  // Zeile, `returning id` bleibt leer.
  const unknown = await setIncidentFalseAlarm(ID.unknown, true);
  assert.deepEqual(
    unknown,
    { ok: false, error: MSG_NOT_FOUND },
    "L5: eine unbekannte UUID ergibt nicht die Meldung 'nicht gefunden'",
  );
  const created = await countBy(
    `select count(*)::integer as rows from public.incidents where id = $1::uuid`,
    [ID.unknown],
  );
  assert.equal(created, 0, "L5: die unbekannte Kennung hat eine Zeile erzeugt");
});

// ==========================================================================
// B) exportIncidentListFull() - Vollmengen-Export und die additive Spalte
// ==========================================================================

test("L6 Disponent: exportIncidentListFull liefert BOM, 16 Spalten und Fehlalarm Ja/Nein", options, async () => {
  // Die Kennzeichnung wird ueber den ECHTEN Anwendungspfad gesetzt (im
  // Eigentuemerkontext waere sie mit 42501 abgewiesen, 0018:186-188).
  await ensureFlag(ID.incFlagged, true, "L6");
  await ensureFlag(ID.incToggle, false, "L6");

  const flaggedNo = await readIncidentNo(ID.incFlagged);
  const plainNo = await readIncidentNo(ID.incToggle);
  assert.ok(flaggedNo && plainNo, "L6: die Vorgangsnummern der Fixtures fehlen");

  setSession(sessionFor(DISPO));
  const result = await exportIncidentListFull(queryFor({ stage_id: ID.stageSmall }));
  assert.equal(result.error, null, "L6: der Disponent wurde beim Export abgewiesen");
  assert.equal(result.capped, false, "L6: die kleine Menge gilt als gekappt");
  assert.equal(
    result.count,
    SMALL_INCIDENTS.length,
    "L6: die Zeilenzahl entspricht nicht den eigenen Fixtures",
  );

  // Das BOM stammt aus src/lib/csv.ts (CSV_BOM) und wird nicht nachgebildet.
  assert.ok(result.csv.startsWith(CSV_BOM), "L6: die CSV beginnt nicht mit dem BOM aus csv.ts");

  // Die Kopfzeile wird NICHT gegen eine eigene Literalliste gestellt: geprueft
  // werden Anzahl und letzter Name gegen die TATSAECHLICHE Ausgabe. buildCsv
  // trennt Zeilen mit CRLF (src/lib/csv.ts:23-27).
  const lines = result.csv.slice(CSV_BOM.length).split("\r\n");
  const header = lines[0].split(";");
  assert.equal(
    header.length,
    EXPORT_COLUMN_COUNT,
    `L6: die Kopfzeile hat ${header.length} statt ${EXPORT_COLUMN_COUNT} Spalten`,
  );
  assert.equal(
    header[header.length - 1],
    EXPORT_LAST_COLUMN,
    "L6: die letzte Spalte heisst nicht Fehlalarm",
  );

  // Ein einfaches Aufteilen der Datenzeile genuegt hier: kein Fixture-Wert
  // enthaelt ein Semikolon, ein Anfuehrungszeichen oder einen Zeilenumbruch,
  // csvCell() setzt also keine Anfuehrungszeichen (src/lib/csv.ts:14-21).
  const dataLine = (no, label) => {
    const line = lines.slice(1).find((candidate) => candidate.startsWith(`${no};`));
    assert.ok(line, `L6: die CSV-Zeile des Vorgangs ${label} fehlt`);
    const cells = line.split(";");
    assert.equal(
      cells.length,
      header.length,
      `L6: die CSV-Zeile des Vorgangs ${label} hat ${cells.length} statt ${header.length} Felder`,
    );
    return cells;
  };

  assert.equal(
    dataLine(flaggedNo, "L-FLAGGED").at(-1),
    "Ja",
    "L6: der gekennzeichnete Vorgang traegt in der Spalte Fehlalarm nicht Ja",
  );
  assert.equal(
    dataLine(plainNo, "L-TOGGLE").at(-1),
    "Nein",
    "L6: der nicht gekennzeichnete Vorgang traegt in der Spalte Fehlalarm nicht Nein",
  );
});

test("L7 Administrator: exportIncidentListFull ist erlaubt (Ist-Zustand)", options, async () => {
  // IST-ZUSTAND DES CODES, hier ausdruecklich als solcher festgehalten und
  // nicht als fachliche Zusage: die Rollenpruefung in
  // src/lib/incident-list-actions.ts:92 schliesst ausschliesslich `monteur`
  // aus (`!session || session.role === "monteur"`). Der Administrator darf
  // daher exportieren, obwohl er die Kennzeichnung selbst nicht setzen darf
  // (L2). Ob das so bleiben soll, ist eine fachliche Entscheidung und nicht
  // Gegenstand dieses Tests.
  setSession(sessionFor(ADMIN));
  const result = await exportIncidentListFull(queryFor({ stage_id: ID.stageSmall }));
  assert.equal(result.error, null, "L7: der Administrator wurde beim Export abgewiesen");
  assert.equal(
    result.count,
    SMALL_INCIDENTS.length,
    "L7: die Zeilenzahl entspricht nicht den eigenen Fixtures",
  );
  assert.ok(result.csv.startsWith(CSV_BOM), "L7: die CSV beginnt nicht mit dem BOM aus csv.ts");
});

test("L8 Monteur: exportIncidentListFull liefert leere CSV und die Exportmeldung", options, async () => {
  setSession(sessionFor(MONTEUR));
  const result = await exportIncidentListFull(queryFor({ stage_id: ID.stageSmall }));
  assert.deepEqual(
    result,
    { csv: "", count: 0, capped: false, error: MSG_EXPORT_STAFF_ONLY },
    "L8: der Monteur erhaelt nicht die vollstaendige Absage aus incident-list-actions.ts",
  );
});

// ==========================================================================
// C) Der Fehlalarmfilter ist additiv
// ==========================================================================

test("L9 Fehlalarmfilter: true + false ergibt die Menge ohne Filter", options, async () => {
  await ensureFlag(ID.incFlagged, true, "L9");

  setSession(sessionFor(DISPO));
  // Alle drei Abfragen laufen ueber DIESELBE Identitaet und DENSELBEN
  // Bauabschnitt; sie beziehen sich damit auf dieselbe RLS-Sicht.
  const base = { stage_id: ID.stageSmall };
  const withFlag = await listIncidentsForFullExport(queryFor({ ...base, falseAlarm: true }));
  const withoutFlag = await listIncidentsForFullExport(queryFor({ ...base, falseAlarm: false }));
  const unfiltered = await listIncidentsForFullExport(queryFor({ ...base }));

  assert.ok(withFlag.total >= 1, "L9: kein gekennzeichneter Vorgang sichtbar - der Fall traf leer");
  assert.ok(
    withoutFlag.total >= 1,
    "L9: kein nicht gekennzeichneter Vorgang sichtbar - der Fall traf leer",
  );
  assert.equal(
    withFlag.total + withoutFlag.total,
    unfiltered.total,
    "L9: true + false ergibt nicht die Menge ohne Filter",
  );
  assert.equal(
    unfiltered.total,
    SMALL_INCIDENTS.length,
    "L9: die ungefilterte Menge entspricht nicht den eigenen Fixtures",
  );

  // Der Filter wirkt auf die Zeilen, nicht nur auf die Zahl.
  assert.ok(
    withFlag.rows.every((row) => row.is_false_alarm === true),
    "L9: die Menge mit falseAlarm = true enthaelt eine nicht gekennzeichnete Zeile",
  );
  assert.ok(
    withoutFlag.rows.every((row) => row.is_false_alarm === false),
    "L9: die Menge mit falseAlarm = false enthaelt eine gekennzeichnete Zeile",
  );
  assert.ok(
    withFlag.rows.some((row) => row.id === ID.incFlagged),
    "L9: der gekennzeichnete Vorgang fehlt in der Menge mit falseAlarm = true",
  );

  // Derselbe Filter auf dem interaktiven Weg: listIncidentsPaged() benutzt
  // dieselbe fetchList()-Bedingung und muss dieselben Gesamtzahlen liefern.
  const pagedWithFlag = await listIncidentsPaged(queryFor({ ...base, falseAlarm: true }));
  const pagedWithoutFlag = await listIncidentsPaged(queryFor({ ...base, falseAlarm: false }));
  const pagedUnfiltered = await listIncidentsPaged(queryFor({ ...base }));
  assert.equal(
    pagedWithFlag.total,
    withFlag.total,
    "L9: listIncidentsPaged zaehlt mit falseAlarm = true anders als listIncidentsForFullExport",
  );
  assert.equal(
    pagedWithoutFlag.total,
    withoutFlag.total,
    "L9: listIncidentsPaged zaehlt mit falseAlarm = false anders als listIncidentsForFullExport",
  );
  assert.equal(
    pagedWithFlag.total + pagedWithoutFlag.total,
    pagedUnfiltered.total,
    "L9: true + false ergibt auf dem interaktiven Weg nicht die Menge ohne Filter",
  );
});

// ==========================================================================
// D) Die Obergrenzen - der Kern des Vollmengen-Exports
// ==========================================================================

test("L10 Vollmengengrenze: genau CAP nicht gekappt, CAP + 1 gekappt", options, async () => {
  // Beide Seiten der Grenze auf DERSELBEN Fixturemenge, unterschieden allein
  // durch den zusaetzlichen Filter auf vzg_line_id. Die erwarteten Zahlen
  // stammen aus INCIDENT_FULL_EXPORT_CAP (src/lib/incident-list.ts:91) und
  // stehen NICHT als Literal in der Erwartung.
  setSession(sessionFor(DISPO));

  const exact = await listIncidentsForFullExport(
    queryFor({ stage_id: ID.stageBulk, vzg_line_id: ID.lineBulkA }),
  );
  assert.equal(
    exact.total,
    INCIDENT_FULL_EXPORT_CAP,
    "L10: die Treffermenge bei genau der Obergrenze stimmt nicht",
  );
  assert.equal(
    exact.rows.length,
    INCIDENT_FULL_EXPORT_CAP,
    "L10: bei genau der Obergrenze werden nicht alle Zeilen geliefert",
  );
  assert.equal(
    exact.capped,
    false,
    "L10: genau die Obergrenze gilt als gekappt - das waere ein Off-by-one",
  );

  const overflow = await listIncidentsForFullExport(queryFor({ stage_id: ID.stageBulk }));
  assert.equal(
    overflow.total,
    INCIDENT_FULL_EXPORT_CAP + 1,
    "L10: die Treffermenge oberhalb der Obergrenze stimmt nicht",
  );
  assert.equal(
    overflow.rows.length,
    INCIDENT_FULL_EXPORT_CAP,
    "L10: oberhalb der Obergrenze werden nicht genau CAP Zeilen geliefert",
  );
  assert.equal(
    overflow.capped,
    true,
    "L10: eine Zeile ueber der Obergrenze gilt nicht als gekappt",
  );
});

test("L11 die interaktive Grenze bleibt bei INCIDENT_EXPORT_CAP", options, async () => {
  // Nachweis, dass der Vollmengenpfad ADDITIV ist: auf DERSELBEN Menge, auf
  // der L10 20000 Zeilen liefert, liefert der interaktive Pfad unveraendert
  // INCIDENT_EXPORT_CAP Zeilen und meldet gekappt. Die 5000 sind in
  // 04-UI-UX/LISTENKONZEPT.md fachlich festgelegt.
  assert.ok(
    INCIDENT_EXPORT_CAP < INCIDENT_FULL_EXPORT_CAP,
    "L11: die interaktive Obergrenze ist nicht kleiner als die Vollmengengrenze",
  );

  setSession(sessionFor(DISPO));
  const interactive = await listIncidentsForExport(queryFor({ stage_id: ID.stageBulk }));
  assert.equal(
    interactive.rows.length,
    INCIDENT_EXPORT_CAP,
    "L11: der interaktive Export liefert nicht genau INCIDENT_EXPORT_CAP Zeilen",
  );
  assert.equal(
    interactive.total,
    INCIDENT_FULL_EXPORT_CAP + 1,
    "L11: der interaktive Export zaehlt eine andere Treffermenge",
  );
  assert.equal(interactive.capped, true, "L11: der interaktive Export meldet nicht gekappt");
});

// ==========================================================================
// E) Fail-closed Typpruefung von fetchList() gegen ECHTES PostgreSQL (AP15B/
// RC1 Schritt 1) - fuer alle drei lesenden Pfade.
// ==========================================================================

test(
  "L12 fail-closed Typpruefung: falseAlarm/q mit unbrauchbarem Typ ergibt 0 Zeilen, kein Wurf",
  options,
  async () => {
    setSession(sessionFor(DISPO));
    const base = { stage_id: ID.stageSmall };

    // Gueltige Vergleichsmessung je Pfad ZUERST: ohne einen Beweis von MEHR ALS
    // NULL Zeilen waere eine anschliessend leere Treffermenge kein Nachweis der
    // Typpruefung, sondern koennte ebenso gut ein falscher Filter sein.
    const pagedBaseline = await listIncidentsPaged(queryFor(base));
    assert.ok(pagedBaseline.total > 0, "L12: listIncidentsPaged liefert fuer die Vergleichsmessung 0 Zeilen");
    const exportBaseline = await listIncidentsForExport(queryFor(base));
    assert.ok(
      exportBaseline.total > 0,
      "L12: listIncidentsForExport liefert fuer die Vergleichsmessung 0 Zeilen",
    );
    const fullExportBaseline = await listIncidentsForFullExport(queryFor(base));
    assert.ok(
      fullExportBaseline.total > 0,
      "L12: listIncidentsForFullExport liefert fuer die Vergleichsmessung 0 Zeilen",
    );

    // Die drei unbrauchbaren Werte. Bewusst kein TypeScript-Zwang: diese Suite
    // ist JavaScript, die Werte werden hier per Absicht UNTYPISIERT eingesetzt -
    // genau der Fall, der aus einer Server-Action mit clientseitig manipulierter
    // Nutzlast entstehen kann (das IncidentListQuery, das ein Browser an
    // exportIncidentList()/exportIncidentListFull() sendet, ist ausserhalb von
    // TypeScript nicht gegen den Vertrag geprueft).
    const badFilters = [
      { label: 'falseAlarm: "abc" (Text statt boolescher Wert)', filters: { ...base, falseAlarm: "abc" } },
      { label: "falseAlarm: null", filters: { ...base, falseAlarm: null } },
      { label: "q: 5 (Zahl statt Text)", filters: { ...base, q: 5 } },
    ];

    for (const { label, filters } of badFilters) {
      const paged = await listIncidentsPaged(queryFor(filters));
      assert.equal(paged.rows.length, 0, `L12 listIncidentsPaged (${label}): Zeilen statt leerer Menge`);
      assert.equal(paged.total, 0, `L12 listIncidentsPaged (${label}): total statt 0`);

      const exported = await listIncidentsForExport(queryFor(filters));
      assert.equal(exported.rows.length, 0, `L12 listIncidentsForExport (${label}): Zeilen statt leerer Menge`);
      assert.equal(exported.total, 0, `L12 listIncidentsForExport (${label}): total statt 0`);

      const fullExported = await listIncidentsForFullExport(queryFor(filters));
      assert.equal(
        fullExported.rows.length,
        0,
        `L12 listIncidentsForFullExport (${label}): Zeilen statt leerer Menge`,
      );
      assert.equal(fullExported.total, 0, `L12 listIncidentsForFullExport (${label}): total statt 0`);
    }
  },
);

// ==========================================================================
// F) setFalseAlarm() (src/lib/incident-actions.ts) - die Server-Action
// end-to-end (AP15B/RC1 Schritt 2: der erste PRODUKTIVE Aufrufer).
// ==========================================================================

/** FormData wie aus dem Formular in IncidentControls.tsx. */
function falseAlarmForm(id, value) {
  const fd = new FormData();
  fd.set("id", id);
  fd.set("value", value);
  return fd;
}

test("L13 setFalseAlarm: Disponent setzt/nimmt zurueck, Administrator und unbrauchbarer Wert bleiben ohne Wirkung", options, async () => {
  await ensureFlag(ID.incAction, false, "L13");

  // Als Disponent, value "1": die Zeile traegt danach is_false_alarm = true.
  setSession(sessionFor(DISPO));
  await setFalseAlarm(falseAlarmForm(ID.incAction, "1"));
  assert.equal(await readFlag(ID.incAction), true, "L13: der Disponent hat die Kennzeichnung nicht gesetzt");

  // ... und wieder value "0": zurueck auf false.
  await setFalseAlarm(falseAlarmForm(ID.incAction, "0"));
  assert.equal(
    await readFlag(ID.incAction),
    false,
    "L13: der Disponent hat die Kennzeichnung nicht zurueckgenommen",
  );

  // Als Administrator, value "1": KEINE Aenderung, kein Wurf - die Aktion
  // bricht schon VOR dem Datenbankzugriff ab (session.role !== "disponent").
  // Die Rollenregel bleibt ZUSAETZLICH datenbankseitig durch den Waechter
  // tg_incident_guard_false_alarm abgesichert - das belegen bereits L2/L3
  // (Administrator bzw. zugewiesener Monteur werden dort mit der 42501-Meldung
  // abgewiesen). L13 prueft dagegen die VORGELAGERTE Pruefung dieser Aktion:
  // faellt sie zurueck, wuerde setIncidentFalseAlarm() aufgerufen und erst DORT
  // (durch den Datenbank-Waechter) abgewiesen - ein Unterschied, den nur ein
  // direkter Test der Aktion selbst zeigt.
  setSession(sessionFor(ADMIN));
  await setFalseAlarm(falseAlarmForm(ID.incAction, "1"));
  assert.equal(
    await readFlag(ID.incAction),
    false,
    "L13: der Administrator hat ueber setFalseAlarm eine Aenderung bewirkt",
  );

  // Als Disponent mit einem unbrauchbaren value ("x", weder "1" noch "0"):
  // KEINE Aenderung, kein Wurf.
  setSession(sessionFor(DISPO));
  await setFalseAlarm(falseAlarmForm(ID.incAction, "x"));
  assert.equal(
    await readFlag(ID.incAction),
    false,
    "L13: ein unbrauchbarer value hat ueber setFalseAlarm eine Aenderung bewirkt",
  );
});
