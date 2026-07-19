// Reine CSV-Hilfen (client- und serverseitig nutzbar).
//
// Entscheidung Trennzeichen: SEMIKOLON. Deutsche Excel-Installationen erwarten
// standardmäßig „;" als Listentrennzeichen (das Komma ist das Dezimalzeichen).
// Zusätzlich UTF-8 mit BOM, damit Umlaute in Excel korrekt erscheinen.
//
// Sicherheit: CSV-/Formel-Injektion wird neutralisiert. Zellen, die mit
// =  +  -  @  Tab (\t) oder CR (\r) beginnen, werden mit einem Apostroph
// vorangestellt, sodass Tabellenprogramme sie als Text und nicht als Formel
// interpretieren (OWASP-Empfehlung).

const DANGEROUS_PREFIX = /^[=+\-@\t\r]/;

export function csvCell(value: unknown, delimiter = ";"): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (DANGEROUS_PREFIX.test(s)) s = "'" + s;
  if (s.includes(delimiter) || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    s = '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export function buildCsv(headers: string[], rows: unknown[][], delimiter = ";"): string {
  const all = [headers, ...rows];
  // CRLF für maximale Kompatibilität mit Excel.
  return all.map((row) => row.map((c) => csvCell(c, delimiter)).join(delimiter)).join("\r\n");
}

export const CSV_BOM = "﻿";

export function csvFilename(prefix = "vorgaenge"): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${prefix}_${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}.csv`;
}
