# Datenbank – Schema, Migrationen, Testkette

> Der Verzeichnisname `supabase/` ist ein **historischer Pfadname** aus AP1–AP13. Es gibt
> **kein Supabase-Ziel**, keine Supabase-CLI, keinen SQL-Editor-Weg und keine zweite
> Migrationsquelle. Zielplattform ist die interne Eigenplattform nach
> `00-Projektsteuerung/ADR-011-postgres-eigenplattform.md` (PostgreSQL 18, Auth.js v5, MinIO).
> Der Ordner wird ausdrücklich **nicht umbenannt**, damit die Git-Historie und alle
> bestehenden Verweise gültig bleiben.

## Inhalt
- `migrations/` – Bestand `0001`–`0017`, Kette lückenlos:
  - `0001_init.sql` – Kernschema: Enums, Tabellen (UUID-PKs), Constraints, Indizes,
    Trigger (Audit, unveränderbare Status-Chronik, Bestandsschutz), RLS-Policies,
    Bestands-View `material_stock`.
  - `0002_storage.sql` – historischer privater Bild-Bucket der Supabase-Ära; die Datei
    trägt keine AP-Nummer, und ihre Wirkung wird von `0013` wieder vollständig entfernt.
    Der heutige MinIO-Bucket entsteht **nicht** hier, sondern als Schritt der internen IT.
  - `0003`–`0011` – additive Fachpakete AP2–AP13 (Priorität, Inventar-RLS, Bilder,
    Sync-Idempotenz, Stammdaten, Vorgangs-Stammdaten, Vorgangsliste, Vorgangsdetails,
    Aufgaben/Bulk).
  - `0012_ap14b_platform_auth.sql` – PostgreSQL-/Auth.js-Plattform.
  - `0013_ap14b_drop_supabase_compat.sql` – entfernt die Kompatibilitätsschemata.
  - `0014`–`0016` – Rechtematrizen für Daten, Stammdaten/Inventar und Bilder.
  - `0017_ap14b_admin_user_management.sql` – administrative Benutzerverwaltung.
- `bootstrap/` – `01_roles.sql`, `02_compat_auth.sql`, `03_compat_storage.sql` sowie
  `bootstrap/README.md`. Die beiden `compat`-Dateien existieren ausschließlich, um die
  Migrationen der Supabase-Ära (`0001`, `0002`) überhaupt anwendbar zu machen; `0013`
  entfernt die dadurch entstandenen Schemata anschließend wieder.
- `seed.sql` – optionale Beispiel-Stammdaten (keine personenbezogenen Daten, keine Secrets).
- `test/` – SQL-Smokes und Runner für die Prüfung von Schema, RLS und Triggern.

## Anwenden
Belegter Weg sind die beiden Testrunner. Beide wenden **dieselbe SQL-Kette in derselben
Reihenfolge** an — Migrationen und Smokes sind darin **verschränkt und nicht sequenziell**:
`bootstrap/01_roles.sql`, `02_compat_auth.sql`, `03_compat_storage.sql` → `0001`–`0011` →
Smokes `15`–`18` → `0012`, `0013`, `0014` → `19`, `19a`, `20` → `0015` → `21` → `0016` →
`22` → `0017` → `23` → `24`.

**Die Verschränkung ist zwingend, nicht kosmetisch.** Jede Rechtematrix steht unmittelbar vor
ihrem Smoke, und die späteren Matrizen stehen bewusst **hinter** `20_ap14b_data.sql`, dessen
Negativfälle belegen, dass bestimmte Rechte zu diesem Zeitpunkt noch fehlen. Würde man erst
alle Migrationen und dann alle Smokes anwenden, entwerteten die später erteilten Rechte diese
Negativproben und der Lauf schlüge fehl (Begründungen im Quelltext:
`test/run_db_tests.sh:113-185`, `test/run_ap14b_local.ps1:190-263`).

- `test/run_db_tests.sh` – POSIX-Weg; dies ist auch der CI-Weg im Job `database`.
  Startet zwei Node-Suiten.
- `test/run_ap14b_local.ps1` – Windows-Weg; startet fünf Node-Suiten und bietet
  zusätzlich den Modus `-TemporaryCluster` (eigenes Cluster, Vorgabeport 55432).

Die Kette läuft ausschließlich gegen eine **Testdatenbank**.

**Ein produktiver Anwendungsweg ist offen.** Es gibt kein produktives Migrationsskript;
weder die CI noch der Containerstart führen Migrationen aus
(`deploy/README.md`: „Die CI führt keine Migrationen aus. Der Containerstart führt keine
Migrationen aus.").

Der erste Administrator wird über `../scripts/bootstrap-admin.mjs` angelegt (verdeckte
doppelte Kennworteingabe, Argon2id, idempotent, fail-closed) – nicht über eine fremde
Authentication-Oberfläche. Betreiberablauf: `07-Betrieb/BENUTZERVERWALTUNG.md`.

## Rollenmodell (RLS)
- `profiles.role` ∈ {admin, disponent, monteur}. Hilfsfunktionen `is_admin()`, `is_staff()`,
  `is_assigned_to_incident()` steuern die Policies.
- Identitätsquelle ist `app.current_user_id()` (nicht mehr `auth.uid()`). Die Anwendung setzt
  sie **transaktionslokal** über `set_config('app.user_id', …, true)`; fehlt der Wert, liefert
  `app.current_user_id()` NULL.
- Die Anwendungsrolle `app_user` hat weder `SUPERUSER` noch `BYPASSRLS`; Migrationen prüfen
  das fail-closed.
- Monteure sehen/bearbeiten nur zugewiesene Vorgänge; Stammdaten schreibt nur der Admin.
- Bewegungs- und Chronikdaten sind unveränderbar (kein UPDATE/DELETE-Policy; Schreiben
  der Chronik nur über Trigger).

## Hinweis
- Die Kette ist **nicht durchgehend additiv**: `0013` entfernt Schemata und eine Funktion,
  `test/19a_ap14b_grant_reset.sql` entzieht Rechte pauschal. „Additiv" gilt für die
  Fachmigrationen, nicht für die Kette als Ganzes.
- Die Kette **niemals gegen eine fremde Plattform** laufen lassen:
  `0013_ap14b_drop_supabase_compat.sql` entfernt die Kompatibilitätsschemata `auth` und
  `storage` sowie `public.handle_new_user()` und prüft vorher fail-closed auf verbliebene
  Referenzen. Auf einer fremden Plattform wäre das destruktiv.
- Belegter Befund zum Testbestand: die sechs Dateien `00_stub_auth_storage.sql`,
  `10_smoke_test.sql`, `11_ap3_smoke.sql`, `12_ap4_smoke.sql`, `13_ap6_idempotency.sql` und
  `14_ap9_smoke.sql` werden von **keinem** der beiden Runner aufgerufen.
  `test/run_ap12_local.ps1` ist ein historischer Weg.

> Stand: 2026-08-03 (Plattformrichtigstellung, AP15).
