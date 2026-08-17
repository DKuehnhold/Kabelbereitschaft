// AUFTRAG_8: URL-Mapping des "In Klaerung"-Filters, exaktes Muster von
// ap15b-incident-list-url.test.mjs (dort: Fehlalarm-Filter).
//
// Der Test prueft den rein funktionalen Bestandteil ohne React/Next/DB:
// - parseIncidentListQuery liest `klaerung=1|0`
// - buildIncidentListQueryString gibt denselben Wert wieder aus
// - andere vorhandene Parameter (inkl. `fehlalarm`) bleiben erhalten
//
// Lauf:  node --test app/test/auftrag8-klaerung-list-url.test.mjs   (Node >= 22.18)
//
// WARUM DAS EINE EIGENE DATEI IST: die Auflösungsregeln aus `registerHooks()`
// gelten prozessweit und duerfen die uebrigen Einheitentests nicht beeinflussen
// (gleiche Begruendung wie in test/ap15b-incident-list-url.test.mjs:10-14 und
// test/ap14b-session-guard.test.mjs:11-12). `node --test` fuehrt jede Testdatei
// in einem eigenen Prozess aus.
//
// `../src/lib/incident-list-url.ts` laedt intern ueber den `@/`-Alias
// `@/lib/status`, `@/lib/priority` und `@/lib/incident-list` - ohne Test-Harness
// ist dieser Alias nicht auflösbar (`ERR_MODULE_NOT_FOUND`). Wie im Vorbild
// sind KEINE Ersatzmodule/Stubs noetig: `status.ts` und `priority.ts` haben
// keine eigenen Importe, und `incident-list.ts` importiert `@/lib/status`,
// `@/lib/priority` und `@/lib/database.types` ausschliesslich als `import
// type` (zur Laufzeit von Node entfernt). Es genuegt der generische
// `@/`-Zweig des Resolve-Hooks, der den Spezifizierer auf die passende Datei
// unter `../src/` abbildet.

import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SOURCE_ROOT = new URL("../src/", import.meta.url);

/** Erste vorhandene Datei zu einem Grundpfad (TypeScript, sonst Verzeichnis). */
function resolveFile(base) {
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
    try {
      if (statSync(fileURLToPath(candidate)).isFile()) return candidate;
    } catch {
      // naechster Kandidat
    }
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const found = resolveFile(new URL(specifier.slice(2), SOURCE_ROOT).href);
      if (found) return { url: found, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

const { buildIncidentListQueryString, parseIncidentListQuery } = await import(
  "../src/lib/incident-list-url.ts"
);

test("klaerung=1 wird als true geparst und roundtripped", () => {
  const query = parseIncidentListQuery((key) =>
    ({
      q: "kabel",
      klaerung: "1",
      offen: "1",
      page: "2",
      size: "100",
    })[key] ?? null,
  );

  assert.equal(query.filters.q, "kabel");
  assert.equal(query.filters.inClarification, true);
  assert.equal(query.filters.hasOpenTask, true);
  assert.equal(query.page, 2);
  assert.equal(query.pageSize, 100);
  assert.equal(buildIncidentListQueryString(query), "q=kabel&offen=1&klaerung=1&page=2&size=100");
});

test("klaerung=0 wird als false geparst und roundtripped", () => {
  const query = parseIncidentListQuery((key) =>
    ({
      klaerung: "0",
      status: "neu",
      sort: "incident_no:desc",
    })[key] ?? null,
  );

  assert.equal(query.filters.inClarification, false);
  assert.equal(query.filters.status, "neu");
  assert.equal(buildIncidentListQueryString(query), "status=neu&klaerung=0&sort=incident_no%3Adesc");
});

test("klaerung fehlt -> kein Filter", () => {
  const query = parseIncidentListQuery(() => null);
  assert.equal(query.filters.inClarification, undefined);
  assert.equal(buildIncidentListQueryString(query).includes("klaerung="), false);
});

test("klaerung und fehlalarm sind unabhaengige Filter (beide gleichzeitig gesetzt)", () => {
  const query = parseIncidentListQuery((key) =>
    ({
      klaerung: "1",
      fehlalarm: "0",
    })[key] ?? null,
  );

  assert.equal(query.filters.inClarification, true);
  assert.equal(query.filters.falseAlarm, false);
  assert.equal(buildIncidentListQueryString(query), "fehlalarm=0&klaerung=1");
});
