// AP14/B: Auflösungsregeln, damit die echten Anwendungsmodule ohne Next.js
// geladen werden können.
//
// Zweck: die Integrationstests sollen NICHT eine Nachbildung des
// Datenbank-Wrappers prüfen, sondern `src/lib/db` und `src/lib/auth-service`
// selbst. Außerhalb von Next fehlen dafür zwei Dinge:
//
//   1. `server-only` ist ein Bundler-Alias und in `node_modules` nicht
//      auflösbar. Der Import wird auf ein leeres Modul gelenkt. Die Marke
//      bleibt damit in der Anwendung wirksam (Next bricht bei einem Import aus
//      einer Client-Komponente weiterhin ab) und blockiert nur den Test nicht.
//   2. Die Pfadkürzel `@/...` aus `tsconfig.json` und dateiendungslose
//      relative Importe kennt Node nicht.
//
// Node führt die TypeScript-Dateien selbst mit Typentfernung aus (>= 22.18);
// es wird nichts vorher übersetzt und keine zweite Fassung des Codes erzeugt.

import { statSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";

const SOURCE_ROOT = new URL("../../src/", import.meta.url);
const EMPTY_MODULE = new URL("./empty-module.mjs", import.meta.url).href;

function isFile(url) {
  try {
    return statSync(fileURLToPath(url)).isFile();
  } catch {
    return false;
  }
}

/** Erste vorhandene Datei zu einem Grundpfad (TypeScript, sonst Verzeichnis). */
function resolveFile(base) {
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
    if (isFile(candidate)) return candidate;
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { url: EMPTY_MODULE, shortCircuit: true };
    }
    if (specifier.startsWith("@/")) {
      const found = resolveFile(new URL(specifier.slice(2), SOURCE_ROOT).href);
      if (found) return { url: found, shortCircuit: true };
    }
    if (specifier.startsWith(".") && context.parentURL) {
      const base = new URL(specifier, context.parentURL).href;
      const found = resolveFile(base);
      if (found && found !== base) return { url: found, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
