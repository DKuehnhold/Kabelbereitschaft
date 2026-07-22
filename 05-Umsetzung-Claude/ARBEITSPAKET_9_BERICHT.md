# Arbeitspaket 9 – Stammdaten & Einstellungen (Umsetzungsbericht)

Status: umgesetzt und lokal verifiziert. Additiv, ohne Breaking Change gegenüber AP1–AP8.
Migration: `0007_ap9_master_data.sql`. Commit: `feat: implement master data management (AP9)`.

## 1. Umfang
Vollständige interne Stammdatenverwaltung inkl. Admin-UI, RLS, feldgenauem Audit und
Monteur-CSV-Import. Kein AP10+-Inhalt (keine Vorgangsverknüpfung, keine Einsätze, kein
Dashboard, keine Bild-/Vorgangslogik verändert). AP8.1-Branding nicht berührt.

## 2. Neue Tabellen
`customers`, `vzg_lines`, `contacts`, `contact_phone_numbers`,
`construction_stage_contacts` (M:N, eigene `id` + Unique-Paar), `technicians`, `teams`,
`team_members` (M:N, eigene `id` + Unique-Paar), `cable_types` (Referenz, geseedet),
`app_settings` (Singleton). Neues Enum `phone_type` (mobil/festnetz/leitstelle/sonstige).

## 3. Erweiterte Tabelle
`construction_stages` additiv um `wus_bst` und `default_on_call_number_id`
(FK → `on_call_numbers`).

## 4. Constraints & Seeds
- `vzg_lines.line_number` `CHECK (~ '^[0-9]{4}$')`, `UNIQUE (construction_stage_id, line_number)`
  (dieselbe Nummer je Bauabschnitt nur einmal, mehreren Bauabschnitten zuordenbar).
- `customers.erp_id UNIQUE` (NULL mehrfach erlaubt; leere Strings werden serverseitig zu NULL).
- `technicians.profile_id UNIQUE` (NULL mehrfach erlaubt).
- `contact_phone_numbers`: `CHECK phone nicht leer`, `sort_order >= 0`.
- `cable_types.code UNIQUE`; Seed: 50 Hz, OLA, LST, TK, LWL, Unbekannt (idempotent).
- `app_settings`: `CHECK (id = 1)` (echte Singleton-Tabelle), genau eine Initialzeile idempotent,
  Standardwerte anfangs NULL.

## 5. RLS
Alle neuen Tabellen: `SELECT` für alle Angemeldeten, `WRITE` nur `is_staff()`
(admin + disponent). `construction_stages`-Schreibrecht von `is_admin()` auf `is_staff()`
erweitert (Broadening, kein Bruch). Monteur ausschließlich lesend. Fachliches Löschen nur
über `is_active` (kein physisches Löschen über die UI).

## 6. Audit (feldgenau, eine Lösung)
`tg_audit` per `CREATE OR REPLACE` additiv erweitert: `detail.op` bleibt erhalten;
bei UPDATE `detail.changes = { feld: { old, new } }` (ohne `updated_at/updated_by`-Rauschen),
bei INSERT `detail.new`, bei DELETE `detail.old`. Datensatz-ID defensiv (Nicht-UUID wie
`app_settings.id` → `entity_id = NULL`, Datensatz bleibt in `detail`). Audit-Trigger an allen
neuen Tabellen und zusätzlich an `construction_stages`. Keine zweite Auditlösung; `audit_events`
strukturell unverändert (nur reichere `detail`-JSON, rückwärtskompatibel).

## 7. UI & Navigation
Neue Gruppe „Stammdaten" in der Navigation (`roles.ts` `NAV_GROUPS` + `AppShell` Desktop+Mobile,
sichtbar für admin/disponent). Acht Unterseiten unter `app/(app)/stammdaten/*`:
Kunden, Bauabschnitte, VzG-Strecken, Ansprechpartner, Monteure, Teams, Kabelarten, Einstellungen.
Alle mit Suche, Sortierung, Aktiv/Inaktiv-Filter, responsivem Layout (Desktop-Tabelle +
Mobil-Karten), token-basiert (AP8-Designsystem, Light/Dark), Danger-Aktion („Deaktivieren"/
„Entfernen") optisch abgesetzt, eindeutig beschriftete Aktiv/Inaktiv-Umschaltung. Kein
Alt-Stil (kein slate/blue/bg-white) in neuen Komponenten; eigener token-basierter Dialog.

## 8. Monteur-CSV-Import
`lib/csv-import.ts` (abhängigkeitsfreier Parser: UTF-8 mit/ohne BOM, Trennzeichen „;"/„,",
Quotes inkl. verdoppelter Anführungszeichen, Header-Aliase deutsch/englisch). Ablauf:
Datei wählen → serverseitige Vorschau (`previewTechnicianImport`) mit Statuszeilen
(neu / Dublette Datei / bereits vorhanden / Fehler) und Zusammenfassung → Bestätigung →
`commitTechnicianImport` legt nur „neu"-Zeilen an. Keine stille Überschreibung; Dublette per
`Vorname+Nachname` (normalisiert) und optional `profile_id` gegen Datei und Datenbank.

## 9. Bereitschaftsnummern
Keine neue Unterseite; bestehende `on_call_numbers` werden wiederverwendet und sind auswählbar
für `construction_stages.default_on_call_number_id` und `app_settings.default_on_call_number_id`.
Eine dedizierte Pflegeoberfläche für `on_call_numbers` existiert derzeit nicht (siehe Offene Punkte).

## 10. Testergebnisse (lokal)
- `npx tsc --noEmit`: 0 Fehler.
- `npx eslint`: 0 Fehler.
- `npx next build`: erfolgreich (alle acht `/stammdaten/*`-Routen erzeugt).
- Migration 0007 auf leerer DB und auf Stand 0001–0006: sauber; zweite Anwendung idempotent.
- AP9-Smoke (`supabase/test/14_ap9_smoke.sql`): 26/26 OK (CRUD, RLS admin/disponent/monteur,
  feldgenaues Audit für Insert/Update/Aktiv/M:N, Constraints, Seeds, Singleton).
- Bestehende Smokes 10/11/12/13: 3/16/20/5 OK, 0 FAIL (Rückwärtskompatibilität `tg_audit`).
- CSV-Parser/Classifier-Unittest: 14/14 OK.
- Nicht ausführbar in dieser Umgebung: Browser-E2E, Push (privates Repo, keine Zugangsdaten).

## 11. Offene Punkte
- Pflegeoberfläche für `on_call_numbers` (außerhalb des freigegebenen AP9-Seitenumfangs).
- Anbindung der Stammdaten an Vorgangserfassung/Einsätze/Dashboard → AP10+.
- Push nach GitHub durch den Nutzer (in der Sandbox nicht verifizierbar).
