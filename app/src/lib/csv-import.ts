// AP9: Robuster CSV-Parser für den Monteur-Import.
// Bewusst abhängigkeitsfrei (keine React/Next-Importe), damit die reine Logik
// isoliert testbar ist. Unterstützt:
//   * UTF-8 mit und ohne BOM
//   * Semikolon (;) und Komma (,) als Trennzeichen (automatische Erkennung)
//   * Anführungszeichen inkl. verdoppelter "" und eingebetteter Zeilenumbrüche
//   * Spaltenzuordnung anhand dokumentierter Header (deutsche + englische Aliase)
//
// Dokumentierte Header (Reihenfolge beliebig, Groß/Kleinschreibung egal):
//   Vorname     | first_name  | firstname            (Pflicht)
//   Nachname    | last_name   | lastname             (Pflicht)
//   Aktiv       | is_active   | active | status       (optional, Default aktiv)
//   Profil-ID   | profile_id                          (optional; wenn gesetzt, UUID)

export type TechnicianImportRow = {
  line: number;
  first_name: string;
  last_name: string;
  is_active: boolean;
  profile_id: string | null;
};

export type RowError = { line: number; message: string };

export type CsvParseResult = {
  ok: boolean;
  delimiter: ";" | ",";
  headers: string[];
  rows: TechnicianImportRow[];
  errors: RowError[];
  fatal: string | null; // z. B. fehlende Pflichtspalten
};

const TRUE_SET = new Set(["ja", "true", "1", "aktiv", "x", "y", "yes", "wahr"]);
const FALSE_SET = new Set(["nein", "false", "0", "inaktiv", "n", "no", "falsch"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const HEADER_ALIASES: Record<string, string> = {
  vorname: "first_name",
  first_name: "first_name",
  firstname: "first_name",
  nachname: "last_name",
  last_name: "last_name",
  lastname: "last_name",
  aktiv: "is_active",
  is_active: "is_active",
  active: "is_active",
  status: "is_active",
  "profil-id": "profile_id",
  profil_id: "profile_id",
  profile_id: "profile_id",
};

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function detectDelimiter(text: string): ";" | "," {
  // Erste nicht-leere Zeile außerhalb von Quotes betrachten.
  const firstLine = text.split(/\r?\n/).find((l) => l.trim() !== "") ?? "";
  let semis = 0;
  let commas = 0;
  let inQ = false;
  for (const ch of firstLine) {
    if (ch === '"') inQ = !inQ;
    else if (!inQ && ch === ";") semis++;
    else if (!inQ && ch === ",") commas++;
  }
  return semis >= commas ? ";" : ",";
}

function tokenize(text: string, delim: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQ = false;
  let i = 0;
  const n = text.length;
  let sawField = false;
  while (i < n) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQ = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQ = true;
      sawField = true;
      i++;
      continue;
    }
    if (c === delim) {
      row.push(field);
      field = "";
      sawField = true;
      i++;
      continue;
    }
    if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      sawField = false;
      i++;
      continue;
    }
    if (c === "\r") {
      i++;
      continue;
    }
    field += c;
    sawField = true;
    i++;
  }
  // Rest
  if (sawField || field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function parseBool(raw: string): boolean | null {
  const v = raw.trim().toLowerCase();
  if (v === "") return true; // Default: aktiv
  if (TRUE_SET.has(v)) return true;
  if (FALSE_SET.has(v)) return false;
  return null;
}

export function parseTechnicianCsv(input: string): CsvParseResult {
  const text = stripBom(input ?? "");
  const delimiter = detectDelimiter(text);
  const table = tokenize(text, delimiter).filter(
    (r) => !(r.length === 1 && r[0].trim() === ""),
  );

  if (table.length === 0) {
    return { ok: false, delimiter, headers: [], rows: [], errors: [], fatal: "Die Datei enthält keine Daten." };
  }

  const rawHeaders = table[0].map((h) => h.trim());
  const mapped = rawHeaders.map((h) => HEADER_ALIASES[h.toLowerCase()] ?? "");
  const idxFirst = mapped.indexOf("first_name");
  const idxLast = mapped.indexOf("last_name");
  const idxActive = mapped.indexOf("is_active");
  const idxProfile = mapped.indexOf("profile_id");

  const missing: string[] = [];
  if (idxFirst < 0) missing.push("Vorname/first_name");
  if (idxLast < 0) missing.push("Nachname/last_name");
  if (missing.length > 0) {
    return {
      ok: false,
      delimiter,
      headers: rawHeaders,
      rows: [],
      errors: [],
      fatal: `Pflichtspalten fehlen: ${missing.join(", ")}. Erwartete Kopfzeile z. B. „Vorname;Nachname;Aktiv".`,
    };
  }

  const rows: TechnicianImportRow[] = [];
  const errors: RowError[] = [];

  for (let r = 1; r < table.length; r++) {
    const cells = table[r];
    const line = r + 1; // 1-basiert inkl. Kopfzeile
    const first = (cells[idxFirst] ?? "").trim();
    const last = (cells[idxLast] ?? "").trim();
    const activeRaw = idxActive >= 0 ? cells[idxActive] ?? "" : "";
    const profileRaw = idxProfile >= 0 ? (cells[idxProfile] ?? "").trim() : "";

    if (first === "" && last === "" && activeRaw.trim() === "" && profileRaw === "") {
      continue; // komplett leere Zeile überspringen
    }
    const rowErrors: string[] = [];
    if (first === "") rowErrors.push("Vorname fehlt");
    if (last === "") rowErrors.push("Nachname fehlt");

    const active = parseBool(activeRaw);
    if (active === null) rowErrors.push(`Aktiv-Wert „${activeRaw.trim()}" nicht interpretierbar`);

    let profile_id: string | null = null;
    if (profileRaw !== "") {
      if (UUID_RE.test(profileRaw)) profile_id = profileRaw.toLowerCase();
      else rowErrors.push("Profil-ID ist keine gültige UUID");
    }

    if (rowErrors.length > 0) {
      errors.push({ line, message: rowErrors.join("; ") });
      continue;
    }
    rows.push({ line, first_name: first, last_name: last, is_active: active as boolean, profile_id });
  }

  return { ok: errors.length === 0, delimiter, headers: rawHeaders, rows, errors, fatal: null };
}

// Normalisierung für Dublettenerkennung: Vorname+Nachname, case-insensitive, getrimmt.
export function technicianKey(firstName: string, lastName: string): string {
  return `${firstName.trim().toLowerCase()}|${lastName.trim().toLowerCase()}`;
}

// ---------------------------------------------------------------------
// Klassifizierung für Vorschau + Commit (rein, testbar)
// ---------------------------------------------------------------------
export type ImportRowStatus = "neu" | "dublette_datei" | "dublette_db" | "fehler";

export type ImportPreviewRow = {
  line: number;
  first_name: string;
  last_name: string;
  is_active: boolean;
  profile_id: string | null;
  status: ImportRowStatus;
  message: string;
};

export type ImportPreview = {
  ok: boolean; // parse ohne fatalen Fehler
  fatal: string | null;
  delimiter: string;
  rows: ImportPreviewRow[];
  summary: { total: number; neu: number; dublette_datei: number; dublette_db: number; fehler: number };
};

export type ImportCommitResult = {
  ok: boolean;
  inserted: number;
  skipped: number;
  failed: number;
  message: string;
};

// Ermittelt je Zeile den Status. Keine stille Überschreibung: bereits
// vorhandene Monteure (Name oder Profil-ID) werden als Dublette markiert,
// nicht aktualisiert.
export function classifyImport(
  parsed: CsvParseResult,
  existingNameKeys: Set<string>,
  existingProfileIds: Set<string>,
): ImportPreview {
  const rows: ImportPreviewRow[] = [];

  for (const e of parsed.errors) {
    rows.push({
      line: e.line,
      first_name: "",
      last_name: "",
      is_active: false,
      profile_id: null,
      status: "fehler",
      message: e.message,
    });
  }

  const seenNames = new Set<string>();
  const seenProfiles = new Set<string>();
  for (const r of parsed.rows) {
    const key = technicianKey(r.first_name, r.last_name);
    let status: ImportRowStatus = "neu";
    let message = "";
    if (seenNames.has(key) || (r.profile_id && seenProfiles.has(r.profile_id))) {
      status = "dublette_datei";
      message = "Dublette innerhalb der Datei";
    } else if (existingNameKeys.has(key)) {
      status = "dublette_db";
      message = "Monteur mit gleichem Namen existiert bereits";
    } else if (r.profile_id && existingProfileIds.has(r.profile_id)) {
      status = "dublette_db";
      message = "Profil-ID ist bereits einem Monteur zugeordnet";
    } else {
      status = "neu";
      message = "Wird angelegt";
    }
    seenNames.add(key);
    if (r.profile_id) seenProfiles.add(r.profile_id);
    rows.push({
      line: r.line,
      first_name: r.first_name,
      last_name: r.last_name,
      is_active: r.is_active,
      profile_id: r.profile_id,
      status,
      message,
    });
  }

  rows.sort((a, b) => a.line - b.line);
  const summary = {
    total: rows.length,
    neu: rows.filter((r) => r.status === "neu").length,
    dublette_datei: rows.filter((r) => r.status === "dublette_datei").length,
    dublette_db: rows.filter((r) => r.status === "dublette_db").length,
    fehler: rows.filter((r) => r.status === "fehler").length,
  };
  return { ok: parsed.fatal == null, fatal: parsed.fatal, delimiter: parsed.delimiter, rows, summary };
}
