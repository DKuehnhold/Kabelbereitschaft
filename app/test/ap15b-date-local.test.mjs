// AP15-b: Einheitentests der Europe/Berlin-Tagesgrenze (src/lib/date-local.ts).
//
// Lauf: node --test app/test/ap15b-date-local.test.mjs  (Teil von test:unit
// ueber den Glob test/*.test.mjs).
//
// Reine Funktionen ohne Datenbank, ohne Netz, ohne Auth/DB-Ersatzmodule - der
// Referenzzeitpunkt wird als Parameter uebergeben statt die Systemzeit zu
// stubben.

import test from "node:test";
import assert from "node:assert/strict";
import { startOfTodayBerlin, startOfTodayBerlinIso } from "../src/lib/date-local.ts";

test("Sommerzeit (CEST, UTC+2): Mitternacht Berlin liegt bei 22:00 UTC des Vortags", () => {
  // 15. Juli 2026, 10:00 UTC == 12:00 Uhr Berliner Sommerzeit, klar am helllichten Tag.
  const reference = new Date("2026-07-15T10:00:00.000Z");
  const start = startOfTodayBerlin(reference);
  assert.equal(start.toISOString(), "2026-07-14T22:00:00.000Z");
});

test("Winterzeit (CET, UTC+1): Mitternacht Berlin liegt bei 23:00 UTC des Vortags", () => {
  // 15. Januar 2026, 10:00 UTC == 11:00 Uhr Berliner Winterzeit.
  const reference = new Date("2026-01-15T10:00:00.000Z");
  const start = startOfTodayBerlin(reference);
  assert.equal(start.toISOString(), "2026-01-14T23:00:00.000Z");
});

test("kurz nach Mitternacht Berlin (00:30 CEST) zaehlt noch zum selben Kalendertag", () => {
  // 00:30 Uhr Berliner Sommerzeit am 15. Juli == 14. Juli 22:30 UTC.
  const reference = new Date("2026-07-14T22:30:00.000Z");
  const start = startOfTodayBerlin(reference);
  // Erwartet: Mitternacht des 15. Juli Berliner Zeit == 14. Juli 22:00 UTC,
  // NICHT Mitternacht des 14. Juli (der Fehler der bisherigen serverzeit-
  // basierten Berechnung unter UTC).
  assert.equal(start.toISOString(), "2026-07-14T22:00:00.000Z");
});

test("kurz vor Mitternacht Berlin (23:50 CET) zaehlt noch zum selben Kalendertag", () => {
  // 23:50 Uhr Berliner Winterzeit am 14. Januar == 14. Januar 22:50 UTC.
  const reference = new Date("2026-01-14T22:50:00.000Z");
  const start = startOfTodayBerlin(reference);
  // Erwartet: Mitternacht DES NOCH LAUFENDEN Kalendertags (14. Januar,
  // Berliner Zeit) == 13. Januar 23:00 UTC - NICHT die kommende Mitternacht
  // des 15. Januar. Der Referenzzeitpunkt liegt kurz VOR Mitternacht, gehoert
  // also noch zum 14. Januar.
  assert.equal(start.toISOString(), "2026-01-13T23:00:00.000Z");
});

test("kurz vor der Umstellung (2026-03-28, 23:30 CET): Tagesgrenze bleibt beim laufenden Kalendertag", () => {
  // 28. Maerz 2026 23:30 Uhr Berliner Winterzeit (CET, UTC+1) == 22:30 UTC.
  // Referenzzeitpunkt liegt noch VOR der Umstellung (29. Maerz, 02:00 Uhr
  // Ortszeit) und noch VOR Mitternacht - Tag bleibt der 28. Maerz.
  // Erwartet: Mitternacht des 28. Maerz Berliner Zeit (ebenfalls noch CET)
  // == 27. Maerz 23:00 UTC - NICHT die kommende Mitternacht des 29. Maerz.
  const reference = new Date("2026-03-28T22:30:00.000Z");
  const start = startOfTodayBerlin(reference);
  assert.equal(start.toISOString(), "2026-03-27T23:00:00.000Z");
});

test("Referenz nach der Umstellung (2026-03-29, 03:00 CEST): Mitternacht des Tages war noch CET", () => {
  // 29. Maerz 2026 03:00 Uhr Berliner Sommerzeit (CEST, UTC+2, direkt nach der
  // Umstellung um 02:00 Uhr) == 01:00 UTC. Die gesuchte Mitternacht (29. Maerz,
  // 00:00 Uhr) liegt VOR der Umstellung, ist also noch CET (UTC+1): 28. Maerz
  // 23:00 UTC - ein anderer Offset als am Referenzzeitpunkt selbst (CEST).
  // Das deckt genau die Selbstkorrektur in startOfTodayBerlin() ab, die
  // greift, wenn Referenz- und Mitternachts-Offset auseinanderfallen.
  const reference = new Date("2026-03-29T01:00:00.000Z");
  const start = startOfTodayBerlin(reference);
  assert.equal(start.toISOString(), "2026-03-28T23:00:00.000Z");
});

test("startOfTodayBerlinIso liefert dieselbe Zeit wie startOfTodayBerlin, als ISO-Text", () => {
  const reference = new Date("2026-07-15T10:00:00.000Z");
  assert.equal(startOfTodayBerlinIso(reference), startOfTodayBerlin(reference).toISOString());
});

test("ohne Argument wird die aktuelle Systemzeit verwendet (Rueckgabe <= jetzt)", () => {
  const start = startOfTodayBerlin();
  assert.ok(start.getTime() <= Date.now());
  // Nie mehr als 25h in der Vergangenheit (deckt jede denkbare Zeitzone ab).
  assert.ok(Date.now() - start.getTime() < 25 * 60 * 60 * 1000);
});

test("Herbstumstellung (2026-10-25, 12:00 UTC): die gesuchte Mitternacht liegt noch in CEST", () => {
  // 25. Oktober 2026 ist der Berliner Rueckstelltag (letzter Sonntag im
  // Oktober, Umstellung 03:00 CEST -> 02:00 CET). Um 12:00 UTC gilt am
  // REFERENZZEITPUNKT bereits CET (UTC+1) - die Umstellung liegt Stunden
  // zuvor. Die GESUCHTE Mitternacht des 25.10. (00:00 Uhr Berliner Zeit)
  // liegt aber VOR der Umstellung und ist damit noch CEST (UTC+2): 24.
  // Oktober 22:00 UTC - ein anderer Offset als am Referenzzeitpunkt selbst.
  // Das ist die bisher fehlende Richtung der Selbstkorrektur in
  // startOfTodayBerlin(): die Faelle oben ("Referenz nach der Umstellung...")
  // decken nur den Fruehjahrswechsel CET->CEST ab, dieser Fall den
  // Herbstwechsel CEST->CET.
  const reference = new Date("2026-10-25T12:00:00.000Z");
  const start = startOfTodayBerlin(reference);
  assert.equal(start.toISOString(), "2026-10-24T22:00:00.000Z");
});

test("startOfTodayBerlinIso verwendet explizit Europe/Berlin statt einer impliziten Prozesszeitzone", () => {
  // Der Produktionscode muss die Berliner Tagesgrenze direkt ueber
  // Intl.DateTimeFormat(timeZone: "Europe/Berlin") ableiten. Ein Prozess mit
  // abweichender Default-Zeitzone darf daran nichts aendern; hier pruefen wir
  // deshalb den expliziten Zeitbereich, ohne auf einen Child-Prozess angewiesen
  // zu sein, der in dieser Sandbox nicht startbar ist.
  const OriginalDateTimeFormat = Intl.DateTimeFormat;
  const seenTimeZones = [];

  function SpyDateTimeFormat(locale, options) {
    seenTimeZones.push(options?.timeZone ?? null);
    return new OriginalDateTimeFormat(locale, options);
  }
  SpyDateTimeFormat.prototype = OriginalDateTimeFormat.prototype;

  const original = Intl.DateTimeFormat;
  try {
    Intl.DateTimeFormat = SpyDateTimeFormat;
    const reference = new Date("2026-07-14T22:30:00.000Z");
    const output = startOfTodayBerlinIso(reference);
    assert.equal(output, "2026-07-14T22:00:00.000Z");
  } finally {
    Intl.DateTimeFormat = original;
  }

  assert.ok(seenTimeZones.length > 0, "Es wurde kein Intl.DateTimeFormat erzeugt");
  assert.ok(seenTimeZones.every((tz) => tz === "Europe/Berlin"), `Unerwartete Zeitzone(n): ${seenTimeZones.join(", ")}`);
});
