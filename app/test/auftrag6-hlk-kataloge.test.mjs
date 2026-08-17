// AUFTRAG_6: statischer Verdrahtungswaechter fuer die drei neuen pflegbaren
// Stammdaten-Kataloge (Gewerke, Funktionen, Objektarten, Migration 0019) und
// die Funktions-Verknuepfung an public.contacts.
//
// AUSDRUECKLICH: dies ist EIN STATISCHER WAECHTER UND KEIN VERHALTENSNACHWEIS
// (Muster aus app/test/ap15b-callers.test.mjs). Er liest die betroffenen
// Quelldateien als TEXT und sichert, dass die Verdrahtung (Export, Import,
// Rollen-Allowlist statt Negativliste, Navigation, Formularfeld) nicht
// unbemerkt verschwindet. Ein echter Datenbanklauf ist in dieser Sandbox laut
// Auftrag nicht moeglich und wird durch den CI-Job "database" erbracht.
//
// Lauf: node --test app/test/auftrag6-hlk-kataloge.test.mjs (Teil von
// test:unit ueber den Glob test/*.test.mjs).

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function readSource(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("masterdata.ts: exportiert die Lesewege der drei neuen Kataloge", async () => {
  const source = await readSource("../src/lib/masterdata.ts");
  for (const fn of [
    "listTrades",
    "getActiveTradeOptions",
    "listContactFunctions",
    "getActiveContactFunctionOptions",
    "listObjectTypes",
    "getActiveObjectTypeOptions",
  ]) {
    assert.match(
      source,
      new RegExp(`export\\s+async\\s+function\\s+${fn}\\s*\\(`),
      `masterdata.ts: ${fn} wird nicht (mehr) als async function exportiert`,
    );
  }
});

test("masterdata-actions.ts: exportiert save/setActive fuer alle drei neuen Kataloge", async () => {
  const source = await readSource("../src/lib/masterdata-actions.ts");
  for (const fn of [
    "saveTrade",
    "setTradeActive",
    "saveContactFunction",
    "setContactFunctionActive",
    "saveObjectType",
    "setObjectTypeActive",
  ]) {
    assert.match(
      source,
      new RegExp(`export\\s+async\\s+function\\s+${fn}\\s*\\(`),
      `masterdata-actions.ts: ${fn} wird nicht (mehr) als async function exportiert`,
    );
  }
});

test("masterdata-actions.ts: die drei neuen save*-Aktionen nutzen die bestehende Allowlist requireStaff() statt einer eigenen Negativliste", async () => {
  const source = await readSource("../src/lib/masterdata-actions.ts");
  // \r?\n statt \n: masterdata-actions.ts liegt mit CRLF-Zeilenenden vor.
  const blocks = {
    saveTrade: /export async function saveTrade\([\s\S]*?\r?\n}\r?\n/,
    saveContactFunction: /export async function saveContactFunction\([\s\S]*?\r?\n}\r?\n/,
    saveObjectType: /export async function saveObjectType\([\s\S]*?\r?\n}\r?\n/,
  };
  for (const [name, pattern] of Object.entries(blocks)) {
    const match = source.match(pattern);
    assert.ok(match, `masterdata-actions.ts: Funktionskoerper von ${name} nicht gefunden`);
    const body = match[0];
    assert.ok(
      body.includes("requireStaff()"),
      `masterdata-actions.ts: ${name} prueft die Berechtigung nicht ueber requireStaff()`,
    );
    assert.ok(
      !body.includes('role === "monteur"') && !body.includes("role !== \"admin\""),
      `masterdata-actions.ts: ${name} enthaelt eine eigene Negativliste statt der gemeinsamen Allowlist requireStaff()`,
    );
  }
});

test("masterdata-actions.ts: saveContact persistiert function_id (AUFTRAG_6-Erweiterung)", async () => {
  const source = await readSource("../src/lib/masterdata-actions.ts");
  const match = source.match(/export async function saveContact\([\s\S]*?\r?\n}\r?\n/);
  assert.ok(match, "masterdata-actions.ts: Funktionskoerper von saveContact nicht gefunden");
  const body = match[0];
  assert.ok(body.includes('optionalUuid(fd, "function_id")'), "saveContact liest function_id nicht aus dem Formular");
  assert.ok(body.includes("function_id = $4::uuid") || body.includes("function_id, email"), "saveContact schreibt function_id nicht in die SQL-Anweisung(en)");
});

test("roles.ts: NAV_GROUPS enthaelt die drei neuen Stammdaten-Eintraege fuer admin und disponent", async () => {
  const source = await readSource("../src/lib/roles.ts");
  for (const href of ["/stammdaten/gewerke", "/stammdaten/funktionen", "/stammdaten/objektarten"]) {
    const marker = `href: "${href}"`;
    const idx = source.indexOf(marker);
    assert.ok(idx >= 0, `roles.ts: NAV_GROUPS enthaelt keinen Eintrag fuer ${href}`);
    const line = source.slice(idx, source.indexOf("}", idx));
    assert.ok(
      line.includes('"admin"') && line.includes('"disponent"'),
      `roles.ts: der Eintrag fuer ${href} ist nicht fuer admin UND disponent sichtbar`,
    );
  }
});

test("die drei neuen Pflegeseiten importieren ihre jeweilige Lese-Funktion und Client-Komponente", async () => {
  const pages = [
    {
      path: "../src/app/(app)/stammdaten/gewerke/page.tsx",
      listFn: "listTrades",
      client: "TradesClient",
    },
    {
      path: "../src/app/(app)/stammdaten/funktionen/page.tsx",
      listFn: "listContactFunctions",
      client: "ContactFunctionsClient",
    },
    {
      path: "../src/app/(app)/stammdaten/objektarten/page.tsx",
      listFn: "listObjectTypes",
      client: "ObjectTypesClient",
    },
  ];
  for (const { path, listFn, client } of pages) {
    const source = await readSource(path);
    assert.ok(source.includes(listFn), `${path}: importiert/nutzt ${listFn} nicht`);
    assert.ok(source.includes(client), `${path}: importiert/nutzt ${client} nicht`);
  }
});

test("ContactsClient.tsx: bindet die Funktions-Auswahl (function_id) als optionales Select ein", async () => {
  const source = await readSource("../src/components/masterdata/ContactsClient.tsx");
  assert.ok(source.includes("functionOptions"), "ContactsClient.tsx: erhaelt/verwendet functionOptions nicht");
  assert.match(
    source,
    /<select[^>]*name="function_id"/,
    "ContactsClient.tsx: kein <select name=\"function_id\">",
  );
});
