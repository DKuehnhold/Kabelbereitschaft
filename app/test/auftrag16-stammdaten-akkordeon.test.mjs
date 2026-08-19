// AUFTRAG_16: Stammdaten-Uebersicht /stammdaten als Akkordeon (Pflege
// inline, kein Seitenwechsel). Die 13 bestehenden Einzelrouten und die 13
// Client-Komponenten in components/masterdata/ bleiben unveraendert - sie
// werden auf der neuen Uebersichtsseite nur eingebunden, nicht geaendert.
//
// AUSDRUECKLICH EIN STATISCHER WAECHTER UND KEIN VERHALTENSNACHWEIS (Muster
// aus app/test/ap15b-callers.test.mjs, siehe auch der zweite Testblock in
// app/test/auftrag10-bereitschaftsplan.test.mjs): liest die neue page.tsx
// und roles.ts als TEXT und sichert Vollstaendigkeit, Reihenfolge und
// Rollengate. Ein Render-/Verhaltensnachweis (z. B. dass das Aufklappen
// tatsaechlich die Pflege zeigt) ist in dieser Sandbox ohne Browser/JSDOM
// nicht vorgesehen und nicht Teil dieses Wächtertests.
//
// Lauf: node --test app/test/auftrag16-stammdaten-akkordeon.test.mjs (Teil
// von test:unit ueber den Glob test/*.test.mjs).

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function readSource(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

// Verbindliche Reihenfolge der 13 Abschnitte laut AUFTRAG_16 (Tabelle):
// Plaetze 1-3 Dennis' ausdrueckliche Vorgabe, Plaetze 4-13 die bestehende
// Reihenfolge aus lib/roles.ts ("Rest").
const EXPECTED_ORDER = [
  "VzgLinesClient",
  "StagesClient",
  "ContactsClient",
  "CustomersClient",
  "TechniciansClient",
  "TeamsClient",
  "CableTypesClient",
  "TradesClient",
  "ContactFunctionsClient",
  "ObjectTypesClient",
  "QualificationsClient",
  "OnCallNumbersClient",
  "SettingsClient",
];

test("stammdaten/page.tsx: alle 13 Client-Komponenten sind importiert und verwendet (kein Import ohne Verwendung, keine fehlt)", async () => {
  const source = await readSource("../src/app/(app)/stammdaten/page.tsx");

  for (const name of EXPECTED_ORDER) {
    const importPattern = new RegExp(`import\\s*\\{\\s*${name}\\s*\\}\\s*from\\s*"@/components/masterdata/${name}"`);
    assert.match(
      source,
      importPattern,
      `stammdaten/page.tsx: Import von ${name} aus components/masterdata/${name} fehlt oder weicht ab`,
    );

    const usagePattern = new RegExp(`<${name}[\\s>]`);
    const usages = source.match(new RegExp(`<${name}[\\s>]`, "g")) ?? [];
    assert.equal(
      usages.length,
      1,
      `stammdaten/page.tsx: <${name} .../> wird ${usages.length}x statt genau 1x verwendet`,
    );
    assert.match(source, usagePattern, `stammdaten/page.tsx: <${name} ...> wird nicht verwendet`);
  }

  assert.equal(EXPECTED_ORDER.length, 13, "Testkonfiguration: EXPECTED_ORDER muss genau 13 Eintraege haben");
});

test("stammdaten/page.tsx: die Reihenfolge der 13 Abschnitte entspricht der AUFTRAG_16-Tabelle (Positionsvergleich)", async () => {
  const source = await readSource("../src/app/(app)/stammdaten/page.tsx");

  const positions = EXPECTED_ORDER.map((name) => {
    const index = source.search(new RegExp(`<${name}[\\s>]`));
    assert.notEqual(index, -1, `stammdaten/page.tsx: <${name} ...> nicht gefunden`);
    return { name, index };
  });

  for (let i = 1; i < positions.length; i += 1) {
    assert.ok(
      positions[i].index > positions[i - 1].index,
      `stammdaten/page.tsx: Reihenfolge verletzt - ${positions[i].name} steht nicht nach ${positions[i - 1].name} ` +
        `(erwartete Reihenfolge: ${EXPECTED_ORDER.join(" -> ")})`,
    );
  }
});

test("stammdaten/page.tsx: Rollengate admin/disponent ist vorhanden und steht VOR der gemeinsamen Datenladung (Promise.all)", async () => {
  const source = await readSource("../src/app/(app)/stammdaten/page.tsx");

  const gatePattern = /session\.role !== "admin" && session\.role !== "disponent"/;
  assert.match(source, gatePattern, "stammdaten/page.tsx: Rollengate admin/disponent fehlt oder weicht ab");

  const gateIndex = source.search(gatePattern);
  const promiseAllIndex = source.indexOf("await Promise.all([");
  assert.notEqual(promiseAllIndex, -1, "stammdaten/page.tsx: keine gemeinsame Promise.all-Datenladung gefunden");
  assert.ok(
    gateIndex < promiseAllIndex,
    "stammdaten/page.tsx: das Rollengate steht nicht vor der Promise.all-Datenladung",
  );

  assert.match(
    source,
    /export const dynamic = "force-dynamic";/,
    'stammdaten/page.tsx: export const dynamic = "force-dynamic" fehlt (Muster der 13 Einzelseiten)',
  );
});

test("roles.ts: der neue Uebersichtseintrag /stammdaten steht als ERSTES Element der Stammdaten-Gruppe, alle 13 Einzelrouten bleiben erhalten", async () => {
  const source = await readSource("../src/lib/roles.ts");

  const groupMatch = source.match(/label:\s*"Stammdaten",[\s\S]*?items:\s*\[([\s\S]*?)\n\s*\],\n\s*\},/);
  assert.ok(groupMatch, "roles.ts: NAV_GROUPS-Eintrag 'Stammdaten' nicht gefunden");
  const itemsBlock = groupMatch[1];

  const hrefPattern = /href:\s*"([^"]+)"/g;
  const hrefs = [...itemsBlock.matchAll(hrefPattern)].map((m) => m[1]);

  assert.equal(
    hrefs[0],
    "/stammdaten",
    `roles.ts: erstes Element der Stammdaten-Gruppe ist "${hrefs[0]}" statt "/stammdaten"`,
  );

  assert.match(
    itemsBlock,
    /\{ href: "\/stammdaten", label: "Stammdaten \(Übersicht\)", roles: \["admin", "disponent"\] \}/,
    "roles.ts: neuer Uebersichtseintrag fehlt oder weicht zeichengenau ab",
  );

  const expectedSingleRoutes = [
    "/stammdaten/kunden",
    "/stammdaten/bauabschnitte",
    "/stammdaten/vzg",
    "/stammdaten/ansprechpartner",
    "/stammdaten/monteure",
    "/stammdaten/teams",
    "/stammdaten/kabelarten",
    "/stammdaten/gewerke",
    "/stammdaten/funktionen",
    "/stammdaten/objektarten",
    "/stammdaten/qualifikationen",
    "/stammdaten/bereitschaftsnummern",
    "/stammdaten/einstellungen",
  ];

  for (const route of expectedSingleRoutes) {
    assert.ok(
      hrefs.includes(route),
      `roles.ts: Einzelroute ${route} fehlt in der Stammdaten-Gruppe`,
    );
  }

  assert.equal(
    hrefs.length,
    1 + expectedSingleRoutes.length,
    `roles.ts: Stammdaten-Gruppe hat ${hrefs.length} Eintraege statt ${1 + expectedSingleRoutes.length} (1 Uebersicht + 13 Einzelrouten)`,
  );
});
