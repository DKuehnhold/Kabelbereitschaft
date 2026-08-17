// AUFTRAG_10: Bereitschaftsplan (Einsatzplanung) - Wochenstart Montag
// (Europe/Berlin, DST-fest).
//
// Zwei Testarten in dieser Datei:
//   1. VERHALTENSNACHWEIS fuer die reinen Kalenderfunktionen aus
//      date-local.ts (mondayOfWeekBerlinIso/addDaysToIsoDate/
//      isIsoCalendarDate/berlinCalendarDateIso) - echte Assertions gegen
//      konkrete Werte, Muster aus app/test/ap15b-date-local.test.mjs. Die
//      Referenzzeitpunkte werden als Parameter uebergeben statt die
//      Systemzeit zu stubben.
//   2. STATISCHER WAECHTER (Muster aus app/test/ap15b-callers.test.mjs) fuer
//      die Staff-Allowlist in on-call-plan-actions.ts: liest die Quelldatei
//      als TEXT und sichert, dass Zuweisen/Entfernen ausschliesslich ueber
//      dieselbe benannte Allowlist laufen. Das tatsaechliche
//      Zugriffsverhalten (RLS) belegt ausschliesslich der SQL-Smoke
//      app/supabase/test/28_hlk_bereitschaftsplan.sql gegen echtes
//      PostgreSQL - ein Datenbanklauf ist in dieser Sandbox laut Auftrag
//      nicht moeglich und wird durch den CI-Job "database" erbracht.
//
// Lauf: node --test app/test/auftrag10-bereitschaftsplan.test.mjs (Teil von
// test:unit ueber den Glob test/*.test.mjs).

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  addDaysToIsoDate,
  berlinCalendarDateIso,
  isIsoCalendarDate,
  mondayOfWeekBerlinIso,
} from "../src/lib/date-local.ts";

async function readSource(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

// ---------------------------------------------------------------------
// isIsoCalendarDate
// ---------------------------------------------------------------------

test("isIsoCalendarDate: kanonisches Datum wird akzeptiert", () => {
  assert.equal(isIsoCalendarDate("2026-08-24"), true);
});

test("isIsoCalendarDate: nicht existierender Kalendertag wird abgewiesen (Ueberlaufprobe)", () => {
  // Date.UTC wuerde den 30. Februar sonst stillschweigend auf den 2. Maerz
  // normalisieren - dieselbe Rueckrechnungsprobe wie bei isIsoDate() in
  // incidents.ts und parseBerlinDatetimeLocal() in date-local.ts.
  assert.equal(isIsoCalendarDate("2026-02-30"), false);
});

test("isIsoCalendarDate: falsches Format wird abgewiesen", () => {
  assert.equal(isIsoCalendarDate("24-08-2026"), false);
  assert.equal(isIsoCalendarDate("2026-8-24"), false);
  assert.equal(isIsoCalendarDate(""), false);
});

// ---------------------------------------------------------------------
// addDaysToIsoDate - reine Kalenderarithmetik, ohne Zeitzonenbezug.
// ---------------------------------------------------------------------

test("addDaysToIsoDate: sieben Tage vorwaerts innerhalb eines Monats", () => {
  assert.equal(addDaysToIsoDate("2026-08-24", 6), "2026-08-30");
});

test("addDaysToIsoDate: Jahreswechsel rueckwaerts", () => {
  assert.equal(addDaysToIsoDate("2026-01-01", -1), "2025-12-31");
});

test("addDaysToIsoDate: Monatsueberlauf vorwaerts", () => {
  assert.equal(addDaysToIsoDate("2026-08-24", 7), "2026-08-31");
  assert.equal(addDaysToIsoDate("2026-08-24", 8), "2026-09-01");
});

test("addDaysToIsoDate: wirft bei einem unbrauchbaren Datum statt fehlzuschlagend zu raten", () => {
  assert.throws(() => addDaysToIsoDate("nicht-ein-datum", 1));
});

// ---------------------------------------------------------------------
// berlinCalendarDateIso - Kalendertag als Berliner Wanduhrzeit.
// ---------------------------------------------------------------------

test("berlinCalendarDateIso: Sommerzeit (CEST, UTC+2) - 22:30 UTC gehoert bereits zum naechsten Berliner Kalendertag", () => {
  // Dieselbe Referenz wie in ap15b-date-local.test.mjs ("kurz nach
  // Mitternacht Berlin"): 14. Juli 22:30 UTC == 15. Juli 00:30 CEST.
  const reference = new Date("2026-07-14T22:30:00.000Z");
  assert.equal(berlinCalendarDateIso(reference), "2026-07-15");
});

test("berlinCalendarDateIso: Winterzeit (CET, UTC+1) - 22:50 UTC gehoert noch zum selben Berliner Kalendertag", () => {
  const reference = new Date("2026-01-14T22:50:00.000Z");
  assert.equal(berlinCalendarDateIso(reference), "2026-01-14");
});

// ---------------------------------------------------------------------
// mondayOfWeekBerlinIso - Wochenstart Montag, DST-fest.
//
// Alle Wochentage unabhaengig durch Date.UTC(...).getUTCDay() nachgerechnet
// (0 = Sonntag): 2026-03-29 und 2026-10-25 sind beide SONNTAGE - die
// Berliner Umstellungstage (Fruehjahr: 02:00 CET -> 03:00 CEST; Herbst:
// 03:00 CEST -> 02:00 CET). 2026-08-17/2026-08-24 (Montage) stammen aus dem
// bereits bestehenden Smoke-Testkopf (27_hlk_anrufdaten.sql/
// 28_hlk_bereitschaftsplan.sql).
// ---------------------------------------------------------------------

test("mondayOfWeekBerlinIso: gewoehnlicher Montag liefert sich selbst", () => {
  const reference = new Date("2026-08-17T10:00:00.000Z");
  assert.equal(mondayOfWeekBerlinIso(reference), "2026-08-17");
});

test("mondayOfWeekBerlinIso: Mittwoch derselben Woche liefert denselben Montag", () => {
  const reference = new Date("2026-08-19T10:00:00.000Z");
  assert.equal(mondayOfWeekBerlinIso(reference), "2026-08-17");
});

test("mondayOfWeekBerlinIso: Sonntag liefert den Montag SECHS Tage zuvor, nicht den kommenden", () => {
  const reference = new Date("2026-08-23T10:00:00.000Z");
  assert.equal(mondayOfWeekBerlinIso(reference), "2026-08-17");
});

test("mondayOfWeekBerlinIso: Fruehjahrs-DST-Wechsel (2026-03-29, CEST-Tag) - der Mittwoch danach liefert den Montag DAVOR", () => {
  // 1. April 2026, 10:00 UTC == 12:00 Uhr Berliner Sommerzeit (CEST, bereits
  // seit der Umstellung am 29. Maerz aktiv), Kalendertag Mittwoch 1. April.
  // Der Montag DERSELBEN Woche liegt VOR der Umstellung: 30. Maerz.
  const reference = new Date("2026-04-01T10:00:00.000Z");
  assert.equal(mondayOfWeekBerlinIso(reference), "2026-03-30");
});

test("mondayOfWeekBerlinIso: der DST-Umstellungssonntag selbst (2026-03-29) gehoert noch zur VORHERGEHENDEN Woche", () => {
  // 29. Maerz 2026, 01:30 UTC: die Umstellung (02:00 CET -> 03:00 CEST)
  // faellt exakt auf 01:00 UTC, der Referenzzeitpunkt liegt also bereits in
  // CEST (UTC+2) -> Berliner Wanduhrzeit 03:30, Kalendertag bleibt Sonntag
  // 29. Maerz. Erwarteter Montag: 23. Maerz (sechs Tage zuvor).
  const reference = new Date("2026-03-29T01:30:00.000Z");
  assert.equal(berlinCalendarDateIso(reference), "2026-03-29");
  assert.equal(mondayOfWeekBerlinIso(reference), "2026-03-23");
});

test("mondayOfWeekBerlinIso: Herbst-DST-Wechsel (2026-10-25) - Referenz nach der Umstellung liefert den Montag der ABGELAUFENEN Woche", () => {
  // 25. Oktober 2026, 12:00 UTC: die Umstellung (03:00 CEST -> 02:00 CET)
  // liegt bereits Stunden zurueck (01:00 UTC) - am Referenzzeitpunkt gilt
  // CET (UTC+1), Berliner Wanduhrzeit 13:00, Kalendertag bleibt Sonntag
  // 25. Oktober. Erwarteter Montag: 19. Oktober.
  const reference = new Date("2026-10-25T12:00:00.000Z");
  assert.equal(berlinCalendarDateIso(reference), "2026-10-25");
  assert.equal(mondayOfWeekBerlinIso(reference), "2026-10-19");
});

test("mondayOfWeekBerlinIso: kurz nach Mitternacht am Tag nach dem Herbst-DST-Wechsel gehoert bereits zur NEUEN Woche", () => {
  // 25. Oktober 2026, 23:30 UTC: nach der Umstellung gilt CET (UTC+1) ->
  // Berliner Wanduhrzeit 26.10. 00:30 - ein anderer Kalendertag (Montag)
  // als am Referenzinstant selbst (noch der 25.). Erwarteter Montag: der
  // 26. Oktober selbst.
  const reference = new Date("2026-10-25T23:30:00.000Z");
  assert.equal(berlinCalendarDateIso(reference), "2026-10-26");
  assert.equal(mondayOfWeekBerlinIso(reference), "2026-10-26");
});

test("mondayOfWeekBerlinIso: ohne Argument wird die aktuelle Systemzeit verwendet (gueltiges Kalenderdatum)", () => {
  const monday = mondayOfWeekBerlinIso();
  assert.equal(isIsoCalendarDate(monday), true);
  const weekday = new Date(`${monday}T12:00:00Z`).getUTCDay();
  assert.equal(weekday, 1, `mondayOfWeekBerlinIso() liefert kein Montagsdatum: ${monday} (Wochentag ${weekday})`);
});

// ---------------------------------------------------------------------------
// AUFTRAG_10: Staff-Allowlist in on-call-plan-actions.ts, exaktes Muster von
// STAFF_ALLOWED_ROLES in incident-list-actions.ts (siehe
// app/test/ap15b-callers.test.mjs). AUSDRUECKLICH EIN STATISCHER WAECHTER
// UND KEIN VERHALTENSNACHWEIS.
// ---------------------------------------------------------------------------
test("on-call-plan-actions.ts: assignOnCall/removeOnCall pruefen ueber dieselbe benannte Staff-Allowlist", async () => {
  const source = await readSource("../src/lib/on-call-plan-actions.ts");

  assert.match(
    source,
    /const STAFF_ALLOWED_ROLES: readonly UserRole\[\] = \["admin", "disponent"\];/,
    'on-call-plan-actions.ts: STAFF_ALLOWED_ROLES fehlt oder ist nicht genau ["admin", "disponent"]',
  );

  // Keine abweichende Negativliste ("monteur") als ausfuehrbarer Code -
  // nur als Kommentarerwaehnung zulaessig.
  const forbiddenPattern = 'role === "monteur"';
  for (const line of source.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.includes(forbiddenPattern)) {
      assert.ok(
        trimmed.startsWith("//"),
        `on-call-plan-actions.ts: Negativliste als Code gefunden: "${trimmed}"`,
      );
    }
  }

  const usages = source.match(/STAFF_ALLOWED_ROLES\.includes\(session\.role\)/g) ?? [];
  assert.equal(
    usages.length,
    2,
    `on-call-plan-actions.ts: STAFF_ALLOWED_ROLES.includes(session.role) wird ${usages.length}x statt 2x verwendet (assignOnCall, removeOnCall)`,
  );

  assert.match(source, /export\s+async\s+function\s+assignOnCall\s*\(/, "assignOnCall wird nicht als async function exportiert");
  assert.match(source, /export\s+async\s+function\s+removeOnCall\s*\(/, "removeOnCall wird nicht als async function exportiert");
});

test("OnCallPlanClient.tsx: Bedienelemente (Hinzufuegen/Entfernen) werden ausschliesslich bei canEdit gerendert", async () => {
  const source = await readSource("../src/components/on-call-plan/OnCallPlanClient.tsx");

  // Der Monteur soll KEIN Bedienelement sehen (kein Verstecken per CSS,
  // echtes Weglassen) - AddCellControl/der Entfernen-Button werden nur
  // gerendert, wenn `canEdit` das umschliessende JSX bedingt.
  assert.match(
    source,
    /\{canEdit \? \(\s*<AddCellControl/,
    "OnCallPlanClient.tsx: AddCellControl wird nicht sichtbar durch canEdit bedingt",
  );
  assert.match(
    source,
    /canEdit \? \(\s*<button/,
    "OnCallPlanClient.tsx: der Entfernen-Button (AssignedBadge) wird nicht sichtbar durch canEdit bedingt",
  );
});
