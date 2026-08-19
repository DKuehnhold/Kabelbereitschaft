// AUFTRAG_17: Dispo-Board – Doppelbelegungs-Hinweis, Soll-Besetzung,
// Markierung in der Monteurliste, Bugfix "x"-Knopf in der Wochenmatrix.
//
// AUSDRUECKLICH EIN STATISCHER WAECHTER UND KEIN VERHALTENSNACHWEIS (Muster
// aus app/test/auftrag16-stammdaten-akkordeon.test.mjs): liest
// OnCallPlanClient.tsx als TEXT und prueft Vorhandensein/Struktur der
// verlangten Regeln. Ein Render-/Verhaltensnachweis (z. B. dass ein echter
// Drop tatsaechlich einen window.confirm ausloest) ist in dieser Sandbox
// ohne Browser/JSDOM nicht vorgesehen und nicht Teil dieses Wächtertests.
//
// Lauf: node --test app/test/auftrag17-dispo-regeln.test.mjs (Teil von
// test:unit ueber den Glob test/*.test.mjs).

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function readSource() {
  return readFile(
    new URL("../src/components/on-call-plan/OnCallPlanClient.tsx", import.meta.url),
    "utf8",
  );
}

test("Bugfix: AssignedChip enthaelt stopPropagation (Regressionswaechter gegen den Doppel-Klick-Bug)", async () => {
  const source = await readSource();
  const start = source.indexOf("function AssignedChip");
  assert.notEqual(start, -1, "AssignedChip nicht gefunden");
  const end = source.indexOf("\nfunction ", start + 1);
  const body = source.slice(start, end === -1 ? undefined : end);
  assert.match(
    body,
    /stopPropagation/,
    "AssignedChip: stopPropagation fehlt im \"x\"-Knopf - der Bug aus AUFTRAG_17 waere nicht behoben",
  );
});

test("Soll-Besetzung: die benannte Konstante existiert und traegt den Wert 2", async () => {
  const source = await readSource();
  assert.match(
    source,
    /const\s+SOLL_BESETZUNG_BEREITSCHAFT\s*=\s*2\s*;/,
    "SOLL_BESETZUNG_BEREITSCHAFT mit Wert 2 nicht gefunden",
  );
});

test("Soll-Besetzung: die Wochenmatrix zeigt die Besetzung im Format n/Soll ausschliesslich fuer Bereitschaftszellen", async () => {
  const source = await readSource();
  assert.match(
    source,
    /\{entries\.length\}\/\{SOLL_BESETZUNG_BEREITSCHAFT\}/,
    "Besetzungsanzeige \"n/Soll\" nicht gefunden",
  );
  assert.match(
    source,
    /target\.kind === "bereitschaft"[\s\S]{0,600}\{entries\.length\}\/\{SOLL_BESETZUNG_BEREITSCHAFT\}/,
    "Besetzungsanzeige ist nicht an target.kind === \"bereitschaft\" gebunden (Dispo-Zeile darf keinen Sollwert zeigen)",
  );
});

test("Doppelbelegungspruefung: wird in BEIDEN Schreibpfaden (Neuzuweisung und Verschieben) erreicht, vor jedem runAction-Aufruf", async () => {
  const source = await readSource();
  const fnStart = source.indexOf("const handleDropOrClickAssign = (target: TargetCell, payload: DragPayload) => {");
  assert.notEqual(fnStart, -1, "handleDropOrClickAssign nicht gefunden");
  const fnEnd = source.indexOf("\n  const onCellDrop", fnStart);
  assert.notEqual(fnEnd, -1, "Ende von handleDropOrClickAssign nicht gefunden");
  const body = source.slice(fnStart, fnEnd);

  const conflictCallIndex = body.indexOf("findConflictingEntry(");
  const confirmIndex = body.indexOf("window.confirm(");
  const abortIndex = body.indexOf("if (!confirmed) return;");
  const moveBranchIndex = body.indexOf('if (payload.kind === "move") {', abortIndex);
  const newAssignIndex = body.indexOf("assignDispo(target.dateIso, payload.technicianId)");

  assert.ok(conflictCallIndex !== -1, "findConflictingEntry wird nicht aufgerufen");
  assert.ok(confirmIndex !== -1, "window.confirm wird nicht aufgerufen");
  assert.ok(abortIndex !== -1, "kein Abbruchzweig (if (!confirmed) return;) gefunden");
  assert.ok(
    conflictCallIndex < confirmIndex && confirmIndex < abortIndex,
    "Reihenfolge falsch: Pruefung -> Rueckfrage -> Abbruchzweig erwartet",
  );
  assert.ok(
    abortIndex < moveBranchIndex && moveBranchIndex < newAssignIndex,
    "der Abbruchzweig steht nicht VOR beiden Schreibpfaden (Verschieben und Neuzuweisung)",
  );
});

test("Doppelbelegungspruefung: der Abbruchzweig fuehrt zu KEINEM Aufruf der Server-Actions (kein runAction vor dem return)", async () => {
  const source = await readSource();
  const abortLine = "if (!confirmed) return;";
  const abortIndex = source.indexOf(abortLine);
  assert.notEqual(abortIndex, -1, "Abbruchzweig nicht gefunden");

  const beforeAbort = source.slice(0, abortIndex);
  const lastConflictBlockStart = beforeAbort.lastIndexOf("if (conflict) {");
  assert.notEqual(lastConflictBlockStart, -1, "if (conflict) {...} Block nicht gefunden");
  const conflictBlock = source.slice(lastConflictBlockStart, abortIndex + abortLine.length);

  assert.ok(
    !conflictBlock.includes("runAction("),
    "im if (conflict)-Block vor dem Abbruch darf runAction NICHT aufgerufen werden",
  );
});

test("Doppelbelegungspruefung: die Rueckfrage benennt Name, Datum und Ort (Bauabschnitt bzw. Dispo) konkret - kein anonymes 'Wirklich?'", async () => {
  const source = await readSource();
  const confirmIndex = source.indexOf("window.confirm(");
  assert.notEqual(confirmIndex, -1, "window.confirm nicht gefunden");
  const confirmCallEnd = source.indexOf(");", confirmIndex);
  const confirmArgs = source.slice(confirmIndex, confirmCallEnd);

  assert.match(confirmArgs, /conflict\.technician_name/, "Rueckfrage nennt nicht den Namen");
  assert.match(confirmArgs, /formatIsoDateDe\(target\.dateIso\)/, "Rueckfrage nennt nicht das Datum");
  assert.match(confirmArgs, /location/, "Rueckfrage nennt nicht den Ort (Bauabschnitt/Dispo)");
});

test("Doppelbelegungspruefung: describeLocation liefert 'Dispo' fuer die Dispo-Zeile und den Bauabschnittsnamen sonst", async () => {
  const source = await readSource();
  assert.match(
    source,
    /function describeLocation[\s\S]{0,80}if \(entry\.assignment_kind === "dispo"\) return "Dispo";/,
    "describeLocation liefert nicht 'Dispo' fuer assignment_kind 'dispo'",
  );
});

test("Doppelbelegungspruefung: die dokumentierte Grenze (nur geladener Zeitraum, keine Nebenlaeufigkeitsgarantie) steht als Kommentar im Quelltext", async () => {
  const source = await readSource();
  assert.match(
    source,
    /GELADENEN Plandaten/,
    "kein Kommentar zur Grenze der Pruefung (nur geladene Plandaten) gefunden",
  );
  assert.match(
    source,
    /Hilfe, KEINE Garantie/,
    "kein Kommentar zur Grenze der Pruefung (Hilfe statt Garantie) gefunden",
  );
});

test("Monteurliste: KEIN Filter, der eingeplante Monteure entfernt (Wächter gegen ein spaeteres 'verschwindet doch')", async () => {
  const source = await readSource();
  const mapIndex = source.indexOf("{technicians.map((t) => (");
  assert.notEqual(mapIndex, -1, "technicians.map(...) nicht gefunden");
  assert.ok(
    !/technicians\s*\.filter\(/.test(source),
    "technicians.filter(...) gefunden - die Monteurliste darf laut AUFTRAG_17 NICHT gefiltert werden",
  );
});

test("Monteurliste: die Markierung (assignedDaysCount) wird an TechnicianChip durchgereicht, ohne die Liste zu veraendern", async () => {
  const source = await readSource();
  assert.match(
    source,
    /assignedDaysCount=\{daysByTechnician\.get\(t\.id\)\?\.size \?\? 0\}/,
    "assignedDaysCount wird nicht wie erwartet an TechnicianChip uebergeben",
  );
});

test("keine harte Tailwind-Farbklasse in den neu hinzugefuegten AUFTRAG_17-Stellen (occupancyBadgeClass, TechnicianChip-Markierung)", async () => {
  const source = await readSource();

  const occupancyStart = source.indexOf("function occupancyBadgeClass");
  const occupancyEnd = source.indexOf("\nfunction formatIsoDateDe", occupancyStart);
  const occupancyBody = source.slice(occupancyStart, occupancyEnd);
  assert.ok(
    !/bg-red-|text-red-|bg-green-|bg-yellow-/.test(occupancyBody),
    "occupancyBadgeClass verwendet eine harte Tailwind-Farbklasse statt der AP8-Badge-Utilities",
  );

  const badgeMarkupIndex = source.indexOf('<span className="badge badge-info" aria-hidden="true">');
  assert.notEqual(badgeMarkupIndex, -1, "Markierungs-Badge in TechnicianChip nicht gefunden");

  assert.ok(
    !/badge-red-|bg-red-|text-red-|bg-green-|bg-yellow-/.test(source.slice(badgeMarkupIndex, badgeMarkupIndex + 120)),
    "Markierungs-Badge verwendet eine harte Tailwind-Farbklasse",
  );
});
