// AP14/B: Einheitentests der Pflichtkonfiguration des Objektspeichers
// (src/lib/minio-config.ts).
//
// Lauf:  node --test app/test/ap14b-minio-config.test.mjs   (Node >= 22.18)
// Node fuehrt die importierte .ts-Datei mit Typentfernung direkt aus. Die Datei
// laeuft ausserdem ueber den bestehenden Glob `test/*.test.mjs` aus
// package.json mit; das Skript bleibt unveraendert.
//
// OHNE DATENBANK UND OHNE NETZ. Geprueft wird ausschliesslich die Auswertung von
// process.env: welche Namen als fehlend gelten, welche Vorgabewerte greifen und
// dass in einer Fehlermeldung niemals ein WERT erscheint. Es wird keine
// Verbindung aufgebaut; die verwendeten Werte sind erkennbar synthetisch und
// zeigen auf keine Umgebung.
//
// WARUM HIER registerHooks() STEHT: minio-config.ts beginnt mit
// `import "server-only"`. `server-only` ist ein Bundler-Alias und in
// node_modules nicht auflösbar (gleiche Feststellung wie in
// test/integration/module-hooks.mjs). Die bestehenden Einheitentests laufen ohne
// Auflösungsregeln und konnten deshalb nur Module ohne diese Marke laden -
// platform-config.ts traegt sie bewusst nicht, minio-config.ts dagegen sehr wohl
// (es gibt die Zugangsdaten selbst heraus). Die Umleitung auf ein leeres Modul
// steht deshalb HIER, in dieser Testdatei, und nicht in einer der
// Hooks-Dateien der Integrationstests: die bleiben unveraendert, und die
// Auflösung wirkt nur in diesem einen Testprozess (node --test fuehrt jede
// Testdatei in einem eigenen Prozess aus).
//
// Die Marke bleibt in der Anwendung dadurch voll wirksam: ein Import aus einer
// Client-Komponente bricht den Next-Build weiterhin ab.

import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

const EMPTY_MODULE = new URL("./integration/empty-module.mjs", import.meta.url).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { url: EMPTY_MODULE, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

const {
  MINIO_REQUIRED_ENV_KEYS,
  assertMinioConfigured,
  isMinioConfigured,
  missingMinioConfigKeys,
  readMinioConfig,
} = await import("../src/lib/minio-config.ts");

// ---------------------------------------------------------------------------
// Unveraenderter Meldungstext des Anwendungscodes.
//
// Er steht bewusst als Konstante hier: aendert sich der Text im Produktionscode,
// scheitert dieser Test und die Aenderung wird sichtbar.
// ---------------------------------------------------------------------------
const MESSAGE_SUFFIX =
  " Werte in der Environment-Datei der Umgebung setzen " +
  "(Vorlage: deploy/env/app.env.example).";

const missingMessage = (...names) =>
  `Konfiguration fehlt: ${names.join(", ")}.${MESSAGE_SUFFIX}`;

/**
 * EIN Meldungstext fuer jeden Ablehnungsgrund einer Basis-URL.
 *
 * Der Text unterscheidet bewusst NICHT, welcher Bestandteil des Werts falsch
 * war - sonst liesse er auf den Wert zurueckschliessen.
 */
const invalidBaseMessage = (name) =>
  `Konfiguration ungueltig: ${name} muss eine absolute http(s)-URL ohne ` +
  "Benutzerinfo, Query und Fragment sein.";

const SAME_ORIGIN_MESSAGE =
  "Konfiguration ungueltig: S3_ENDPOINT und S3_PUBLIC_BASE_URL duerfen ausserhalb " +
  "von Loopback nicht denselben Origin haben.";

const AUTH_ORIGIN_MESSAGE =
  "Konfiguration ungueltig: S3_PUBLIC_BASE_URL und AUTH_URL muessen denselben " +
  "Origin haben.";

// ---------------------------------------------------------------------------
// Synthetische, gueltige Werte. Keiner von ihnen loest die
// Platzhaltererkennung aus, und keiner zeigt auf eine echte Umgebung.
//
// S3_PUBLIC_BASE_URL ist Pflicht und traegt hier bewusst einen ANDEREN Port als
// S3_ENDPOINT: die oeffentliche Signierbasis ist nicht der interne Endpunkt.
// Beide Hostnamen sind Loopback, es wird also nichts erreichbar gemacht.
// ---------------------------------------------------------------------------
const VALID = {
  S3_ENDPOINT: "http://127.0.0.1:9",
  S3_PUBLIC_BASE_URL: "http://127.0.0.1:10",
  S3_BUCKET: "kb-ap14b-objekte",
  S3_ACCESS_KEY_ID: "AP14BSYNTHETISCHKEY0",
  S3_SECRET_ACCESS_KEY: "ap14b-synthetischer-testschluessel-0000",
};

/**
 * Alle Namen, die dieses Modul auswertet - Pflicht und optional.
 *
 * AUTH_URL steht hier, obwohl sie NICHT zu den Pflichtnamen des Objektspeichers
 * gehoert: readMinioConfig() vergleicht ihren Origin mit dem der oeffentlichen
 * Signierbasis. Ohne die Klammer wuerde ein in der Laufumgebung gesetzter Wert
 * das Ergebnis verfaelschen.
 */
const ALL_KEYS = [
  ...MINIO_REQUIRED_ENV_KEYS,
  "S3_REGION",
  "S3_FORCE_PATH_STYLE",
  "AUTH_URL",
];

/**
 * Gegenprobe zu jedem Ablehnungsfall: in der Meldung steht KEIN gesetzter WERT.
 *
 * Leere Werte werden uebersprungen - sie waeren in jeder Zeichenkette enthalten.
 */
function assertNoValuesInMessage(error, values) {
  assert.ok(error instanceof Error);
  for (const [name, value] of Object.entries(values)) {
    if (value === undefined || value === "") continue;
    assert.equal(
      error.message.includes(value),
      false,
      `der Wert von ${name} steht in der Meldung`,
    );
  }
}

/**
 * Fuehrt `run` mit GENAU den uebergebenen Laufzeitvariablen aus.
 *
 * Alle von diesem Modul ausgewerteten Namen werden vorher entfernt und danach
 * exakt auf ihren vorherigen Stand zurueckgesetzt - auch im Fehlerfall. Ohne
 * diese Klammer wuerde ein Fall den naechsten beeinflussen, und ein in der
 * Umgebung des Testlaufs vorhandener Wert wuerde das Ergebnis verfaelschen.
 */
function withEnv(values, run) {
  const snapshot = new Map(ALL_KEYS.map((name) => [name, process.env[name]]));
  try {
    for (const name of ALL_KEYS) delete process.env[name];
    for (const [name, value] of Object.entries(values)) {
      if (value !== undefined) process.env[name] = value;
    }
    return run();
  } finally {
    for (const name of ALL_KEYS) {
      const previous = snapshot.get(name);
      if (previous === undefined) delete process.env[name];
      else process.env[name] = previous;
    }
  }
}

/**
 * Werte, die als Platzhalter gelten muessen.
 *
 * Deckt jede Regel aus minio-config.ts ab: die Teilzeichenfolgen PLATZHALTER,
 * CHANGE_ME, CHANGEME, BEISPIEL und EXAMPLE.INVALID, die Klammerzeichen "<" und
 * ">" sowie die vollstaendigen Werte BENUTZER und PASSWORT. Die
 * Gross-/Kleinschreibung ist dabei ohne Bedeutung.
 */
const PLACEHOLDERS = [
  "ANON_KEY_PLATZHALTER",
  "platzhalter",
  "CHANGE_ME",
  "CHANGEME",
  "s3.example.invalid",
  "http://objektspeicher.beispiel.invalid",
  "<hier eintragen>",
  "<",
  ">",
  "BENUTZER",
  "PASSWORT",
  "benutzer",
  "passwort",
];

// ===========================================================================
// A) Vollstaendige Konfiguration
// ===========================================================================

test("MC1 alle Pflichtvariablen gueltig: konfiguriert, nichts fehlt, kein Abbruch", () => {
  withEnv(VALID, () => {
    assert.deepEqual(missingMinioConfigKeys(), []);
    assert.equal(isMinioConfigured(), true);
    assert.doesNotThrow(() => assertMinioConfigured());
  });
});

test("MC2 die Pflichtnamen sind genau die fuenf des Objektspeichers", () => {
  // S3_PUBLIC_BASE_URL steht an zweiter Stelle und ist PFLICHT: es gibt keinen
  // Rueckfall auf S3_ENDPOINT mehr.
  assert.deepEqual(
    [...MINIO_REQUIRED_ENV_KEYS],
    [
      "S3_ENDPOINT",
      "S3_PUBLIC_BASE_URL",
      "S3_BUCKET",
      "S3_ACCESS_KEY_ID",
      "S3_SECRET_ACCESS_KEY",
    ],
  );
});

// ===========================================================================
// B) Fehlende, leere und mit Platzhaltern belegte Werte
// ===========================================================================

test("MC3 je eine fehlende Pflichtvariable wird gemeldet und bricht mit ihrem NAMEN ab", () => {
  for (const name of MINIO_REQUIRED_ENV_KEYS) {
    const values = { ...VALID };
    delete values[name];
    withEnv(values, () => {
      assert.deepEqual(missingMinioConfigKeys(), [name], name);
      assert.equal(isMinioConfigured(), false, name);
      assert.throws(() => assertMinioConfigured(), { message: missingMessage(name) }, name);
      // readMinioConfig() bricht am selben Waechter ab und liefert nichts.
      assert.throws(() => readMinioConfig(), { message: missingMessage(name) }, name);
    });
  }
});

test("MC4 fehlen alle Pflichtvariablen, werden alle Namen in Deklarationsreihenfolge gemeldet", () => {
  withEnv({}, () => {
    assert.deepEqual(missingMinioConfigKeys(), [...MINIO_REQUIRED_ENV_KEYS]);
    assert.equal(isMinioConfigured(), false);
    assert.throws(
      () => assertMinioConfigured(),
      { message: missingMessage(...MINIO_REQUIRED_ENV_KEYS) },
    );
  });
});

test("MC5 ein leerer und ein reiner Leerraum-Wert gelten als fehlend", () => {
  for (const name of MINIO_REQUIRED_ENV_KEYS) {
    for (const blank of ["", " ", "   ", "\t", "\n", " \t\n "]) {
      withEnv({ ...VALID, [name]: blank }, () => {
        assert.deepEqual(missingMinioConfigKeys(), [name], `${name}=${JSON.stringify(blank)}`);
        assert.equal(isMinioConfigured(), false);
        assert.throws(() => assertMinioConfigured(), { message: missingMessage(name) });
      });
    }
  }
});

test("MC6 Platzhalterwerte gelten als fehlend - fail-closed", () => {
  for (const name of MINIO_REQUIRED_ENV_KEYS) {
    for (const placeholder of PLACEHOLDERS) {
      withEnv({ ...VALID, [name]: placeholder }, () => {
        assert.deepEqual(missingMinioConfigKeys(), [name], `${name}=${placeholder}`);
        assert.equal(isMinioConfigured(), false, `${name}=${placeholder}`);
        assert.throws(
          () => assertMinioConfigured(),
          { message: missingMessage(name) },
          `${name}=${placeholder}`,
        );
      });
    }
  }
});

test("MC7 ein Wert, der 'benutzer' nur ENTHAELT, bleibt gueltig", () => {
  // Gegenprobe zur Platzhalterregel: BENUTZER und PASSWORT gelten nur als
  // VOLLSTAENDIGER Wert. Als Teilzeichenfolge waere die Regel zu scharf - ein
  // echter Bucketname darf "benutzer" enthalten (PLACEHOLDER_VALUES in
  // minio-config.ts).
  withEnv({ ...VALID, S3_BUCKET: "kb-benutzerdaten" }, () => {
    assert.deepEqual(missingMinioConfigKeys(), []);
    assert.equal(isMinioConfigured(), true);
    assert.equal(readMinioConfig().bucket, "kb-benutzerdaten");
  });
});

// ===========================================================================
// C) Keine Werte in Meldungen
// ===========================================================================

test("MC8 in der Fehlermeldung erscheint kein einziger WERT", () => {
  // Eigener, ausdruecklicher Fall: der Abbruch wird durch eine ANDERE fehlende
  // Variable ausgeloest, waehrend ein erkennbarer Geheimniswert gesetzt ist. Er
  // darf in der Meldung nicht vorkommen - und ebenso wenig Endpunkt, Bucket oder
  // Zugriffsschluessel.
  const SECRET = "i23-geheimniswert-darf-nicht-in-meldungen-erscheinen";
  const values = { ...VALID, S3_SECRET_ACCESS_KEY: SECRET };
  delete values.S3_BUCKET;

  withEnv(values, () => {
    assert.throws(
      () => assertMinioConfigured(),
      (error) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, missingMessage("S3_BUCKET"));
        assert.equal(error.message.includes(SECRET), false, "das Geheimnis steht in der Meldung");
        assert.equal(error.message.includes(VALID.S3_ENDPOINT), false);
        assert.equal(error.message.includes(VALID.S3_ACCESS_KEY_ID), false);
        // Der fehlende NAME steht darin - genau er soll es auch.
        assert.ok(error.message.includes("S3_BUCKET"));
        return true;
      },
    );
  });
});

// ===========================================================================
// D) Vorgabewerte der optionalen Variablen
// ===========================================================================

test("MC9 fehlendes S3_REGION ergibt us-east-1, ein gesetzter Wert gilt unveraendert", () => {
  withEnv(VALID, () => {
    assert.equal(readMinioConfig().region, "us-east-1");
  });
  withEnv({ ...VALID, S3_REGION: "eu-central-1" }, () => {
    assert.equal(readMinioConfig().region, "eu-central-1");
  });
  // Ein leerer bzw. als Platzhalter erkennbarer Wert faellt auf die Vorgabe
  // zurueck; die Region ist keine Pflichtvariable.
  withEnv({ ...VALID, S3_REGION: "   " }, () => {
    assert.equal(readMinioConfig().region, "us-east-1");
  });
});

test("MC10 S3_FORCE_PATH_STYLE ist standardmaessig true und nur ein ausdrueckliches false schaltet ab", () => {
  withEnv(VALID, () => {
    assert.equal(readMinioConfig().forcePathStyle, true);
  });
  for (const value of ["false", "FALSE", " False "]) {
    withEnv({ ...VALID, S3_FORCE_PATH_STYLE: value }, () => {
      assert.equal(readMinioConfig().forcePathStyle, false, value);
    });
  }
  for (const value of ["true", "TRUE", "", "1", "0", "nein"]) {
    withEnv({ ...VALID, S3_FORCE_PATH_STYLE: value }, () => {
      assert.equal(readMinioConfig().forcePathStyle, true, value);
    });
  }
});

test("MC11 S3_PUBLIC_BASE_URL hat KEINEN Rueckfall auf S3_ENDPOINT - fail-closed", () => {
  // Frueher galt hier S3_ENDPOINT als Ersatz. Damit geriet der interne Endpunkt
  // in jede signierte URL und in den Browser. Jetzt bricht der Zugriff ab.
  const values = { ...VALID };
  delete values.S3_PUBLIC_BASE_URL;
  withEnv(values, () => {
    assert.deepEqual(missingMinioConfigKeys(), ["S3_PUBLIC_BASE_URL"]);
    assert.equal(isMinioConfigured(), false);
    assert.throws(
      () => assertMinioConfigured(),
      { message: missingMessage("S3_PUBLIC_BASE_URL") },
    );
    assert.throws(
      () => readMinioConfig(),
      { message: missingMessage("S3_PUBLIC_BASE_URL") },
    );
  });

  // Leerer Wert und Platzhalter gelten wie ein fehlender Wert - ebenfalls
  // fail-closed und ohne Rueckfall.
  for (const value of ["", "  ", "http://objektspeicher.beispiel.invalid"]) {
    withEnv({ ...VALID, S3_PUBLIC_BASE_URL: value }, () => {
      assert.deepEqual(missingMinioConfigKeys(), ["S3_PUBLIC_BASE_URL"], value);
      assert.throws(
        () => readMinioConfig(),
        { message: missingMessage("S3_PUBLIC_BASE_URL") },
        value,
      );
    });
  }

  // Gegenprobe: mit gesetztem Wert gelten beide Basen getrennt und unveraendert.
  withEnv(VALID, () => {
    const config = readMinioConfig();
    assert.equal(config.endpoint, VALID.S3_ENDPOINT);
    assert.equal(config.publicBaseUrl, VALID.S3_PUBLIC_BASE_URL);
    assert.notEqual(config.publicBaseUrl, config.endpoint);
  });
});

test("MC12 die gelesene Konfiguration traegt genau die erwarteten Felder", () => {
  withEnv({ ...VALID, S3_REGION: "eu-central-1", S3_FORCE_PATH_STYLE: "false" }, () => {
    const config = readMinioConfig();
    assert.deepEqual(Object.keys(config).sort(), [
      "accessKeyId",
      "bucket",
      "endpoint",
      "forcePathStyle",
      "publicBaseUrl",
      "region",
      "secretAccessKey",
    ]);
    // Die Werte werden bei JEDEM Aufruf frisch aus process.env gelesen und nicht
    // beim Modulimport - deshalb wirkt die Klammer von withEnv() ueberhaupt.
    assert.equal(config.endpoint, VALID.S3_ENDPOINT);
    assert.equal(config.bucket, VALID.S3_BUCKET);
    assert.equal(config.accessKeyId, VALID.S3_ACCESS_KEY_ID);
    assert.equal(config.secretAccessKey, VALID.S3_SECRET_ACCESS_KEY);
    assert.equal(config.region, "eu-central-1");
    assert.equal(config.forcePathStyle, false);
  });
});

test("MC13 ein umgebender Leerraum wird abgeschnitten", () => {
  withEnv({ ...VALID, S3_BUCKET: `  ${VALID.S3_BUCKET}  ` }, () => {
    assert.deepEqual(missingMinioConfigKeys(), []);
    assert.equal(readMinioConfig().bucket, VALID.S3_BUCKET);
  });
});

// ===========================================================================
// E) Pruefung der beiden Basis-URLs
//
// Geprueft wird ausschliesslich die Auswertung der Zeichenkette. Es wird KEINE
// Verbindung aufgebaut; alle Hostnamen sind Loopback oder enden auf .invalid.
// ===========================================================================

test("MC14 die getrimmten Werte gehen UNVERAENDERT in die Konfiguration - keine URL-Normalisierung", () => {
  // new URL("http://host") normalisiert zu "http://host/". Genau das darf NICHT
  // in die Konfiguration geraten: ein veraenderter Endpunkt wuerde das
  // SDK-Verhalten und den Cache-Schluessel in minio-storage.ts still veraendern.
  withEnv(
    {
      ...VALID,
      S3_ENDPOINT: `  ${VALID.S3_ENDPOINT}  `,
      S3_PUBLIC_BASE_URL: `  ${VALID.S3_PUBLIC_BASE_URL}  `,
    },
    () => {
      const config = readMinioConfig();
      assert.equal(config.endpoint, VALID.S3_ENDPOINT);
      assert.equal(config.publicBaseUrl, VALID.S3_PUBLIC_BASE_URL);
      assert.equal(config.endpoint.endsWith("/"), false);
      assert.equal(config.publicBaseUrl.endsWith("/"), false);
    },
  );
});

test("MC15 ein anderes Schema als http/https wird abgewiesen", () => {
  for (const name of ["S3_ENDPOINT", "S3_PUBLIC_BASE_URL"]) {
    for (const value of ["ftp://127.0.0.1:11", "file://127.0.0.1/objekte"]) {
      const values = { ...VALID, [name]: value };
      withEnv(values, () => {
        assert.throws(
          () => readMinioConfig(),
          (error) => {
            assert.equal(error.message, invalidBaseMessage(name), `${name}=${value}`);
            assertNoValuesInMessage(error, values);
            assert.ok(error.message.includes(name));
            return true;
          },
          `${name}=${value}`,
        );
      });
    }
  }
  // Gegenprobe: https ist zulaessig.
  withEnv(
    {
      ...VALID,
      S3_ENDPOINT: "https://objektspeicher.intern.invalid",
      S3_PUBLIC_BASE_URL: "https://bilder.intern.invalid",
    },
    () => {
      const config = readMinioConfig();
      assert.equal(config.endpoint, "https://objektspeicher.intern.invalid");
      assert.equal(config.publicBaseUrl, "https://bilder.intern.invalid");
    },
  );
});

test("MC16 eine Benutzerinfo in der Basis-URL wird abgewiesen", () => {
  // Eine Basis-URL mit Benutzerinfo traegt ein Zugangsdatum. Der Wert loest die
  // Platzhaltererkennung NICHT aus: "benutzer" gilt nur als VOLLSTAENDIGER Wert
  // als Platzhalter, nicht als Teil einer URL (PLACEHOLDER_VALUES in
  // minio-config.ts).
  for (const name of ["S3_ENDPOINT", "S3_PUBLIC_BASE_URL"]) {
    for (const value of [
      "http://benutzer:geheim@127.0.0.1:11",
      "http://benutzer@127.0.0.1:11",
    ]) {
      const values = { ...VALID, [name]: value };
      withEnv(values, () => {
        // Gegenprobe zur Platzhalterregel: der Wert gilt als GESETZT.
        assert.deepEqual(missingMinioConfigKeys(), [], `${name}=${value}`);
        assert.throws(
          () => readMinioConfig(),
          (error) => {
            assert.equal(error.message, invalidBaseMessage(name), `${name}=${value}`);
            assertNoValuesInMessage(error, values);
            return true;
          },
          `${name}=${value}`,
        );
      });
    }
  }
});

test("MC17 ein Query in der Basis-URL wird abgewiesen", () => {
  for (const name of ["S3_ENDPOINT", "S3_PUBLIC_BASE_URL"]) {
    const value = "http://127.0.0.1:11?zugriff=1";
    const values = { ...VALID, [name]: value };
    withEnv(values, () => {
      assert.throws(
        () => readMinioConfig(),
        (error) => {
          assert.equal(error.message, invalidBaseMessage(name), name);
          assertNoValuesInMessage(error, values);
          return true;
        },
        name,
      );
    });
  }
});

test("MC18 ein Fragment in der Basis-URL wird abgewiesen", () => {
  for (const name of ["S3_ENDPOINT", "S3_PUBLIC_BASE_URL"]) {
    const value = "http://127.0.0.1:11#teil";
    const values = { ...VALID, [name]: value };
    withEnv(values, () => {
      assert.throws(
        () => readMinioConfig(),
        (error) => {
          assert.equal(error.message, invalidBaseMessage(name), name);
          assertNoValuesInMessage(error, values);
          return true;
        },
        name,
      );
    });
  }
});

test("MC19 ein nicht absoluter Wert wird abgewiesen - mit DEMSELBEN Meldungstext", () => {
  // Derselbe Text wie in MC15 bis MC18: die Meldung darf nicht verraten, WELCHER
  // Bestandteil des Werts falsch war.
  for (const name of ["S3_ENDPOINT", "S3_PUBLIC_BASE_URL"]) {
    for (const value of ["objektspeicher-ohne-schema", "/nur/ein/pfad", "127.0.0.1:11"]) {
      const values = { ...VALID, [name]: value };
      withEnv(values, () => {
        assert.throws(
          () => readMinioConfig(),
          (error) => {
            assert.equal(error.message, invalidBaseMessage(name), `${name}=${value}`);
            assertNoValuesInMessage(error, values);
            return true;
          },
          `${name}=${value}`,
        );
      });
    }
  }
});

// ===========================================================================
// F) Trennung von internem Endpunkt und oeffentlicher Signierbasis
// ===========================================================================

test("MC20 gleicher Origin ausserhalb von Loopback wird abgewiesen", () => {
  const SAME = "http://objektspeicher.intern.invalid:9000";
  const values = { ...VALID, S3_ENDPOINT: SAME, S3_PUBLIC_BASE_URL: SAME };
  withEnv(values, () => {
    assert.throws(
      () => readMinioConfig(),
      (error) => {
        assert.equal(error.message, SAME_ORIGIN_MESSAGE);
        assertNoValuesInMessage(error, values);
        // Genau die beiden NAMEN stehen darin.
        assert.ok(error.message.includes("S3_ENDPOINT"));
        assert.ok(error.message.includes("S3_PUBLIC_BASE_URL"));
        return true;
      },
    );
  });

  // Verglichen wird der ORIGIN, nicht die Zeichenkette: ein zusaetzlicher
  // Schraegstrich am Ende aendert daran nichts.
  const withSlash = { ...VALID, S3_ENDPOINT: SAME, S3_PUBLIC_BASE_URL: `${SAME}/` };
  withEnv(withSlash, () => {
    assert.throws(
      () => readMinioConfig(),
      (error) => {
        assert.equal(error.message, SAME_ORIGIN_MESSAGE);
        assertNoValuesInMessage(error, withSlash);
        return true;
      },
    );
  });

  // Gegenprobe: verschiedene Origins ausserhalb von Loopback sind zulaessig -
  // genau das ist der Stage-/Produktionsfall (interner Dienstname gegen
  // oeffentliche Signierbasis am Reverse-Proxy).
  withEnv(
    {
      ...VALID,
      S3_ENDPOINT: SAME,
      S3_PUBLIC_BASE_URL: "https://bilder.intern.invalid",
    },
    () => {
      const config = readMinioConfig();
      assert.equal(config.endpoint, SAME);
      assert.equal(config.publicBaseUrl, "https://bilder.intern.invalid");
    },
  );
});

test("MC21 gleicher Origin ist bei Loopback zulaessig", () => {
  // Der lokale synthetische Testaufbau bindet auf 127.0.0.1 und benutzt fuer
  // Endpunkt und Signierbasis DENSELBEN Wert; SigV4 signiert den Host.
  // "[::1]" ist ausdruecklich mitgeprueft: URL.hostname liefert die IPv6-Form
  // MIT eckigen Klammern, isLoopback() entfernt sie vor dem Vergleich.
  for (const value of ["http://127.0.0.1:9", "http://localhost:9", "http://[::1]:9"]) {
    withEnv({ ...VALID, S3_ENDPOINT: value, S3_PUBLIC_BASE_URL: value }, () => {
      const config = readMinioConfig();
      assert.equal(config.endpoint, value, value);
      assert.equal(config.publicBaseUrl, value, value);
    });
  }
});

test("MC22 verschiedene Loopback-Origins sind zulaessig", () => {
  // Verschiedene Ports (VALID) und verschiedene Loopback-Namen.
  withEnv(VALID, () => {
    const config = readMinioConfig();
    assert.equal(config.endpoint, VALID.S3_ENDPOINT);
    assert.equal(config.publicBaseUrl, VALID.S3_PUBLIC_BASE_URL);
  });
  withEnv(
    { ...VALID, S3_ENDPOINT: "http://127.0.0.1:9", S3_PUBLIC_BASE_URL: "http://localhost:9" },
    () => {
      const config = readMinioConfig();
      assert.equal(config.endpoint, "http://127.0.0.1:9");
      assert.equal(config.publicBaseUrl, "http://localhost:9");
    },
  );
});

// ===========================================================================
// G) Same-Origin-Proxygrenze gegen AUTH_URL
// ===========================================================================

test("MC23 ein abweichender Origin von AUTH_URL wird abgewiesen", () => {
  const values = { ...VALID, AUTH_URL: "http://127.0.0.1:12" };
  withEnv(values, () => {
    assert.throws(
      () => readMinioConfig(),
      (error) => {
        assert.equal(error.message, AUTH_ORIGIN_MESSAGE);
        assertNoValuesInMessage(error, values);
        // Genau die beiden NAMEN stehen darin.
        assert.ok(error.message.includes("S3_PUBLIC_BASE_URL"));
        assert.ok(error.message.includes("AUTH_URL"));
        return true;
      },
    );
  });
});

test("MC24 derselbe Origin wie AUTH_URL ist zulaessig - verglichen wird der Origin, nicht der Pfad", () => {
  for (const authUrl of [
    VALID.S3_PUBLIC_BASE_URL,
    `${VALID.S3_PUBLIC_BASE_URL}/`,
    `${VALID.S3_PUBLIC_BASE_URL}/anmeldung`,
  ]) {
    withEnv({ ...VALID, AUTH_URL: authUrl }, () => {
      const config = readMinioConfig();
      assert.equal(config.publicBaseUrl, VALID.S3_PUBLIC_BASE_URL, authUrl);
      assert.equal(config.endpoint, VALID.S3_ENDPOINT, authUrl);
    });
  }
});

test("MC25 eine unbrauchbare AUTH_URL wird abgewiesen - Meldung nennt nur diesen Namen", () => {
  for (const value of ["kabelbereitschaft-ohne-schema", "ftp://127.0.0.1:10", "/nur/ein/pfad"]) {
    const values = { ...VALID, AUTH_URL: value };
    withEnv(values, () => {
      assert.throws(
        () => readMinioConfig(),
        (error) => {
          assert.equal(error.message, invalidBaseMessage("AUTH_URL"), value);
          assertNoValuesInMessage(error, values);
          assert.equal(error.message.includes("S3_"), false);
          return true;
        },
        value,
      );
    });
  }
});

test("MC26 ohne AUTH_URL findet kein Origin-Vergleich statt", () => {
  // AUTH_URL ist optional. Fehlt sie oder ist sie getrimmt leer, bleibt die
  // Signierbasis ungeprueft gegen sie - sonst waere der lokale synthetische
  // Testaufbau nicht lauffaehig, der AUTH_URL bewusst nicht setzt.
  for (const value of [undefined, "", "   ", "\t"]) {
    withEnv({ ...VALID, AUTH_URL: value }, () => {
      const config = readMinioConfig();
      assert.equal(config.publicBaseUrl, VALID.S3_PUBLIC_BASE_URL, JSON.stringify(value));
    });
  }
  // AUTH_URL ist ausdruecklich KEINE Pflichtvariable dieses Moduls.
  assert.equal([...MINIO_REQUIRED_ENV_KEYS].includes("AUTH_URL"), false);
});
