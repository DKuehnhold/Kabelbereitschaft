// AP14/B: Auflösungsregeln für die Integrationstests der FACHMODULE ohne
// Next.js: Stammdaten und Inventar, Bildpfad, Dashboardkennzahlen.
//
// Warum es diese ZWEITE Hooks-Datei gibt: `module-hooks.mjs` bleibt
// unverändert. Die dort geprüften Module (`src/lib/db`,
// `src/lib/auth-service`) brauchen genau zwei Umleitungen; die Fachmodule
// brauchen zwei weitere. Würden sie in `module-hooks.mjs` ergänzt, sähen die
// bestehenden Integrationstests eine andere Auflösung als bisher - insbesondere
// eine ERSETZTE Sitzungsauswertung. Genau das darf dort nicht passieren.
// Der Linux-CI-Runner run_db_tests.sh lädt sie deshalb per `--import` nur für
// ap14b-masterdata-inventory, ap14b-images und ap15-dashboard-metrics.
//
// Regeln 1 und 2 sind wörtlich die aus `module-hooks.mjs`:
//
//   1. `server-only` ist ein Bundler-Alias und in `node_modules` nicht
//      auflösbar. Der Import wird auf ein leeres Modul gelenkt. Die Marke
//      bleibt damit in der Anwendung wirksam (Next bricht bei einem Import aus
//      einer Client-Komponente weiterhin ab) und blockiert nur den Test nicht.
//   2. Die Pfadkürzel `@/...` aus `tsconfig.json` und dateiendungslose
//      relative Importe kennt Node nicht.
//
// Zusätzlich, und nur hier:
//
//   3. `next/cache` (`revalidatePath`) existiert außerhalb einer Next-Laufzeit
//      nicht. Der Ersatz protokolliert die Aufrufe, statt sie auszuführen; der
//      Test kann dadurch prüfen, DASS revalidiert wurde.
//   4. `@/lib/auth` zieht über `@/auth` die vollständige Auth.js-Instanz und den
//      Next-Request-Kontext nach sich, die außerhalb von Next nicht existieren.
//      Die Sitzungsauswertung selbst ist bereits abgedeckt durch
//      `app/test/ap14b-auth.test.mjs`, `app/test/ap14b-session-guard.test.mjs`
//      und `app/test/integration/ap14b-platform.int.mjs` - dort läuft der ECHTE
//      `src/lib/auth.ts` bzw. `validateSession()` gegen die echte Datenbank.
//      Hier wird ausschließlich die IDENTITÄT eingespeist, damit die Fachmodule
//      mit einer definierten Rolle gegen echtes PostgreSQL laufen. Der Ersatz
//      behandelt `mustChangePassword = true` genau wie der Produktionscode
//      (dann liefert `getSessionProfile()` NULL), damit der fail-closed Pfad
//      auch im Test nachweisbar bleibt.
//   5. `next/navigation` (`redirect`) existiert ebenfalls nur innerhalb einer
//      Next-Laufzeit. Der Ersatz ist der bereits vorhandene
//      `app/test/stubs/next-navigation.mjs` (bisher nur von den
//      Einheitentests der Sitzungssperre genutzt). Grund für die Regel: die
//      AP15B-Suite (ap15b-incident-list.int.mjs) prüft `setFalseAlarm()` aus
//      `src/lib/incident-actions.ts` jetzt als ECHTE Server-Action, und diese
//      Datei importiert `redirect` aus `next/navigation` (für die anderen
//      Aktionen `createIncident`/`updateIncident`) - ohne Umleitung schlüge
//      schon der Modulimport mit ERR_MODULE_NOT_FOUND fehl. Für die übrigen
//      drei Suiten (ap14b-masterdata-inventory, ap14b-images,
//      ap15-dashboard-metrics) bleibt die Regel wirkungslos: keine von ihnen
//      importiert ein Modul, das `next/navigation` nachzieht.
//
// Geprüft werden die Fachmodule selbst: die jeweilige Suite importiert den
// echten Anwendungscode, über den auch die echte DB-Schicht `src/lib/db`
// läuft. Eingespeist werden nur Next-Kontext und Sitzungsidentität über die
// oben beschriebenen Stubs; Anwendungs-SQL wird im Test nicht nachgebaut.
//
// Node führt die TypeScript-Dateien selbst mit Typentfernung aus (>= 22.18);
// es wird nichts vorher übersetzt und keine zweite Fassung des Codes erzeugt.

import { statSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";

const SOURCE_ROOT = new URL("../../src/", import.meta.url);
const EMPTY_MODULE = new URL("./empty-module.mjs", import.meta.url).href;
const NEXT_CACHE_STUB = new URL("./stubs/next-cache.mjs", import.meta.url).href;
const SESSION_STUB = new URL("./stubs/session.mjs", import.meta.url).href;
const NEXT_NAVIGATION_STUB = new URL("../stubs/next-navigation.mjs", import.meta.url).href;

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
    if (specifier === "next/cache") {
      return { url: NEXT_CACHE_STUB, shortCircuit: true };
    }
    if (specifier === "next/navigation") {
      return { url: NEXT_NAVIGATION_STUB, shortCircuit: true };
    }
    // Ausdrücklich Gleichheit und kein Präfixvergleich: `@/lib/auth-paths`,
    // `@/lib/auth-password` und `@/lib/auth-service` beginnen ebenso und müssen
    // unverändert die echten Module bleiben.
    if (specifier === "@/lib/auth") {
      return { url: SESSION_STUB, shortCircuit: true };
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
