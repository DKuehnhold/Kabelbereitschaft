// AUFTRAG_18: Dispo-Board – Zuweisung über mehrere Tage ("von-bis"-Dialog).
//
// AUSDRUECKLICH EIN STATISCHER WAECHTER UND KEIN VERHALTENSNACHWEIS (Muster
// aus app/test/auftrag17-dispo-regeln.test.mjs): liest OnCallPlanClient.tsx
// und on-call-plan-actions.ts als TEXT und prueft Vorhandensein/Struktur der
// verlangten Regeln. Ein Render-/Verhaltensnachweis (z. B. dass ein echter
// Dialog tatsaechlich oeffnet) ist in dieser Sandbox ohne Browser/JSDOM nicht
// vorgesehen und nicht Teil dieses Wächtertests.
//
// Lauf: node --test app/test/auftrag18-dispo-zeitraum.test.mjs (Teil von
// test:unit ueber den Glob test/*.test.mjs).

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function readClientSource() {
  return readFile(
    new URL("../src/components/on-call-plan/OnCallPlanClient.tsx", import.meta.url),
    "utf8",
  );
}

async function readActionsSource() {
  return readFile(
    new URL("../src/lib/on-call-plan-actions.ts", import.meta.url),
    "utf8",
  );
}

async function readLimitsSource() {
  return readFile(
    new URL("../src/lib/on-call-plan-limits.ts", import.meta.url),
    "utf8",
  );
}

function sliceFunction(source, marker, nextMarkers) {
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `Marker nicht gefunden: "${marker}"`);
  let end = source.length;
  for (const next of nextMarkers) {
    const idx = source.indexOf(next, start + marker.length);
    if (idx !== -1 && idx < end) end = idx;
  }
  return source.slice(start, end);
}

test("assignOnCallRange existiert und verwendet STAFF_ALLOWED_ROLES, withUserTransaction und on conflict", async () => {
  const source = await readActionsSource();
  assert.match(
    source,
    /export async function assignOnCallRange\(/,
    "assignOnCallRange als exportierte Funktion nicht gefunden",
  );
  const body = sliceFunction(
    source,
    "export async function assignOnCallRange(",
    ["\nexport async function ", "\nexport function "],
  );
  assert.match(body, /STAFF_ALLOWED_ROLES/, "assignOnCallRange prüft nicht gegen STAFF_ALLOWED_ROLES");
  assert.match(body, /withUserTransaction\(/, "assignOnCallRange nutzt keine withUserTransaction()");
  assert.match(body, /on conflict/, "assignOnCallRange enthält keine \"on conflict\"-Klausel");
});

test("assignOnCallRange wiederholt serverseitig BEIDE Grenzprüfungen: Bis vor Von und Obergrenze", async () => {
  const source = await readActionsSource();
  const body = sliceFunction(
    source,
    "export async function assignOnCallRange(",
    ["\nexport async function ", "\nexport function "],
  );
  assert.match(
    body,
    /toIso\s*<\s*fromIso/,
    "keine serverseitige Prüfung \"Bis vor Von\" (toIso < fromIso) in assignOnCallRange gefunden",
  );
  assert.match(
    body,
    /countDaysInclusive\(fromIso, toIso, MAX_RANGE_DAYS\)\s*>\s*MAX_RANGE_DAYS/,
    "keine serverseitige Obergrenzenprüfung (> MAX_RANGE_DAYS) in assignOnCallRange gefunden",
  );
});

test("on conflict-Formulierungen passen auf die BEIDEN partiellen Unique-Indizes aus 0022_hlk_dispo_board.sql", async () => {
  const source = await readActionsSource();
  assert.match(
    source,
    /on conflict \(plan_date, technician_id\) where assignment_kind = 'dispo' do nothing/,
    "on-conflict-Klausel für die Dispo-Zeile passt nicht auf on_call_plan_dispo_uq",
  );
  assert.match(
    source,
    /on conflict \(construction_stage_id, plan_date, technician_id\) where assignment_kind = 'bereitschaft' do nothing/,
    "on-conflict-Klausel für Bereitschaft passt nicht auf on_call_plan_bereitschaft_uq",
  );
});

test("Obergrenze: MAX_RANGE_DAYS trägt in on-call-plan-limits.ts den Wert 92 (benannte Konstante, kommentiert) und wird von on-call-plan-actions.ts importiert (AUFTRAG_24: kein Wert-Export in einer \"use server\"-Datei)", async () => {
  const limitsSource = await readLimitsSource();
  assert.match(
    limitsSource,
    /export const MAX_RANGE_DAYS = 92;/,
    "MAX_RANGE_DAYS mit Wert 92 nicht als benannte, exportierte Konstante in on-call-plan-limits.ts gefunden",
  );
  assert.doesNotMatch(
    limitsSource.split("\n").slice(0, 5).join("\n"),
    /^\s*["']use server["'];?\s*$/m,
    "on-call-plan-limits.ts darf keine \"use server\"-Direktive tragen (Client importiert direkt daraus)",
  );

  const actionsSource = await readActionsSource();
  assert.doesNotMatch(
    actionsSource,
    /export const MAX_RANGE_DAYS/,
    "on-call-plan-actions.ts exportiert MAX_RANGE_DAYS weiterhin selbst als Wert - genau das verletzt die \"use server\"-Regel",
  );
  assert.match(
    actionsSource,
    /import\s*\{[^}]*\bMAX_RANGE_DAYS\b[^}]*\}\s*from\s*"@\/lib\/on-call-plan-limits"/,
    "on-call-plan-actions.ts importiert MAX_RANGE_DAYS nicht aus on-call-plan-limits.ts",
  );
});

test("Obergrenze: OnCallPlanClient.tsx verwendet DIESELBE MAX_RANGE_DAYS-Konstante (Import aus on-call-plan-limits, kein zweiter Zahlenwert)", async () => {
  const source = await readClientSource();
  assert.match(
    source,
    /import\s*\{\s*MAX_RANGE_DAYS\s*\}\s*from\s*"@\/lib\/on-call-plan-limits"/,
    "OnCallPlanClient.tsx importiert MAX_RANGE_DAYS nicht aus on-call-plan-limits.ts - Gefahr eines zweiten, abweichenden Zahlenwerts",
  );
  assert.doesNotMatch(
    source,
    /const\s+MAX_RANGE_DAYS\s*=/,
    "OnCallPlanClient.tsx definiert eine eigene MAX_RANGE_DAYS-Konstante statt die importierte zu verwenden",
  );
});

// AUFTRAG_24: neuer Waechterfall gegen genau die Build-Fehlerklasse, die
// diesen Auftrag ausgeloest hat - ein Wert-Export in einer "use server"-
// Datei, den Turbopack im Produktionsbuild ablehnt (tsc/ESLint/Unit-Tests
// kannten die Next.js-Direktive bislang nicht). Geprueft wird ueber ALLE
// Dateien unter app/src, die "use server" tragen: jeder Export muss
// entweder "export async function" oder ein reiner Typ-Export
// ("export type" bzw. "export interface") sein.
//
// Nachbesserung 2026-08-18 (Korrektur zu AUFTRAG_24): Die Anzahl der
// gefundenen "use server"-Dateien wird bewusst NICHT auf eine feste Zahl
// geprueft, sondern nur als untere Schranke. Ein statischer Waechter darf
// keine Momentaufnahme festschreiben, sondern muss die Absicht pruefen -
// siehe Projektlehre in PROJEKT_WISSEN.md, ausgeloest durch AUFTRAG_19
// (fest eingetragene Anzahl 4) und AUFTRAG_22 (woertliche Zeichenkette).
// Jede kuenftige, legitime neue Server-Actions-Datei wuerde einen Test mit
// exakter Gleichheit sonst zwangslaeufig rot machen. Die untere Schranke
// bleibt trotzdem sinnvoll: sie schuetzt davor, dass der Dateiscan ins
// Leere laeuft (z. B. falscher Pfad, kaputte Regex) und der Test dadurch
// stillschweigend nichts mehr prueft - ein Scan mit 0 Treffern waere sonst
// grade wegen der fehlenden Zahl grün.
test("Jede \"use server\"-Datei unter src exportiert ausschließlich async function oder Typen (Turbopack-Regel, AUFTRAG_24)", async () => {
  const { readdir } = await import("node:fs/promises");

  const srcRoot = new URL("../src/", import.meta.url);

  async function collectFiles(dirUrl) {
    const entries = await readdir(dirUrl, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      const entryUrl = new URL(entry.name + (entry.isDirectory() ? "/" : ""), dirUrl);
      if (entry.isDirectory()) {
        files.push(...(await collectFiles(entryUrl)));
      } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
        files.push(entryUrl);
      }
    }
    return files;
  }

  const allFiles = await collectFiles(srcRoot);
  const useServerFiles = [];
  for (const fileUrl of allFiles) {
    const content = await readFile(fileUrl, "utf8");
    if (/^\s*["']use server["'];?\s*$/m.test(content.split("\n").slice(0, 5).join("\n"))) {
      useServerFiles.push({ fileUrl, content });
    }
  }

  // Untere Schranke statt fester Anzahl (siehe Kommentar im Testkopf,
  // Nachbesserung 2026-08-18 zu AUFTRAG_24): zum Zeitpunkt dieses Auftrags
  // gab es mindestens 9 "use server"-Dateien unter src. Die Schranke prueft
  // nicht die exakte Anzahl, sondern nur, dass der Dateiscan nicht ins Leere
  // laeuft - ein Scan mit 0 Treffern (kaputter Pfad/Regex) wuerde sonst
  // stillschweigend nichts mehr pruefen und trotzdem gruen bleiben.
  assert.ok(
    useServerFiles.length >= 9,
    `Erwartet mindestens 9 "use server"-Dateien unter src (Schranke gegen einen leerlaufenden Dateiscan, der den Test stillschweigend wirkungslos machen wuerde), gefunden ${useServerFiles.length}: `
    + useServerFiles.map((f) => f.fileUrl.pathname).join(", "),
  );

  const violations = [];
  for (const { fileUrl, content } of useServerFiles) {
    const exportLines = content
      .split("\n")
      .filter((line) => /^\s*export\s/.test(line));
    for (const line of exportLines) {
      const isAsyncFunction = /^\s*export\s+async\s+function\b/.test(line);
      const isType = /^\s*export\s+(type|interface)\b/.test(line);
      if (!isAsyncFunction && !isType) {
        violations.push(`${fileUrl.pathname}: ${line.trim()}`);
      }
    }
  }

  assert.deepEqual(
    violations,
    [],
    `"use server"-Dateien mit einem Export, der weder async function noch Typ ist (Turbopack verwirft dort ALLE Exporte): ${violations.join(" | ")}`,
  );
});

test("Der Dialog wird ausschließlich im Neuzuweisungspfad geöffnet (openAssignDialog), nicht im Verschiebepfad", async () => {
  const source = await readClientSource();

  // Neuzuweisungspfade: Klick-Ebene Woche, Klickpfad Monat, und der
  // "kind !== move"-Zweig von onCellDrop.
  const onCellClickBody = sliceFunction(source, "const onCellClick = (target: TargetCell) => () => {", ["\n  const onEntryDragStart"]);
  assert.match(onCellClickBody, /openAssignDialog\(/, "onCellClick (Klick-Ebene Woche) öffnet den Dialog nicht");

  const onConfirmPromptIndex = source.indexOf("onConfirmPrompt={(dateIso) => {");
  assert.notEqual(onConfirmPromptIndex, -1, "onConfirmPrompt (Klickpfad Monat) nicht gefunden");
  const onConfirmPromptBody = source.slice(onConfirmPromptIndex, source.indexOf("}}", source.indexOf("setMonthPromptDate(null);", onConfirmPromptIndex)));
  assert.match(onConfirmPromptBody, /openAssignDialog\(/, "onConfirmPrompt (Klickpfad Monat) öffnet den Dialog nicht");

  const onCellDropBody = sliceFunction(source, "const onCellDrop = (target: TargetCell) => (e: DragEvent) => {", ["\n  const onCellClick"]);
  assert.match(onCellDropBody, /openAssignDialog\(/, "onCellDrop (Neuzuweisungs-Zweig) öffnet den Dialog nicht");
  assert.match(
    onCellDropBody,
    /payload\.kind === "move"[\s\S]{0,300}handleDropOrClickAssign\(target, payload\)/,
    "onCellDrop leitet den move-Zweig nicht unverändert an handleDropOrClickAssign weiter",
  );

  // Verschiebepfad: handleDropOrClickAssign selbst und dessen move-Branch
  // dürfen NICHT openAssignDialog aufrufen - Verschieben bleibt ohne Dialog.
  const handleDropBody = sliceFunction(
    source,
    "const handleDropOrClickAssign = (target: TargetCell, payload: DragPayload) => {",
    ["\n  const onCellDrop"],
  );
  assert.ok(
    !handleDropBody.includes("openAssignDialog("),
    "handleDropOrClickAssign (Verschiebepfad) ruft openAssignDialog auf - Verschieben soll laut Punkt 6 OHNE Dialog bleiben",
  );
});

test("\"Nur diesen Tag\" und \"Zeitraum eintragen\" sind getrennte Pfade (eigene Funktionen)", async () => {
  const source = await readClientSource();
  assert.match(source, /const handleAssignSingleDay = \(\) => \{/, "handleAssignSingleDay nicht gefunden");
  assert.match(source, /const handleAssignRange = \(\) => \{/, "handleAssignRange nicht gefunden");
  assert.notEqual(
    source.indexOf("const handleAssignSingleDay = "),
    source.indexOf("const handleAssignRange = "),
    "beide Pfade dürfen nicht identisch/verschmolzen sein",
  );
});

test("Der Abbruchzweig des Dialogs (Abbrechen/Schließen) ruft KEINE Server-Action auf", async () => {
  const source = await readClientSource();
  const closeBody = sliceFunction(source, "const closeAssignDialog = () => {", ["\n  /** Alle Kalendertage"]);
  assert.ok(
    !/assignOnCall|assignDispo|assignOnCallRange|runAction|runRangeAction/.test(closeBody),
    "closeAssignDialog ruft eine Server-Action bzw. einen Action-Runner auf - Abbrechen darf nichts schreiben",
  );
});

test("Doppelbelegungsprüfung im Zeitraum-Pfad läuft über ALLE Tage des Zeitraums, nicht nur den Starttag", async () => {
  const source = await readClientSource();
  const body = sliceFunction(source, "const handleAssignRange = () => {", ["\n  return ("]);
  assert.match(
    body,
    /isoDatesInRange\(fromIso, rangeToIso\)/,
    "handleAssignRange ermittelt nicht alle Tage des Zeitraums (isoDatesInRange)",
  );
  assert.match(
    body,
    /days\.filter\(\s*\n?\s*\(day\) => findConflictingEntry\(activeEntries, technicianId, day, target\)/,
    "die Doppelbelegungsprüfung im Zeitraum-Pfad prüft nicht jeden Tag aus \"days\" einzeln",
  );
});

// AUFTRAG_22 (Stopppunkt aus AUFTRAG_20 / MELDUNG_20): Der Wächter darf die
// Obergrenzenprüfung NICHT als wörtliche Zeichenkette ("days.length >
// MAX_RANGE_DAYS") suchen, denn AUFTRAG_20 hat genau diese Formulierung durch
// einen frueh abbrechenden Zaehler (countDaysInRange(...) > MAX_RANGE_DAYS)
// ersetzt - ein Zeichenketten-Wächter wuerde jede zukuenftige, gleichwertige
// Umformulierung faelschlich als Regressionsbruch melden. Geprueft wird daher
// die ABSICHT: irgendein Vergleich gegen MAX_RANGE_DAYS (Muster /> \s*
// MAX_RANGE_DAYS/, erkennt sowohl die alte als auch die neue Formulierung)
// muss VOR dem Aufbau der vollstaendigen Tagesliste (isoDatesInRange(...))
// UND vor dem Schreibvorgang (runRangeAction(...)) stehen. Zusaetzlich wird
// festgehalten, dass isoDatesInRange selbst ein Sicherheitsnetz gegen
// MAX_RANGE_DAYS traegt (AUFTRAG_20 Punkt 3).
test("Bis vor Von und die 92-Tage-Obergrenze werden im Dialog VOR jedem Schreibvorgang geprüft (kein Schreiben bei Verstoß)", async () => {
  const source = await readClientSource();
  const body = sliceFunction(source, "const handleAssignRange = () => {", ["\n  return ("]);

  const orderCheckIndex = body.indexOf("rangeToIso < fromIso");
  const maxCheckMatch = body.match(/>\s*MAX_RANGE_DAYS/);
  const maxCheckIndex = maxCheckMatch ? maxCheckMatch.index : -1;
  const isoDatesInRangeCallIndex = body.indexOf("isoDatesInRange(");
  const rangeActionIndex = body.indexOf("runRangeAction(");

  assert.notEqual(orderCheckIndex, -1, "Prüfung \"Bis vor Von\" nicht gefunden");
  assert.notEqual(
    maxCheckIndex,
    -1,
    "Prüfung der 92-Tage-Obergrenze (ein Vergleich gegen MAX_RANGE_DAYS) nicht gefunden",
  );
  assert.notEqual(
    isoDatesInRangeCallIndex,
    -1,
    "Aufruf von isoDatesInRange (Aufbau der vollstaendigen Tagesliste) nicht gefunden",
  );
  assert.notEqual(rangeActionIndex, -1, "Aufruf von runRangeAction (Schreibvorgang) nicht gefunden");

  assert.ok(
    orderCheckIndex < rangeActionIndex && maxCheckIndex < rangeActionIndex,
    "beide Grenzprüfungen stehen nicht VOR dem Schreibvorgang (runRangeAction)",
  );
  assert.ok(
    maxCheckIndex < isoDatesInRangeCallIndex,
    "die 92-Tage-Obergrenzenprüfung (Vergleich gegen MAX_RANGE_DAYS) greift erst NACH dem Aufbau der "
    + "vollstaendigen Tagesliste (isoDatesInRange) - bei einem Tippfehler im Jahr wuerde der Browser "
    + "erst die riesige Liste aufbauen, bevor die Grenze ueberhaupt geprueft wird, statt vorher "
    + "abzubrechen",
  );

  const isoDatesInRangeBody = sliceFunction(
    source,
    "const isoDatesInRange = (fromIso: string, toIso: string): string[] => {",
    ["\n  const handleAssignSingleDay"],
  );
  assert.match(
    isoDatesInRangeBody,
    /MAX_RANGE_DAYS/,
    "isoDatesInRange traegt kein Sicherheitsnetz gegen MAX_RANGE_DAYS (AUFTRAG_20 Punkt 3)",
  );
});

test("keine harte Tailwind-Farbklasse in den neu hinzugefügten AUFTRAG_18-Stellen (Dialog, Zeitraum-Handler)", async () => {
  const source = await readClientSource();
  const forbidden = /bg-red-|text-red-|bg-green-|bg-yellow-/;

  const dialogStart = source.indexOf("function AssignRangeDialog(");
  assert.notEqual(dialogStart, -1, "AssignRangeDialog nicht gefunden");
  const dialogBody = source.slice(dialogStart);
  assert.ok(!forbidden.test(dialogBody), "AssignRangeDialog verwendet eine harte Tailwind-Farbklasse");

  const rangeActionBody = sliceFunction(source, "const handleAssignRange = () => {", ["\n  return ("]);
  assert.ok(!forbidden.test(rangeActionBody), "handleAssignRange verwendet eine harte Tailwind-Farbklasse");

  const runRangeActionBody = sliceFunction(source, "const runRangeAction = async", ["\n  const openAssignDialog"]);
  assert.ok(!forbidden.test(runRangeActionBody), "runRangeAction verwendet eine harte Tailwind-Farbklasse");
});

test("keine harte Tailwind-Farbklasse in assignOnCallRange (on-call-plan-actions.ts)", async () => {
  const source = await readActionsSource();
  const body = sliceFunction(
    source,
    "export async function assignOnCallRange(",
    ["\nexport async function ", "\nexport function "],
  );
  assert.ok(
    !/bg-red-|text-red-|bg-green-|bg-yellow-/.test(body),
    "assignOnCallRange verwendet eine harte Tailwind-Farbklasse",
  );
});
