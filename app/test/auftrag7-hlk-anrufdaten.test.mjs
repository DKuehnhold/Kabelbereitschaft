// AUFTRAG_7: Anrufdaten an der Meldung (Anrufzeitpunkt, Anrufender, Gewerk)
// und das "In Klaerung"-Kennzeichen (Migration 0020).
//
// Zwei Testarten in dieser Datei:
//   1. VERHALTENSNACHWEIS fuer die reinen Funktionen aus date-local.ts
//      (berlinWallTimeToInstant/formatBerlinDatetimeLocal/
//      parseBerlinDatetimeLocal) - echte Assertions gegen konkrete Werte,
//      Muster aus app/test/ap15b-date-local.test.mjs.
//   2. STATISCHER WAECHTER (Muster aus app/test/ap15b-callers.test.mjs und
//      app/test/auftrag6-hlk-kataloge.test.mjs) fuer die Verdrahtung in
//      incident-actions.ts/NewIncidentForm.tsx: liest die Quelldateien als
//      TEXT und sichert, dass Import/Formularfelder/RPC-Aufruf nicht
//      unbemerkt verschwinden. Das tatsaechliche Zugriffs-/Speicherverhalten
//      (RLS, RPC, FK) belegt ausschliesslich der SQL-Smoke
//      app/supabase/test/27_hlk_anrufdaten.sql gegen echtes PostgreSQL - ein
//      Datenbanklauf ist in dieser Sandbox laut Auftrag nicht moeglich und
//      wird durch den CI-Job "database" erbracht.
//
// Lauf: node --test app/test/auftrag7-hlk-anrufdaten.test.mjs (Teil von
// test:unit ueber den Glob test/*.test.mjs).

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  berlinWallTimeToInstant,
  formatBerlinDatetimeLocal,
  parseBerlinDatetimeLocal,
} from "../src/lib/date-local.ts";

async function readSource(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

// ---------------------------------------------------------------------
// date-local.ts: berlinWallTimeToInstant / formatBerlinDatetimeLocal /
// parseBerlinDatetimeLocal
// ---------------------------------------------------------------------

test("berlinWallTimeToInstant: 17.08.2026 14:30 Berliner Sommerzeit (CEST, UTC+2) == 12:30 UTC", () => {
  const instant = berlinWallTimeToInstant(2026, 8, 17, 14, 30, 0);
  assert.equal(instant.toISOString(), "2026-08-17T12:30:00.000Z");
});

test("berlinWallTimeToInstant: 15.01.2026 10:00 Berliner Winterzeit (CET, UTC+1) == 09:00 UTC", () => {
  const instant = berlinWallTimeToInstant(2026, 1, 15, 10, 0, 0);
  assert.equal(instant.toISOString(), "2026-01-15T09:00:00.000Z");
});

test("formatBerlinDatetimeLocal: Rundreise fuer einen UTC-Zeitpunkt in Berliner Sommerzeit", () => {
  const instant = new Date("2026-08-17T12:30:00.000Z");
  assert.equal(formatBerlinDatetimeLocal(instant), "2026-08-17T14:30");
});

test("parseBerlinDatetimeLocal: gueltiger Wert wird als Berliner Wanduhrzeit interpretiert", () => {
  const instant = parseBerlinDatetimeLocal("2026-08-17T14:30");
  assert.ok(instant, "parseBerlinDatetimeLocal liefert null fuer einen gueltigen Wert");
  assert.equal(instant.toISOString(), "2026-08-17T12:30:00.000Z");
});

test("parseBerlinDatetimeLocal/formatBerlinDatetimeLocal: Rundreise liefert denselben Text", () => {
  const value = "2026-01-15T09:05";
  const instant = parseBerlinDatetimeLocal(value);
  assert.ok(instant);
  assert.equal(formatBerlinDatetimeLocal(instant), value);
});

test("parseBerlinDatetimeLocal: lehnt Muster-Abweichungen fail-closed ab", () => {
  for (const bad of ["", "nicht-datum", "2026-08-17", "2026-08-17 14:30", "2026-08-17T14:30:00Z"]) {
    assert.equal(parseBerlinDatetimeLocal(bad), null, `erwartet null fuer "${bad}"`);
  }
});

test("parseBerlinDatetimeLocal: lehnt einen nicht existierenden Kalendertag ab (30. Februar)", () => {
  // Date.UTC() normalisiert 2026-02-30 stillschweigend auf den 2. Maerz -
  // die Rueckrechnungsprobe muss das abfangen (dasselbe Prinzip wie
  // isIsoDate() in incidents.ts).
  assert.equal(parseBerlinDatetimeLocal("2026-02-30T10:00"), null);
});

test("parseBerlinDatetimeLocal: lehnt eine nicht existierende Uhrzeit ab (Stunde/Minute ausserhalb des Bereichs)", () => {
  assert.equal(parseBerlinDatetimeLocal("2026-08-17T24:00"), null);
  assert.equal(parseBerlinDatetimeLocal("2026-08-17T10:60"), null);
});

test("berlinWallTimeToInstant/parseBerlinDatetimeLocal: Sommerzeit-Umstellung (2026-03-29, 02:30 existiert nicht) wird konsistent behandelt", () => {
  // 29. Maerz 2026, 02:00 -> 03:00 Uhr Umstellung: 02:30 Uhr existiert in der
  // Berliner Ortszeit nicht. berlinWallTimeToInstant() darf dabei nicht
  // abstuerzen; parseBerlinDatetimeLocal() muss ueber die Rueckrechnungsprobe
  // konsistent bleiben (entweder ein gueltiger Instant, dessen Ruecktext
  // uebereinstimmt, oder null - kein undefiniertes Verhalten).
  const instant = berlinWallTimeToInstant(2026, 3, 29, 2, 30, 0);
  assert.ok(!Number.isNaN(instant.getTime()), "berlinWallTimeToInstant liefert einen ungueltigen Instant");
  const parsed = parseBerlinDatetimeLocal("2026-03-29T02:30");
  if (parsed) {
    assert.equal(formatBerlinDatetimeLocal(parsed), "2026-03-29T02:30");
  }
});

// ---------------------------------------------------------------------
// Statischer Waechter: incident-actions.ts (createIncident)
// ---------------------------------------------------------------------

test("incident-actions.ts: importiert parseBerlinDatetimeLocal aus @/lib/date-local", async () => {
  const source = await readSource("../src/lib/incident-actions.ts");
  assert.match(
    source,
    /import\s*\{\s*parseBerlinDatetimeLocal\s*\}\s*from\s*"@\/lib\/date-local"/,
    "incident-actions.ts: kein Import von parseBerlinDatetimeLocal aus \"@/lib/date-local\"",
  );
});

test("incident-actions.ts: createIncident() liest reported_at/caller_contact_id/trade_id und uebergibt sie an create_incident_ap12", async () => {
  const source = await readSource("../src/lib/incident-actions.ts");
  // incident-actions.ts liegt mit CRLF-Zeilenenden vor (Muster aus
  // auftrag6-hlk-kataloge.test.mjs: \r?\n statt \n).
  const match = source.match(/export async function createIncident\([\s\S]*?\r?\n\}\r?\n/);
  assert.ok(match, "incident-actions.ts: Funktionskoerper von createIncident nicht gefunden");
  const body = match[0];

  assert.ok(body.includes('strOrNull(fd, "caller_contact_id")'), "createIncident liest caller_contact_id nicht aus dem Formular");
  assert.ok(body.includes('strOrNull(fd, "trade_id")'), "createIncident liest trade_id nicht aus dem Formular");
  assert.ok(body.includes('str(fd, "reported_at")'), "createIncident liest reported_at nicht aus dem Formular");
  assert.ok(body.includes("parseBerlinDatetimeLocal("), "createIncident wertet reported_at nicht ueber parseBerlinDatetimeLocal() aus");
  assert.ok(body.includes("Ungültiger Anrufzeitpunkt"), "createIncident meldet einen ungueltigen Anrufzeitpunkt nicht als Fachfehler");

  assert.ok(body.includes("$22::timestamptz, $23::uuid, $24::uuid"), "createIncident uebergibt die drei neuen Parameter nicht mit den erwarteten Platzhaltern/Casts an create_incident_ap12");
  assert.ok(body.includes("reportedAtIso,"), "createIncident bindet reportedAtIso nicht als Parameter");
  assert.ok(body.includes("callerContactId,"), "createIncident bindet callerContactId nicht als Parameter");
  assert.ok(body.includes("tradeId,"), "createIncident bindet tradeId nicht als Parameter");
});

// ---------------------------------------------------------------------
// Statischer Waechter: NewIncidentForm.tsx (Erfassung)
// ---------------------------------------------------------------------

test("NewIncidentForm.tsx: bindet reported_at, caller_contact_id und trade_id als Formularfelder ein", async () => {
  const source = await readSource("../src/components/incidents/NewIncidentForm.tsx");

  assert.match(source, /type="datetime-local"[\s\S]*?name="reported_at"/, "NewIncidentForm.tsx: kein datetime-local-Feld name=\"reported_at\"");
  assert.match(source, /<select[\s\S]*?name="caller_contact_id"/, "NewIncidentForm.tsx: kein <select name=\"caller_contact_id\">");
  assert.match(source, /<select[\s\S]*?name="trade_id"/, "NewIncidentForm.tsx: kein <select name=\"trade_id\">");

  assert.ok(
    source.includes("formatBerlinDatetimeLocal"),
    "NewIncidentForm.tsx: die Anrufzeit-Vorbelegung nutzt nicht formatBerlinDatetimeLocal (Europe/Berlin-Konvention aus date-local.ts)",
  );
  assert.ok(
    !source.includes('id="caller_contact_id" name="contact_id"') && !source.includes('name="contact_id" id="caller_contact_id"'),
    "NewIncidentForm.tsx: caller_contact_id darf den bestehenden Formularschluessel contact_id nicht ueberschreiben",
  );
});

test("NewIncidentForm.tsx: die bestehenden Freitext-Fallbacks caller_name/caller_contact bleiben im optionalen Abschnitt bestehen", async () => {
  const source = await readSource("../src/components/incidents/NewIncidentForm.tsx");
  assert.match(source, /name="caller_name"/, "NewIncidentForm.tsx: caller_name fehlt");
  assert.match(source, /name="caller_contact"/, "NewIncidentForm.tsx: caller_contact fehlt");
});

// ---------------------------------------------------------------------
// Statischer Waechter: incidents.ts (Formularoptionen)
// ---------------------------------------------------------------------

test("incidents.ts: getIncidentFormOptions() liest aktive Gewerke aus public.trades", async () => {
  const source = await readSource("../src/lib/incidents.ts");
  // incidents.ts liegt ebenfalls mit CRLF-Zeilenenden vor.
  const match = source.match(/export async function getIncidentFormOptions\([\s\S]*?\r?\n\}\r?\n/);
  assert.ok(match, "incidents.ts: Funktionskoerper von getIncidentFormOptions nicht gefunden");
  const body = match[0];
  assert.ok(body.includes("from public.trades"), "getIncidentFormOptions liest public.trades nicht");
  assert.ok(body.includes("trades: trades.rows"), "getIncidentFormOptions liefert kein trades-Feld im Ergebnis");
});

// ---------------------------------------------------------------------
// Statischer Waechter: Migration 0020 (Datei-Existenz und additive Regeln)
// ---------------------------------------------------------------------

test("Migration 0020: legt die vier additiven Spalten an und definiert incident_list_view mit den drei neuen Spalten am Ende", async () => {
  const source = await readSource("../supabase/migrations/0020_hlk_meldung_anrufdaten.sql");

  for (const fragment of [
    "add column if not exists reported_at timestamptz",
    "add column if not exists caller_contact_id uuid references public.contacts(id)",
    "add column if not exists trade_id uuid references public.trades(id)",
    "add column if not exists is_in_clarification boolean not null default false",
  ]) {
    assert.ok(source.includes(fragment), `Migration 0020: erwarteter Abschnitt fehlt: "${fragment}"`);
  }

  // Die drei neuen View-Spalten muessen NACH is_false_alarm (der letzten
  // Spalte aus 0018) und in genau dieser Reihenfolge stehen.
  const viewMatch = source.match(/create or replace view public\.incident_list_view[\s\S]*?from public\.incidents i/);
  assert.ok(viewMatch, "Migration 0020: keine Neudefinition von incident_list_view gefunden");
  const viewBody = viewMatch[0];
  const idxFalseAlarm = viewBody.indexOf("i.is_false_alarm");
  const idxClarif = viewBody.indexOf("i.is_in_clarification");
  const idxTradeId = viewBody.indexOf("i.trade_id");
  const idxTradeLabel = viewBody.indexOf("as trade_label");
  assert.ok(
    idxFalseAlarm >= 0 && idxClarif > idxFalseAlarm && idxTradeId > idxClarif && idxTradeLabel > idxTradeId,
    "Migration 0020: is_in_clarification/trade_id/trade_label stehen nicht in der erwarteten Reihenfolge nach is_false_alarm",
  );

  assert.ok(
    source.includes("drop function if exists public.create_incident_ap12("),
    "Migration 0020: kein DROP FUNCTION der alten 21-Parameter-Fassung von create_incident_ap12",
  );
  assert.ok(
    source.includes("p_reported_at timestamptz default null") &&
      source.includes("p_caller_contact_id uuid default null") &&
      source.includes("p_trade_id uuid default null"),
    "Migration 0020: create_incident_ap12 traegt nicht die drei erwarteten, nachgestellten Defaultparameter",
  );
});

test("run_db_tests.sh und run_ap14b_local.ps1: 0020/27_hlk_anrufdaten stehen unmittelbar hinter 0019/26", async () => {
  const bash = await readSource("../supabase/test/run_db_tests.sh");
  assert.ok(bash.includes('"${MIGRATIONS}/0020_hlk_meldung_anrufdaten.sql"'), "run_db_tests.sh: Migration 0020 fehlt in der FILES-Kette");
  assert.ok(bash.includes('"${TEST_ROOT}/27_hlk_anrufdaten.sql"'), "run_db_tests.sh: Smoke 27 fehlt in der FILES-Kette");
  assert.ok(
    bash.indexOf('"${MIGRATIONS}/0019_hlk_katalog_stammdaten.sql"') < bash.indexOf('"${MIGRATIONS}/0020_hlk_meldung_anrufdaten.sql"'),
    "run_db_tests.sh: 0020 steht nicht hinter 0019",
  );

  const ps1 = await readSource("../supabase/test/run_ap14b_local.ps1");
  assert.ok(ps1.includes('(Join-Path $migrationRoot "0020_hlk_meldung_anrufdaten.sql")'), "run_ap14b_local.ps1: Migration 0020 fehlt in der Dateikette");
  assert.ok(ps1.includes('(Join-Path $testRoot "27_hlk_anrufdaten.sql")'), "run_ap14b_local.ps1: Smoke 27 fehlt in der Dateikette");
});

test('ci.yml: Schrittname nennt "Migrationen 0001-00\\d\\d, Smokes 15-\\d\\d" (tolerant, AUFTRAG_14)', async () => {
  // Ursprung dieser Pruefung war AUFTRAG_7 (woertlich "...0001-0020, Smokes
  // 15-27"), AUFTRAG_10 zog sie auf "...0001-0021, Smokes 15-28" nach. Ab
  // AUFTRAG_14 ist die Pruefung TOLERANT gemacht (00-Projektsteuerung/
  // AUFTRAG_14.md, Umfang "Laeufer + CI"): jede kuenftige additive Migration
  // muesste sonst diesen Wortlaut-Test miterledigen, obwohl er inhaltlich nur
  // die Kettenlaenge, nicht ihren genauen Endstand betrifft. Die Regex
  // verlangt weiterhin das Format "0001-00NN, Smokes 15-NN" (zwei Ziffern je
  // Zaehler) und damit denselben Wortlaut-STIL wie bisher - nur die exakte
  // Endziffer ist nicht mehr Teil dieses Tests. Der Nachweis, DASS 0022/29
  // tatsaechlich Teil der Kette sind, steht in run_db_tests.sh/
  // run_ap14b_local.ps1 selbst (Dateiexistenz und Reihenfolge).
  const yml = await readSource("../../.github/workflows/ci.yml");
  assert.match(
    yml,
    /Migrationen 0001-00\d\d, Smokes 15-\d\d/,
    'ci.yml: der CI-Schrittname entspricht nicht dem Muster "Migrationen 0001-00NN, Smokes 15-NN"',
  );
});
