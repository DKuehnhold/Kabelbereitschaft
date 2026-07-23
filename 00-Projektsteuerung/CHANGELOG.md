# Changelog

## [0.1.0] – 2026-07-19 – Arbeitspaket 1
### Hinzugefügt
- Vault-Dokumentationsstruktur (00–07, 99) mit Grundlagendokumenten.
- Next.js 16 / React 19 / TypeScript / Tailwind 4 Grundgerüst im Ordner `app/`.
- Supabase-Integration: Browser-/Server-/Middleware-Clients (`@supabase/ssr`), `.env.example`.
- Datenbankschema als Migration `0001_init.sql` (Enums, Tabellen, Constraints, Indizes,
  Trigger, RLS, Bestands-View) und `0002_storage.sql` (privater Bild-Bucket + Policies).
- Beispiel-Seed `seed.sql`; lokale Testskripte unter `supabase/test/`.
- Loginseite mit Branding-Platzhalter; Abmeldung; geschützter Bereich `(app)`.
- Rollenbasierte Grundnavigation (Administrator, Disponent, Monteur) + Dashboard.
- Serverseitige EXIF-Hilfsfunktion (`exifr`) vorbereitet.

### Geprüft
- Lint, TypeScript-Prüfung und Produktions-Build erfolgreich.
- RLS/Trigger/Bestandsschutz gegen PostgreSQL 18 per Smoke-Test verifiziert.

## [0.2.0] – 2026-07-19 – Arbeitspaket 2 (Vorgangsverwaltung)
### Hinzugefügt
- Rollenbasierte Dashboards (Disponent/Admin, Monteur) mit Kennzahlen und Übersichten.
- Vorgang anlegen/bearbeiten, Monteurzuweisung, rollenabhängige Statuswechsel, Zustandsbewertung, Notizen.
- Priorität (Enum, farbige Darstellung); moderne unveränderbare Timeline.
- Responsive Sidebar-/Header-Navigation.
### Geändert
- Migration `0003_ap2_priority.sql` (additiv): Priorität + Abschluss-/interne Bemerkung.
- `(app)/layout` auf Sidebar-Shell umgestellt.
### Geprüft
- Lint, Typecheck, Build erfolgreich; Migration 0001–0003 + Smoke-Test grün.

## AP9 – Stammdaten & Einstellungen
feat: implement master data management (AP9)
- Migration 0007 (additiv): 10 neue Tabellen + construction_stages erweitert + Enum phone_type.
- RLS (is_staff), feldgenaues Audit (tg_audit erweitert), 8 Stammdaten-Seiten, Monteur-CSV-Import.
- Verifikation: lint/tsc/build ok; AP9-Smoke 26/26; Bestandssmokes grün; CSV-Unittest 14/14.

## AP10 – Vorgangserfassung
feat: integrate master data into incident creation (AP10)
- Migration 0008 (additiv): incidents.customer_id/vzg_line_id, NOT-NULL-Lockerung km_from/vzg_line_number,
  incident_cable_positions (positionsbezogene Kabelart), transaktionale RPCs, Backfill.
- Erfassungs-/Bearbeitungsmaske token-basiert mit abhängigen Dropdowns; Detail/Listen ergänzt.
- Verifikation: lint/tsc/build ok; AP10-Smoke 12/12; Backfill ok; Regression 11/13/14 grün.
