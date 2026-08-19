// AUFTRAG_23: Dispo-Board – Rückmeldung und Robustheit (Bedienmängel, Teil 1).
//
// AUSDRUECKLICH EIN STATISCHER WAECHTER UND KEIN VERHALTENSNACHWEIS (gleiches
// Muster wie app/test/auftrag17-dispo-regeln.test.mjs): liest
// OnCallPlanClient.tsx als TEXT und prueft Vorhandensein/Struktur/Reihenfolge
// der verlangten Regeln - ABSICHT statt woertlicher Formulierung, Muster
// statt blosser Zeichenkette, Reihenfolge statt blossem Vorkommen (Lehre aus
// AUFTRAG_19/22, siehe PROJEKT_WISSEN.md). Ein Render-/Verhaltensnachweis
// (z. B. dass ein echter Drop tatsaechlich die Zielzelle hervorhebt) ist in
// dieser Sandbox ohne Browser/JSDOM nicht vorgesehen und nicht Teil dieses
// Wächtertests.
//
// Lauf: node --test app/test/auftrag23-dispo-bedienung.test.mjs (Teil von
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

// ---------------------------------------------------------------------
// M1/M2 – Erfolg und Fehler getrennt, ausschliesslich AP8-Utilities
// ---------------------------------------------------------------------

test("in der gesamten Datei kommt keine harte Tailwind-Farbklasse mehr vor (schaerfste, stabilste Form)", async () => {
  const source = await readSource();
  assert.ok(
    !/bg-red-|text-red-|border-red-|bg-green-|bg-yellow-/.test(source),
    "eine harte Tailwind-Farbklasse (bg-red-/text-red-/border-red-/bg-green-/bg-yellow-) ist noch vorhanden",
  );
});

test("die Rueckmeldung ist typisiert mit einer Art (Erfolg oder Fehler), nicht nur ein Text", async () => {
  const source = await readSource();
  assert.match(
    source,
    /kind:\s*"success"\s*\|\s*"error"/,
    "kein Rueckmeldungs-Typ mit den zwei Auspraegungen \"success\"/\"error\" gefunden",
  );
});

test("runAction: jeder Fehlerpfad setzt die Art auf 'error', keine 'success'-Zuweisung in dieser Funktion", async () => {
  const source = await readSource();
  const start = source.indexOf("const runAction = async");
  const end = source.indexOf("const runRangeAction = async", start);
  assert.notEqual(start, -1, "runAction nicht gefunden");
  assert.notEqual(end, -1, "runRangeAction nicht gefunden (Ende von runAction unklar)");
  const body = source.slice(start, end);
  assert.match(body, /kind:\s*"error"/, "runAction setzt im Fehlerfall keine Art 'error'");
  assert.ok(!/kind:\s*"success"/.test(body), "runAction darf keinen Erfolgsfall auf 'success' setzen (nicht Teil dieses Auftrags)");
});

test("runRangeAction: 'created === 0' fuehrt zur Art 'error', ein tatsaechlicher Zeitraum-Erfolg (created > 0) zur Art 'success' - in dieser Reihenfolge im Quelltext", async () => {
  const source = await readSource();
  const start = source.indexOf("const runRangeAction = async");
  const end = source.indexOf("const openAssignDialog", start);
  assert.notEqual(start, -1, "runRangeAction nicht gefunden");
  assert.notEqual(end, -1, "Ende von runRangeAction nicht gefunden");
  const body = source.slice(start, end);

  const zeroCaseIndex = body.indexOf("created === 0");
  assert.notEqual(zeroCaseIndex, -1, "Sonderfall 'created === 0' nicht mehr gefunden (Regel aus AUFTRAG_18 darf inhaltlich nicht verschwinden)");

  const errorAfterZeroIndex = body.indexOf('kind: "error"', zeroCaseIndex);
  assert.notEqual(errorAfterZeroIndex, -1, "kein 'kind: \"error\"' nach dem Sonderfall 'created === 0' gefunden");

  const successIndex = body.indexOf('kind: "success"');
  assert.notEqual(successIndex, -1, "kein 'kind: \"success\"' in runRangeAction gefunden");
  assert.ok(
    successIndex > errorAfterZeroIndex,
    "die Erfolgs-Zuweisung ('success') steht nicht NACH dem 'created === 0'-Fehlerfall - der 0-Tage-Sonderfall muesste zuerst behandelt werden",
  );
});

test("Fehlerfall bekommt die Art 'error' auch im ersten Abbruchzweig von runRangeAction (result.ok === false)", async () => {
  const source = await readSource();
  const start = source.indexOf("const runRangeAction = async");
  const end = source.indexOf("const openAssignDialog", start);
  const body = source.slice(start, end);
  const notOkIndex = body.indexOf("!result.ok");
  const returnIndex = body.indexOf("return;", notOkIndex);
  assert.notEqual(notOkIndex, -1, "kein '!result.ok'-Zweig gefunden");
  const guardBlock = body.slice(notOkIndex, returnIndex);
  assert.match(guardBlock, /kind:\s*"error"/, "der '!result.ok'-Zweig setzt die Art nicht auf 'error'");
});

// ---------------------------------------------------------------------
// M4 – Sperrzustand: Zellklick und Drop brechen bei busy VOR jeder Aktion ab
// ---------------------------------------------------------------------

test("onCellDrop: busy-Sperre steht VOR dem Auslesen der Drag-Nutzlast (fail-closed am Anfang)", async () => {
  const source = await readSource();
  const start = source.indexOf("const onCellDrop = (target: TargetCell) => (e: DragEvent) => {");
  const end = source.indexOf("const onCellClick = (target: TargetCell) => () => {", start);
  assert.notEqual(start, -1, "onCellDrop nicht gefunden");
  assert.notEqual(end, -1, "onCellClick nicht gefunden (Ende von onCellDrop unklar)");
  const body = source.slice(start, end);

  const busyGuardMatch = body.match(/if\s*\(!canEdit\s*\|\|\s*busy\)\s*return;/);
  assert.ok(busyGuardMatch, "kein fail-closed-Abbruch 'if (!canEdit || busy) return;' in onCellDrop gefunden");
  const busyGuardIndex = body.indexOf(busyGuardMatch[0]);
  const getDataIndex = body.indexOf("e.dataTransfer.getData(DND_MIME)");
  assert.notEqual(getDataIndex, -1, "kein Zugriff auf die Drag-Nutzlast gefunden");
  assert.ok(busyGuardIndex < getDataIndex, "die busy-Sperre steht NICHT vor dem Auslesen der Drag-Nutzlast");
});

test("onCellClick: busy-Sperre steht im fruehen Abbruchzweig VOR dem Oeffnen des Zuweisungsdialogs", async () => {
  const source = await readSource();
  const start = source.indexOf("const onCellClick = (target: TargetCell) => () => {");
  const end = source.indexOf("const onEntryDragStart", start);
  assert.notEqual(start, -1, "onCellClick nicht gefunden");
  assert.notEqual(end, -1, "onEntryDragStart nicht gefunden (Ende von onCellClick unklar)");
  const body = source.slice(start, end);

  const busyGuardMatch = body.match(/if\s*\(!canEdit\s*\|\|\s*busy\s*\|\|\s*!selectedTechnician\)\s*return;/);
  assert.ok(busyGuardMatch, "kein fail-closed-Abbruch mit busy in onCellClick gefunden");
  const busyGuardIndex = body.indexOf(busyGuardMatch[0]);
  const openIndex = body.indexOf("openAssignDialog(target, selectedTechnician)");
  assert.notEqual(openIndex, -1, "openAssignDialog-Aufruf in onCellClick nicht gefunden");
  assert.ok(busyGuardIndex < openIndex, "die busy-Sperre steht NICHT vor dem Oeffnen des Zuweisungsdialogs");
});

test("onRemoveZoneDrop: busy-Sperre steht VOR dem Entfernen-Aufruf (Ablegeflaechen der Monteurliste)", async () => {
  const source = await readSource();
  const start = source.indexOf("const onRemoveZoneDrop = (e: DragEvent) => {");
  const end = source.indexOf("const selectTechnician = (id: string) => {", start);
  assert.notEqual(start, -1, "onRemoveZoneDrop nicht gefunden");
  assert.notEqual(end, -1, "selectTechnician nicht gefunden (Ende von onRemoveZoneDrop unklar)");
  const body = source.slice(start, end);

  const busyGuardMatch = body.match(/if\s*\(!canEdit\s*\|\|\s*busy\)\s*return;/);
  assert.ok(busyGuardMatch, "kein fail-closed-Abbruch 'if (!canEdit || busy) return;' in onRemoveZoneDrop gefunden");
  const busyGuardIndex = body.indexOf(busyGuardMatch[0]);
  const removeIndex = body.indexOf("handleRemove(payload.entryId)");
  assert.notEqual(removeIndex, -1, "handleRemove-Aufruf in onRemoveZoneDrop nicht gefunden");
  assert.ok(busyGuardIndex < removeIndex, "die busy-Sperre steht NICHT vor dem Entfernen-Aufruf");
});

test("MonthGrid: der Tagesklick bricht ebenfalls bei busy ab (dieselbe Sperrzustand-Regel wie in der Wochenmatrix)", async () => {
  const source = await readSource();
  const start = source.indexOf("function MonthGrid(");
  assert.notEqual(start, -1, "MonthGrid nicht gefunden");
  const body = source.slice(start);
  assert.match(
    body,
    /if\s*\(!canEdit\s*\|\|\s*busy\s*\|\|\s*!selectedTechnician\)\s*return;/,
    "der Tagesklick in MonthGrid prueft busy nicht (Sperrzustand faellt in der Monatsansicht sonst nicht auf)",
  );
});

// ---------------------------------------------------------------------
// M3 – Drag-Feedback: onDragEnter/onDragLeave an Zielzellen, Reset bei Drop
// ---------------------------------------------------------------------

test("WeekMatrix: die Zellen tragen onDragEnter UND onDragLeave (Drag-Hervorhebung), zusaetzlich zum bestehenden onDragOver", async () => {
  const source = await readSource();
  const start = source.indexOf("function WeekMatrix(");
  const end = source.indexOf("function MonthGrid(", start);
  assert.notEqual(start, -1, "WeekMatrix nicht gefunden");
  assert.notEqual(end, -1, "MonthGrid nicht gefunden (Ende von WeekMatrix unklar)");
  const body = source.slice(start, end);

  assert.match(body, /onDragOver=/, "onDragOver fehlt in WeekMatrix (bestehendes Verhalten, darf nicht verloren gehen)");
  assert.match(body, /onDragEnter=/, "onDragEnter fehlt in WeekMatrix - keine Drag-Hervorhebung");
  assert.match(body, /onDragLeave=/, "onDragLeave fehlt in WeekMatrix - keine Ruecknahme der Drag-Hervorhebung");
});

test("WeekMatrix: der Hervorhebungszustand wird auch im drop-Pfad zurueckgesetzt (nicht nur bei onDragLeave)", async () => {
  const source = await readSource();
  const start = source.indexOf("function WeekMatrix(");
  const end = source.indexOf("function MonthGrid(", start);
  const body = source.slice(start, end);

  const onDropIndex = body.indexOf("onDrop=");
  assert.notEqual(onDropIndex, -1, "onDrop an der Zielzelle nicht gefunden");
  const resetIndex = body.indexOf("setDragOverKey(null)", onDropIndex);
  assert.notEqual(resetIndex, -1, "der Drag-Hervorhebungszustand (dragOverKey) wird im onDrop-Handler nicht zurueckgesetzt");
});

test("die beiden Ablegeflaechen der Monteurliste (Chip-Liste und der gestrichelte Entfernen-Bereich) tragen ebenfalls onDragEnter/onDragLeave", async () => {
  const source = await readSource();
  const listZoneStart = source.indexOf('className={`flex flex-col gap-2 rounded-md');
  const trashZoneStart = source.indexOf("Hierher ziehen zum Entfernen");
  assert.notEqual(listZoneStart, -1, "die Chip-Listen-Ablegeflaeche wurde nicht wie erwartet gefunden");
  assert.notEqual(trashZoneStart, -1, "der gestrichelte Entfernen-Bereich wurde nicht gefunden");

  const listZoneBlock = source.slice(listZoneStart, listZoneStart + 400);
  const trashZoneBlock = source.slice(Math.max(0, trashZoneStart - 400), trashZoneStart);

  assert.match(listZoneBlock, /onDragEnter=/, "Chip-Liste: onDragEnter fehlt");
  assert.match(listZoneBlock, /onDragLeave=/, "Chip-Liste: onDragLeave fehlt");
  assert.match(trashZoneBlock, /onDragEnter=/, "Entfernen-Bereich: onDragEnter fehlt");
  assert.match(trashZoneBlock, /onDragLeave=/, "Entfernen-Bereich: onDragLeave fehlt");
});

// ---------------------------------------------------------------------
// M5 – Leerzustaende unabhaengig von canEdit / Monatsansicht
// ---------------------------------------------------------------------

test("der Platzhalter fuer leere Zellen der Wochenmatrix erscheint UNABHAENGIG von canEdit (kein '&& canEdit' mehr davor)", async () => {
  const source = await readSource();
  assert.match(
    source,
    /entries\.length === 0 \? <span className="text-xs text-muted">—<\/span> : null/,
    "der Leerzustand-Platzhalter der Wochenmatrix ist nicht mehr an genau 'entries.length === 0' gebunden",
  );
  assert.ok(
    !/entries\.length === 0 && canEdit \? <span className="text-xs text-muted">—<\/span>/.test(source),
    "der Leerzustand-Platzhalter haengt weiterhin von canEdit ab - laut Auftrag muss er unabhaengig davon erscheinen",
  );
});

test("die bestehende Zeile 'Keine aktiven Bauabschnitte.' bleibt unveraendert erhalten", async () => {
  const source = await readSource();
  assert.match(source, /Keine aktiven Bauabschnitte\./, "die bestehende Leerzustandszeile fuer fehlende Bauabschnitte fehlt");
});

test("MonthGrid: ein Leerzustand fuer den GESAMTEN Monat existiert, unterscheidet sachlich zwischen Monteur (canEdit=false) und Staff (canEdit=true)", async () => {
  const source = await readSource();
  const emptyDeclIndex = source.indexOf("const monthIsEmpty = month.entries.length === 0;");
  assert.notEqual(emptyDeclIndex, -1, "kein monatsweiter Leerzustand (basierend auf month.entries.length === 0) gefunden");

  const ternaryStart = source.indexOf("monthIsEmpty ? (", emptyDeclIndex);
  assert.notEqual(ternaryStart, -1, "der Leerzustand wird nicht bedingt gerendert");
  const ternaryEnd = source.indexOf(") : null}", ternaryStart);
  assert.notEqual(ternaryEnd, -1, "Ende des bedingten Leerzustand-Blocks nicht gefunden");
  const ternaryBlock = source.slice(ternaryStart, ternaryEnd);

  assert.match(ternaryBlock, /canEdit/, "der Monats-Leerzustand unterscheidet nicht nach canEdit (Monteur vs. Staff)");
  const sentences = ternaryBlock.match(/"[^"]{15,}"/g) || [];
  assert.ok(sentences.length >= 2, "es wurden keine zwei unterschiedlichen Saetze fuer Monteur/Staff gefunden");
  assert.notEqual(sentences[0], sentences[1], "der Satz fuer canEdit und !canEdit ist identisch - keine Unterscheidung Monteur/Staff");
});

// ---------------------------------------------------------------------
// M6 – Chiphoehe: kein minHeight: 44px mehr in AssignedChip, stopPropagation bleibt
// ---------------------------------------------------------------------

test("AssignedChip enthaelt kein minHeight: \"44px\" (bzw. style={touchStyle}) mehr, stopPropagation aber weiterhin (Regressionswaechter aus AUFTRAG_17)", async () => {
  const source = await readSource();
  const start = source.indexOf("function AssignedChip");
  assert.notEqual(start, -1, "AssignedChip nicht gefunden");
  const end = source.indexOf("\nfunction ", start + 1);
  const body = source.slice(start, end === -1 ? undefined : end);

  assert.ok(!/minHeight:\s*"44px"/.test(body), "AssignedChip setzt weiterhin minHeight: \"44px\" - M6 ist nicht behoben");
  assert.ok(!/style=\{touchStyle\}/.test(body), "AssignedChip verwendet weiterhin style={touchStyle} - M6 ist nicht behoben");
  assert.match(body, /stopPropagation/, "AssignedChip: stopPropagation fehlt im \"x\"-Knopf - der Bugfix aus AUFTRAG_17 waere verloren");
});

test("touchStyle (minHeight 44px) bleibt als Konstante fuer die Schaltflaechen weiterhin in Gebrauch", async () => {
  const source = await readSource();
  assert.match(
    source,
    /const touchStyle = \{ minHeight: "44px" \} as const;/,
    "die touchStyle-Konstante wurde entfernt oder veraendert - sie soll fuer Schaltflaechen unveraendert bleiben",
  );
  const usages = source.match(/style=\{touchStyle\}/g) || [];
  assert.ok(usages.length > 0, "touchStyle wird nirgendwo mehr verwendet - es soll weiterhin an den Schaltflaechen genutzt werden");
});

// ---------------------------------------------------------------------
// Punkt 2 – hover:text-red-600 an beiden "x"-Knoepfen auf ein Token umgestellt
// ---------------------------------------------------------------------

test("beide 'x'-Knoepfe nutzen ein vorhandenes Token (hover:text-destructive) statt hover:text-red-600", async () => {
  const source = await readSource();
  assert.ok(!/hover:text-red-600/.test(source), "hover:text-red-600 ist noch vorhanden");
  const tokenUsages = source.match(/hover:text-destructive/g) || [];
  assert.equal(
    tokenUsages.length,
    2,
    `erwartet genau 2 Vorkommen von hover:text-destructive (AssignedChip und Monats-\"x\"-Knopf), gefunden: ${tokenUsages.length}`,
  );
});
