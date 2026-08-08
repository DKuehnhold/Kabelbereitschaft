// AP14/B Integrationstests der Stammdaten- und Inventarmodule gegen ein
// synthetisches PostgreSQL 18.
//
// Lauf (siehe app/supabase/test/run_ap14b_local.ps1, zweiter Node-Aufruf im
// Schritt "Integrationstests"):
//   AP14B_APP_DATABASE_URL=...   Verbindung der Anwendung (Rolle erbt app_user,
//                                kein SUPERUSER, kein BYPASSRLS)
//   AP14B_ADMIN_DATABASE_URL=... Verbindung der Migrations-/Eigentuemerrolle,
//                                ausschliesslich fuer Fixtures und Gegenproben
//   node --import ./test/integration/module-hooks-app.mjs \
//        test/integration/ap14b-masterdata-inventory.int.mjs
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
// ap15-dashboard-metrics.int.mjs und ap14b-minio-live.int.mjs. Ohne den
// Schalter - also im lokalen Gebrauch ohne Datenbank - bleibt das
// Skip-Verhalten unveraendert.
//
// WARUM DIESE DATEI NOETIG IST: der SQL-Smoke 21 misst die Datenbankseite
// (Rechte, RLS, Trigger, Chronik), fuehrt aber keine Zeile des in AP14/B neu
// geschriebenen TypeScript-SQL aus. TypeScript, ESLint und der Build erkennen
// einen Fehler in einer SQL-Zeichenkette nicht. Hier laufen deshalb die ECHTEN
// Modulfunktionen aus src/lib/masterdata.ts, src/lib/masterdata-actions.ts,
// src/lib/inventory.ts und src/lib/inventory-actions.ts gegen echtes
// PostgreSQL. Im Test wird KEIN Anwendungs-SQL nachgebaut; die ADMIN-Verbindung
// dient ausschliesslich Fixtures und Gegenproben.
//
// Ersetzt sind ausschliesslich die beiden Abhaengigkeiten, die eine
// Next-Laufzeit verlangen (siehe module-hooks-app.mjs): `next/cache` und
// `@/lib/auth`. Die Identitaet wird ueber setSession() eingespeist; die
// Sitzungsauswertung selbst ist an anderer Stelle geprueft.
//
// Es kommen ausschliesslich synthetische Werte vor: Kennungen mit dem Praefix
// 21c00000- (er kommt in keiner anderen Test- oder Migrationsdatei vor -
// 20_ap14b_data.sql benutzt 20b00000-, 21_ap14b_masterdata_inventory.sql
// 21b00000- und ap14b-platform.int.mjs ac140b00-), Namen mit dem Praefix "I21",
// E-Mail-Adressen auf @beispiel.invalid, keine echten Personen, Telefonnummern,
// Lager-, GPS-/EXIF- oder Zugangsdaten, kein Passwort und kein Hashmaterial.

import test from "node:test";
import assert from "node:assert/strict";

import { Client } from "pg";

const APP_URL = process.env.AP14B_APP_DATABASE_URL?.trim();
const ADMIN_URL = process.env.AP14B_ADMIN_DATABASE_URL?.trim();
const ENABLED = Boolean(APP_URL && ADMIN_URL);

/**
 * Pflichtmodus: der Lauf DARF nicht uebersprungen werden.
 *
 * Gesetzt wird er von der CI (app/supabase/test/run_db_tests.sh, Job `database`).
 * Dort ist ein Skip kein harmloses "keine Datenbank vorhanden", sondern ein
 * gruener Lauf ohne jeden Nachweis. Lokal bleibt der Schalter ungesetzt und das
 * bisherige Skip-Verhalten unveraendert.
 */
const REQUIRE_INTEGRATION = process.env.AP14B_REQUIRE_INTEGRATION?.trim() === "1";

if (REQUIRE_INTEGRATION && !ENABLED) {
  // Abbruch statt Skip, und zwar SOFORT beim Laden des Moduls: ein `skip` liefe
  // mit Exitcode 0 durch. Die Meldung nennt ausschliesslich die NAMEN der
  // fehlenden Variablen - niemals einen Wert und niemals eine
  // Verbindungszeichenfolge (Muster aus ap14b-admin-users.int.mjs).
  const missing = [
    ["AP14B_APP_DATABASE_URL", APP_URL],
    ["AP14B_ADMIN_DATABASE_URL", ADMIN_URL],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);
  throw new Error(
    `AP14/B-Integrationsnachweis der Stammdaten und des Inventars nicht lauffaehig, Pflichtvariablen fehlen: ${missing.join(", ")}. ` +
      "Bei gesetztem AP14B_REQUIRE_INTEGRATION=1 wird dieser Lauf ausdruecklich NICHT uebersprungen.",
  );
}

// Muss vor der ersten Abfrage stehen: der Pool in src/lib/db liest die Variable
// beim ersten Verbindungsaufbau.
if (ENABLED) process.env.DATABASE_URL = APP_URL;

const { setSession, clearSession } = await import("./stubs/session.mjs");
const { resetRevalidateCalls, revalidatedPaths } = await import("./stubs/next-cache.mjs");

const {
  listCustomers,
  listStages,
  listOnCallNumbers,
  listVzgLines,
  listContacts,
  listTechnicians,
  listTeams,
  listCableTypes,
  listProfileOptions,
  getAppSettings,
} = await import("../../src/lib/masterdata.ts");

const {
  saveOnCallNumber,
  saveCustomer,
  saveStage,
  saveVzgLine,
  saveContact,
  saveTechnician,
  saveTeam,
  saveCableType,
  saveSettings,
  setCustomerActive,
  setTechnicianActive,
  setTeamActive,
  previewTechnicianImport,
  commitTechnicianImport,
} = await import("../../src/lib/masterdata-actions.ts");

const {
  listMaterials,
  listLocations,
  getStock,
  getLowStockMaterials,
  listMovements,
  returnableQuantity,
} = await import("../../src/lib/inventory.ts");

const {
  saveMaterial,
  saveLocation,
  createMovement,
  takeoutMaterial,
  returnMaterial,
  consumeMaterial,
} = await import("../../src/lib/inventory-actions.ts");

// --------------------------------------------------------------------------
// Unveraenderte Meldungstexte des Anwendungscodes.
//
// Sie stehen bewusst als Konstanten hier: aendert sich ein Text im
// Produktionscode, scheitert dieser Test und die Aenderung wird sichtbar.
// --------------------------------------------------------------------------

const STAFF_ONLY = "Nur Administration und Disposition dürfen Stammdaten verwalten.";
const SAVE_FAILED = "Speichern fehlgeschlagen: unerwarteter Datenbankfehler.";
const MATERIAL_ADMIN_ONLY = "Nur Administratoren dürfen Material verwalten.";
const LOCATION_ADMIN_ONLY = "Nur Administratoren dürfen Lagerorte verwalten.";
const MOVEMENT_STAFF_ONLY = "Diese Buchung ist der Disposition/Administration vorbehalten.";
const NOT_SIGNED_IN = "Nicht angemeldet.";
const MOVEMENT_PREFIX = "Buchung fehlgeschlagen";
const TAKEOUT_PREFIX = "Entnahme fehlgeschlagen (evtl. Bestand zu gering)";
const RETURN_PREFIX = "Rückgabe fehlgeschlagen";
const CONSUME_PREFIX = "Verbrauch fehlgeschlagen (evtl. Bestand zu gering)";
const MATERIAL_INACTIVE = "Material ist inaktiv.";
// Ein unbrauchbarer Verweis - derselbe Text fuer die fachliche Vorpruefung und
// fuer den gefangenen Fremdschluesselfehler (REFERENCE_INVALID im Modul).
const REFERENCE_INVALID = "Verweis auf Material, Lager oder Vorgang ist ungültig.";

const OK = { ok: true, error: null };
const STAFF_DENIED = { ok: false, error: STAFF_ONLY };

// --------------------------------------------------------------------------
// Synthetische Fixtures
// --------------------------------------------------------------------------

const ID = {
  // Identitaeten
  admin: "21c00000-0000-0000-0000-000000000001",
  dispo: "21c00000-0000-0000-0000-000000000002",
  monteur: "21c00000-0000-0000-0000-000000000003",
  fremd: "21c00000-0000-0000-0000-000000000004",
  // Stammdaten
  stage: "21c00000-0000-0000-0000-0000000000a1",
  stagePlain: "21c00000-0000-0000-0000-0000000000a6",
  stageNumberOnly: "21c00000-0000-0000-0000-0000000000a7",
  vzgWithCode: "21c00000-0000-0000-0000-0000000000a2",
  vzgWithoutCode: "21c00000-0000-0000-0000-0000000000a9",
  customer: "21c00000-0000-0000-0000-0000000000a3",
  cableType: "21c00000-0000-0000-0000-0000000000a4",
  onCallWithLabel: "21c00000-0000-0000-0000-0000000000a5",
  onCallWithoutLabel: "21c00000-0000-0000-0000-0000000000a8",
  incident: "21c00000-0000-0000-0000-0000000000b1",
  // Syntaktisch gueltige Kennung OHNE Zeile in public.incidents. Wird von II17
  // ueber die ADMIN-Verbindung nachgewiesen und NICHT als Fixture angelegt.
  incidentUnknown: "21c00000-0000-0000-0000-0000000000b9",
  technicianA: "21c00000-0000-0000-0000-0000000000e2",
  technicianB: "21c00000-0000-0000-0000-0000000000e3",
  team: "21c00000-0000-0000-0000-0000000000e4",
  // Inventar
  material: "21c00000-0000-0000-0000-0000000000d1",
  central: "21c00000-0000-0000-0000-0000000000d2",
  vehicle: "21c00000-0000-0000-0000-0000000000d3",
  materialLow: "21c00000-0000-0000-0000-0000000000d6",
  materialInactive: "21c00000-0000-0000-0000-0000000000d7",
  // Syntaktisch gueltige Kennung OHNE Zeile in public.materials. Wird von II16
  // ueber die ADMIN-Verbindung nachgewiesen und NICHT als Fixture angelegt.
  materialUnknown: "21c00000-0000-0000-0000-0000000000d9",
  movementIn1: "21c00000-0000-0000-0000-0000000000f1",
  movementIn2: "21c00000-0000-0000-0000-0000000000f2",
  movementTransfer: "21c00000-0000-0000-0000-0000000000f3",
  movementTakeout: "21c00000-0000-0000-0000-0000000000f4",
  movementLow: "21c00000-0000-0000-0000-0000000000f5",
};

/**
 * Platzhalter aus Migration 0012: absichtlich kein anmeldefaehiger Hash.
 *
 * Begruendung uebernommen aus 20_ap14b_data.sql und
 * 21_ap14b_masterdata_inventory.sql: usableAdminCount() in
 * ap14b-platform.int.mjs und das Bootstrap-Gate in scripts/bootstrap-admin.mjs
 * zaehlen jedes aktive Admin-Profil, dessen password_hash auf '$argon2id$'
 * passt. Ein solcher Wert liesse deren Bootstrap-Faelle scheitern, weil sie eine
 * Datenbank ohne anmeldefaehigen Administrator voraussetzen. Dieser Test braucht
 * keinen Hash: die Identitaet kommt aus setSession() und von auth_accounts nur
 * der Fremdschluessel auf die id (0012 hat public.profiles.id darauf
 * umgehaengt). Diesen Wert NICHT auf einen '$argon2id$'-Wert aendern.
 */
const ACCOUNT_MARKER = "!MIGRATED-ACCOUNT-REQUIRES-RESET!";

// `sid` ist nur der Formtreue wegen gesetzt: die Fachmodule benutzen aus
// SessionProfile ausschliesslich userId und role. Es gibt zu diesen Kennungen
// bewusst KEINE Zeile in public.auth_sessions - eine echte Sitzung entsteht in
// diesem Test nicht.
const ADMIN = {
  id: ID.admin,
  sid: "21c00000-0000-0000-0000-00000000c101",
  email: "i21.admin@beispiel.invalid",
  name: "I21 Administrator",
  role: "admin",
};
const DISPO = {
  id: ID.dispo,
  sid: "21c00000-0000-0000-0000-00000000c102",
  email: "i21.dispo@beispiel.invalid",
  name: "I21 Disposition",
  role: "disponent",
};
const MONTEUR = {
  id: ID.monteur,
  sid: "21c00000-0000-0000-0000-00000000c103",
  email: "i21.monteur@beispiel.invalid",
  name: "I21 Monteur zugewiesen",
  role: "monteur",
};
const FREMD = {
  id: ID.fremd,
  sid: "21c00000-0000-0000-0000-00000000c104",
  email: "i21.fremd@beispiel.invalid",
  name: "I21 Monteur fremd",
  role: "monteur",
};
const PEOPLE = [ADMIN, DISPO, MONTEUR, FREMD];

/** Synthetische Bezeichner, die von den Faellen erzeugt und gesucht werden. */
const VZG_IM4 = "2151";
const CONTACT_NAME = "I21 Kontakt IM6";
const PHONE_A = "000-21c-000001";
const PHONE_B = "000-21c-000002";
const TEAM_NAME = "I21 Team IM8";
const IMPORT_LAST_NAME = "Techniker Import";

/**
 * Notizen als Wiedererkennungsmerkmal der ueber die Module gebuchten
 * Bewegungen. Die Aktionen geben keine Kennung zurueck; die Gegenprobe ueber die
 * ADMIN-Verbindung sucht deshalb ueber diese eindeutigen Texte.
 */
const NOTE = {
  receipt: "I21 II5 Wareneingang",
  transfer: "I21 II5 Umbuchung",
  monteurReceipt: "I21 II5 Wareneingang als Monteur",
  invalid: "I21 II6 unzulaessige Eingabe",
  inactive: "I21 II7 inaktives Material",
  unit: "I21 II8 Einheit aus dem Material",
  takeout: "I21 II9 Entnahme zugewiesen",
  consume: "I21 II9 Verbrauch zugewiesen",
  foreign: "I21 II9 Entnahme fremder Monteur",
  overdraw: "I21 II10 Entnahme ueber den Bestand hinaus",
  returnTooMuch: "I21 II11 Rueckgabe zu gross",
  returnOk: "I21 II11 Rueckgabe zulaessig",
  author: "I21 II13 Urheber aus der Sitzung",
  noSession: "I21 II14 ohne Berechtigung",
  roleGuest: "I21 II15 Rolle gast",
  roleOther: "I21 II15 Rolle ausgeschieden",
  roleMonteur: "I21 II15 Rolle monteur",
  missingMovement: "I21 II16 fehlendes Material Buchung",
  missingTakeout: "I21 II16 fehlendes Material Entnahme",
  missingReturn: "I21 II16 fehlendes Material Rueckgabe",
  missingConsume: "I21 II16 fehlendes Material Verbrauch",
  missingInactive: "I21 II16 inaktives Material zur Abgrenzung",
  unknownIncidentTakeout: "I21 II17 fehlender Vorgang Entnahme",
  unknownIncidentReturn: "I21 II17 fehlender Vorgang Rueckgabe",
  unknownIncidentConsume: "I21 II17 fehlender Vorgang Verbrauch",
  foreignIncidentTakeout: "I21 II17 fremder Vorgang Entnahme",
  foreignIncidentReturn: "I21 II17 fremder Vorgang Rueckgabe",
  foreignIncidentConsume: "I21 II17 fremder Vorgang Verbrauch",
  racePrepReturn: "I21 II18 Vorbereitung Rueckgabe",
  racePrepTakeout: "I21 II18 Vorbereitung Entnahme",
  raceReturnA: "I21 II18 gleichzeitige Rueckgabe A",
  raceReturnB: "I21 II18 gleichzeitige Rueckgabe B",
  lockTakeoutMonteur: "I21 II19 Entnahme Monteur",
  lockConsumeMonteur: "I21 II19 Verbrauch Monteur",
  lockReturnMonteur: "I21 II19 Rueckgabe Monteur",
  lockTakeoutDispo: "I21 II19 Entnahme Disposition",
  lockConsumeDispo: "I21 II19 Verbrauch Disposition",
  lockReturnDispo: "I21 II19 Rueckgabe Disposition",
};

/** CSV des Monteur-Imports: eine Neuanlage und eine Dublette gegen die Datenbank. */
const IMPORT_CSV = [
  "Vorname;Nachname;Aktiv",
  `I21;${IMPORT_LAST_NAME};ja`,
  "I21;Techniker A;ja",
  "",
].join("\r\n");

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

/** FormData aus einem flachen Objekt; NULL und undefined bleiben weg. */
function form(fields) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    fd.set(key, String(value));
  }
  return fd;
}

/** FormData eines Ansprechpartners samt Telefonnummern und Bauabschnitten. */
function contactForm({ id, customerId, name, role, email, phones = [], stageIds = [] }) {
  const fd = new FormData();
  if (id) fd.set("id", id);
  fd.set("customer_id", customerId);
  fd.set("name", name);
  if (role) fd.set("function", role);
  if (email) fd.set("email", email);
  fd.set("phones_json", JSON.stringify(phones));
  for (const stageId of stageIds) fd.append("stage_ids", stageId);
  return fd;
}

/**
 * Feldnamen einer Zeile exakt vergleichen.
 *
 * Bewusst exakt und nicht "enthaelt": ein zusaetzliches oder fehlendes Feld ist
 * genau der Formfehler, den dieser Test aufdecken soll.
 */
function assertKeys(row, keys, label) {
  assert.deepEqual(Object.keys(row).sort(), [...keys].sort(), label);
}

// Alle Gegenproben laufen ueber die Eigentuemerrolle und mit festen
// SQL-Literalen; es wird nichts in einen Anweisungstext hineingebaut.
const COUNT_ON_CALL_BY_NUMBER = `select count(*)::integer as rows from public.on_call_numbers where number = $1::text`;
const COUNT_CUSTOMERS_BY_NAME = `select count(*)::integer as rows from public.customers where name = $1::text`;
const COUNT_STAGES_BY_NAME = `select count(*)::integer as rows from public.construction_stages where name = $1::text`;
const COUNT_CONTACTS_BY_NAME = `select count(*)::integer as rows from public.contacts where name = $1::text`;
const COUNT_TECHNICIANS_BY_LAST_NAME = `select count(*)::integer as rows from public.technicians where last_name = $1::text`;
const COUNT_TEAMS_BY_NAME = `select count(*)::integer as rows from public.teams where name = $1::text`;
const COUNT_CABLE_TYPES_BY_CODE = `select count(*)::integer as rows from public.cable_types where code = $1::text`;
const COUNT_MATERIALS_BY_NAME = `select count(*)::integer as rows from public.materials where name = $1::text`;
const COUNT_LOCATIONS_BY_NAME = `select count(*)::integer as rows from public.storage_locations where name = $1::text`;
const COUNT_VZG_IN_STAGE = `select count(*)::integer as rows from public.vzg_lines where construction_stage_id = $1::uuid and line_number = $2::text`;
const COUNT_MATERIALS_BY_ID = `select count(*)::integer as rows from public.materials where id = $1::uuid`;
const COUNT_INCIDENTS_BY_ID = `select count(*)::integer as rows from public.incidents where id = $1::uuid`;
// Summe einer Bewegungsart zu Vorgang+Material - Grundlage der Gegenprobe in
// II18: die Summe der Rueckgaben darf die Summe der Entnahmen nie ueberschreiten.
const SUM_MOVEMENTS_BY_TYPE = `select coalesce(sum(quantity), 0)::text as quantity from public.inventory_movements where incident_id = $1::uuid and material_id = $2::uuid and movement_type = $3::public.movement_type`;

const SELECT_CUSTOMER_ACTIVE = `select is_active from public.customers where id = $1::uuid`;
const SELECT_TECHNICIAN_ACTIVE = `select is_active from public.technicians where id = $1::uuid`;
const SELECT_TEAM_ACTIVE = `select is_active from public.teams where id = $1::uuid`;

async function countBy(sql, ...values) {
  const result = await admin.query(sql, values);
  return result.rows[0].rows;
}

async function isActive(sql, id) {
  const result = await admin.query(sql, [id]);
  return result.rows[0]?.is_active ?? null;
}

async function appSettingsRow() {
  const result = await admin.query(
    `select id, default_customer_id, default_on_call_number_id
       from public.app_settings
      where id = 1`,
  );
  return result.rows[0] ?? null;
}

async function contactPhoneRows(contactId) {
  const result = await admin.query(
    `select id, phone, phone_type::text as phone_type, sort_order
       from public.contact_phone_numbers
      where contact_id = $1::uuid
      order by sort_order asc`,
    [contactId],
  );
  return result.rows;
}

/** Bestand eines Materials in einem Lagerort - unmittelbar aus der View. */
async function stockQuantity(materialId, locationId) {
  const result = await admin.query(
    `select coalesce(sum(quantity), 0)::text as quantity
       from public.material_stock
      where material_id = $1::uuid and location_id = $2::uuid`,
    [materialId, locationId],
  );
  return Number(result.rows[0].quantity);
}

/** Ueber das Modul gebuchte Bewegungen, gefunden ueber ihre eindeutige Notiz. */
async function movementsByNote(note) {
  const result = await admin.query(
    `select id, material_id, quantity::text as quantity, unit, movement_type::text as movement_type,
            source_location_id, target_location_id, incident_id, created_by, created_at
       from public.inventory_movements
      where note = $1::text
      order by created_at asc`,
    [note],
  );
  return result.rows;
}

/** Gebuchte Menge einer Bewegungsart zu Vorgang+Material - ueber die ADMIN-Verbindung. */
async function movementSum(incidentId, materialId, movementType) {
  const result = await admin.query(SUM_MOVEMENTS_BY_TYPE, [incidentId, materialId, movementType]);
  return Number(result.rows[0].quantity);
}

async function tablePrivilege(object, privilege) {
  const result = await admin.query(
    `select has_table_privilege('app_user', $1::text, $2::text) as granted`,
    [object, privilege],
  );
  return result.rows[0].granted;
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

  // Zwei Bereitschaftsnummern: eine MIT und eine OHNE Bezeichnung. Nur so sind
  // beide Zweige des zusammengesetzten Labels in listStages() messbar. Die Werte
  // sind bewusst keine Ziffernfolgen, die als Rufnummer missverstanden werden
  // koennten.
  await admin.query(
    `insert into public.on_call_numbers (id, number, label)
     values ($1::uuid, 'I21-0000-0001', 'I21 Bereitschaft mit Bezeichnung'),
            ($2::uuid, 'I21-0000-0002', null)
     on conflict (id) do nothing`,
    [ID.onCallWithLabel, ID.onCallWithoutLabel],
  );

  // Drei Bauabschnitte: mit Bereitschaft samt Bezeichnung, ohne Bereitschaft
  // (und ohne Code - Gegenprobe fuer stage_name) und mit Bereitschaft ohne
  // Bezeichnung. construction_stages.code ist unique (0001).
  await admin.query(
    `insert into public.construction_stages (id, code, name, default_on_call_number_id)
     values ($1::uuid, 'I21A', 'I21 Bauabschnitt', $4::uuid),
            ($2::uuid, null, 'I21 Bauabschnitt ohne Bereitschaft', null),
            ($3::uuid, 'I21B', 'I21 Bauabschnitt Nummer ohne Bezeichnung', $5::uuid)
     on conflict (id) do nothing`,
    [
      ID.stage,
      ID.stagePlain,
      ID.stageNumberOnly,
      ID.onCallWithLabel,
      ID.onCallWithoutLabel,
    ],
  );

  await admin.query(
    `insert into public.vzg_lines (id, line_number, description, construction_stage_id)
     values ($1::uuid, '2161', 'I21 Strecke mit Bauabschnittscode', $3::uuid),
            ($2::uuid, '2161', 'I21 Strecke ohne Bauabschnittscode', $4::uuid)
     on conflict (id) do nothing`,
    [ID.vzgWithCode, ID.vzgWithoutCode, ID.stage, ID.stagePlain],
  );

  await admin.query(
    `insert into public.customers (id, name, erp_id)
     values ($1::uuid, 'I21 Kunde', 'I21-ERP-0001')
     on conflict (id) do nothing`,
    [ID.customer],
  );

  await admin.query(
    `insert into public.cable_types (id, code, name, sort_order)
     values ($1::uuid, 'i21c-kabel', 'I21 Kabelart', 31)
     on conflict (id) do nothing`,
    [ID.cableType],
  );

  await admin.query(
    `insert into public.technicians (id, first_name, last_name)
     values ($1::uuid, 'I21', 'Techniker A'),
            ($2::uuid, 'I21', 'Techniker B')
     on conflict (id) do nothing`,
    [ID.technicianA, ID.technicianB],
  );

  await admin.query(
    `insert into public.teams (id, name)
     values ($1::uuid, 'I21 Team Schalter')
     on conflict (id) do nothing`,
    [ID.team],
  );

  // Ein Vorgang mit Zuweisung des Monteurs: Grundlage der vorgangsbezogenen
  // Buchungen und Gegenprobe fuer den fremden Monteur.
  await admin.query(
    `insert into public.incidents
       (id, construction_stage_id, vzg_line_number, vzg_line_id, km_from, status, description)
     values ($1::uuid, $2::uuid, '2161', $3::uuid, 31.100, 'monteur_zugewiesen',
             'AP14B Integrationstest Stammdaten/Inventar - zugewiesener Vorgang')
     on conflict (id) do nothing`,
    [ID.incident, ID.stage, ID.vzgWithCode],
  );
  await admin.query(
    `insert into public.incident_assignments (incident_id, monteur_id)
     values ($1::uuid, $2::uuid)
     on conflict do nothing`,
    [ID.incident, ID.monteur],
  );

  // Materialien: eines mit der Einheit 'Meter' (bewusst nicht der Spaltendefault
  // 'Stk', damit die Einheitenherkunft ueberhaupt messbar ist), eines unter dem
  // Mindestbestand und eines inaktives.
  await admin.query(
    `insert into public.materials (id, material_no, name, unit, category, min_stock, is_active)
     values ($1::uuid, 'I21-0001', 'I21 Material', 'Meter', 'I21 Kategorie', 10, true),
            ($2::uuid, 'I21-0002', 'I21 Material knapp', 'Stk', null, 50, true),
            ($3::uuid, 'I21-0003', 'I21 Material inaktiv', 'Stk', null, 0, false)
     on conflict (id) do nothing`,
    [ID.material, ID.materialLow, ID.materialInactive],
  );

  await admin.query(
    `insert into public.storage_locations (id, name, location_type)
     values ($1::uuid, 'I21 Zentrallager', 'zentrallager'),
            ($2::uuid, 'I21 Fahrzeuglager', 'fahrzeuglager')
     on conflict (id) do nothing`,
    [ID.central, ID.vehicle],
  );

  // Ausgangsbestand in EINZELNEN Anweisungen und in dieser Reihenfolge: der
  // BEFORE-Trigger check_inventory_nonnegative() prueft jede Buchung gegen den
  // bis dahin vorhandenen Bestand.
  //   +100 Zentrallager                      -> zentral 100
  //    +40 Fahrzeuglager                     -> fahrzeug  40
  //    -10 Umbuchung zentral -> Fahrzeug     -> zentral  90, fahrzeug 50
  //     -5 Entnahme auf den Vorgang          -> zentral  85
  // Erwartet danach: zentral 85, Fahrzeug 50, gesamt 135.
  //
  // Die Umbuchung traegt beide Lagerorte und die Entnahme einen Vorgangsbezug:
  // erst damit sind die verschachtelten Objekte source, target und incident einer
  // MovementRow ueberhaupt messbar. created_by der Entnahme wird ausdruecklich
  // auf die Disposition gesetzt, damit created_by_name einen Namen liefert; die
  // uebrigen Fixture-Bewegungen entstehen ohne Identitaet und tragen NULL.
  await admin.query(
    `insert into public.inventory_movements
       (id, material_id, quantity, unit, movement_type, target_location_id, note)
     values ($1::uuid, $2::uuid, 100, 'Meter', 'wareneingang', $3::uuid,
             'I21 Anfangsbestand Zentrallager')
     on conflict (id) do nothing`,
    [ID.movementIn1, ID.material, ID.central],
  );
  await admin.query(
    `insert into public.inventory_movements
       (id, material_id, quantity, unit, movement_type, target_location_id, note)
     values ($1::uuid, $2::uuid, 40, 'Meter', 'wareneingang', $3::uuid,
             'I21 Anfangsbestand Fahrzeuglager')
     on conflict (id) do nothing`,
    [ID.movementIn2, ID.material, ID.vehicle],
  );
  await admin.query(
    `insert into public.inventory_movements
       (id, material_id, quantity, unit, movement_type, source_location_id,
        target_location_id, note)
     values ($1::uuid, $2::uuid, 10, 'Meter', 'umbuchung', $3::uuid, $4::uuid,
             'I21 Umbuchung Fixture')
     on conflict (id) do nothing`,
    [ID.movementTransfer, ID.material, ID.central, ID.vehicle],
  );
  await admin.query(
    `insert into public.inventory_movements
       (id, material_id, quantity, unit, movement_type, source_location_id,
        incident_id, created_by, note)
     values ($1::uuid, $2::uuid, 5, 'Meter', 'entnahme_vorgang', $3::uuid,
             $4::uuid, $5::uuid, 'I21 Entnahme Fixture')
     on conflict (id) do nothing`,
    [ID.movementTakeout, ID.material, ID.central, ID.incident, ID.dispo],
  );
  await admin.query(
    `insert into public.inventory_movements
       (id, material_id, quantity, unit, movement_type, target_location_id, note)
     values ($1::uuid, $2::uuid, 5, 'Stk', 'wareneingang', $3::uuid,
             'I21 Anfangsbestand knappes Material')
     on conflict (id) do nothing`,
    [ID.movementLow, ID.materialLow, ID.central],
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
  // 20_ap14b_data.sql und 21_ap14b_masterdata_inventory.sql: public.incidents
  // traegt eine Loeschsperre, und beide Startskripte entfernen die temporaere
  // Testdatenbank nach dem Lauf immer. Alle Kennungen tragen den Praefix
  // 21c00000-, alle Namen den Praefix "I21"; fremde Fixtures bleiben unberuehrt.
  //
  // Einzige Ausnahme: das in IM7 voruebergehend entzogene insert-Recht wird hier
  // defensiv noch einmal erteilt. Das `finally` in IM7 deckt jede Ausnahme und
  // jede fehlgeschlagene Zusicherung ab, NICHT aber einen Abbruch des Prozesses
  // zwischen Entzug und Wiederherstellung (Zeitlimit, Ctrl-C, Kill durch den
  // Runner). `grant` ist idempotent, der Aufruf im Normalfall also wirkungslos.
  await admin.query("grant insert on public.contact_phone_numbers to app_user");
  await admin.end();
  // Der Pool in src/lib/db exportiert bewusst keine Verbindung und auch keinen
  // Abschluss. Fuer das Ende des Testprozesses wird der modulprivate Anker
  // benutzt; ein offener Client liesse den Testlauf haengen.
  await globalThis.__kabelbereitschaftPool?.end();
});

const options = {
  skip: ENABLED ? false : "AP14B_APP_DATABASE_URL/AP14B_ADMIN_DATABASE_URL fehlen",
};

// ==========================================================================
// A) Stammdaten (IM1-IM12)
// ==========================================================================

test("IM1 Stammdaten-Reads laufen als Admin und liefern die bisherige Zeilenform", options, async () => {
  setSession(sessionFor(ADMIN));

  const customers = await listCustomers();
  assert.ok(Array.isArray(customers), "listCustomers liefert kein Array");
  const customer = customers.find((c) => c.id === ID.customer);
  assert.ok(customer, "Fixture-Kunde fehlt in listCustomers()");
  assertKeys(customer, ["id", "name", "erp_id", "is_active"], "CustomerRow");
  assert.equal(customer.name, "I21 Kunde");
  assert.equal(customer.erp_id, "I21-ERP-0001");
  assert.equal(customer.is_active, true);

  const onCallNumbers = await listOnCallNumbers();
  assert.ok(Array.isArray(onCallNumbers));
  const onCall = onCallNumbers.find((o) => o.id === ID.onCallWithLabel);
  assert.ok(onCall, "Fixture-Bereitschaftsnummer fehlt in listOnCallNumbers()");
  assertKeys(onCall, ["id", "number", "label", "is_active"], "OnCallRow");
  assert.equal(onCall.number, "I21-0000-0001");
  assert.equal(onCall.label, "I21 Bereitschaft mit Bezeichnung");

  const cableTypes = await listCableTypes();
  assert.ok(Array.isArray(cableTypes));
  const cableType = cableTypes.find((c) => c.id === ID.cableType);
  assert.ok(cableType, "Fixture-Kabelart fehlt in listCableTypes()");
  assertKeys(cableType, ["id", "code", "name", "sort_order", "is_active"], "CableTypeRow");
  assert.equal(cableType.code, "i21c-kabel");
  assert.equal(cableType.sort_order, 31);
  assert.equal(typeof cableType.sort_order, "number");

  const profileOptions = await listProfileOptions();
  assert.ok(Array.isArray(profileOptions));
  const option = profileOptions.find((p) => p.id === ID.dispo);
  assert.ok(option, "Fixture-Profil fehlt in listProfileOptions()");
  assertKeys(option, ["id", "label"], "StageOption");
  assert.equal(option.label, `${DISPO.name} (${DISPO.role})`);

  const settings = await getAppSettings();
  assertKeys(
    settings,
    ["id", "default_customer_id", "default_on_call_number_id"],
    "AppSettingsRow",
  );
  assert.equal(settings.id, 1);

  const technicians = await listTechnicians();
  const technician = technicians.find((t) => t.id === ID.technicianA);
  assert.ok(technician, "Fixture-Monteur fehlt in listTechnicians()");
  assertKeys(
    technician,
    ["id", "first_name", "last_name", "profile_id", "profile_name", "is_active"],
    "TechnicianRow",
  );
  assert.equal(technician.profile_id, null);
  assert.equal(technician.profile_name, null);
});

test("IM2 listStages setzt das Bereitschaftslabel aus Nummer und Bezeichnung zusammen", options, async () => {
  setSession(sessionFor(ADMIN));
  const stages = await listStages();

  const withLabel = stages.find((s) => s.id === ID.stage);
  assert.ok(withLabel, "Fixture-Bauabschnitt fehlt in listStages()");
  assertKeys(
    withLabel,
    [
      "id",
      "code",
      "name",
      "description",
      "wus_bst",
      "default_on_call_number_id",
      "default_on_call_label",
      "is_active",
    ],
    "StageRow",
  );
  assert.equal(withLabel.code, "I21A");
  assert.equal(withLabel.default_on_call_number_id, ID.onCallWithLabel);
  // Gedankenstrich wie im Code (masterdata.ts: `${oc.number} – ${oc.label}`).
  assert.equal(
    withLabel.default_on_call_label,
    "I21-0000-0001 – I21 Bereitschaft mit Bezeichnung",
  );

  // Bereitschaftsnummer ohne Bezeichnung: nur die Nummer, kein Gedankenstrich.
  const numberOnly = stages.find((s) => s.id === ID.stageNumberOnly);
  assert.ok(numberOnly);
  assert.equal(numberOnly.default_on_call_number_id, ID.onCallWithoutLabel);
  assert.equal(numberOnly.default_on_call_label, "I21-0000-0002");

  // Ohne gesetzte Bereitschaftsnummer bleibt das Label NULL.
  const without = stages.find((s) => s.id === ID.stagePlain);
  assert.ok(without);
  assert.equal(without.code, null);
  assert.equal(without.default_on_call_number_id, null);
  assert.equal(without.default_on_call_label, null);
});

test("IM3 listVzgLines setzt stage_name aus Code und Bezeichnung zusammen", options, async () => {
  setSession(sessionFor(ADMIN));
  const lines = await listVzgLines();

  const withCode = lines.find((v) => v.id === ID.vzgWithCode);
  assert.ok(withCode, "Fixture-Strecke fehlt in listVzgLines()");
  assertKeys(
    withCode,
    ["id", "line_number", "description", "construction_stage_id", "stage_name", "is_active"],
    "VzgLineRow",
  );
  assert.equal(withCode.line_number, "2161");
  assert.equal(withCode.stage_name, "I21A – I21 Bauabschnitt");

  const withoutCode = lines.find((v) => v.id === ID.vzgWithoutCode);
  assert.ok(withoutCode);
  assert.equal(withoutCode.stage_name, "I21 Bauabschnitt ohne Bereitschaft");

  // Der dritte Zweig des Mappers ist der Rueckfall "—" fuer einen FEHLENDEN
  // Bauabschnitt. Er ist mit echten Daten nicht erreichbar:
  // vzg_lines.construction_stage_id ist NOT NULL (0007, Abschnitt 3.2), und
  // beide Tabellen tragen dieselbe Select-Policy - der LEFT JOIN findet also
  // immer seinen Partner. Das ist eine Aussage ueber die Daten und ausdruecklich
  // kein Anlass, den Code zu aendern.
});

test("IM4 alle save*-Aktionen legen als Disposition einen Datensatz an", options, async () => {
  setSession(sessionFor(DISPO));

  assert.deepEqual(
    await saveOnCallNumber(null, form({ number: "I21-0000-0011", label: "I21 Bereitschaft IM4" })),
    OK,
  );
  assert.ok((await listOnCallNumbers()).some((o) => o.number === "I21-0000-0011"));

  assert.deepEqual(
    await saveCustomer(null, form({ name: "I21 Kunde IM4", erp_id: "I21-ERP-0011" })),
    OK,
  );
  assert.ok((await listCustomers()).some((c) => c.name === "I21 Kunde IM4"));

  assert.deepEqual(
    await saveStage(
      null,
      form({
        code: "I21-IM4",
        name: "I21 Bauabschnitt IM4",
        wus_bst: "I21-BST-IM4",
        default_on_call_number_id: ID.onCallWithLabel,
      }),
    ),
    OK,
  );
  const stage = (await listStages()).find((s) => s.name === "I21 Bauabschnitt IM4");
  assert.ok(stage, "der angelegte Bauabschnitt fehlt in listStages()");
  assert.equal(stage.wus_bst, "I21-BST-IM4");
  assert.equal(
    stage.default_on_call_label,
    "I21-0000-0001 – I21 Bereitschaft mit Bezeichnung",
  );

  assert.deepEqual(
    await saveVzgLine(
      null,
      form({
        line_number: VZG_IM4,
        description: "I21 Strecke IM4",
        construction_stage_id: ID.stage,
      }),
    ),
    OK,
  );
  assert.ok(
    (await listVzgLines()).some(
      (v) => v.line_number === VZG_IM4 && v.construction_stage_id === ID.stage,
    ),
  );

  assert.deepEqual(
    await saveTechnician(null, form({ first_name: "I21", last_name: "Techniker IM4" })),
    OK,
  );
  assert.ok((await listTechnicians()).some((t) => t.last_name === "Techniker IM4"));

  assert.deepEqual(
    await saveCableType(
      null,
      form({ code: "i21c-kabel-im4", name: "I21 Kabelart IM4", sort_order: "32" }),
    ),
    OK,
  );
  const savedCableType = (await listCableTypes()).find((c) => c.code === "i21c-kabel-im4");
  assert.ok(savedCableType);
  assert.equal(savedCableType.sort_order, 32);

  assert.deepEqual(
    await saveSettings(
      null,
      form({
        default_customer_id: ID.customer,
        default_on_call_number_id: ID.onCallWithLabel,
      }),
    ),
    OK,
  );
  const settings = await getAppSettings();
  assert.equal(settings.default_customer_id, ID.customer);
  assert.equal(settings.default_on_call_number_id, ID.onCallWithLabel);
});

test("IM5 saveVzgLine prueft Format und Eindeutigkeit mit unveraenderten Meldungen", options, async () => {
  // Baut auf IM4 auf: dort ist die Strecke VZG_IM4 im Fixture-Bauabschnitt
  // angelegt worden. node:test fuehrt die Faelle einer Datei in der
  // Reihenfolge ihrer Deklaration aus.
  setSession(sessionFor(DISPO));

  assert.deepEqual(
    await saveVzgLine(null, form({ line_number: "215", construction_stage_id: ID.stage })),
    { ok: false, error: "Die VzG-Streckennummer muss aus genau vier Ziffern bestehen." },
  );

  assert.deepEqual(
    await saveVzgLine(null, form({ line_number: VZG_IM4, construction_stage_id: ID.stage })),
    { ok: false, error: "Diese VzG-Streckennummer ist für diesen Bauabschnitt bereits vergeben." },
  );

  // Gegenprobe: nach wie vor genau eine Zeile.
  assert.equal(await countBy(COUNT_VZG_IN_STAGE, ID.stage, VZG_IM4), 1);
});

test("IM6 saveContact ersetzt Telefonnummern und Bauabschnittszuordnung vollstaendig", options, async () => {
  setSession(sessionFor(DISPO));

  assert.deepEqual(
    await saveContact(
      null,
      contactForm({
        customerId: ID.customer,
        name: CONTACT_NAME,
        role: "I21 Funktion",
        email: "i21.kontakt@beispiel.invalid",
        phones: [
          { phone: PHONE_A, phone_type: "mobil" },
          { phone: PHONE_B, phone_type: "festnetz" },
        ],
        stageIds: [ID.stage, ID.stagePlain],
      }),
    ),
    OK,
  );

  const contact = (await listContacts()).find((c) => c.name === CONTACT_NAME);
  assert.ok(contact, "der angelegte Ansprechpartner fehlt in listContacts()");
  assertKeys(
    contact,
    [
      "id",
      "customer_id",
      "customer_name",
      "name",
      "function",
      "email",
      "is_active",
      "phones",
      "stage_ids",
    ],
    "ContactRow",
  );
  assert.equal(contact.customer_id, ID.customer);
  assert.equal(contact.customer_name, "I21 Kunde");
  assert.equal(contact.function, "I21 Funktion");
  assert.equal(contact.email, "i21.kontakt@beispiel.invalid");
  assert.equal(contact.phones.length, 2);
  assertKeys(contact.phones[0], ["id", "phone", "phone_type", "sort_order"], "PhoneRow");
  // Reihenfolge nach sort_order - genau die Reihenfolge aus phones_json.
  assert.deepEqual(
    contact.phones.map((p) => p.phone),
    [PHONE_A, PHONE_B],
  );
  assert.deepEqual(
    contact.phones.map((p) => p.sort_order),
    [0, 1],
  );
  assert.deepEqual(
    contact.phones.map((p) => p.phone_type),
    ["mobil", "festnetz"],
  );
  assert.equal(contact.stage_ids.length, 2);
  assert.deepEqual([...contact.stage_ids].sort(), [ID.stage, ID.stagePlain].sort());

  // Ersetzungssemantik: derselbe Kontakt mit nur EINER Nummer und EINEM
  // Bauabschnitt. Beide abhaengigen Mengen werden vollstaendig ersetzt.
  assert.deepEqual(
    await saveContact(
      null,
      contactForm({
        id: contact.id,
        customerId: ID.customer,
        name: CONTACT_NAME,
        phones: [{ phone: PHONE_B, phone_type: "festnetz" }],
        stageIds: [ID.stage],
      }),
    ),
    OK,
  );

  const updated = (await listContacts()).find((c) => c.id === contact.id);
  assert.ok(updated);
  assert.equal(updated.phones.length, 1);
  assert.equal(updated.phones[0].phone, PHONE_B);
  assert.equal(updated.phones[0].sort_order, 0);
  assert.deepEqual(updated.stage_ids, [ID.stage]);
});

test("IM7 saveContact hinterlaesst bei einem Fehler im zweiten Schritt keinen Teilstand", options, async () => {
  // Der wichtigste Atomaritaetsfall des Schreibpfads. saveContact loescht die
  // Telefonnummern und fuegt danach die neue Menge ein. Scheitert der zweite
  // Schritt, waere OHNE gemeinsame Transaktion der vorherige Stand dauerhaft
  // verloren - der Kontakt haette dann gar keine Nummer mehr.
  //
  // Der Fehlschlag wird NICHT im Produktionscode erzeugt, sondern in der
  // Datenbank: der Anwendungsrolle wird voruebergehend das insert-Recht auf
  // public.contact_phone_numbers entzogen (Muster aus ap14b-platform.int.mjs,
  // Fall I26). Das delete-Recht bleibt - der erste Schritt gelingt also.
  setSession(sessionFor(DISPO));

  const before = (await listContacts()).find((c) => c.name === CONTACT_NAME);
  assert.ok(before, "IM6 hat den Ansprechpartner nicht hinterlassen");
  assert.equal(before.phones.length, 1);
  const phoneBefore = before.phones[0];

  await admin.query("revoke insert on public.contact_phone_numbers from app_user");
  let outcome;
  try {
    outcome = await saveContact(
      null,
      contactForm({
        id: before.id,
        customerId: ID.customer,
        name: CONTACT_NAME,
        phones: [
          { phone: PHONE_A, phone_type: "mobil" },
          { phone: PHONE_B, phone_type: "festnetz" },
        ],
        stageIds: [ID.stage],
      }),
    );
  } finally {
    await admin.query("grant insert on public.contact_phone_numbers to app_user");
  }

  // Der Rechtestand ist wiederhergestellt, BEVOR irgendeine Zusicherung
  // greifen kann. Ohne diese Probe koennte eine spaetere Zusicherung auf einer
  // degradierten Testdatenbank laufen, ohne dass es auffaellt: ab IM10 wird
  // saveContact nur noch im Staff-verweigerten Zustand gerufen und erreicht das
  // SQL gar nicht mehr.
  assert.equal(await tablePrivilege("public.contact_phone_numbers", "insert"), true);

  // Neutrale Meldung: die Datenbankmeldung gelangt nicht in das Ergebnis.
  assert.deepEqual(outcome, { ok: false, error: SAVE_FAILED });

  // Kein Teilstand: die Nummer aus IM6 ist UNVERAENDERT vorhanden - dieselbe
  // Kennung, also nicht neu geschrieben, sondern das delete zurueckgerollt.
  const rows = await contactPhoneRows(before.id);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, phoneBefore.id);
  assert.equal(rows[0].phone, phoneBefore.phone);

  const after = (await listContacts()).find((c) => c.id === before.id);
  assert.equal(after.phones.length, 1);
  assert.equal(after.phones[0].id, phoneBefore.id);
});

test("IM8 saveTeam ersetzt die Mitgliedschaft vollstaendig", options, async () => {
  setSession(sessionFor(DISPO));

  const created = new FormData();
  created.set("name", TEAM_NAME);
  created.append("member_ids", ID.technicianA);
  created.append("member_ids", ID.technicianB);
  assert.deepEqual(await saveTeam(null, created), OK);

  const team = (await listTeams()).find((t) => t.name === TEAM_NAME);
  assert.ok(team, "das angelegte Team fehlt in listTeams()");
  assertKeys(team, ["id", "name", "is_active", "member_ids", "member_names"], "TeamRow");
  assert.equal(team.member_ids.length, 2);
  assert.deepEqual([...team.member_ids].sort(), [ID.technicianA, ID.technicianB].sort());
  // member_names ist im Mapper alphabetisch sortiert.
  assert.deepEqual(team.member_names, ["I21 Techniker A", "I21 Techniker B"]);

  const reduced = new FormData();
  reduced.set("id", team.id);
  reduced.set("name", TEAM_NAME);
  reduced.append("member_ids", ID.technicianB);
  assert.deepEqual(await saveTeam(null, reduced), OK);

  const after = (await listTeams()).find((t) => t.id === team.id);
  assert.ok(after);
  assert.deepEqual(after.member_ids, [ID.technicianB]);
  assert.deepEqual(after.member_names, ["I21 Techniker B"]);
});

test("IM9 Monteur-Import erkennt Neuanlage und DB-Dublette und legt nur die Neuen an", options, async () => {
  setSession(sessionFor(DISPO));

  const preview = await previewTechnicianImport(IMPORT_CSV);
  assert.equal(preview.ok, true);
  assert.equal(preview.fatal, null);
  assert.equal(preview.delimiter, ";");
  assert.deepEqual(preview.summary, {
    total: 2,
    neu: 1,
    dublette_datei: 0,
    dublette_db: 1,
    fehler: 0,
  });
  const neu = preview.rows.find((r) => r.status === "neu");
  assert.ok(neu);
  assert.equal(neu.last_name, IMPORT_LAST_NAME);
  assert.equal(neu.message, "Wird angelegt");
  const duplicate = preview.rows.find((r) => r.status === "dublette_db");
  assert.ok(duplicate);
  assert.equal(duplicate.last_name, "Techniker A");
  assert.equal(duplicate.message, "Monteur mit gleichem Namen existiert bereits");

  const commit = await commitTechnicianImport(IMPORT_CSV);
  assert.deepEqual(commit, {
    ok: true,
    inserted: 1,
    skipped: 1,
    failed: 0,
    message: "1 Monteur(e) angelegt, 1 übersprungen.",
  });
  assert.ok((await listTechnicians()).some((t) => t.last_name === IMPORT_LAST_NAME));
  assert.equal(await countBy(COUNT_TECHNICIANS_BY_LAST_NAME, IMPORT_LAST_NAME), 1);

  // Zweiter Lauf: jetzt ist die Zeile eine DB-Dublette, es wird nichts angelegt.
  const again = await commitTechnicianImport(IMPORT_CSV);
  assert.deepEqual(again, {
    ok: true,
    inserted: 0,
    skipped: 2,
    failed: 0,
    message: "Keine neuen Monteure zum Anlegen.",
  });
  assert.equal(await countBy(COUNT_TECHNICIANS_BY_LAST_NAME, IMPORT_LAST_NAME), 1);
});

/**
 * Ruft jede schreibende Stammdatenaktion auf und erwartet die Staff-Meldung.
 *
 * Alle erzeugten Bezeichner tragen `tag`; die Gegenprobe ueber die
 * ADMIN-Verbindung sucht genau diese Werte. Rueckgabe sind die benutzten
 * Bezeichner.
 */
async function expectAllSavesDenied(tag) {
  const names = {
    onCall: `I21-0000-${tag}`,
    customer: `I21 Kunde ${tag}`,
    stage: `I21 Bauabschnitt ${tag}`,
    contact: `I21 Kontakt ${tag}`,
    technician: `Techniker ${tag}`,
    team: `I21 Team ${tag}`,
    cableType: `i21c-kabel-${tag}`,
  };

  assert.deepEqual(
    await saveOnCallNumber(null, form({ number: names.onCall })),
    STAFF_DENIED,
    `saveOnCallNumber ${tag}`,
  );
  assert.deepEqual(
    await saveCustomer(null, form({ name: names.customer })),
    STAFF_DENIED,
    `saveCustomer ${tag}`,
  );
  assert.deepEqual(
    await saveStage(null, form({ name: names.stage })),
    STAFF_DENIED,
    `saveStage ${tag}`,
  );
  assert.deepEqual(
    await saveVzgLine(null, form({ line_number: "2199", construction_stage_id: ID.stage })),
    STAFF_DENIED,
    `saveVzgLine ${tag}`,
  );
  assert.deepEqual(
    await saveContact(
      null,
      contactForm({
        customerId: ID.customer,
        name: names.contact,
        phones: [{ phone: PHONE_A, phone_type: "mobil" }],
        stageIds: [ID.stage],
      }),
    ),
    STAFF_DENIED,
    `saveContact ${tag}`,
  );
  assert.deepEqual(
    await saveTechnician(null, form({ first_name: "I21", last_name: names.technician })),
    STAFF_DENIED,
    `saveTechnician ${tag}`,
  );
  const teamFd = new FormData();
  teamFd.set("name", names.team);
  teamFd.append("member_ids", ID.technicianA);
  assert.deepEqual(await saveTeam(null, teamFd), STAFF_DENIED, `saveTeam ${tag}`);
  assert.deepEqual(
    await saveCableType(null, form({ code: names.cableType, name: `I21 Kabelart ${tag}` })),
    STAFF_DENIED,
    `saveCableType ${tag}`,
  );
  assert.deepEqual(
    await saveSettings(null, form({})),
    STAFF_DENIED,
    `saveSettings ${tag}`,
  );

  // Der Import laeuft ueber denselben Staff-Schutz und nennt denselben Text.
  const preview = await previewTechnicianImport(IMPORT_CSV);
  assert.equal(preview.ok, false, `previewTechnicianImport ${tag}`);
  assert.equal(preview.fatal, STAFF_ONLY, `previewTechnicianImport ${tag}`);
  assert.deepEqual(preview.rows, [], `previewTechnicianImport ${tag}`);
  assert.deepEqual(
    await commitTechnicianImport(IMPORT_CSV),
    { ok: false, inserted: 0, skipped: 0, failed: 0, message: STAFF_ONLY },
    `commitTechnicianImport ${tag}`,
  );

  return names;
}

/** Gegenprobe ueber die ADMIN-Verbindung: keine der Zeilen ist entstanden. */
async function assertNothingWritten(names, label) {
  assert.equal(await countBy(COUNT_ON_CALL_BY_NUMBER, names.onCall), 0, `${label} on_call_numbers`);
  assert.equal(await countBy(COUNT_CUSTOMERS_BY_NAME, names.customer), 0, `${label} customers`);
  assert.equal(await countBy(COUNT_STAGES_BY_NAME, names.stage), 0, `${label} construction_stages`);
  assert.equal(await countBy(COUNT_CONTACTS_BY_NAME, names.contact), 0, `${label} contacts`);
  assert.equal(
    await countBy(COUNT_TECHNICIANS_BY_LAST_NAME, names.technician),
    0,
    `${label} technicians`,
  );
  assert.equal(await countBy(COUNT_TEAMS_BY_NAME, names.team), 0, `${label} teams`);
  assert.equal(
    await countBy(COUNT_CABLE_TYPES_BY_CODE, names.cableType),
    0,
    `${label} cable_types`,
  );
  assert.equal(await countBy(COUNT_VZG_IN_STAGE, ID.stage, "2199"), 0, `${label} vzg_lines`);
}

test("IM10 als Monteur wird jede Stammdatenaktion abgewiesen und schreibt nichts", options, async () => {
  setSession(sessionFor(MONTEUR));
  const settingsBefore = await appSettingsRow();

  const names = await expectAllSavesDenied("IM10");

  await assertNothingWritten(names, "IM10");
  // saveSettings schreibt in die Singletonzeile; sie muss unveraendert sein.
  assert.deepEqual(await appSettingsRow(), settingsBefore);
});

test("IM11 ohne Sitzung und mit Wechselzwang bleiben die Stammdaten fail-closed", options, async () => {
  const cases = [
    ["ohne Sitzung", "IM11a", () => clearSession()],
    [
      "mit Wechselzwang",
      "IM11b",
      // Der Stub behandelt mustChangePassword wie der Produktionscode:
      // getSessionProfile() liefert dann NULL (ADR-011 / 2.3).
      () => setSession(sessionFor(ADMIN, { mustChangePassword: true })),
    ],
  ];

  for (const [label, tag, apply] of cases) {
    apply();
    const settingsBefore = await appSettingsRow();

    assert.deepEqual(await listCustomers(), [], `${label} listCustomers`);
    assert.deepEqual(await listStages(), [], `${label} listStages`);
    assert.deepEqual(await listOnCallNumbers(), [], `${label} listOnCallNumbers`);
    assert.deepEqual(await listVzgLines(), [], `${label} listVzgLines`);
    assert.deepEqual(await listContacts(), [], `${label} listContacts`);
    assert.deepEqual(await listTechnicians(), [], `${label} listTechnicians`);
    assert.deepEqual(await listTeams(), [], `${label} listTeams`);
    assert.deepEqual(await listCableTypes(), [], `${label} listCableTypes`);
    assert.deepEqual(await listProfileOptions(), [], `${label} listProfileOptions`);
    // Vorgabewert von getAppSettings - unveraendert derselbe wie bisher.
    assert.deepEqual(
      await getAppSettings(),
      { id: 1, default_customer_id: null, default_on_call_number_id: null },
      `${label} getAppSettings`,
    );

    const names = await expectAllSavesDenied(tag);
    await assertNothingWritten(names, label);
    assert.deepEqual(await appSettingsRow(), settingsBefore, `${label} app_settings`);
  }
});

test("IM12 die Aktivschalter wirken als Staff, loesen revalidatePath aus und bleiben dem Monteur verschlossen", options, async () => {
  setSession(sessionFor(DISPO));

  resetRevalidateCalls();
  await setCustomerActive(form({ id: ID.customer, active: "false" }));
  assert.equal(await isActive(SELECT_CUSTOMER_ACTIVE, ID.customer), false);
  assert.ok(
    revalidatedPaths().includes("/stammdaten/kunden"),
    `revalidatePath fehlt: ${revalidatedPaths().join(", ")}`,
  );

  resetRevalidateCalls();
  await setTechnicianActive(form({ id: ID.technicianA, active: "false" }));
  assert.equal(await isActive(SELECT_TECHNICIAN_ACTIVE, ID.technicianA), false);
  assert.ok(revalidatedPaths().includes("/stammdaten/monteure"));

  resetRevalidateCalls();
  await setTeamActive(form({ id: ID.team, active: "false" }));
  assert.equal(await isActive(SELECT_TEAM_ACTIVE, ID.team), false);
  assert.ok(revalidatedPaths().includes("/stammdaten/teams"));

  // Als Monteur bleiben die Schalter wirkungslos: kein Schreibzugriff und
  // deshalb auch kein revalidatePath.
  setSession(sessionFor(MONTEUR));
  resetRevalidateCalls();
  await setCustomerActive(form({ id: ID.customer, active: "true" }));
  await setTechnicianActive(form({ id: ID.technicianA, active: "true" }));
  await setTeamActive(form({ id: ID.team, active: "true" }));
  assert.equal(await isActive(SELECT_CUSTOMER_ACTIVE, ID.customer), false);
  assert.equal(await isActive(SELECT_TECHNICIAN_ACTIVE, ID.technicianA), false);
  assert.equal(await isActive(SELECT_TEAM_ACTIVE, ID.team), false);
  assert.deepEqual(revalidatedPaths(), []);

  // Ausgangslage wiederherstellen - die Faelle darunter setzen sie voraus.
  setSession(sessionFor(DISPO));
  await setCustomerActive(form({ id: ID.customer, active: "true" }));
  await setTechnicianActive(form({ id: ID.technicianA, active: "true" }));
  await setTeamActive(form({ id: ID.team, active: "true" }));
  assert.equal(await isActive(SELECT_CUSTOMER_ACTIVE, ID.customer), true);
  assert.equal(await isActive(SELECT_TECHNICIAN_ACTIVE, ID.technicianA), true);
  assert.equal(await isActive(SELECT_TEAM_ACTIVE, ID.team), true);
});

// ==========================================================================
// B) Inventar (II1-II14)
// ==========================================================================

test("II1 Inventar-Reads laufen als Admin und liefern die bisherige Zeilenform", options, async () => {
  setSession(sessionFor(ADMIN));

  const material = (await listMaterials()).find((m) => m.id === ID.material);
  assert.ok(material, "Fixture-Material fehlt in listMaterials()");
  assertKeys(
    material,
    [
      "id",
      "material_no",
      "name",
      "category",
      "manufacturer",
      "unit",
      "min_stock",
      "purchase_price",
      "note",
      "is_active",
    ],
    "MaterialRow",
  );
  assert.equal(material.material_no, "I21-0001");
  assert.equal(material.unit, "Meter");
  // numeric kommt vom Treiber als Text; nOrNull macht daraus eine Zahl.
  assert.equal(typeof material.min_stock, "number");
  assert.equal(material.min_stock, 10);
  assert.equal(material.purchase_price, null);
  assert.equal(material.manufacturer, null);

  const location = (await listLocations()).find((l) => l.id === ID.central);
  assert.ok(location, "Fixture-Lagerort fehlt in listLocations()");
  assertKeys(
    location,
    ["id", "name", "location_type", "address", "responsible_person", "note", "is_active"],
    "LocationRow",
  );
  assert.equal(location.location_type, "zentrallager");

  const stock = (await getStock()).find(
    (s) => s.material_id === ID.material && s.location_id === ID.central,
  );
  assert.ok(stock, "Bestandszeile des Fixture-Materials fehlt in getStock()");
  assertKeys(
    stock,
    [
      "material_id",
      "material_no",
      "material_name",
      "unit",
      "min_stock",
      "location_id",
      "location_name",
      "location_type",
      "quantity",
      "material_total",
      "below_min",
    ],
    "StockRow",
  );
  assert.equal(stock.material_name, "I21 Material");
  assert.equal(stock.location_name, "I21 Zentrallager");
  assert.equal(typeof stock.quantity, "number");

  const low = (await getLowStockMaterials()).find((m) => m.id === ID.materialLow);
  assert.ok(low, "knappes Material fehlt in getLowStockMaterials()");
  assertKeys(low, ["id", "material_no", "name", "unit", "total", "min_stock"], "LowStockRow");
  assert.equal(low.total, 5);
  assert.equal(low.min_stock, 50);
  // Das inaktive Material bleibt aussen vor.
  assert.equal(
    (await getLowStockMaterials()).some((m) => m.id === ID.materialInactive),
    false,
  );

  const movements = await listMovements();
  assert.ok(Array.isArray(movements));

  const transfer = movements.find((m) => m.id === ID.movementTransfer);
  assert.ok(transfer, "Fixture-Umbuchung fehlt in listMovements()");
  assertKeys(
    transfer,
    [
      "id",
      "created_at",
      "movement_type",
      "quantity",
      "unit",
      "note",
      "material",
      "source",
      "target",
      "incident",
      "created_by",
      "created_by_name",
    ],
    "MovementRow",
  );
  assertKeys(transfer.material, ["id", "material_no", "name", "unit"], "MovementRow.material");
  assertKeys(transfer.source, ["id", "name"], "MovementRow.source");
  assertKeys(transfer.target, ["id", "name"], "MovementRow.target");
  assert.equal(transfer.material.id, ID.material);
  assert.equal(transfer.source.id, ID.central);
  assert.equal(transfer.target.id, ID.vehicle);
  assert.equal(transfer.movement_type, "umbuchung");
  assert.equal(typeof transfer.quantity, "number");
  assert.equal(transfer.quantity, 10);
  assert.equal(transfer.unit, "Meter");
  // Ohne Vorgangsbezug bzw. ohne Urheber bleibt NULL bzw. der Gedankenstrich.
  assert.equal(transfer.incident, null);
  assert.equal(transfer.created_by, null);
  assert.equal(transfer.created_by_name, "—");

  const takeout = movements.find((m) => m.id === ID.movementTakeout);
  assert.ok(takeout, "Fixture-Entnahme fehlt in listMovements()");
  assertKeys(takeout.incident, ["id", "incident_no"], "MovementRow.incident");
  assert.equal(takeout.incident.id, ID.incident);
  assert.equal(typeof takeout.incident.incident_no, "number");
  assert.equal(takeout.target, null);
  assert.equal(takeout.created_by, DISPO.id);
  assert.equal(takeout.created_by_name, DISPO.name);

  // Absteigend nach created_at - unveraenderte Ordnung.
  const timestamps = movements.map((m) => Date.parse(m.created_at));
  const sorted = [...timestamps].sort((a, b) => b - a);
  assert.deepEqual(timestamps, sorted);
});

test("II2 getStock liefert Bestand je Lagerort, Gesamtbestand und Mindestbestandskennzeichen", options, async () => {
  setSession(sessionFor(ADMIN));
  const rows = await getStock();

  // Fixture-Rechnung: 100 zu Zentrallager, 40 zu Fahrzeuglager, 10 umgebucht,
  // 5 auf den Vorgang entnommen -> zentral 85, Fahrzeug 50, gesamt 135.
  const central = rows.find(
    (s) => s.material_id === ID.material && s.location_id === ID.central,
  );
  const vehicle = rows.find(
    (s) => s.material_id === ID.material && s.location_id === ID.vehicle,
  );
  assert.ok(central && vehicle);
  assert.equal(central.quantity, 85);
  assert.equal(vehicle.quantity, 50);
  assert.equal(central.material_total, 135);
  assert.equal(vehicle.material_total, 135);
  assert.equal(central.min_stock, 10);
  assert.equal(central.below_min, false);
  assert.equal(central.material_total <= (central.min_stock ?? 0), central.below_min);

  // Gegenprobe unmittelbar auf der View ueber die ADMIN-Verbindung.
  assert.equal(await stockQuantity(ID.material, ID.central), 85);
  assert.equal(await stockQuantity(ID.material, ID.vehicle), 50);

  // Unter dem Mindestbestand: dieselbe Regel total <= (min_stock ?? 0).
  const low = rows.find(
    (s) => s.material_id === ID.materialLow && s.location_id === ID.central,
  );
  assert.ok(low);
  assert.equal(low.quantity, 5);
  assert.equal(low.material_total, 5);
  assert.equal(low.min_stock, 50);
  assert.equal(low.below_min, true);
  assert.equal(low.material_total <= (low.min_stock ?? 0), low.below_min);
});

test("II3 created_at einer Bewegung ist eine ISO-8601-Zeichenkette", options, async () => {
  // Nachweis der to_json-Projektion: ohne sie gaebe der Treiber ein JS-Date
  // heraus, MovementRow.created_at ist aber eine Zeichenkette.
  setSession(sessionFor(ADMIN));
  const movement = (await listMovements()).find((m) => m.id === ID.movementIn1);
  assert.ok(movement);
  assert.equal(typeof movement.created_at, "string");
  assert.match(movement.created_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  assert.equal(Number.isNaN(new Date(movement.created_at).getTime()), false);
});

test("II4 Material und Lagerort sind Administratorsache", options, async () => {
  setSession(sessionFor(ADMIN));
  assert.deepEqual(
    await saveMaterial(
      null,
      form({ material_no: "I21-0011", name: "I21 Material II4", unit: "Stk", min_stock: "3" }),
    ),
    OK,
  );
  const saved = (await listMaterials()).find((m) => m.name === "I21 Material II4");
  assert.ok(saved);
  assert.equal(saved.unit, "Stk");
  assert.equal(saved.min_stock, 3);

  assert.deepEqual(
    await saveLocation(
      null,
      form({ name: "I21 Lagerort II4", location_type: "baustellenlager" }),
    ),
    OK,
  );
  assert.ok((await listLocations()).some((l) => l.name === "I21 Lagerort II4"));

  // Disposition und Monteur scheitern beide - materials_write und
  // locations_write fordern is_admin(), Staff genuegt hier NICHT.
  for (const person of [DISPO, MONTEUR]) {
    setSession(sessionFor(person));
    const materialName = `I21 Material Versuch ${person.role}`;
    const locationName = `I21 Lagerort Versuch ${person.role}`;
    assert.deepEqual(
      await saveMaterial(null, form({ name: materialName, unit: "Stk" })),
      { ok: false, error: MATERIAL_ADMIN_ONLY },
      person.role,
    );
    assert.deepEqual(
      await saveLocation(null, form({ name: locationName, location_type: "zentrallager" })),
      { ok: false, error: LOCATION_ADMIN_ONLY },
      person.role,
    );
    assert.equal(await countBy(COUNT_MATERIALS_BY_NAME, materialName), 0, person.role);
    assert.equal(await countBy(COUNT_LOCATIONS_BY_NAME, locationName), 0, person.role);
  }
});

test("II5 createMovement bucht als Disposition und veraendert den Bestand", options, async () => {
  setSession(sessionFor(DISPO));
  const centralBefore = await stockQuantity(ID.material, ID.central);
  const vehicleBefore = await stockQuantity(ID.material, ID.vehicle);

  assert.deepEqual(
    await createMovement(
      null,
      form({
        movement_type: "wareneingang",
        material_id: ID.material,
        quantity: "20",
        target_location_id: ID.central,
        note: NOTE.receipt,
      }),
    ),
    OK,
  );
  assert.equal(await stockQuantity(ID.material, ID.central), centralBefore + 20);

  assert.deepEqual(
    await createMovement(
      null,
      form({
        movement_type: "umbuchung",
        material_id: ID.material,
        quantity: "15",
        source_location_id: ID.central,
        target_location_id: ID.vehicle,
        note: NOTE.transfer,
      }),
    ),
    OK,
  );
  assert.equal(await stockQuantity(ID.material, ID.central), centralBefore + 5);
  assert.equal(await stockQuantity(ID.material, ID.vehicle), vehicleBefore + 15);

  const booked = await movementsByNote(NOTE.transfer);
  assert.equal(booked.length, 1);
  assert.equal(booked[0].movement_type, "umbuchung");
  assert.equal(booked[0].source_location_id, ID.central);
  assert.equal(booked[0].target_location_id, ID.vehicle);

  // Der Monteur darf diese Buchungsarten nicht.
  setSession(sessionFor(MONTEUR));
  assert.deepEqual(
    await createMovement(
      null,
      form({
        movement_type: "wareneingang",
        material_id: ID.material,
        quantity: "1",
        target_location_id: ID.central,
        note: NOTE.monteurReceipt,
      }),
    ),
    { ok: false, error: MOVEMENT_STAFF_ONLY },
  );
  assert.equal((await movementsByNote(NOTE.monteurReceipt)).length, 0);
});

test("II6 createMovement weist unzulaessige Eingaben mit den bisherigen Meldungen ab", options, async () => {
  setSession(sessionFor(DISPO));
  const cases = [
    [
      { movement_type: "unbekannt", material_id: ID.material, quantity: "1", target_location_id: ID.central },
      "Ungültiger Bewegungstyp.",
    ],
    [
      { movement_type: "wareneingang", material_id: ID.material, quantity: "0", target_location_id: ID.central },
      "Menge muss größer als 0 sein.",
    ],
    [
      { movement_type: "wareneingang", material_id: ID.material, quantity: "-5", target_location_id: ID.central },
      "Menge muss größer als 0 sein.",
    ],
    [
      { movement_type: "wareneingang", material_id: ID.material, quantity: "1" },
      "Ziellager ist erforderlich.",
    ],
    [
      {
        movement_type: "umbuchung",
        material_id: ID.material,
        quantity: "1",
        source_location_id: ID.central,
        target_location_id: ID.central,
      },
      "Quell- und Ziellager müssen verschieden sein.",
    ],
    [
      {
        movement_type: "korrektur",
        material_id: ID.material,
        quantity: "1",
        source_location_id: ID.central,
        target_location_id: ID.vehicle,
      },
      "Bei Korrektur genau ein Lager (Zugang ODER Abgang) wählen.",
    ],
    [
      { movement_type: "korrektur", material_id: ID.material, quantity: "1" },
      "Bei Korrektur genau ein Lager (Zugang ODER Abgang) wählen.",
    ],
  ];

  for (const [fields, message] of cases) {
    assert.deepEqual(
      await createMovement(null, form({ ...fields, note: NOTE.invalid })),
      { ok: false, error: message },
      message,
    );
  }
  assert.equal((await movementsByNote(NOTE.invalid)).length, 0);
});

test("II7 eine Buchung auf inaktives Material wird abgewiesen", options, async () => {
  setSession(sessionFor(DISPO));
  assert.deepEqual(
    await createMovement(
      null,
      form({
        movement_type: "wareneingang",
        material_id: ID.materialInactive,
        quantity: "1",
        target_location_id: ID.central,
        note: NOTE.inactive,
      }),
    ),
    { ok: false, error: "Material ist inaktiv." },
  );
  assert.equal((await movementsByNote(NOTE.inactive)).length, 0);
});

test("II8 die gebuchte Einheit stammt aus dem Material und nicht aus dem Formular", options, async () => {
  // Das Formular schickt bewusst eine ABWEICHENDE Einheit mit. Uebernommen wird
  // sie nicht: die Einheit gehoert zum Material (materialUnit()).
  setSession(sessionFor(MONTEUR));
  assert.deepEqual(
    await takeoutMaterial(
      null,
      form({
        incident_id: ID.incident,
        material_id: ID.material,
        source_location_id: ID.central,
        quantity: "2",
        unit: "Kilometer",
        note: NOTE.unit,
      }),
    ),
    OK,
  );

  const rows = await movementsByNote(NOTE.unit);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].unit, "Meter");
  assert.notEqual(rows[0].unit, "Kilometer");
  assert.equal(rows[0].movement_type, "entnahme_vorgang");
  assert.equal(rows[0].created_by, MONTEUR.id);
});

test("II9 Entnahme und Verbrauch gelingen dem zugewiesenen Monteur, nicht dem fremden", options, async () => {
  setSession(sessionFor(MONTEUR));
  assert.deepEqual(
    await takeoutMaterial(
      null,
      form({
        incident_id: ID.incident,
        material_id: ID.material,
        source_location_id: ID.central,
        quantity: "6",
        note: NOTE.takeout,
      }),
    ),
    OK,
  );
  assert.equal((await movementsByNote(NOTE.takeout)).length, 1);

  assert.deepEqual(
    await consumeMaterial(
      null,
      form({
        incident_id: ID.incident,
        material_id: ID.material,
        source_location_id: ID.central,
        quantity: "1",
        note: NOTE.consume,
      }),
    ),
    OK,
  );
  const consumed = await movementsByNote(NOTE.consume);
  assert.equal(consumed.length, 1);
  assert.equal(consumed[0].movement_type, "verbrauch");

  // Der fremde Monteur ist dem Vorgang nicht zugewiesen und wird abgewiesen.
  //
  // WARUM SICH DER TEXT GEAENDERT HAT: die Abweisung liegt jetzt FRUEHER. Bis zur
  // Vorgangssperre lief die Buchung bis zum Insert und scheiterte dort an der
  // Policy movements_insert (SQLSTATE 42501, "keine Berechtigung."). Seit F3
  // sperrt jeder vorgangsbezogene Weg als erste Anweisung die Vorgangszeile; fuer
  // den fremden Monteur liefert diese Abfrage keine Zeile (incidents_select /
  // incidents_update), die Transaktion endet ohne Insert und mit dem neutralen
  // Verweistext. Der neutrale Text ist beabsichtigt: er unterscheidet "nicht
  // sichtbar" nicht von "nicht vorhanden" und ist damit keine Existenzaussage
  // ueber fremde Vorgaenge.
  //
  // Der eigentliche Nachweis bleibt unveraendert: es entsteht keine Zeile.
  setSession(sessionFor(FREMD));
  const denied = await takeoutMaterial(
    null,
    form({
      incident_id: ID.incident,
      material_id: ID.material,
      source_location_id: ID.central,
      quantity: "1",
      note: NOTE.foreign,
    }),
  );
  assert.equal(denied.ok, false);
  assert.equal(denied.error, `${TAKEOUT_PREFIX}: ${REFERENCE_INVALID}`);
  assert.equal((await movementsByNote(NOTE.foreign)).length, 0);
});

test("II10 der Bestandswaechter verhindert eine Entnahme ueber den Bestand hinaus", options, async () => {
  setSession(sessionFor(MONTEUR));
  const before = await stockQuantity(ID.material, ID.central);

  const result = await takeoutMaterial(
    null,
    form({
      incident_id: ID.incident,
      material_id: ID.material,
      source_location_id: ID.central,
      quantity: "100000",
      note: NOTE.overdraw,
    }),
  );
  assert.equal(result.ok, false);
  assert.ok(result.error.startsWith(TAKEOUT_PREFIX), result.error);
  assert.equal(result.error, `${TAKEOUT_PREFIX}: Bestand nicht ausreichend.`);

  assert.equal((await movementsByNote(NOTE.overdraw)).length, 0);
  assert.equal(await stockQuantity(ID.material, ID.central), before);
});

test("II11 die Rueckgabe ist auf die entnommene Restmenge begrenzt", options, async () => {
  setSession(sessionFor(MONTEUR));
  const available = await returnableQuantity(ID.incident, ID.material);
  assert.ok(available >= 2, `rueckgabefaehige Menge ist ${available}`);

  const tooMuch = available + 1;
  assert.deepEqual(
    await returnMaterial(
      null,
      form({
        incident_id: ID.incident,
        material_id: ID.material,
        target_location_id: ID.central,
        quantity: String(tooMuch),
        note: NOTE.returnTooMuch,
      }),
    ),
    {
      ok: false,
      error: `Rückgabe (${tooMuch}) größer als entnommene Restmenge (${available}).`,
    },
  );
  assert.equal((await movementsByNote(NOTE.returnTooMuch)).length, 0);

  assert.deepEqual(
    await returnMaterial(
      null,
      form({
        incident_id: ID.incident,
        material_id: ID.material,
        target_location_id: ID.central,
        quantity: "2",
        note: NOTE.returnOk,
      }),
    ),
    OK,
  );
  const returned = await movementsByNote(NOTE.returnOk);
  assert.equal(returned.length, 1);
  assert.equal(returned[0].movement_type, "rueckgabe");
  assert.equal(await returnableQuantity(ID.incident, ID.material), available - 2);
});

test("II12 die Bewegungschronik ist unveraenderbar - kein Modulpfad und kein Recht", options, async () => {
  // Es gibt in src/lib/inventory.ts und src/lib/inventory-actions.ts keinen
  // Export, der eine Bewegung aendert oder loescht - nur Inserts und Reads. Die
  // messbare Schranke dahinter ist das fehlende Tabellenrecht (0015 vergibt auf
  // public.inventory_movements bewusst nur select und insert).
  assert.equal(await tablePrivilege("public.inventory_movements", "update"), false);
  assert.equal(await tablePrivilege("public.inventory_movements", "delete"), false);
  assert.equal(await tablePrivilege("public.inventory_movements", "select"), true);
  assert.equal(await tablePrivilege("public.inventory_movements", "insert"), true);
});

test("II13 created_by stammt aus der Sitzung und nicht aus der Eingabe", options, async () => {
  setSession(sessionFor(DISPO));
  // Das Formular schickt zusaetzlich created_by und created_at mit. Beide
  // Spalten bleiben Spaltendefault der Datenbank; die Aktion liest die Felder
  // nicht einmal.
  assert.deepEqual(
    await createMovement(
      null,
      form({
        movement_type: "wareneingang",
        material_id: ID.material,
        quantity: "1",
        target_location_id: ID.central,
        note: NOTE.author,
        created_by: FREMD.id,
        created_at: "2000-01-01T00:00:00Z",
      }),
    ),
    OK,
  );

  const rows = await movementsByNote(NOTE.author);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].created_by, DISPO.id);
  assert.notEqual(rows[0].created_by, FREMD.id);
  assert.ok(
    rows[0].created_at.getTime() > Date.parse("2020-01-01T00:00:00Z"),
    String(rows[0].created_at),
  );
});

test("II14 ohne Sitzung und mit Wechselzwang bleibt das Inventar fail-closed", options, async () => {
  const cases = [
    ["ohne Sitzung", () => clearSession()],
    ["mit Wechselzwang", () => setSession(sessionFor(ADMIN, { mustChangePassword: true }))],
  ];

  for (const [label, apply] of cases) {
    apply();

    assert.deepEqual(await listMaterials(), [], `${label} listMaterials`);
    assert.deepEqual(await listLocations(), [], `${label} listLocations`);
    assert.deepEqual(await getStock(), [], `${label} getStock`);
    assert.deepEqual(await getLowStockMaterials(), [], `${label} getLowStockMaterials`);
    assert.deepEqual(await listMovements(), [], `${label} listMovements`);
    assert.equal(await returnableQuantity(ID.incident, ID.material), 0, `${label} returnable`);

    const materialName = `I21 Material ${label}`;
    const locationName = `I21 Lagerort ${label}`;
    assert.deepEqual(
      await saveMaterial(null, form({ name: materialName, unit: "Stk" })),
      { ok: false, error: MATERIAL_ADMIN_ONLY },
      label,
    );
    assert.deepEqual(
      await saveLocation(null, form({ name: locationName, location_type: "zentrallager" })),
      { ok: false, error: LOCATION_ADMIN_ONLY },
      label,
    );
    assert.deepEqual(
      await createMovement(
        null,
        form({
          movement_type: "wareneingang",
          material_id: ID.material,
          quantity: "1",
          target_location_id: ID.central,
          note: NOTE.noSession,
        }),
      ),
      { ok: false, error: MOVEMENT_STAFF_ONLY },
      label,
    );

    for (const [name, action] of [
      ["takeoutMaterial", takeoutMaterial],
      ["returnMaterial", returnMaterial],
      ["consumeMaterial", consumeMaterial],
    ]) {
      assert.deepEqual(
        await action(
          null,
          form({
            incident_id: ID.incident,
            material_id: ID.material,
            source_location_id: ID.central,
            target_location_id: ID.central,
            quantity: "1",
            note: NOTE.noSession,
          }),
        ),
        { ok: false, error: NOT_SIGNED_IN },
        `${label} ${name}`,
      );
    }

    // Gegenprobe: es ist keine Zeile entstanden. Die Abweisung erfolgt im
    // Anwendungscode vor withUserTransaction(), es lief also kein SQL.
    assert.equal((await movementsByNote(NOTE.noSession)).length, 0, label);
    assert.equal(await countBy(COUNT_MATERIALS_BY_NAME, materialName), 0, label);
    assert.equal(await countBy(COUNT_LOCATIONS_BY_NAME, locationName), 0, label);
  }
});

// ==========================================================================
// C) Nachgezogene Faelle zu den Reviewfeststellungen F1-F3 (II15-II19)
//
// Sie stehen bewusst NACH II14 und nicht zwischen den vorhandenen Faellen: II9
// und II11 rechnen mit relativen Restmengen, eine vorgeschaltete Buchung wuerde
// sie verschieben.
// ==========================================================================

test("II15 eine nicht freigegebene Rolle wird von createMovement abgewiesen und schreibt nichts", options, async () => {
  // F1: createMovement entscheidet jetzt ueber eine Allowlist (admin,
  // disponent) statt ueber die Verbotsliste `role === "monteur"`. Genau dieser
  // Unterschied wird gemessen: eine Rolle, die weder in der Allowlist noch in
  // der alten Verbotsliste steht, haette mit der Verbotsliste buchen DUERFEN.
  //
  // Die Identitaet bleibt in allen Faellen dieselbe (ADMIN) und nur die Rolle
  // wechselt - abgewiesen wird also nachweislich wegen der Rolle.
  const cases = [
    ["gast", NOTE.roleGuest],
    ["ausgeschieden", NOTE.roleOther],
    // Verhaltensgleichheit zum Bestand: der Monteur bleibt ausgeschlossen.
    ["monteur", NOTE.roleMonteur],
  ];

  for (const [role, note] of cases) {
    setSession(sessionFor(ADMIN, { role }));
    assert.deepEqual(
      await createMovement(
        null,
        form({
          movement_type: "wareneingang",
          material_id: ID.material,
          quantity: "1",
          target_location_id: ID.central,
          note,
        }),
      ),
      { ok: false, error: MOVEMENT_STAFF_ONLY },
      role,
    );
    // Gegenprobe: es ist keine Zeile entstanden. Die Abweisung liegt vor
    // withUserTransaction(), es lief also kein SQL.
    assert.equal((await movementsByNote(note)).length, 0, role);
  }
});

test("II16 ein fehlendes Material wird in allen vier Buchungswegen abgewiesen", options, async () => {
  // Gegenprobe zuerst: zu dieser Kennung gibt es wirklich keine Zeile.
  assert.equal(await countBy(COUNT_MATERIALS_BY_ID, ID.materialUnknown), 0);

  // F2: bisher hat materialUnit() fuer eine fehlende Zeile still "Stk"
  // geliefert und createMovement hat sie mit `mat && mat.is_active === false`
  // ausdruecklich durchgelassen; abgebrochen wurde erst am Fremdschluessel.
  // Jetzt bricht jeder der vier Wege VOR dem Insert fachlich ab.
  //
  // GRENZE DIESES NACHWEISES, ausdruecklich: von aussen ist das Ergebnis
  // dasselbe wie vorher. Der alte Pfad scheiterte am Fremdschluessel (23503),
  // und dbError() bildet 23503 auf GENAU DENSELBEN Text ab; auch damals entstand
  // keine Zeile. Die Zusicherungen unten haetten also vor F2 ebenfalls bestanden
  // - mit Ausnahme der Abgrenzung zum inaktiven Material am Ende. Dieser Fall
  // ist deshalb eine VerhaltensSPERRE gegen einen kuenftigen Rueckfall (etwa
  // eine neu eingefuehrte Vorgabeeinheit oder ein aufgeschobener
  // Fremdschluessel) und kein Beweis der inneren Umstellung. Die innere
  // Umstellung ist statisch belegt: es gibt in inventory-actions.ts keinen
  // `?? "Stk"` mehr.
  const bookings = [
    [
      "createMovement",
      DISPO,
      createMovement,
      MOVEMENT_PREFIX,
      NOTE.missingMovement,
      { movement_type: "wareneingang", target_location_id: ID.central },
    ],
    [
      "takeoutMaterial",
      MONTEUR,
      takeoutMaterial,
      TAKEOUT_PREFIX,
      NOTE.missingTakeout,
      { incident_id: ID.incident, source_location_id: ID.central },
    ],
    [
      "returnMaterial",
      MONTEUR,
      returnMaterial,
      RETURN_PREFIX,
      NOTE.missingReturn,
      { incident_id: ID.incident, target_location_id: ID.central },
    ],
    [
      "consumeMaterial",
      MONTEUR,
      consumeMaterial,
      CONSUME_PREFIX,
      NOTE.missingConsume,
      { incident_id: ID.incident, source_location_id: ID.central },
    ],
  ];

  for (const [name, person, action, prefix, note, fields] of bookings) {
    setSession(sessionFor(person));
    assert.deepEqual(
      await action(
        null,
        form({ ...fields, material_id: ID.materialUnknown, quantity: "1", note }),
      ),
      { ok: false, error: `${prefix}: ${REFERENCE_INVALID}` },
      name,
    );
    assert.equal((await movementsByNote(note)).length, 0, name);
  }

  // Unterscheidbar von einem VORHANDENEN, aber inaktiven Material: dort steht
  // ein anderer, fachlich zutreffender Text. Waeren beide Texte gleich, waere
  // die Ursache fuer den Benutzer nicht erkennbar.
  setSession(sessionFor(DISPO));
  assert.deepEqual(
    await createMovement(
      null,
      form({
        movement_type: "wareneingang",
        material_id: ID.materialInactive,
        quantity: "1",
        target_location_id: ID.central,
        note: NOTE.missingInactive,
      }),
    ),
    { ok: false, error: MATERIAL_INACTIVE },
  );
  assert.equal((await movementsByNote(NOTE.missingInactive)).length, 0);
  assert.notEqual(MATERIAL_INACTIVE, `${MOVEMENT_PREFIX}: ${REFERENCE_INVALID}`);
});

test("II17 ein fehlender oder nicht sichtbarer Vorgang bricht fail-closed ab", options, async () => {
  // Gegenprobe zuerst: zu dieser Kennung gibt es wirklich keine Zeile.
  assert.equal(await countBy(COUNT_INCIDENTS_BY_ID, ID.incidentUnknown), 0);

  // F3: die Vorgangssperre ist die ERSTE Anweisung der Transaktion. Liefert sie
  // keine Zeile, endet die Transaktion ohne Insert.
  const paths = [
    ["takeoutMaterial", takeoutMaterial, TAKEOUT_PREFIX],
    ["returnMaterial", returnMaterial, RETURN_PREFIX],
    ["consumeMaterial", consumeMaterial, CONSUME_PREFIX],
  ];

  setSession(sessionFor(MONTEUR));
  const missingNotes = [
    NOTE.unknownIncidentTakeout,
    NOTE.unknownIncidentReturn,
    NOTE.unknownIncidentConsume,
  ];
  for (const [index, [name, action, prefix]] of paths.entries()) {
    const note = missingNotes[index];
    assert.deepEqual(
      await action(
        null,
        form({
          incident_id: ID.incidentUnknown,
          material_id: ID.material,
          source_location_id: ID.central,
          target_location_id: ID.central,
          quantity: "1",
          note,
        }),
      ),
      { ok: false, error: `${prefix}: ${REFERENCE_INVALID}` },
      `${name} fehlender Vorgang`,
    );
    assert.equal((await movementsByNote(note)).length, 0, `${name} fehlender Vorgang`);
  }

  // Zweiter Teil: derselbe Aufruf als FREMDER Monteur mit dem ECHTEN Vorgang.
  // Fuer ihn liefert die Sperrabfrage ebenfalls keine Zeile (incidents_select
  // und incidents_update tragen dieselbe Bedingung: is_staff() oder
  // is_assigned_to_incident()). Der Text ist ABSICHTLICH derselbe wie oben -
  // "nicht sichtbar" und "nicht vorhanden" sollen nicht unterscheidbar sein,
  // sonst waere die Meldung eine Existenzaussage ueber fremde Vorgaenge.
  setSession(sessionFor(FREMD));
  const foreignNotes = [
    NOTE.foreignIncidentTakeout,
    NOTE.foreignIncidentReturn,
    NOTE.foreignIncidentConsume,
  ];
  for (const [index, [name, action, prefix]] of paths.entries()) {
    const note = foreignNotes[index];
    assert.deepEqual(
      await action(
        null,
        form({
          incident_id: ID.incident,
          material_id: ID.material,
          source_location_id: ID.central,
          target_location_id: ID.central,
          quantity: "1",
          note,
        }),
      ),
      { ok: false, error: `${prefix}: ${REFERENCE_INVALID}` },
      `${name} fremder Vorgang`,
    );
    assert.equal((await movementsByNote(note)).length, 0, `${name} fremder Vorgang`);
  }
});

test("II18 zwei gleichzeitige Rueckgaben ueberschreiten die Restmenge nicht", options, async () => {
  // DER fachlich entscheidende Fall zu F3. Vor der Korrektur haetten BEIDE
  // Rueckgaben bestanden: unter READ COMMITTED sah returnableQuantityIn() die
  // parallele, noch nicht festgeschriebene Rueckgabe nicht, und datenbankseitig
  // faengt das niemand auf - check_inventory_nonnegative() prueft ausschliesslich
  // Abgaenge, eine Rueckgabe ist ein Zugang.
  //
  // Seit F3 sperrt returnMaterial() als erste Anweisung die Vorgangszeile: die
  // zweite Transaktion WARTET an dieser Sperre, bis die erste festgeschrieben
  // ist, und liest danach einen neuen Snapshot - sie rechnet also mit der
  // bereits verringerten Restmenge.
  //
  // Bewusst OHNE Zeitannahme: kein setTimeout, keine Barriere, keine kuenstliche
  // Wartezeit. Die Serialisierung entsteht allein aus der Sperre, die nur
  // Millisekunden gehalten wird (statement_timeout liegt bei 15 000 ms,
  // src/lib/db/index.ts).
  setSession(sessionFor(MONTEUR));

  // Schritt 1: die Restmenge auf einen selbst gesetzten, kleinen Wert bringen.
  // Die dafuer noetige Buchung wird aus der GELESENEN Restmenge abgeleitet; der
  // Fall haengt an keiner absoluten Bestandszahl und ist unabhaengig davon,
  // welche Faelle vorher gebucht haben.
  const LIMIT = 3;
  const before = await returnableQuantity(ID.incident, ID.material);
  if (before > LIMIT) {
    assert.deepEqual(
      await returnMaterial(
        null,
        form({
          incident_id: ID.incident,
          material_id: ID.material,
          target_location_id: ID.central,
          quantity: String(before - LIMIT),
          note: NOTE.racePrepReturn,
        }),
      ),
      OK,
      "Vorbereitung: Restmenge senken",
    );
  } else if (before < LIMIT) {
    assert.deepEqual(
      await takeoutMaterial(
        null,
        form({
          incident_id: ID.incident,
          material_id: ID.material,
          source_location_id: ID.central,
          quantity: String(LIMIT - before),
          note: NOTE.racePrepTakeout,
        }),
      ),
      OK,
      "Vorbereitung: Restmenge erhoehen",
    );
  }
  assert.equal(
    await returnableQuantity(ID.incident, ID.material),
    LIMIT,
    "Vorbereitung hat die Restmenge nicht genau auf LIMIT gebracht",
  );

  // Schritt 2: zwei Rueckgaben ueber je LIMIT - zusammen also 2 * LIMIT - ECHT
  // gleichzeitig. Beide Promises werden erst erzeugt und dann GEMEINSAM
  // abgewartet, nicht nacheinander.
  const returnOf = (note) =>
    returnMaterial(
      null,
      form({
        incident_id: ID.incident,
        material_id: ID.material,
        target_location_id: ID.central,
        quantity: String(LIMIT),
        note,
      }),
    );
  const first = returnOf(NOTE.raceReturnA);
  const second = returnOf(NOTE.raceReturnB);
  const results = await Promise.all([first, second]);

  // Schritt 3: genau eine Buchung, genau eine Abweisung.
  const succeeded = results.filter((r) => r.ok === true);
  const failed = results.filter((r) => r.ok === false);
  assert.equal(succeeded.length, 1, JSON.stringify(results));
  assert.equal(failed.length, 1, JSON.stringify(results));
  assert.deepEqual(succeeded[0], OK);
  // Unveraenderter Restmengentext, available = 0: nach der ersten Rueckgabe ist
  // nichts mehr rueckgabefaehig.
  assert.equal(failed[0].error, `Rückgabe (${LIMIT}) größer als entnommene Restmenge (0).`);

  const bookedA = await movementsByNote(NOTE.raceReturnA);
  const bookedB = await movementsByNote(NOTE.raceReturnB);
  assert.equal(
    bookedA.length + bookedB.length,
    1,
    "ueber beide Notizen zusammen darf genau EINE Bewegungszeile existieren",
  );

  const afterwards = await returnableQuantity(ID.incident, ID.material);
  assert.equal(afterwards, 0);
  assert.ok(afterwards >= 0, `Restmenge ist negativ: ${afterwards}`);

  // Gegenprobe ueber die ADMIN-Verbindung, unabhaengig vom Modulpfad: die Summe
  // der Rueckgaben hat die Summe der Entnahmen nie ueberschritten.
  const takenTotal = await movementSum(ID.incident, ID.material, "entnahme_vorgang");
  const returnedTotal = await movementSum(ID.incident, ID.material, "rueckgabe");
  assert.ok(
    returnedTotal <= takenTotal,
    `zurueckgegeben ${returnedTotal}, entnommen ${takenTotal}`,
  );
});

test("II19 die Vorgangssperre blockiert legitime Buchungen nicht", options, async () => {
  // Gegenprobe zu F3: die Sperre darf niemanden aussperren, der buchen darf.
  // Geprueft werden BEIDE zulaessigen Identitaeten - der zugewiesene Monteur
  // (sichtbar und sperrbar ueber is_assigned_to_incident()) und die Disposition
  // (ueber is_staff()).
  const rounds = [
    [MONTEUR, NOTE.lockTakeoutMonteur, NOTE.lockConsumeMonteur, NOTE.lockReturnMonteur],
    [DISPO, NOTE.lockTakeoutDispo, NOTE.lockConsumeDispo, NOTE.lockReturnDispo],
  ];

  for (const [person, takeoutNote, consumeNote, returnNote] of rounds) {
    setSession(sessionFor(person));
    const before = await returnableQuantity(ID.incident, ID.material);
    assert.ok(before >= 0, `${person.role}: Restmenge vor der Runde ist ${before}`);

    assert.deepEqual(
      await takeoutMaterial(
        null,
        form({
          incident_id: ID.incident,
          material_id: ID.material,
          source_location_id: ID.central,
          quantity: "4",
          note: takeoutNote,
        }),
      ),
      OK,
      `${person.role} Entnahme`,
    );
    assert.equal((await movementsByNote(takeoutNote)).length, 1, `${person.role} Entnahme`);
    assert.equal(await returnableQuantity(ID.incident, ID.material), before + 4);

    assert.deepEqual(
      await consumeMaterial(
        null,
        form({
          incident_id: ID.incident,
          material_id: ID.material,
          source_location_id: ID.central,
          quantity: "1",
          note: consumeNote,
        }),
      ),
      OK,
      `${person.role} Verbrauch`,
    );
    assert.equal((await movementsByNote(consumeNote)).length, 1, `${person.role} Verbrauch`);
    // Ein Verbrauch ist keine Entnahme auf den Vorgang und veraendert die
    // rueckgabefaehige Menge deshalb nicht.
    assert.equal(await returnableQuantity(ID.incident, ID.material), before + 4);

    assert.deepEqual(
      await returnMaterial(
        null,
        form({
          incident_id: ID.incident,
          material_id: ID.material,
          target_location_id: ID.central,
          quantity: "2",
          note: returnNote,
        }),
      ),
      OK,
      `${person.role} Rueckgabe`,
    );
    assert.equal((await movementsByNote(returnNote)).length, 1, `${person.role} Rueckgabe`);

    const after = await returnableQuantity(ID.incident, ID.material);
    assert.equal(after, before + 2, `${person.role} Restmenge nach der Runde`);
    assert.ok(after >= 0, `${person.role}: Restmenge ist negativ: ${after}`);
  }
});
