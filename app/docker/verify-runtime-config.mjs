// Pruefung der Laufzeitkonfiguration beim Containerstart.
//
// Regel: fehlt eine Pflichtvariable, bricht der Start mit Exit-Code 78
// (EX_CONFIG) und einer klaren Meldung ab. Kein stiller Start, keine
// Platzhalterwerte, keine Ausgabe von Werten.
//
// Es werden ausschliesslich NAMEN geprueft und protokolliert - niemals Werte.
// Das gilt auch fuer Angaben, die kein Geheimnis im kryptografischen Sinn sind:
// Endpunkte, Bucketnamen und Kennungen bleiben ebenso aus dem Log.
//
// Stand nach Abschluss der Datenmigration (ADR-011 / 4): Anwendung, Anmeldung
// und Sitzungen laufen vollstaendig gegen PostgreSQL (DATABASE_URL) mit Auth.js
// (AUTH_SECRET). Der Bildspeicher liegt im internen Objektspeicher (MinIO/S3);
// dessen Pflichtnamen sind mit MINIO_REQUIRED_ENV_KEYS in
// src/lib/minio-config.ts deckungsgleich zu halten. Supabase ist abgeloest und
// wird von keinem Modul mehr benutzt.

const REQUIRED = [
  "DATABASE_URL",
  "AUTH_SECRET",
  // AUTH_URL ist im CONTAINERBETRIEB Pflicht, obwohl die Anwendung sie sonst als
  // optional behandelt. Grund: readMinioConfig() in src/lib/minio-config.ts
  // erzwingt die Same-Origin-Proxygrenze - S3_PUBLIC_BASE_URL muss denselben
  // Origin haben wie AUTH_URL - aber NUR, wenn AUTH_URL gesetzt ist. Bliebe sie
  // hier optional, entfiele diese Zusicherung im Betrieb still, und der Browser
  // koennte Bild-URLs von einem fremden Origin erhalten. Die Pflicht gilt
  // bewusst nur an dieser Startgrenze und nicht in MINIO_REQUIRED_ENV_KEYS:
  // lokale Entwicklung und die synthetischen Tests laufen ohne AUTH_URL.
  "AUTH_URL",
  // Objektspeicher, Reihenfolge und Schreibweise wie MINIO_REQUIRED_ENV_KEYS
  // in src/lib/minio-config.ts.
  "S3_ENDPOINT",
  "S3_PUBLIC_BASE_URL",
  "S3_BUCKET",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
];

const OPTIONAL_WITH_DEFAULT = [
  ["APP_VERSION", "0.1.0"],
  ["PORT", "3000"],
  ["HOSTNAME", "0.0.0.0"],
];

// Variablen, die in dieser Anwendung ausdruecklich NICHT gesetzt werden
// duerfen.
//
// - SUPABASE_SERVICE_ROLE_KEY: ein Service-Role-Key wird von der Webanwendung
//   nicht verwendet (ADR-011 / SICHERHEIT.md).
// - NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY: nach der
//   Abloesung darf keine Supabase-Laufzeitvariable mehr gesetzt sein. Eine noch
//   vorhandene Altvariable ist ein Konfigurationsfehler und soll den Start
//   verweigern, statt still ignoriert zu werden. Zusaetzlich sind
//   NEXT_PUBLIC_*-Werte buildzeitgebunden: eine zur Laufzeit gesetzte
//   Altvariable wuerde einen falschen Eindruck von Wirksamkeit erzeugen.
const FORBIDDEN = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
];

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
    lines.push("Diese Variablen werden von der Webanwendung nicht verwendet.");
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
