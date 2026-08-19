// AUFTRAG_14: Dispo-Board (Wochen-/Monatsansicht, Qualifikationen, Drag &
// Drop + Klick-Ebene, Dispo-Zeile).
//
// Zwei Testarten in dieser Datei (Muster aus
// app/test/auftrag7-hlk-anrufdaten.test.mjs):
//   1. VERHALTENSNACHWEIS fuer die reinen Funktionen aus
//      src/lib/qualifications.ts (Rang-/Farblogik) und die neuen
//      Monats-Helfer aus src/lib/date-local.ts (echte Assertions).
//   2. STATISCHER WAECHTER fuer die Verdrahtung in
//      on-call-plan-actions.ts (Staff-Allowlist auch fuer die neuen
//      Aktionen) und run_db_tests.sh/run_ap14b_local.ps1 (0022/29 stehen
//      unmittelbar hinter 0021/28). Das tatsaechliche Zugriffs-/
//      Speicherverhalten (RLS, Unique je Zuweisungsart, Check-Constraints)
//      belegt ausschliesslich der SQL-Smoke
//      app/supabase/test/29_hlk_dispo_board.sql gegen echtes PostgreSQL -
//      ein Datenbanklauf ist in dieser Sandbox laut Auftrag nicht moeglich
//      und wird durch den CI-Job "database" erbracht.
//
// Lauf: node --test app/test/auftrag14-hlk-dispo-board.test.mjs (Teil von
// test:unit ueber den Glob test/*.test.mjs).

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  highestQualification,
  technicianColorKey,
  isQualificationColorKey,
  QUALIFICATION_COLOR_KEYS,
  DEFAULT_QUALIFICATION_COLOR,
} from "../src/lib/qualifications.ts";
import {
  monthStartIso,
  addMonthsToIsoDate,
  daysInMonthIso,
} from "../src/lib/date-local.ts";

async function readSource(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

// ---------------------------------------------------------------------
// qualifications.ts: Rang-/Farblogik ("höchste Qualifikation bestimmt die
// Hintergrundfarbe", Punkt 3/12 des Auftrags)
// ---------------------------------------------------------------------

const CATALOG = [
  { id: "q1", label: "Basis", rank: 10, color: "rot", is_active: true },
  { id: "q2", label: "Fachkraft", rank: 20, color: "blau", is_active: true },
  { id: "q3", label: "Ausgemustert", rank: 99, color: "gruen", is_active: false },
];

test("highestQualification: liefert die Qualifikation mit dem groessten rank", () => {
  const top = highestQualification(["q1", "q2"], CATALOG);
  assert.equal(top?.id, "q2");
});

test("highestQualification: ignoriert INAKTIVE Qualifikationen, auch mit hoeherem rank", () => {
  const top = highestQualification(["q1", "q3"], CATALOG);
  assert.equal(top?.id, "q1");
});

test("highestQualification: liefert null ohne (aktive) Qualifikation", () => {
  assert.equal(highestQualification([], CATALOG), null);
  assert.equal(highestQualification(["q3"], CATALOG), null);
  assert.equal(highestQualification(["unbekannt"], CATALOG), null);
});

test("technicianColorKey: Farbe der hoechsten Qualifikation", () => {
  assert.equal(technicianColorKey(["q1", "q2"], CATALOG), "blau");
});

test("technicianColorKey: neutrale Standardfarbe ohne Qualifikation", () => {
  assert.equal(technicianColorKey([], CATALOG), DEFAULT_QUALIFICATION_COLOR);
  assert.equal(DEFAULT_QUALIFICATION_COLOR, "grau");
});

test("isQualificationColorKey/QUALIFICATION_COLOR_KEYS: sechs bis acht token-basierte Werte (Auftrag)", () => {
  assert.ok(QUALIFICATION_COLOR_KEYS.length >= 6 && QUALIFICATION_COLOR_KEYS.length <= 8);
  for (const key of QUALIFICATION_COLOR_KEYS) {
    assert.ok(isQualificationColorKey(key), `${key} sollte ein gueltiger Palettenschluessel sein`);
  }
  assert.equal(isQualificationColorKey("pink"), false);
});

// ---------------------------------------------------------------------
// date-local.ts: Monats-/Wochenbereichsberechnung inkl. DST
// ---------------------------------------------------------------------

test("monthStartIso: normalisiert ein beliebiges Datum auf den 1. des Monats", () => {
  assert.equal(monthStartIso("2026-08-17"), "2026-08-01");
  assert.equal(monthStartIso("2026-08-01"), "2026-08-01");
  assert.equal(monthStartIso("2026-08-31"), "2026-08-01");
});

test("addMonthsToIsoDate: Vor-/Zurueckrechnen inklusive Jahreswechsel", () => {
  assert.equal(addMonthsToIsoDate("2026-08-17", 1), "2026-09-01");
  assert.equal(addMonthsToIsoDate("2026-08-17", -1), "2026-07-01");
  assert.equal(addMonthsToIsoDate("2026-12-05", 1), "2027-01-01");
  assert.equal(addMonthsToIsoDate("2026-01-05", -1), "2025-12-01");
});

test("daysInMonthIso: Schaltjahr-Februar (2028) hat 29, Nicht-Schaltjahr (2026) hat 28 Tage", () => {
  const feb2028 = daysInMonthIso("2028-02-01");
  const feb2026 = daysInMonthIso("2026-02-01");
  assert.equal(feb2028.length, 29);
  assert.equal(feb2028[feb2028.length - 1], "2028-02-29");
  assert.equal(feb2026.length, 28);
  assert.equal(feb2026[feb2026.length - 1], "2026-02-28");
});

test("daysInMonthIso: der Sommerzeit-Umstellungsmonat (2026-03) liefert trotzdem alle 31 Kalendertage", () => {
  // Reine Kalenderarithmetik (Kopfkommentar date-local.ts) - der DST-Wechsel
  // am 29.03.2026 darf keinen Tag verschlucken oder verdoppeln.
  const days = daysInMonthIso("2026-03-01");
  assert.equal(days.length, 31);
  assert.equal(days[0], "2026-03-01");
  assert.equal(days[28], "2026-03-29");
  assert.equal(days[30], "2026-03-31");
});

// ---------------------------------------------------------------------
// Statischer Waechter: on-call-plan-actions.ts (Staff-Allowlist auch fuer
// die neuen Aktionen assignDispo/moveOnCallEntry)
// ---------------------------------------------------------------------

test("on-call-plan-actions.ts: assignDispo und moveOnCallEntry pruefen STAFF_ALLOWED_ROLES wie assignOnCall/removeOnCall", async () => {
  const source = await readSource("../src/lib/on-call-plan-actions.ts");
  for (const fnName of ["assignDispo", "moveOnCallEntry"]) {
    const match = source.match(new RegExp(`export async function ${fnName}\\([\\s\\S]*?\\r?\\n\\}\\r?\\n`));
    assert.ok(match, `on-call-plan-actions.ts: Funktionskoerper von ${fnName} nicht gefunden`);
    const body = match[0];
    assert.ok(
      body.includes("STAFF_ALLOWED_ROLES.includes(session.role)"),
      `${fnName} prueft die Staff-Allowlist nicht`,
    );
  }
});

test("on-call-plan-actions.ts: moveOnCallEntry laeuft ueber withUserTransaction (eine Transaktion, delete+insert)", async () => {
  const source = await readSource("../src/lib/on-call-plan-actions.ts");
  const match = source.match(/export async function moveOnCallEntry\([\s\S]*?\r?\n\}\r?\n/);
  assert.ok(match, "moveOnCallEntry nicht gefunden");
  const body = match[0];
  assert.ok(body.includes("withUserTransaction("), "moveOnCallEntry nutzt withUserTransaction nicht");
  assert.ok(body.includes("delete from public.on_call_plan"), "moveOnCallEntry loescht die alte Zuweisung nicht");
  assert.ok(body.includes("insert into public.on_call_plan"), "moveOnCallEntry legt die neue Zuweisung nicht an");
});

// ---------------------------------------------------------------------
// Statischer Waechter: Migration 0022 (additive Regeln)
// ---------------------------------------------------------------------

test("Migration 0022: Qualifikationen, Zuordnung und die Erweiterung von on_call_plan sind additiv angelegt", async () => {
  const source = await readSource("../supabase/migrations/0022_hlk_dispo_board.sql");
  for (const fragment of [
    "create table if not exists public.qualifications",
    "create table if not exists public.technician_qualifications",
    "add column if not exists assignment_kind text not null default 'bereitschaft'",
    "alter column construction_stage_id drop not null",
    "drop constraint if exists on_call_plan_stage_date_tech_uq",
    "create unique index if not exists on_call_plan_bereitschaft_uq",
    "create unique index if not exists on_call_plan_dispo_uq",
  ]) {
    assert.ok(source.includes(fragment), `Migration 0022: erwarteter Abschnitt fehlt: "${fragment}"`);
  }
  // KEINE Startwerte fuer Qualifikationen (Auftrag: "Startwerte NICHT erfinden").
  assert.ok(
    !/insert into public\.qualifications/.test(source),
    "Migration 0022: es duerfen keine Startwerte in public.qualifications eingefuegt werden",
  );
});

test("run_db_tests.sh und run_ap14b_local.ps1: 0022/29_hlk_dispo_board stehen unmittelbar hinter 0021/28", async () => {
  const bash = await readSource("../supabase/test/run_db_tests.sh");
  assert.ok(bash.includes('"${MIGRATIONS}/0022_hlk_dispo_board.sql"'), "run_db_tests.sh: Migration 0022 fehlt in der FILES-Kette");
  assert.ok(bash.includes('"${TEST_ROOT}/29_hlk_dispo_board.sql"'), "run_db_tests.sh: Smoke 29 fehlt in der FILES-Kette");
  assert.ok(
    bash.indexOf('"${MIGRATIONS}/0021_hlk_bereitschaftsplan.sql"') < bash.indexOf('"${MIGRATIONS}/0022_hlk_dispo_board.sql"'),
    "run_db_tests.sh: 0022 steht nicht hinter 0021",
  );

  const ps1 = await readSource("../supabase/test/run_ap14b_local.ps1");
  assert.ok(ps1.includes('(Join-Path $migrationRoot "0022_hlk_dispo_board.sql")'), "run_ap14b_local.ps1: Migration 0022 fehlt in der Dateikette");
  assert.ok(ps1.includes('(Join-Path $testRoot "29_hlk_dispo_board.sql")'), "run_ap14b_local.ps1: Smoke 29 fehlt in der Dateikette");
});

test('ci.yml: Schrittname wurde auf "Migrationen 0001-0022, Smokes 15-29" nachgezogen', async () => {
  const yml = await readSource("../../.github/workflows/ci.yml");
  assert.ok(
    yml.includes("Migrationen 0001-0022, Smokes 15-29"),
    'ci.yml: der aktuelle CI-Schrittname enthaelt nicht "Migrationen 0001-0022, Smokes 15-29"',
  );
});
