// AUFTRAG_21: Logo im Dark Mode weiß, sonst schwarz (Ursache: kaputte
// `dark:`-Variante).
//
// AUSDRUECKLICH EIN STATISCHER WAECHTER UND KEIN VERHALTENSNACHWEIS (Muster
// aus app/test/auftrag18-dispo-zeitraum.test.mjs): liest globals.css und
// Logo.tsx als TEXT und prueft Vorhandensein/Struktur der verlangten
// Selektoren. Ein Render-/Darstellungsnachweis (z. B. dass ein echter
// Browser das Logo tatsaechlich weiß zeichnet) ist in dieser Sandbox ohne
// Browser nicht moeglich und nicht Teil dieses Wächtertests - siehe
// MELDUNG_21.md.
//
// Lauf: node --test app/test/auftrag21-dark-variante.test.mjs (Teil von
// test:unit ueber den Glob test/*.test.mjs).

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function readGlobalsCss() {
  return readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");
}

async function readLogoSource() {
  return readFile(new URL("../src/components/Logo.tsx", import.meta.url), "utf8");
}

function sliceBlock(source, marker, nextMarkers) {
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `Marker nicht gefunden: "${marker}"`);
  let end = source.length;
  for (const next of nextMarkers) {
    const idx = source.indexOf(next, start + marker.length);
    if (idx !== -1 && idx < end) end = idx;
  }
  return source.slice(start, end);
}

function countOccurrences(source, needle) {
  let count = 0;
  let from = 0;
  for (;;) {
    const idx = source.indexOf(needle, from);
    if (idx === -1) break;
    count += 1;
    from = idx + needle.length;
  }
  return count;
}

test("die dark-Variante nennt sowohl [data-theme=\"dark\"] als auch prefers-color-scheme: dark", async () => {
  const css = await readGlobalsCss();
  const variantBlock = sliceBlock(css, "@custom-variant dark", [
    "Designsystem – Tokens (AP8)",
  ]);
  assert.match(
    variantBlock,
    /\[data-theme="dark"\]/,
    "die dark-Variante deckt das explizite Theme [data-theme=\"dark\"] nicht (mehr) ab",
  );
  assert.match(
    variantBlock,
    /prefers-color-scheme:\s*dark/,
    "die dark-Variante deckt den Systempraeferenz-Fall (prefers-color-scheme: dark) nicht ab",
  );
});

test("die dark-Variante enthaelt den Ausschluss :not([data-theme=\"light\"]) fuer den Systempraeferenz-Zweig", async () => {
  const css = await readGlobalsCss();
  const variantBlock = sliceBlock(css, "@custom-variant dark", [
    "Designsystem – Tokens (AP8)",
  ]);
  assert.match(
    variantBlock,
    /:not\(\[data-theme="light"\]\)/,
    "der Ausschluss :not([data-theme=\"light\"]) fehlt - ein ausdrueckliches Hell-Theme auf dunklem "
    + "Betriebssystem wuerde sonst ein weißes Logo auf weißem Grund zeigen",
  );
});

test("Logo.tsx traegt weiterhin dark:invert", async () => {
  const source = await readLogoSource();
  assert.match(
    source,
    /className=\{`[^`]*dark:invert[^`]*`/,
    "Logo.tsx traegt nicht mehr die Klasse dark:invert",
  );
});

test("die drei bestehenden Farb-Bloecke existieren weiterhin je genau einmal (Wächter gegen versehentliche Tokenaenderung)", async () => {
  const css = await readGlobalsCss();
  // Die @custom-variant-Definition selbst (samt Begruendungskommentar) nennt
  // "@media (prefers-color-scheme: dark)" zwangslaeufig ebenfalls (einmal im
  // Kommentar, einmal im zweiten Bedingungszweig) - das ist gewollter
  // Bestandteil der Variantenreparatur (AUFTRAG_21), KEIN zusaetzlicher
  // Tokenblock. Fuer den Waechter gegen eine versehentliche Tokenaenderung
  // zaehlt daher nur der Dateiteil NACH der Variantendefinition.
  // Einzeiliger Marker (keine eingebettete Newline): globals.css traegt
  // CRLF-Zeilenenden (siehe BEFUND_CRLF_ARBEITSBAUM.md, hier nicht zu
  // reparieren) - ein Marker mit "\n" wuerde daher nie treffen.
  const variantEnd = css.indexOf("Designsystem – Tokens (AP8)");
  assert.notEqual(variantEnd, -1, "Ende der @custom-variant-Definition (Designsystem-Kommentar) nicht gefunden");
  const tokensCss = css.slice(variantEnd);

  assert.equal(
    countOccurrences(tokensCss, ":root {"),
    1,
    ":root { ... } kommt nicht (mehr) genau einmal vor",
  );
  assert.equal(
    countOccurrences(tokensCss, '[data-theme="dark"] {'),
    1,
    '[data-theme="dark"] { ... } kommt nicht (mehr) genau einmal vor',
  );
  assert.equal(
    countOccurrences(tokensCss, "@media (prefers-color-scheme: dark) {"),
    1,
    "@media (prefers-color-scheme: dark) { ... } kommt nicht (mehr) genau einmal vor",
  );
});
