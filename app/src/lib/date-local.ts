// AP15-b: Zeitzonenfeste Tagesgrenze fuer Kennzahlen ("heute erstellt", "heute
// hochgeladen", "heute uebernommen").
//
// Fachlicher Befund (siehe PROJEKT_WISSEN.md, AP15-Fachbefunde): die bisherige
// Berechnung `new Date(); d.setHours(0,0,0,0)` liefert Mitternacht in der
// Zeitzone des NODE-PROZESSES (Server-Betriebssystem/Container), nicht in der
// fachlich gewollten Zeitzone Europe/Berlin. Laeuft der Server z. B. mit UTC,
// verschiebt sich die Tagesgrenze um zwei bzw. eine Stunde (Sommer-/Winterzeit)
// - ein Vorgang, der um 00:30 Uhr Berliner Zeit angelegt wird, zaehlte dann noch
// zum VORTAG. `public.incident_list_view.created_date_local` loest dasselbe
// Problem bereits datenbankseitig ueber `at time zone 'Europe/Berlin'`
// (Migration 0009); diese Datei ist das JS-seitige Gegenstueck fuer Kennzahlen,
// die nicht aus dieser View stammen (Bild-Uploads, Monteur-Zuweisungen).
//
// Europe/Berlin ist eine BEWUSSTE, an dieser Stelle neu getroffene fachliche
// Festlegung (vorher laut Kommentar in images-server.ts ausdruecklich offen).
// Sie folgt der bereits bestehenden Festlegung in `incident_list_view` und wird
// hier nicht zweimal unabhaengig entschieden.
//
// Absichtlich ohne Bibliothek (kein date-fns-tz/luxon): `Intl.DateTimeFormat`
// mit `timeZone` ist in Node >= 22 zuverlaessig und IANA-tz-Daten-aktuell,
// zusaetzliche Abhaengigkeit waere hier nicht gerechtfertigt.
//
// Genauigkeitsgrenze: der UTC-Offset wird zunaechst am Referenzzeitpunkt
// bestimmt und, falls der ermittelte Kalendertag einen abweichenden Offset hat
// (Sommer-/Winterzeit-Wechsel liegt zwischen Referenzzeitpunkt und Mitternacht),
// ein zweites Mal am so bestimmten Tag selbst nachgezogen. Das deckt den
// Normalfall und den Tag des Wechsels ab; theoretisch verbleibt eine
// Unschaerfe von wenigen Millisekunden bei einer erneuten Ermittlung exakt in
// der Wechselstunde selbst - fachlich ohne Bedeutung fuer Tageskennzahlen.

const BERLIN_TZ = "Europe/Berlin";

type PartsMap = Record<string, string>;

function partsAt(instant: Date): PartsMap {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: BERLIN_TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const out: PartsMap = {};
  for (const part of formatter.formatToParts(instant)) {
    if (part.type !== "literal") out[part.type] = part.value;
  }
  return out;
}

/** UTC-Offset (Minuten, UTC - Berlin) der Berliner Wanduhrzeit zu `instant`. */
function berlinOffsetMinutes(instant: Date): number {
  const p = partsAt(instant);
  const asIfUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
    Number(p.second),
  );
  return Math.round((asIfUtc - instant.getTime()) / 60000);
}

/**
 * Mitternacht (00:00:00.000) des Berliner Kalendertags von `reference` -
 * als tatsaechlicher Zeitpunkt (Instant), nicht als Wanduhrzeit.
 *
 * `reference` ist optional und default auf `new Date()`, damit Aufrufer in
 * Tests einen festen Zeitpunkt einsetzen koennen, statt die Systemzeit zu
 * stubben.
 */
export function startOfTodayBerlin(reference: Date = new Date()): Date {
  const offsetAtReference = berlinOffsetMinutes(reference);
  const wallAtReference = new Date(reference.getTime() + offsetAtReference * 60000);
  const y = wallAtReference.getUTCFullYear();
  const m = wallAtReference.getUTCMonth();
  const d = wallAtReference.getUTCDate();
  const wallMidnightAsUtcMillis = Date.UTC(y, m, d, 0, 0, 0, 0);

  let candidate = new Date(wallMidnightAsUtcMillis - offsetAtReference * 60000);
  const offsetAtCandidate = berlinOffsetMinutes(candidate);
  if (offsetAtCandidate !== offsetAtReference) {
    candidate = new Date(wallMidnightAsUtcMillis - offsetAtCandidate * 60000);
  }
  return candidate;
}

/** ISO-8601 UTC-Zeichenkette derselben Mitternacht, fuer parametrisiertes SQL. */
export function startOfTodayBerlinIso(reference: Date = new Date()): string {
  return startOfTodayBerlin(reference).toISOString();
}
