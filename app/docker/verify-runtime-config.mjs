// Pruefung der Laufzeitkonfiguration beim Containerstart.
//
// Regel: fehlt eine Pflichtvariable, bricht der Start mit Exit-Code 78
// (EX_CONFIG) und einer klaren Meldung ab. Kein stiller Start, keine
// Platzhalterwerte, keine Ausgabe von Werten.
//
// Es werden ausschliesslich NAMEN geprueft und protokolliert - niemals Werte.
// Der Anon-Key ist kein Geheimnis im kryptografischen Sinn, wird aber
// dennoch nicht ins Log geschrieben.
//
// Stand Arbeitspaket B / Auth-Basis: Authentifizierung und Sitzungen laufen
// gegen PostgreSQL (DATABASE_URL) mit Auth.js (AUTH_SECRET). Die noch nicht
// migrierten Datenmodule (Vorgaenge, Material, Bilder) nutzen weiterhin
// Supabase; deshalb sind derzeit BEIDE Gruppen Pflicht. Die Supabase-Variablen
// entfallen mit dem Abschluss der Datenmigration (ADR-011 / 4).
//
// Die MinIO-Zugangsdaten sind noch nicht Pflicht: der Bildspeicher wird in
// einem eigenen Arbeitspaket umgestellt.

const REQUIRED = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
];

const OPTIONAL_WITH_DEFAULT = [
  ["APP_VERSION", "0.1.0"],
  ["PORT", "3000"],
  ["HOSTNAME", "0.0.0.0"],
];

// Variablen, die in dieser Anwendung ausdruecklich NICHT gesetzt werden
// duerfen. Ein Service-Role-Key wird von der Webanwendung nicht verwendet
// (ADR-011 / SICHERHEIT.md); sein Vorhandensein ist ein Konfigurationsfehler.
const FORBIDDEN = ["SUPABASE_SERVICE_ROLE_KEY"];

const missing = REQUIRED.filter((name) => {
  const value = process.env[name];
  return value === undefined || value.trim() === "";
});

const forbidden = FORBIDDEN.filter((name) => {
  const value = process.env[name];
  return value !== undefined && value.trim() !== "";
});

if (missing.length > 0 || forbidden.length > 0) {
  const lines = ["", "Konfigurationsfehler: Container wird nicht gestartet.", ""];
  if (missing.length > 0) {
    lines.push("Fehlende Pflichtvariablen:");
    for (const name of missing) lines.push(`  - ${name}`);
    lines.push("");
    lines.push("Diese Werte gehoeren in die Environment-Datei des Stacks");
    lines.push("(deploy/env/app.env, Vorlage: deploy/env/app.env.example).");
  }
  if (forbidden.length > 0) {
    lines.push("");
    lines.push("Unzulaessig gesetzte Variablen (bitte entfernen):");
    for (const name of forbidden) lines.push(`  - ${name}`);
    lines.push("");
    lines.push("Die Webanwendung verwendet keinen Service-Role-Key.");
  }
  lines.push("");
  process.stderr.write(lines.join("\n") + "\n");
  process.exit(78); // EX_CONFIG
}

const defaults = OPTIONAL_WITH_DEFAULT.filter(([name]) => !process.env[name]).map(
  ([name, fallback]) => `${name}=${fallback} (Standard)`,
);

process.stdout.write(
  [
    "Konfiguration geprueft: alle Pflichtvariablen vorhanden.",
    defaults.length > 0 ? `Standardwerte aktiv: ${defaults.join(", ")}` : null,
    "",
  ]
    .filter(Boolean)
    .join("\n"),
);
