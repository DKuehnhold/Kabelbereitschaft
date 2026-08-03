// AP15-1/W2: Einheitentests der statusbasierten Dashboardkennzahlen
// (src/lib/incident-metrics.ts).
//
// Lauf:  node --test app/test/ap15-incident-metrics.test.mjs   (Node >= 22.18)
// Node fuehrt die importierte .ts-Datei mit Typentfernung direkt aus. Die Datei
// laeuft ausserdem ueber den bestehenden Glob `test/*.test.mjs` aus
// package.json mit; das Skript bleibt unveraendert.
//
// OHNE DATENBANK UND OHNE NETZ. Geprueft wird die ECHTE Modulfunktion
// `getIncidentStatusMetrics()`, aber nicht ihr SQL-Ergebnis: gemessen werden die
// GEBUNDENEN PARAMETER, die FORM des Anweisungstextes, die Zahl der
// Transaktionen und Abfragen sowie die Rueckgabeform. Die fachliche Gleichheit
// zur bisherigen JS-Auswertung gehoert in den Integrationstest gegen echtes
// PostgreSQL; hier wird keine Verbindung aufgebaut und kein Wert an eine
// Datenbank uebergeben.
//
// WARUM DIE ERSATZMODULE ALS `data:`-URL VORLIEGEN und nicht als neue Datei
// unter test/stubs/: `data:`-Module laedt Node nativ. Es braucht dafuer weder
// einen `load`-Hook noch eine zusaetzliche Datei im Testbestand, und die beiden
// Ersatzmodule bleiben unmittelbar neben den Faellen sichtbar, die sie
// steuern. Der veraenderliche Zustand liegt auf `globalThis`, weil ein
// `data:`-Modul keinen gemeinsamen Dateibezug mit dieser Datei hat - so sehen
// Testdatei und Ersatzmodul dieselbe Instanz.
//
// WARUM DAS EINE EIGENE DATEI IST: die Auflösungsregeln aus `registerHooks()`
// gelten prozessweit und duerfen die uebrigen Einheitentests nicht beeinflussen
// (gleiche Begruendung wie in test/ap14b-session-guard.test.mjs:11-12).
// `node --test` fuehrt jede Testdatei in einem eigenen Prozess aus.
//
// `server-only` ist ein Bundler-Alias und in node_modules nicht auflösbar; der
// Import wird wie in test/ap14b-minio-config.test.mjs auf ein leeres Modul
// gelenkt. Die Marke bleibt in der Anwendung voll wirksam.
//
// Alle Werte sind synthetisch: eine erfundene Kennung, eine Adresse auf
// @beispiel.invalid, keine echte Person, keine Telefonnummer, keine GPS-/EXIF-
// und keine Zugangsdaten.

import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SOURCE_ROOT = new URL("../src/", import.meta.url);
const EMPTY_MODULE = new URL("./integration/empty-module.mjs", import.meta.url).href;
const METRICS_FILE = fileURLToPath(new URL("../src/lib/incident-metrics.ts", import.meta.url));

// Quelltext des Moduls als TEXT - Grundlage von A12. Gelesen wird die Datei,
// die unten auch ausgefuehrt wird.
const METRICS_SOURCE = readFileSync(METRICS_FILE, "utf8");

// Anker des veraenderlichen Zustands. Der Name ist bewusst lang und eindeutig:
// er liegt auf globalThis und darf mit nichts kollidieren.
const STUB_STATE = "__kbAp15MetricsStub";

// Ersatz fuer `@/lib/db`: protokolliert die Kennung jeder Transaktion und jede
// Abfrage samt gebundenen Werten und liefert das vorgegebene Ergebnis. Es wird
// kein Pool erzeugt und keine Verbindung aufgebaut.
const DB_STUB_SOURCE = `
export async function withUserTransaction(userId, run) {
  const state = globalThis.${STUB_STATE};
  state.transactions.push(userId);
  return run({
    query: async (text, values) => {
      state.queries.push({ text, values });
      return state.result;
    },
  });
}
`;

// Ersatz fuer `@/lib/auth`: gibt genau die vorgegebene Sitzung heraus. Die
// Sitzungsauswertung selbst ist an anderer Stelle geprueft
// (test/ap14b-session-guard.test.mjs mit dem ECHTEN src/lib/auth.ts).
const AUTH_STUB_SOURCE = `
export async function getSessionProfile() {
  return globalThis.${STUB_STATE}.session;
}
`;

const DB_STUB = `data:text/javascript,${encodeURIComponent(DB_STUB_SOURCE)}`;
const AUTH_STUB = `data:text/javascript,${encodeURIComponent(AUTH_STUB_SOURCE)}`;

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
    if (specifier === "server-only") {
      return { url: EMPTY_MODULE, shortCircuit: true };
    }
    if (specifier === "@/lib/db") {
      return { url: DB_STUB, shortCircuit: true };
    }
    // Ausdruecklich Gleichheit und kein Praefixvergleich: `@/lib/auth-paths`,
    // `@/lib/auth-password` und `@/lib/auth-service` beginnen ebenso und muessen
    // unveraendert die echten Module bleiben (gleiche Begruendung wie in
    // test/integration/module-hooks-app.mjs:80-85).
    if (specifier === "@/lib/auth") {
      return { url: AUTH_STUB, shortCircuit: true };
    }
    if (specifier.startsWith("@/")) {
      const found = resolveFile(new URL(specifier.slice(2), SOURCE_ROOT).href);
      if (found) return { url: found, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

const { TERMINAL_STATUS, INCIDENT_STATUS } = await import("../src/lib/status.ts");
const { getIncidentStatusMetrics } = await import("../src/lib/incident-metrics.ts");

// ---------------------------------------------------------------------------
// Synthetische Sitzung in der Form von SessionProfile (src/lib/auth.ts).
//
// Es gibt zu dieser Kennung keine Zeile in irgendeiner Datenbank; sie wird
// ausschliesslich als gebundener Wert der Transaktion erwartet.
// ---------------------------------------------------------------------------
const SESSION = {
  userId: "24e00000-0000-0000-0000-0000000000a1",
  sessionId: "24e00000-0000-0000-0000-0000000000f1",
  email: "a15.kennzahlen@beispiel.invalid",
  fullName: "A15 Synthetische Person",
  role: "disponent",
  mustChangePassword: false,
};

/** Die fuenf erwarteten Schluessel in sortierter Reihenfolge. */
const EXPECTED_KEYS = [
  "monteure_im_einsatz",
  "offen",
  "technisch_abgeschlossen",
  "warten_auf_db",
  "warten_auf_material",
];

/** Die drei Einzelstatus in der Reihenfolge der Parameter $2, $3 und $4. */
const SINGLE_STATUS = ["technisch_abgeschlossen", "warten_auf_db", "warten_auf_material"];

/**
 * Belegt den geteilten Zustand FRISCH.
 *
 * Ohne diese Klammer wuerde ein Fall den naechsten beeinflussen: die
 * Protokolle `transactions` und `queries` sind kumulativ, und genau ihre
 * LAENGE ist der Nachweis in A4 und A8.
 */
function resetStub({ session = SESSION, result = { rows: [] } } = {}) {
  globalThis[STUB_STATE] = { session, result, transactions: [], queries: [] };
  return globalThis[STUB_STATE];
}

/** Eine vollstaendige Ergebniszeile mit den uebergebenen Werten. */
function rowsOf(values) {
  return { rows: [values] };
}

/** Ein Aufruf mit vorgegebenem Ergebnis; liefert Kennzahlen UND Protokoll. */
async function callWith(result, session = SESSION) {
  const state = resetStub({ session, result });
  const metrics = await getIncidentStatusMetrics();
  return { metrics, state };
}

/** Gebundene Werte der EINEN erwarteten Abfrage. */
async function boundValues() {
  const { state } = await callWith(rowsOf({}));
  assert.equal(state.queries.length, 1, "es wurde nicht genau eine Abfrage ausgefuehrt");
  return state.queries[0].values;
}

/** Anweisungstext der EINEN erwarteten Abfrage. */
async function statementText() {
  const { state } = await callWith(rowsOf({}));
  assert.equal(state.queries.length, 1, "es wurde nicht genau eine Abfrage ausgefuehrt");
  return state.queries[0].text;
}

// ===========================================================================
// A) Gebundene Parameter
// ===========================================================================

test("A1 der erste Parameter ist wertgleich zur zentralen Terminalstatusliste", async () => {
  const values = await boundValues();
  assert.deepEqual(
    values[0],
    [...TERMINAL_STATUS],
    "A1: $1 ist nicht wertgleich zu TERMINAL_STATUS",
  );
  assert.equal(
    values[0].length,
    TERMINAL_STATUS.length,
    `A1: $1 hat ${values[0].length} statt ${TERMINAL_STATUS.length} Elemente`,
  );
});

test("A2 die zentrale Terminalstatusliste wird kopiert und nicht durchgereicht", async () => {
  // Wuerde das Modul die exportierte Liste selbst binden, koennte ein Aufrufer
  // (oder ein Treiber) sie veraendern und damit die Statusgruppen der GESAMTEN
  // Anwendung verschieben. Der Nachweis ist die Objektidentitaet, nicht der Wert.
  const values = await boundValues();
  assert.notStrictEqual(
    values[0],
    TERMINAL_STATUS,
    "A2: $1 ist dasselbe Objekt wie TERMINAL_STATUS",
  );
});

test("A3 die drei Einzelstatus sind genau die erwarteten Codes des Enums", async () => {
  const values = await boundValues();
  assert.deepEqual(values.slice(1, 4), SINGLE_STATUS, "A3: $2..$4 tragen andere Codes");
  for (const code of SINGLE_STATUS) {
    assert.equal(
      INCIDENT_STATUS.includes(code),
      true,
      `A3: '${code}' ist kein Element von INCIDENT_STATUS`,
    );
  }
});

// ===========================================================================
// B) Eine Transaktion, eine Anweisung
// ===========================================================================

test("A4 je Aufruf genau eine Transaktion, genau eine Abfrage und die Sitzungskennung", async () => {
  const { state } = await callWith(rowsOf({}));
  assert.equal(state.transactions.length, 1, "A4: nicht genau eine Transaktion");
  assert.equal(state.queries.length, 1, "A4: nicht genau eine Abfrage");
  assert.equal(
    state.transactions[0],
    SESSION.userId,
    "A4: die Transaktion laeuft nicht unter der Kennung der Sitzung",
  );

  // Zweiter Aufruf OHNE Zuruecksetzen: je Aufruf kommt genau eine Transaktion
  // und genau eine Abfrage hinzu - es sammelt sich nichts an und es werden
  // nicht mehrere Anweisungen je Aufruf abgesetzt.
  await getIncidentStatusMetrics();
  assert.equal(state.transactions.length, 2, "A4: nicht genau eine Transaktion je Aufruf");
  assert.equal(state.queries.length, 2, "A4: nicht genau eine Abfrage je Aufruf");
  assert.equal(state.transactions[1], SESSION.userId, "A4: zweite Kennung abweichend");
});

test("A5 der Anweisungstext liest ausschliesslich public.incident_list_view", async () => {
  // Programmatisch und nicht als Teilstringsuche: JEDES Vorkommen von `public.`
  // muss zur Erlaubnismenge gehoeren. Eine zusaetzliche Tabelle - etwa
  // public.incidents oder public.incident_assignments - waere eine zweite
  // Sichtbarkeitsquelle neben der View und wuerde hier auffallen.
  const sql = await statementText();
  const allowed = new Set(["public.incident_list_view", "public.incident_status"]);
  const found = sql.match(/public\.[a-z_]+/g) ?? [];
  assert.ok(found.length > 0, "A5: der Anweisungstext nennt kein einziges public.-Objekt");
  for (const name of found) {
    assert.equal(allowed.has(name), true, `A5: unerwartetes Objekt ${name} im Anweisungstext`);
  }
  // Gegenprobe: die View kommt tatsaechlich vor - sonst waere die Schleife
  // stillschweigend erfuellt.
  assert.ok(
    found.includes("public.incident_list_view"),
    "A5: public.incident_list_view fehlt im Anweisungstext",
  );
});

test("A6 der Anweisungstext ist EINE Anweisung ohne Semikolon", async () => {
  const sql = await statementText();
  assert.equal(sql.includes(";"), false, "A6: der Anweisungstext enthaelt ein Semikolon");
});

// ===========================================================================
// C) Rueckgabeform und Rueckfallwerte
// ===========================================================================

test("A7 die Rueckgabe traegt genau die fuenf erwarteten Zahlenfelder", async () => {
  const { metrics } = await callWith(
    rowsOf({
      offen: 1,
      technisch_abgeschlossen: 1,
      warten_auf_db: 1,
      warten_auf_material: 1,
      monteure_im_einsatz: 1,
    }),
  );
  assert.deepEqual(Object.keys(metrics).sort(), EXPECTED_KEYS, "A7: abweichende Feldmenge");
  for (const key of EXPECTED_KEYS) {
    assert.equal(typeof metrics[key], "number", `A7: ${key} ist keine Zahl`);
  }
});

test("A8 ohne Sitzung sind alle Werte 0 und es wird kein SQL ausgefuehrt", async () => {
  // Fail-closed und ohne Ausnahme: ohne Identitaet liefert die RLS keine Zeile,
  // die Kacheln zeigten bisher 0 - und es darf gar erst keine Transaktion
  // geoeffnet werden.
  const { metrics, state } = await callWith(
    rowsOf({
      offen: 9,
      technisch_abgeschlossen: 9,
      warten_auf_db: 9,
      warten_auf_material: 9,
      monteure_im_einsatz: 9,
    }),
    null,
  );
  for (const key of EXPECTED_KEYS) {
    assert.equal(metrics[key], 0, `A8: ${key} ist nicht 0`);
  }
  assert.equal(state.transactions.length, 0, "A8: es wurde eine Transaktion geoeffnet");
  assert.equal(state.queries.length, 0, "A8: es wurde eine Abfrage ausgefuehrt");
});

test("A9 ein leeres Ergebnis ergibt alle fuenf Werte 0", async () => {
  const { metrics } = await callWith({ rows: [] });
  for (const key of EXPECTED_KEYS) {
    assert.equal(metrics[key], 0, `A9: ${key} ist nicht 0`);
  }
});

test("A10 fehlende und NULL-Spaltenwerte ergeben 0 statt null", async () => {
  // `count(...)` liefert in PostgreSQL nie NULL; der Rueckfall schuetzt die
  // Kacheln davor, `null` anzuzeigen, falls die Projektion je umgebaut wird.
  const { metrics } = await callWith(
    rowsOf({
      offen: null,
      technisch_abgeschlossen: undefined,
      warten_auf_db: null,
      // warten_auf_material fehlt in der Zeile vollstaendig
      monteure_im_einsatz: null,
    }),
  );
  for (const key of EXPECTED_KEYS) {
    assert.equal(metrics[key], 0, `A10: ${key} ist nicht 0`);
    assert.equal(typeof metrics[key], "number", `A10: ${key} ist keine Zahl`);
  }
});

test("A11 durchgereichte Werte werden unveraendert uebernommen", async () => {
  // Fuenf VERSCHIEDENE Zahlen: eine Verwechslung zweier Spalten im Mapper
  // waere mit gleichen Werten nicht messbar.
  const row = {
    offen: 7,
    technisch_abgeschlossen: 3,
    warten_auf_db: 2,
    warten_auf_material: 5,
    monteure_im_einsatz: 4,
  };
  const { metrics } = await callWith(rowsOf(row));
  assert.deepEqual(metrics, row, "A11: die Werte kommen nicht zeichengleich zurueck");
});

// ===========================================================================
// D) Keine zweite Statusliste, keine Statuswerte im Anweisungstext
// ===========================================================================

test("A12 im Modul steht keine zweite Terminalstatusliste", async () => {
  // Die drei Terminalstatus duerfen AUSSCHLIESSLICH aus @/lib/status stammen.
  // Steht einer von ihnen als eigener Wert im Modul, gibt es zwei Listen, und
  // eine spaetere Erweiterung in @/lib/status wirkt hier nicht mehr - die
  // Kachel "offen" wuerde dann still falsch zaehlen.
  assert.equal(
    METRICS_SOURCE.includes("storniert"),
    false,
    "A12: 'storniert' steht im Modulquelltext",
  );
  assert.equal(
    METRICS_SOURCE.includes("fehlalarm"),
    false,
    "A12: 'fehlalarm' steht im Modulquelltext",
  );

  // 'abgeschlossen' darf nur als Bestandteil von 'technisch_abgeschlossen'
  // vorkommen - das ist ein Einzelstatus ($2) und kein Terminalstatus.
  const prefix = "technisch_";
  let index = METRICS_SOURCE.indexOf("abgeschlossen");
  assert.ok(index >= 0, "A12: 'abgeschlossen' kommt im Modulquelltext gar nicht vor");
  while (index >= 0) {
    assert.equal(
      METRICS_SOURCE.slice(Math.max(0, index - prefix.length), index),
      prefix,
      `A12: 'abgeschlossen' an Position ${index} ist nicht Teil von 'technisch_abgeschlossen'`,
    );
    index = METRICS_SOURCE.indexOf("abgeschlossen", index + 1);
  }
});

test("A13 im Anweisungstext steht kein Statuswert - alle vier sind gebunden", async () => {
  const sql = await statementText();

  // Kein Apostroph im Anweisungstext: damit gibt es dort ueberhaupt keine
  // SQL-Zeichenkette, in der ein Statuscode stehen koennte. Diese Pruefung ist
  // die tragende - eine blosse Teilstringsuche waere hier FALSCH, weil die
  // Spaltenaliase der Projektion (`as technisch_abgeschlossen`,
  // `as warten_auf_db`, `as warten_auf_material`) dieselben Zeichenfolgen
  // enthalten muessen: sie sind die Feldnamen der Rueckgabe.
  assert.equal(
    sql.includes("'"),
    false,
    "A13: der Anweisungstext enthaelt eine SQL-Zeichenkette",
  );

  // Zusaetzlich ausdruecklich: keiner der sechs Statuscodes kommt in Anfuehrung
  // vor - weder die drei Terminalstatus noch die drei Einzelstatus.
  for (const code of [...TERMINAL_STATUS, ...SINGLE_STATUS]) {
    assert.equal(
      sql.includes(`'${code}'`),
      false,
      `A13: '${code}' steht als Literal im Anweisungstext`,
    );
  }

  // Gegenprobe: alle vier Werte werden tatsaechlich als Parameter gebunden.
  for (const placeholder of ["$1", "$2", "$3", "$4"]) {
    assert.ok(sql.includes(placeholder), `A13: ${placeholder} fehlt im Anweisungstext`);
  }
  assert.equal((await boundValues()).length, 4, "A13: es werden nicht genau vier Werte gebunden");
});
