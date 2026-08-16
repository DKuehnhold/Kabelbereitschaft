// AP15-b: URL-Mapping des Fehlalarm-Filters und der bestehenden Listenkette.
//
// Der Test prueft den rein funktionalen Bestandteil ohne React/Next/DB:
// - parseIncidentListQuery liest `fehlalarm=1|0`
// - buildIncidentListQueryString gibt denselben Wert wieder aus
// - andere vorhandene Parameter bleiben erhalten
//
// Lauf:  node --test app/test/ap15b-incident-list-url.test.mjs   (Node >= 22.18)
//
// WARUM DAS EINE EIGENE DATEI IST: die Auflösungsregeln aus `registerHooks()`
// gelten prozessweit und duerfen die uebrigen Einheitentests nicht beeinflussen
// (gleiche Begruendung wie in test/ap15-incident-metrics.test.mjs:25-28 und
// test/ap14b-session-guard.test.mjs:11-12). `node --test` fuehrt jede Testdatei
// in einem eigenen Prozess aus.
//
// `../src/lib/incident-list-url.ts` laedt intern ueber den `@/`-Alias
// `@/lib/status`, `@/lib/priority` und `@/lib/incident-list` - ohne Test-Harness
// ist dieser Alias nicht auflösbar (`ERR_MODULE_NOT_FOUND`). Anders als im
// Vorbild `ap15-incident-metrics.test.mjs` sind hier KEINE Ersatzmodule/Stubs
// noetig: `status.ts` und `priority.ts` haben keine eigenen Importe, und
// `incident-list.ts` importiert `@/lib/status`, `@/lib/priority` und
// `@/lib/database.types` ausschliesslich als `import type` (zur Laufzeit von
// Node entfernt). Es genuegt der generische `@/`-Zweig des Resolve-Hooks, der
// den Spezifizierer auf die passende Datei unter `../src/` abbildet.

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

test("fehlalarm=1 wird als true geparst und roundtripped", () => {
  const query = parseIncidentListQuery((key) =>
    ({
      q: "kabel",
      fehlalarm: "1",
      offen: "1",
      page: "2",
      size: "100",
    })[key] ?? null,
  );

  assert.equal(query.filters.q, "kabel");
  assert.equal(query.filters.falseAlarm, true);
  assert.equal(query.filters.hasOpenTask, true);
  assert.equal(query.page, 2);
  assert.equal(query.pageSize, 100);
  assert.equal(buildIncidentListQueryString(query), "q=kabel&offen=1&fehlalarm=1&page=2&size=100");
});

test("fehlalarm=0 wird als false geparst und roundtripped", () => {
  const query = parseIncidentListQuery((key) =>
    ({
      fehlalarm: "0",
      status: "neu",
      sort: "incident_no:desc",
    })[key] ?? null,
  );

  assert.equal(query.filters.falseAlarm, false);
  assert.equal(query.filters.status, "neu");
  assert.equal(buildIncidentListQueryString(query), "status=neu&fehlalarm=0&sort=incident_no%3Adesc");
});

test("fehlalarm fehlt -> kein Filter", () => {
  const query = parseIncidentListQuery(() => null);
  assert.equal(query.filters.falseAlarm, undefined);
  assert.equal(buildIncidentListQueryString(query).includes("fehlalarm="), false);
});
