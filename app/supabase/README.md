# Supabase – Schema, Migrationen, Storage

## Inhalt
- `migrations/0001_init.sql` – Kernschema: Enums, Tabellen (UUID-PKs), Constraints,
  Indizes, Trigger (Audit, unveränderbare Status-Chronik, Bestandsschutz), RLS-Policies,
  Bestands-View `material_stock`, Profil-Anlage bei neuem Auth-Benutzer.
- `migrations/0002_storage.sql` – privater Bucket `incident-images` + Zugriffsrichtlinien.
- `seed.sql` – optionale Beispiel-Stammdaten (keine personenbezogenen Daten, keine Secrets).
- `test/` – **nur lokal**: Auth/Storage-Stub + Smoke-Test zur Prüfung von RLS/Triggern.

## Anwenden in Supabase
1. Projekt anlegen, URL + Anon-Key in `../.env.local` eintragen (siehe `../.env.example`).
2. SQL-Editor öffnen und `migrations/0001_init.sql`, danach `migrations/0002_storage.sql` ausführen.
   Alternativ mit Supabase CLI: `supabase db push` (Migrations-Ordner).
3. Optional `seed.sql` ausführen.
4. Ersten Benutzer unter **Authentication** anlegen. Das Profil wird automatisch erzeugt.
   Rolle setzen: `update public.profiles set role='admin' where id='<uuid>';`

## Rollenmodell (RLS)
- `profiles.role` ∈ {admin, disponent, monteur}. Hilfsfunktionen `is_admin()`, `is_staff()`,
  `is_assigned_to_incident()` steuern die Policies.
- Monteure sehen/bearbeiten nur zugewiesene Vorgänge; Stammdaten schreibt nur der Admin.
- Bewegungs- und Chronikdaten sind unveränderbar (kein UPDATE/DELETE-Policy; Schreiben
  der Chronik nur über Trigger).

## Hinweis
`test/*.sql` niemals in Supabase ausführen – die Dateien stubben `auth`/`storage`
für eine lokale PostgreSQL-Prüfung.
