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

// =====================================================================
// AUFTRAG_7: Umrechnung zwischen dem Wert eines <input type="datetime-local">
// (eine Wanduhrzeit ohne Zeitzone, z. B. "2026-08-17T14:30") und einem
// tatsaechlichen Zeitpunkt (Instant) - fuer den neuen Anrufzeitpunkt
// (incidents.reported_at). Wiederverwendung derselben Herleitung wie
// startOfTodayBerlin() oben: die gesuchte Wanduhrzeit wird zunaechst so
// interpretiert, als waere sie UTC, dann um den an dieser Stelle geltenden
// Berliner Offset korrigiert, und die Korrektur am Ergebnis (statt nur am
// Referenzzeitpunkt) ein zweites Mal nachgezogen - das deckt den
// Sommer-/Winterzeit-Wechsel exakt wie bei der Tagesgrenze ab.
//
// WARUM HIER UND NICHT NUR SERVERSEITIG IN incident-actions.ts: das Formular
// (NewIncidentForm.tsx, Client-Komponente) belegt das Feld mit "jetzt" vor und
// muss dafuer dieselbe Berliner Wanduhrzeit erzeugen, die die Datenbank spaeter
// speichert - sonst wichen Vorbelegung und gespeicherter Wert bei einem
// Server-Client-Zeitzonenunterschied voneinander ab. Beide Seiten nutzen daher
// dieselbe Herleitung aus diesem Modul (reine Funktionen, kein
// Server-/DB-Import, siehe Kopfkommentar der Datei).

/** Berliner Wanduhrzeit (Jahr, Monat 1-12, Tag, Stunde, Minute) als Instant. */
export function berlinWallTimeToInstant(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second = 0,
): Date {
  const wallAsUtcMillis = Date.UTC(year, month - 1, day, hour, minute, second, 0);
  const offsetAtWall = berlinOffsetMinutes(new Date(wallAsUtcMillis));
  let candidate = new Date(wallAsUtcMillis - offsetAtWall * 60000);
  const offsetAtCandidate = berlinOffsetMinutes(candidate);
  if (offsetAtCandidate !== offsetAtWall) {
    candidate = new Date(wallAsUtcMillis - offsetAtCandidate * 60000);
  }
  return candidate;
}

/** Berliner Wanduhrzeit eines Instants im Format von <input type="datetime-local"> ("YYYY-MM-DDTHH:mm"). */
export function formatBerlinDatetimeLocal(instant: Date): string {
  const p = partsAt(instant);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

const DATETIME_LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/**
 * Wert eines <input type="datetime-local"> als Berliner Wanduhrzeit
 * interpretiert und in einen Instant umgerechnet. Fail-closed: `null` bei
 * jeder Abweichung vom Muster UND bei einem nicht existierenden Kalendertag
 * bzw. einer nicht existierenden Uhrzeit (Rueckrechnungsprobe, dasselbe
 * Prinzip wie isIsoDate() in incidents.ts - Date.UTC() normalisiert einen
 * Ueberlauf wie 2026-02-31 sonst stillschweigend statt ihn abzuweisen).
 */
export function parseBerlinDatetimeLocal(value: string): Date | null {
  const match = DATETIME_LOCAL_PATTERN.exec(value.trim());
  if (!match) return null;
  const [, y, mo, d, h, mi] = match;
  const month = Number(mo);
  const day = Number(d);
  const hour = Number(h);
  const minute = Number(mi);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;

  const instant = berlinWallTimeToInstant(Number(y), month, day, hour, minute, 0);
  if (Number.isNaN(instant.getTime())) return null;
  if (formatBerlinDatetimeLocal(instant) !== `${y}-${mo}-${d}T${h}:${mi}`) return null;
  return instant;
}
