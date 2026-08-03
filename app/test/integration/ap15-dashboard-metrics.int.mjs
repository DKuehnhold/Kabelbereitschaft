// AP15-1/W2 Integrationstest der statusbasierten Dashboardkennzahlen gegen ein
// synthetisches PostgreSQL 18.
//
// Lauf:
//   AP14B_APP_DATABASE_URL=...   Verbindung der Anwendung (Rolle erbt app_user,
//                                kein SUPERUSER, kein BYPASSRLS)
//   AP14B_ADMIN_DATABASE_URL=... Verbindung der Migrations-/Eigentuemerrolle,
//                                ausschliesslich fuer Fixtures und Gegenproben
//   node --import ./test/integration/module-hooks-app.mjs \
//        test/integration/ap15-dashboard-metrics.int.mjs
//
// Ohne diese beiden Variablen werden alle Pruefungen uebersprungen; die Datei
// ist damit in einer Umgebung ohne Datenbank harmlos.
//
// BETRIEBSART "PFLICHTMODUS" (AP14B_REQUIRE_INTEGRATION=1): dann gilt das
// Ueberspringen ausdruecklich NICHT. Fehlt eine der beiden Verbindungsvariablen,
// bricht die Datei bereits beim Laden ab. Grund: in der GitHub-CI darf ein
// fehlender Verbindungswert nicht zu einem gruenen Lauf ohne Nachweis fuehren -
// ein stiller Skip waere dort ein vorgetaeuschter Nachweis. Dasselbe
// fail-closed Muster benutzen ap14b-admin-users.int.mjs und
// ap14b-minio-live.int.mjs. Ohne den Schalter - also im lokalen Gebrauch ohne
// Datenbank - bleibt das Skip-Verhalten unveraendert.
//
// WARUM DIESE DATEI NOETIG IST: die Kennzahlen der statusbasierten
// Dashboardkacheln entstehen seit AP15-1 in EINER SQL-Anweisung
// (src/lib/incident-metrics.ts) statt in JavaScript aus der vollstaendig
// geladenen Vorgangsliste. TypeScript, ESLint und der Next-Build erkennen einen
// Fehler in einer SQL-Zeichenkette nicht, und der Einheitentest
// test/ap15-incident-metrics.test.mjs prueft ausschliesslich Parameter und Form
// des Anweisungstextes. Der SQL-Smoke wiederum prueft die Datenbankseite, aber
// keine Zeile des Moduls. Hier laeuft deshalb die ECHTE Modulfunktion
// `getIncidentStatusMetrics()` gegen echtes PostgreSQL und wird gegen die
// ABGELOESTE JS-Aggregation derselben Sitzung gestellt. Im Test wird KEIN
// Anwendungs-SQL nachgebaut; die ADMIN-Verbindung dient ausschliesslich
// Fixtures, Aufraeumen und Gegenproben.
//
// Ersetzt sind ausschliesslich die beiden Abhaengigkeiten, die eine
// Next-Laufzeit verlangen (siehe module-hooks-app.mjs): `next/cache` und
// `@/lib/auth`. Die Identitaet wird ueber setSession() eingespeist; die
// Sitzungsauswertung selbst ist an anderer Stelle geprueft.
//
// Es kommen ausschliesslich synthetische Werte vor: Kennungen mit dem Praefix
// 24f00000- (er kommt in keiner anderen Test- oder Migrationsdatei vor -
// 20_ap14b_data.sql benutzt 20b00000-, 21_ap14b_masterdata_inventory.sql
// 21b00000-, ap14b-masterdata-inventory.int.mjs 21c00000-, ap14b-platform.int.mjs
// ac140b00-, ap14b-images.int.mjs 23d00000-, ap14b-minio-live.int.mjs 24d00000-,
// ap14b-admin-users.int.mjs 25e00000-), Namen mit dem Praefix "K24",
// E-Mail-Adressen auf @beispiel.invalid, keine echten Personen, keine
// Telefonnummern, keine Lager-, GPS-/EXIF- oder Zugangsdaten, kein Passwort und
// kein Hashmaterial.
//
// AUFRAEUMEN - BEWUSSTE UND BEGRUENDETE GRENZE:
// `public.incidents`, `public.incident_tasks` und der eigene
// `public.construction_stages`-Satz werden NICHT geloescht, und das ist eine
// Entscheidung aus der Schemalage, keine Nachlaessigkeit:
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
// dokumentierte Entscheidung aus supabase/test/20_ap14b_data.sql:28-43, die auch
// ap14b-masterdata-inventory.int.mjs:622-641 uebernimmt. Beide Startskripte
// (run_db_tests.sh, run_ap14b_local.ps1) entfernen die Testdatenbank am Laufende;
// die Aufraeumbilanz wird fuer diese drei Tabellen also auf Datenbank-, Rollen-,
// Cluster- und Portebene erbracht und nicht auf Zeilenebene. Die verbleibende
// Zeilenzahl wird in test.after als "AUFRAEUMBILANZ AP15" ausgegeben, damit sie
// im Nachweis sichtbar bleibt und nicht als "aufgeraeumt" missverstanden wird.
// Alle Fixture-Inserts sind mit `on conflict (id) do nothing` wiederholbar.

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
    `AP15-1-Integrationsnachweis nicht lauffaehig, Pflichtvariablen fehlen: ${missing.join(", ")}. ` +
      "Bei gesetztem AP14B_REQUIRE_INTEGRATION=1 wird dieser Lauf ausdruecklich NICHT uebersprungen.",
  );
}

// Muss vor der ersten Abfrage stehen: der Pool in src/lib/db liest die Variable
// beim ersten Verbindungsaufbau.
if (ENABLED) process.env.DATABASE_URL = APP_URL;

const { setSession, clearSession } = await import("./stubs/session.mjs");

const { getIncidentStatusMetrics } = await import("../../src/lib/incident-metrics.ts");
const { listIncidents } = await import("../../src/lib/incidents.ts");
const { isOpenStatus, TERMINAL_STATUS } = await import("../../src/lib/status.ts");

// --------------------------------------------------------------------------
// Synthetische Fixtures
// --------------------------------------------------------------------------

const PREFIX = "24f00000-";

const ID = {
  // Identitaeten
  admin: `${PREFIX}0000-0000-0000-000000000001`,
  dispo: `${PREFIX}0000-0000-0000-000000000002`,
  monteur1: `${PREFIX}0000-0000-0000-000000000003`,
  monteur2: `${PREFIX}0000-0000-0000-000000000004`,
  monteur3: `${PREFIX}0000-0000-0000-000000000005`,
  // Bauphase
  stage: `${PREFIX}0000-0000-0000-0000000000a1`,
  // Vorgaenge V-A bis V-H
  incidentA: `${PREFIX}0000-0000-0000-0000000000b1`,
  incidentB: `${PREFIX}0000-0000-0000-0000000000b2`,
  incidentC: `${PREFIX}0000-0000-0000-0000000000b3`,
  incidentD: `${PREFIX}0000-0000-0000-0000000000b4`,
  incidentE: `${PREFIX}0000-0000-0000-0000000000b5`,
  incidentF: `${PREFIX}0000-0000-0000-0000000000b6`,
  incidentG: `${PREFIX}0000-0000-0000-0000000000b7`,
  incidentH: `${PREFIX}0000-0000-0000-0000000000b8`,
  // Zuweisungen
  assignA1: `${PREFIX}0000-0000-0000-0000000000c1`,
  assignB1: `${PREFIX}0000-0000-0000-0000000000c2`,
  assignB2: `${PREFIX}0000-0000-0000-0000000000c3`,
  assignC2: `${PREFIX}0000-0000-0000-0000000000c4`,
  assignE2: `${PREFIX}0000-0000-0000-0000000000c5`,
  assignF1: `${PREFIX}0000-0000-0000-0000000000c6`,
  assignG1: `${PREFIX}0000-0000-0000-0000000000c7`,
  assignH1: `${PREFIX}0000-0000-0000-0000000000c8`,
};

/**
 * Platzhalter aus Migration 0012: absichtlich kein anmeldefaehiger Hash.
 *
 * Begruendung uebernommen aus ap14b-masterdata-inventory.int.mjs:169-182:
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
  email: "k24.admin@beispiel.invalid",
  name: "K24 Administrator",
  role: "admin",
};
const DISPO = {
  id: ID.dispo,
  sid: `${PREFIX}0000-0000-0000-00000000d102`,
  email: "k24.dispo@beispiel.invalid",
  name: "K24 Disposition",
  role: "disponent",
};
const MONTEUR1 = {
  id: ID.monteur1,
  sid: `${PREFIX}0000-0000-0000-00000000d103`,
  email: "k24.monteur.eins@beispiel.invalid",
  name: "K24 Monteur eins",
  role: "monteur",
};
const MONTEUR2 = {
  id: ID.monteur2,
  sid: `${PREFIX}0000-0000-0000-00000000d104`,
  email: "k24.monteur.zwei@beispiel.invalid",
  name: "K24 Monteur zwei",
  role: "monteur",
};
/** Fremder Monteur: OHNE jede Zuweisung - Nachweis gegen ein Zaehlleck. */
const MONTEUR3 = {
  id: ID.monteur3,
  sid: `${PREFIX}0000-0000-0000-00000000d105`,
  email: "k24.monteur.drei@beispiel.invalid",
  name: "K24 Monteur drei",
  role: "monteur",
};
const PEOPLE = [ADMIN, DISPO, MONTEUR1, MONTEUR2, MONTEUR3];

/**
 * Die acht Vorgaenge dieses Tests.
 *
 * `status` wird unmittelbar in der insert-Anweisung gesetzt. Das ist zulaessig
 * und braucht keinen Umweg: der Statuswaechter `tg_incident_guard` ist
 * ausschliesslich `before update on public.incidents` (0001_init.sql:415-417),
 * beim Einfuegen greift er also nicht. `tg_incident_status_history`
 * (0001_init.sql:376-390) schreibt dabei je Vorgang einen Chronikeintrag; er
 * wird beim Aufraeumen mit entfernt.
 *
 * Pflichtspalten von public.incidents sind construction_stage_id,
 * vzg_line_number und km_from (0001_init.sql:185-188; 0008 hat die beiden
 * letzten auf nullable gestellt, sie werden hier trotzdem gefuellt).
 */
const INCIDENTS = [
  { key: "V-A", id: ID.incidentA, status: "neu", km: 24.1 },
  { key: "V-B", id: ID.incidentB, status: "technisch_abgeschlossen", km: 24.2 },
  { key: "V-C", id: ID.incidentC, status: "warten_auf_db", km: 24.3 },
  { key: "V-D", id: ID.incidentD, status: "warten_auf_material", km: 24.4 },
  { key: "V-E", id: ID.incidentE, status: "in_bearbeitung", km: 24.5 },
  { key: "V-F", id: ID.incidentF, status: "abgeschlossen", km: 24.6 },
  { key: "V-G", id: ID.incidentG, status: "storniert", km: 24.7 },
  { key: "V-H", id: ID.incidentH, status: "fehlalarm", km: 24.8 },
];

/**
 * Die Zuweisungen. `is_active = false` genau einmal (V-E/M2): nur so ist
 * nachweisbar, dass eine INAKTIVE Zuweisung nicht in `monteure_im_einsatz`
 * eingeht. M3 erhaelt keine Zuweisung.
 */
const ASSIGNMENTS = [
  { id: ID.assignA1, incidentId: ID.incidentA, monteurId: ID.monteur1, active: true },
  { id: ID.assignB1, incidentId: ID.incidentB, monteurId: ID.monteur1, active: true },
  { id: ID.assignB2, incidentId: ID.incidentB, monteurId: ID.monteur2, active: true },
  { id: ID.assignC2, incidentId: ID.incidentC, monteurId: ID.monteur2, active: true },
  { id: ID.assignE2, incidentId: ID.incidentE, monteurId: ID.monteur2, active: false },
  { id: ID.assignF1, incidentId: ID.incidentF, monteurId: ID.monteur1, active: true },
  { id: ID.assignG1, incidentId: ID.incidentG, monteurId: ID.monteur1, active: true },
  { id: ID.assignH1, incidentId: ID.incidentH, monteurId: ID.monteur1, active: true },
];

const INCIDENT_IDS = INCIDENTS.map((incident) => incident.id);
const PERSON_IDS = PEOPLE.map((person) => person.id);
const ASSIGNMENT_IDS = ASSIGNMENTS.map((assignment) => assignment.id);
/** Alle eigenen Kennungen - Grundlage der Auditbereinigung und der Gegenprobe. */
const OWN_IDS = [...PERSON_IDS, ...INCIDENT_IDS, ...ASSIGNMENT_IDS, ID.stage];

/** Die fuenf Kennzahlfelder - Reihenfolge ohne Bedeutung. */
const METRIC_KEYS = [
  "offen",
  "technisch_abgeschlossen",
  "warten_auf_db",
  "warten_auf_material",
  "monteure_im_einsatz",
];

let admin;

// --------------------------------------------------------------------------
// Die ABGELOESTE JS-Aggregation
//
// Zeichengleich zu dem Code, der aus app/src/app/dashboard/page.tsx entfernt
// wurde: genau diese Berechnung ersetzt getIncidentStatusMetrics(). Sie steht
// hier als Sollwert, damit die Umstellung nicht nur "irgendwelche" Zahlen
// liefert, sondern DIESELBEN.
// --------------------------------------------------------------------------
function jsMetrics(rows) {
  const offen = rows.filter((r) => isOpenStatus(r.status));
  return {
    offen: offen.length,
    technisch_abgeschlossen: rows.filter((r) => r.status === "technisch_abgeschlossen").length,
    warten_auf_db: rows.filter((r) => r.status === "warten_auf_db").length,
    warten_auf_material: rows.filter((r) => r.status === "warten_auf_material").length,
    monteure_im_einsatz: new Set(
      offen.flatMap((r) => r.assignments.filter((a) => a.is_active).map((a) => a.monteur_id)),
    ).size,
  };
}

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

/** Aktiv zugewiesene Monteure einer Zeile aus listIncidents(). */
function activeMonteure(row) {
  return row.assignments.filter((a) => a.is_active).map((a) => a.monteur_id);
}

/** Eigene Fixturezeile aus der Liste - oder undefined. */
function ownRow(rows, id) {
  return rows.find((row) => row.id === id);
}

/**
 * Kernvergleich: DB-Kennzahl gegen JS-Aggregation DERSELBEN Sitzung.
 *
 * Beide Seiten sehen dieselbe Zeilenmenge, weil beide Wege ueber dieselbe RLS
 * laufen - `getIncidentStatusMetrics()` ueber public.incident_list_view
 * (security_invoker) und `listIncidents()` ueber public.incidents. Verglichen
 * wird die GESAMTE sichtbare Menge; fremde Fixtures anderer Testdateien in
 * derselben Datenbank sind dabei unschaedlich, weil sie in BEIDEN Zahlen
 * gleichermassen stecken.
 */
async function compare(person, label) {
  setSession(sessionFor(person));
  const rows = await listIncidents();
  const js = jsMetrics(rows);
  const db = await getIncidentStatusMetrics();
  assert.deepEqual(db, js, `${label}: DB-Kennzahl weicht von der JS-Aggregation ab`);
  return { rows, js, db };
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
// public.profiles.id auf public.auth_accounts umgehaengt hat.
//
// `on conflict (id) do nothing` haelt die Fixtures wiederholbar, ohne fremde
// Zeilen zu beruehren - und ohne die Vorgaenge eines vorherigen Laufs zu
// veraendern, die nach der Loeschsperre stehen bleiben (siehe Dateikopf).
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
     values ($1::uuid, 'K24', 'K24 Bauphase Dashboardkennzahlen')
     on conflict (id) do nothing`,
    [ID.stage],
  );

  for (const incident of INCIDENTS) {
    await admin.query(
      `insert into public.incidents
         (id, construction_stage_id, vzg_line_number, km_from, status, description)
       values ($1::uuid, $2::uuid, '2400', $3::numeric, $4::public.incident_status, $5::text)
       on conflict (id) do nothing`,
      [
        incident.id,
        ID.stage,
        incident.km,
        incident.status,
        `AP15-1 Kennzahlen - Vorgang ${incident.key} (${incident.status})`,
      ],
    );
  }

  for (const assignment of ASSIGNMENTS) {
    // `unassigned_at` wird bei der inaktiven Zuweisung mitgesetzt, damit die
    // Zeile fachlich stimmig ist. Der Teilindex uq_assignment_active
    // (0001_init.sql:222-223) gilt nur fuer aktive Zuweisungen.
    await admin.query(
      `insert into public.incident_assignments
         (id, incident_id, monteur_id, is_active, unassigned_at)
       values ($1::uuid, $2::uuid, $3::uuid, $4::boolean,
               case when $4::boolean then null else now() end)
       on conflict (id) do nothing`,
      [assignment.id, assignment.incidentId, assignment.monteurId, assignment.active],
    );
  }
}

/**
 * Aufraeumen in fremdschluesselsicherer Reihenfolge.
 *
 * Reihenfolge und Begruendung:
 *   a) audit_events der eigenen Kennungen. `tg_audit` (0001_init.sql:89-97)
 *      schreibt die ZEILEN-id als entity_id; die Aufgabenzeilen tragen eine
 *      vergebene Kennung ohne eigenen Praefix und werden deshalb ueber ihren
 *      incident_id-Bezug gefunden.
 *   b) profiles-Verweise der BLEIBENDEN Zeilen loesen. public.incidents
 *      (created_by 0001:203, updated_by 0001:205, closed_by 0001:201,
 *      call_taken_by 0001:181) und public.incident_tasks (created_by/updated_by
 *      0011:42-44, assignee_profile_id 0011:36, acknowledged_by 0011:40) zeigen
 *      nach 0012 auf public.profiles. Alle Spalten sind nullable. Ohne dieses
 *      Loesen scheitert (e) am Fremdschluessel.
 *   c) incident_status_history je Vorgang (vom Chroniktrigger erzeugt).
 *   d) incident_assignments je Vorgang.
 *   e) profiles - erst jetzt zeigt keine bleibende Zeile mehr auf sie.
 *   f) auth_accounts - nach den Profilen, weil profiles.id auf sie verweist.
 *   g) audit_events ein ZWEITES Mal. Die Loeschungen in (b), (c) und (d)
 *      erzeugen selbst neue Auditsaetze: trg_audit_incidents (0001:455-457),
 *      trg_audit_assignments (0001:458-460) und - ueber
 *      trg_sync_tasks_assignments (0011:271-273) - trg_audit_incident_tasks
 *      (0011:109-111). Ohne diesen zweiten Durchgang koennte die zaehlende
 *      Gegenprobe nicht bestehen.
 *
 * NICHT geloescht werden public.incidents, public.incident_tasks und
 * public.construction_stages - Begruendung mit Belegstellen im Dateikopf
 * (0011:28, 0011:113-123, identisch entschieden in 20_ap14b_data.sql:28-43).
 * Es wird dafuer KEIN Trigger abgeschaltet und KEIN Recht geaendert.
 */
async function tearDownFixtures() {
  await deleteOwnAuditEvents();

  // (b) Verweise der bleibenden Zeilen loesen. Die `where`-Bedingung haelt die
  // Anweisung im Regelfall wirkungslos: die Fixtures schreiben ohne gesetzte
  // Identitaet, `app.current_user_id()` liefert dann NULL (0012:9-26).
  await admin.query(
    `update public.incidents
        set created_by = null, updated_by = null, closed_by = null, call_taken_by = null
      where id = any($1::uuid[])
        and (created_by is not null or updated_by is not null
             or closed_by is not null or call_taken_by is not null)`,
    [INCIDENT_IDS],
  );
  await admin.query(
    `update public.incident_tasks
        set created_by = null, updated_by = null, assignee_profile_id = null
      where incident_id = any($1::uuid[])
        and (created_by is not null or updated_by is not null
             or assignee_profile_id is not null)`,
    [INCIDENT_IDS],
  );
  // `acknowledged_by` getrennt und nur fuer nicht quittierte Aufgaben: bei
  // status = 'acknowledged' muessen acknowledged_at UND acknowledged_by gesetzt
  // sein (Kohaerenz-Constraint 0011:69-76). Eine abgeleitete Fixture-Aufgabe
  // wird in diesem Test nie quittiert; bliebe eine solche Zeile doch stehen,
  // scheitert (e) sichtbar am Fremdschluessel statt still etwas zu verbiegen.
  await admin.query(
    `update public.incident_tasks
        set acknowledged_by = null
      where incident_id = any($1::uuid[])
        and acknowledged_by is not null
        and status <> 'acknowledged'`,
    [INCIDENT_IDS],
  );

  await admin.query(
    `delete from public.incident_status_history where incident_id = any($1::uuid[])`,
    [INCIDENT_IDS],
  );
  await admin.query(
    `delete from public.incident_assignments where incident_id = any($1::uuid[])`,
    [INCIDENT_IDS],
  );
  await admin.query(`delete from public.profiles where id = any($1::uuid[])`, [PERSON_IDS]);
  await admin.query(`delete from public.auth_accounts where id = any($1::uuid[])`, [PERSON_IDS]);

  await deleteOwnAuditEvents();
}

/** Auditsaetze der eigenen Kennungen und der Aufgaben der eigenen Vorgaenge. */
async function deleteOwnAuditEvents() {
  await admin.query(
    `delete from public.audit_events
      where actor = any($1::uuid[])
         or entity_id = any($1::uuid[])
         or (entity = 'incident_tasks'
             and entity_id in (
               select id from public.incident_tasks where incident_id = any($2::uuid[])
             ))`,
    [OWN_IDS, INCIDENT_IDS],
  );
}

// --------------------------------------------------------------------------
// Zaehlende Gegenproben des Aufraeumens
// --------------------------------------------------------------------------

const COUNT_AUDIT = `select count(*)::integer as rows
                       from public.audit_events
                      where actor = any($1::uuid[])
                         or entity_id = any($1::uuid[])
                         or (entity = 'incident_tasks'
                             and entity_id in (
                               select id from public.incident_tasks
                                where incident_id = any($2::uuid[])
                             ))`;
const COUNT_HISTORY = `select count(*)::integer as rows
                         from public.incident_status_history
                        where incident_id = any($1::uuid[])`;
const COUNT_ASSIGNMENTS = `select count(*)::integer as rows
                             from public.incident_assignments
                            where incident_id = any($1::uuid[])`;
const COUNT_PROFILES = `select count(*)::integer as rows
                          from public.profiles where id = any($1::uuid[])`;
const COUNT_ACCOUNTS = `select count(*)::integer as rows
                          from public.auth_accounts where id = any($1::uuid[])`;
// Gegenprobe zu Schritt (b): keine bleibende Zeile verweist mehr auf ein
// eigenes Profil.
const COUNT_INCIDENT_REFS = `select count(*)::integer as rows
                               from public.incidents
                              where id = any($1::uuid[])
                                and (created_by is not null or updated_by is not null
                                     or closed_by is not null or call_taken_by is not null)`;
const COUNT_TASK_REFS = `select count(*)::integer as rows
                           from public.incident_tasks
                          where incident_id = any($1::uuid[])
                            and (created_by is not null or updated_by is not null
                                 or assignee_profile_id is not null
                                 or acknowledged_by is not null)`;
// Nicht leerbar - wird ausschliesslich BERICHTET, nicht zugesichert.
const COUNT_INCIDENTS = `select count(*)::integer as rows
                           from public.incidents where id = any($1::uuid[])`;
const COUNT_TASKS = `select count(*)::integer as rows
                       from public.incident_tasks where incident_id = any($1::uuid[])`;
const COUNT_STAGES = `select count(*)::integer as rows
                        from public.construction_stages where id = $1::uuid`;

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
    ["audit_events", await countBy(COUNT_AUDIT, [OWN_IDS, INCIDENT_IDS])],
    ["incident_status_history", await countBy(COUNT_HISTORY, [INCIDENT_IDS])],
    ["incident_assignments", await countBy(COUNT_ASSIGNMENTS, [INCIDENT_IDS])],
    ["profiles", await countBy(COUNT_PROFILES, [PERSON_IDS])],
    ["auth_accounts", await countBy(COUNT_ACCOUNTS, [PERSON_IDS])],
    ["incidents.profil-verweise", await countBy(COUNT_INCIDENT_REFS, [INCIDENT_IDS])],
    ["incident_tasks.profil-verweise", await countBy(COUNT_TASK_REFS, [INCIDENT_IDS])],
  ];
  const leftovers = remaining.filter(([, rows]) => rows > 0);

  // AUFRAEUMBILANZ der drei nicht leerbaren Tabellen: nur berichtet, KEIN
  // assert. Begruendung im Dateikopf (0011:28, 0011:113-123,
  // 20_ap14b_data.sql:28-43). Die Zeilen verschwinden mit der Testdatenbank.
  const stillThere = {
    incidents: await countBy(COUNT_INCIDENTS, [INCIDENT_IDS]),
    incident_tasks: await countBy(COUNT_TASKS, [INCIDENT_IDS]),
    construction_stages: await countBy(COUNT_STAGES, [ID.stage]),
  };
  console.log(
    `AUFRAEUMBILANZ AP15: nicht leerbar wegen trg_incident_tasks_no_delete - ` +
      `public.incidents ${stillThere.incidents}, ` +
      `public.incident_tasks ${stillThere.incident_tasks}, ` +
      `public.construction_stages ${stillThere.construction_stages} ` +
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
// A) Gleichheit von Datenbankaggregat und abgeloester JS-Aggregation
// ==========================================================================

test("V1 Administrator: DB-Kennzahl gleich JS-Aggregation", options, async () => {
  const { js } = await compare(ADMIN, "V1");
  // Ohne diese Probe koennte der Vergleich auf zwei leeren Mengen bestehen.
  assert.ok(js.offen > 0, "V1: kein offener Vorgang sichtbar - der Vergleich traf leer");
});

test("V2 Disponent: DB-Kennzahl gleich JS-Aggregation", options, async () => {
  const { js } = await compare(DISPO, "V2");
  assert.ok(js.offen > 0, "V2: kein offener Vorgang sichtbar - der Vergleich traf leer");
});

test("V3 zugewiesener Monteur: DB-Kennzahl gleich JS-Aggregation", options, async () => {
  // WARUM DIE GLEICHHEIT AUCH FUER EINEN MONTEUR GILT, obwohl
  // public.incident_list_view fuer monteur_ids ueber public.profiles joint
  // (0011:683-689): `assignments_select` begrenzt einen Monteur auf seine
  // EIGENEN Zuweisungszeilen (0001:551-552), und sein eigenes Profil ist ihm
  // sichtbar (`profiles_select`, 0001:508-509). Die Zuweisungs-Unterabfrage in
  // listIncidents() unterliegt derselben RLS. Beide Wege sehen deshalb genau
  // ihn selbst - der Join verwirft nichts, was der andere Weg noch fuehrte.
  const { rows, js, db } = await compare(MONTEUR1, "V3");
  assert.ok(js.offen > 0, "V3: der zugewiesene Monteur sieht keinen offenen Vorgang");

  // Sichtbar sind ausschliesslich die Vorgaenge mit eigener aktiver Zuweisung.
  const own = rows.filter((row) => INCIDENT_IDS.includes(row.id)).map((row) => row.id);
  assert.deepEqual(
    [...own].sort(),
    [ID.incidentA, ID.incidentB, ID.incidentF, ID.incidentG, ID.incidentH].sort(),
    "V3: abweichende Zeilensicht des zugewiesenen Monteurs",
  );
  // In seiner Sicht ist er selbst der einzige Monteur im Einsatz.
  assert.equal(db.monteure_im_einsatz, 1, "V3: nicht genau ein Monteur im Einsatz");
});

test("V4 fremder Monteur: keine eigene Fixturezeile und alle Kennzahlen 0", options, async () => {
  // Gegenprobe gegen ein Zaehlleck. M3 hat KEINE Zuweisung; `incidents_select`
  // (0001:540-541) macht ihm damit keinen Vorgang sichtbar, und weil die
  // Kennzahlen ueber die security_invoker-View derselben RLS laufen, darf auch
  // keine ZAHL etwas verraten. Dass die Kennzahlen nicht aus einer anderen
  // Quelle stammen, zeigt der Vergleich mit derselben leeren Zeilenmenge.
  setSession(sessionFor(MONTEUR3));
  const rows = await listIncidents();
  const own = rows.filter((row) => row.id.startsWith(PREFIX));
  assert.deepEqual(
    own.map((row) => row.id),
    [],
    "V4: der fremde Monteur sieht eigene Fixturezeilen",
  );

  const db = await getIncidentStatusMetrics();
  for (const key of METRIC_KEYS) {
    assert.equal(db[key], 0, `V4: ${key} ist nicht 0`);
  }
  assert.deepEqual(db, jsMetrics(rows), "V4: DB-Kennzahl weicht von der JS-Aggregation ab");
});

test("V5 ohne Sitzung sind alle fuenf Werte 0 und es faellt keine Ausnahme", options, async () => {
  clearSession();
  const db = await getIncidentStatusMetrics();
  for (const key of METRIC_KEYS) {
    assert.equal(db[key], 0, `V5: ${key} ist nicht 0`);
  }
  // Und der bisherige Weg verhaelt sich unveraendert: keine Zeile, keine
  // Ausnahme.
  assert.deepEqual(await listIncidents(), [], "V5: ohne Sitzung kommen Zeilen zurueck");
});

// ==========================================================================
// B) Die vier fachlichen Kanten der Aggregation
// ==========================================================================

test("V6 Terminalstatus zaehlen nicht als offen - auch fehlalarm nicht", options, async () => {
  const { rows, js, db } = await compare(ADMIN, "V6");

  // Die Differenz zwischen allen sichtbaren Zeilen und `offen` sind genau die
  // Zeilen mit einem Status aus TERMINAL_STATUS.
  const terminalRows = rows.filter((row) => TERMINAL_STATUS.includes(row.status));
  assert.equal(
    rows.length - js.offen,
    terminalRows.length,
    "V6: die Differenz zu den sichtbaren Zeilen sind nicht genau die Terminalzeilen",
  );
  assert.equal(db.offen, js.offen, "V6: abweichende Zahl offener Vorgaenge");

  // Konkret V-F ('abgeschlossen'), V-G ('storniert') und V-H ('fehlalarm').
  const terminalFixtures = [
    ["V-F", ID.incidentF],
    ["V-G", ID.incidentG],
    ["V-H", ID.incidentH],
  ];
  for (const [key, id] of terminalFixtures) {
    const row = ownRow(rows, id);
    assert.ok(row, `V6: Fixture ${key} fehlt in listIncidents()`);
    assert.equal(isOpenStatus(row.status), false, `V6: ${key} gilt als offen`);
    assert.ok(
      terminalRows.some((terminal) => terminal.id === id),
      `V6: ${key} steht nicht in der Terminalmenge`,
    );
  }

  // Dieselbe Aggregation ueber AUSSCHLIESSLICH diesen drei Zeilen ergibt null
  // offene Vorgaenge - und trotz aktiver Zuweisung keinen Monteur im Einsatz.
  const onlyTerminal = jsMetrics(terminalFixtures.map(([, id]) => ownRow(rows, id)));
  assert.equal(onlyTerminal.offen, 0, "V6: eine Terminalzeile zaehlt als offen");
  assert.equal(
    onlyTerminal.monteure_im_einsatz,
    0,
    "V6: eine Terminalzeile bringt einen Monteur in den Einsatz",
  );
});

test("V7 eine inaktive Zuweisung zaehlt nicht als Monteur im Einsatz", options, async () => {
  const { rows, js, db } = await compare(ADMIN, "V7");

  const rowE = ownRow(rows, ID.incidentE);
  assert.ok(rowE, "V7: Fixture V-E fehlt in listIncidents()");
  assert.equal(rowE.assignments.length, 1, "V7: V-E traegt nicht genau eine Zuweisung");
  assert.deepEqual(activeMonteure(rowE), [], "V7: die Zuweisung von V-E ist aktiv");
  assert.equal(isOpenStatus(rowE.status), true, "V7: V-E ist nicht offen");

  // M2 geht ausschliesslich ueber V-B und V-C in die Zaehlung ein - nicht ueber
  // V-E.
  const openWithMonteur2 = rows
    .filter(
      (row) =>
        INCIDENT_IDS.includes(row.id) &&
        isOpenStatus(row.status) &&
        activeMonteure(row).includes(ID.monteur2),
    )
    .map((row) => row.id);
  assert.deepEqual(
    [...openWithMonteur2].sort(),
    [ID.incidentB, ID.incidentC].sort(),
    "V7: M2 geht ueber andere Vorgaenge als V-B und V-C ein",
  );
  assert.equal(
    db.monteure_im_einsatz,
    js.monteure_im_einsatz,
    "V7: abweichende Zahl der Monteure im Einsatz",
  );
});

test("V8 ein Monteur in mehreren offenen Vorgaengen zaehlt nur einmal", options, async () => {
  const { rows, js, db } = await compare(ADMIN, "V8");

  const openWithMonteur1 = rows
    .filter(
      (row) =>
        INCIDENT_IDS.includes(row.id) &&
        isOpenStatus(row.status) &&
        activeMonteure(row).includes(ID.monteur1),
    )
    .map((row) => row.id);
  assert.ok(
    openWithMonteur1.length >= 2,
    `V8: M1 ist nur in ${openWithMonteur1.length} offenen Vorgang/Vorgaengen aktiv`,
  );

  // Die flache Liste enthaelt M1 mehrfach; die Kennzahl entspricht der
  // MENGENGROESSE - damit ist die Entdopplung ueber Vorgangsgrenzen belegt.
  const flat = rows
    .filter((row) => isOpenStatus(row.status))
    .flatMap((row) => activeMonteure(row));
  assert.ok(
    flat.filter((id) => id === ID.monteur1).length >= 2,
    "V8: M1 kommt in der flachen Liste nicht mehrfach vor",
  );
  assert.equal(new Set(flat).size, db.monteure_im_einsatz, "V8: die Entdopplung fehlt");
  assert.equal(js.monteure_im_einsatz, db.monteure_im_einsatz, "V8: abweichende Mengengroesse");
});

test("V9 ein offener Vorgang OHNE Monteur bleibt in offen gezaehlt", options, async () => {
  // Der `unnest`-Zweig der Anweisung steht in einer getrennten Unterabfrage.
  // Stuende er in derselben Projektion, fiele genau diese Zeile heraus.
  const { rows, js, db } = await compare(ADMIN, "V9");

  const rowD = ownRow(rows, ID.incidentD);
  assert.ok(rowD, "V9: Fixture V-D fehlt in listIncidents()");
  assert.deepEqual(rowD.assignments, [], "V9: V-D traegt eine Zuweisung");
  assert.equal(isOpenStatus(rowD.status), true, "V9: V-D ist nicht offen");

  const offenIds = rows.filter((row) => isOpenStatus(row.status)).map((row) => row.id);
  assert.ok(offenIds.includes(ID.incidentD), "V9: V-D fehlt in der Menge der offenen Vorgaenge");
  assert.equal(db.offen, js.offen, "V9: abweichende Zahl offener Vorgaenge");
  assert.ok(db.warten_auf_material >= 1, "V9: V-D fehlt in warten_auf_material");
});

// ==========================================================================
// C) Kein Zustand ueber die Poolverbindung hinaus
// ==========================================================================

test("V10 zwei aufeinanderfolgende Aufrufe liefern denselben Wert", options, async () => {
  // Der Aufruf laeuft ohne eine von aussen geoeffnete Transaktion: er oeffnet
  // seine eigene, setzt `app.user_id` transaktionslokal und gibt die Verbindung
  // an den Pool zurueck. Bliebe dabei etwas an der Verbindung haengen - eine
  // offene Transaktion, eine gesetzte Einstellung -, waere der zweite Aufruf
  // nicht mehr wertgleich.
  setSession(sessionFor(ADMIN));
  const first = await getIncidentStatusMetrics();
  const second = await getIncidentStatusMetrics();
  assert.deepEqual(second, first, "V10: der zweite Aufruf liefert andere Werte");
  assert.deepEqual(
    first,
    jsMetrics(await listIncidents()),
    "V10: DB-Kennzahl weicht von der JS-Aggregation ab",
  );
  assert.ok(first.offen > 0, "V10: kein offener Vorgang sichtbar - der Vergleich traf leer");
});
