// AP15B/RC1 Schritt 3: statischer Verdrahtungswaechter fuer die in Schritt 2
// hergestellten Aufrufer von setIncidentFalseAlarm()/exportIncidentListFull().
//
// AUSDRUECKLICH: dies ist EIN STATISCHER WAECHTER UND KEIN VERHALTENSNACHWEIS.
// Er liest die betroffenen Quelldateien als TEXT und sichert nur, dass die
// Verdrahtung (Import, Export, Formularaktion, Sichtbarkeitsbedingung, Aufruf,
// Obergrenzen) nicht unbemerkt wieder verschwindet. DASS setIncidentFalseAlarm()
// tatsaechlich nur der Disposition erlaubt ist, DASS exportIncidentListFull()
// die richtigen Zeilen liefert und DASS die Obergrenzen tatsaechlich greifen,
// belegen ausschliesslich die Integrationsfaelle gegen echtes PostgreSQL in
// app/test/integration/ap15b-incident-list.int.mjs (dort L1-L13). Dieser Test
// laeuft ohne Datenbank und ohne Netz und ist bei einer rein kosmetischen
// Umformulierung der betroffenen Dateien der einzige, der sofort anschlaegt.
//
// Lauf: node --test app/test/ap15b-callers.test.mjs (Teil von test:unit ueber
// den Glob test/*.test.mjs).

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { INCIDENT_EXPORT_CAP, INCIDENT_FULL_EXPORT_CAP } from "../src/lib/incident-list.ts";

async function readSource(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

/**
 * Text des Importsatzes, der ein bestimmtes Modul benennt - als schlichte
 * Textspanne zwischen dem NAECHSTGELEGENEN vorangehenden `import {` und der
 * ersten Fundstelle von `from "<moduleSpecifier>"`.
 *
 * Bewusst KEIN allgemeiner Regex-Ansatz mit `[\s\S]*?` ueber das ganze
 * Dokument: eine lazy Wiederholung sucht das naechste `}` UNABHAENGIG davon,
 * zu welchem Importsatz es gehoert, und wuerde bei mehreren Importen vor der
 * Zielzeile ueber mehrere fremde Importsaetze hinweg zusammenfassen. Die
 * `lastIndexOf`-Suche liefert dagegen genau den zu dieser Fundstelle
 * gehoerenden Satzanfang.
 */
function importClause(source, moduleSpecifier) {
  const markerIndex = source.indexOf(`from "${moduleSpecifier}"`);
  if (markerIndex < 0) return null;
  const start = source.lastIndexOf("import {", markerIndex);
  if (start < 0) return null;
  return source.slice(start, markerIndex);
}

test("incident-actions.ts: importiert setIncidentFalseAlarm aus @/lib/incidents und exportiert setFalseAlarm", async () => {
  const source = await readSource("../src/lib/incident-actions.ts");

  const importBlock = importClause(source, "@/lib/incidents");
  assert.ok(importBlock, "incident-actions.ts: kein Import aus \"@/lib/incidents\" gefunden");
  assert.ok(
    importBlock.includes("setIncidentFalseAlarm"),
    "incident-actions.ts: setIncidentFalseAlarm wird nicht aus \"@/lib/incidents\" importiert",
  );

  assert.match(
    source,
    /export\s+async\s+function\s+setFalseAlarm\s*\(/,
    "incident-actions.ts: setFalseAlarm wird nicht (mehr) als async function exportiert",
  );
});

test('IncidentControls.tsx: bindet setFalseAlarm als Formularaktion, sichtbar nur bei role === "disponent", ohne isStaff', async () => {
  const source = await readSource("../src/components/incidents/IncidentControls.tsx");

  const importBlock = importClause(source, "@/lib/incident-actions");
  assert.ok(importBlock, 'IncidentControls.tsx: kein Import aus "@/lib/incident-actions" gefunden');
  assert.ok(
    importBlock.includes("setFalseAlarm"),
    'IncidentControls.tsx: setFalseAlarm wird nicht aus "@/lib/incident-actions" importiert',
  );

  assert.ok(
    source.includes("action={setFalseAlarm}"),
    "IncidentControls.tsx: kein Formular mit action={setFalseAlarm}",
  );

  // Der Fehlalarm-Block wird ueber seine Textgrenzen isoliert: von
  // `role === "disponent" ? (` bis zum zugehoerigen `) : null}`. Kein
  // vollstaendiger JSX-Parser, aber ausreichend, um diesen Block sicher vom
  // umgebenden JSX (u. a. dem isStaff-gesteuerten Block "Monteur zuweisen") zu
  // trennen.
  const startMarker = 'role === "disponent" ? (';
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, 'IncidentControls.tsx: keine Bedingung role === "disponent" gefunden');
  const end = source.indexOf(") : null}", start);
  assert.ok(end >= 0, "IncidentControls.tsx: der Fehlalarm-Block endet nicht sichtbar mit \") : null}\"");
  const block = source.slice(start, end);

  assert.ok(
    block.includes("setFalseAlarm"),
    "IncidentControls.tsx: setFalseAlarm steht nicht im Block der role === \"disponent\"-Bedingung",
  );
  assert.ok(
    !block.includes("isStaff"),
    'IncidentControls.tsx: der Fehlalarm-Block prueft zusaetzlich isStaff statt ausschliesslich role === "disponent"',
  );
});

test("OperationalList.tsx: importiert exportIncidentListFull und ruft es auf", async () => {
  const source = await readSource("../src/components/incidents/list/OperationalList.tsx");

  const importBlock = importClause(source, "@/lib/incident-list-actions");
  assert.ok(importBlock, 'OperationalList.tsx: kein Import aus "@/lib/incident-list-actions" gefunden');
  assert.ok(
    importBlock.includes("exportIncidentListFull"),
    'OperationalList.tsx: exportIncidentListFull wird nicht aus "@/lib/incident-list-actions" importiert',
  );

  assert.ok(
    source.includes("exportIncidentListFull("),
    "OperationalList.tsx: exportIncidentListFull wird nirgends aufgerufen",
  );
});

test("die dokumentierten UI-Obergrenzen bleiben unveraendert (04-UI-UX/LISTENKONZEPT.md)", () => {
  assert.equal(
    INCIDENT_EXPORT_CAP,
    5000,
    "INCIDENT_EXPORT_CAP hat sich veraendert - Abweichung von der dokumentierten UI-Grenze",
  );
  assert.equal(
    INCIDENT_FULL_EXPORT_CAP,
    20000,
    "INCIDENT_FULL_EXPORT_CAP hat sich veraendert - Abweichung von der dokumentierten UI-Grenze",
  );
});

// ---------------------------------------------------------------------------
// AUFTRAG_2/F10: Export- und Massenaktions-Rollenpruefung als Allowlist statt
// Negativliste. AUSDRUECKLICH EIN STATISCHER WAECHTER UND KEIN
// VERHALTENSNACHWEIS - wie die Faelle oben liest dieser Block
// incident-list-actions.ts als TEXT und sichert nur, dass die Negativliste
// (`session.role === "monteur"`) nicht als AUSFUEHRBARER Code zurueckkehrt und
// dass alle vier betroffenen Funktionen dieselbe benannte Allowlist verwenden.
// Das tatsaechliche Zugriffsverhalten (inkl. RLS/RPC) belegen die
// Integrationsfaelle gegen echtes PostgreSQL (u. a.
// app/test/integration/ap15b-incident-list.int.mjs), nicht dieser Test.
test("incident-list-actions.ts: Export- und Massenaktionspruefungen sind eine Allowlist, keine Negativliste mehr", async () => {
  const source = await readSource("../src/lib/incident-list-actions.ts");

  assert.match(
    source,
    /const STAFF_ALLOWED_ROLES: readonly UserRole\[\] = \["admin", "disponent"\];/,
    'incident-list-actions.ts: STAFF_ALLOWED_ROLES fehlt oder ist nicht genau ["admin", "disponent"]',
  );

  // Kein ausfuehrbarer Vergleich mehr auf die verbotene Rolle. Der Text
  // `session.role === "monteur"` darf nur noch als Erwaehnung in einem
  // Kommentar auftauchen (Zeilen, die mit `//` beginnen), nicht als Code.
  const forbiddenPattern = 'session.role === "monteur"';
  for (const line of source.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.includes(forbiddenPattern)) {
      assert.ok(
        trimmed.startsWith("//"),
        `incident-list-actions.ts: Negativliste als Code gefunden: "${trimmed}"`,
      );
    }
  }

  const usages = source.match(/STAFF_ALLOWED_ROLES\.includes\(session\.role\)/g) ?? [];
  assert.equal(
    usages.length,
    4,
    `incident-list-actions.ts: STAFF_ALLOWED_ROLES.includes(session.role) wird ${usages.length}x statt 4x verwendet (exportIncidentList, exportIncidentListFull, bulkUpdateIncidentStatus, bulkAssignIncidentMonteur)`,
  );
});
