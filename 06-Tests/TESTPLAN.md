# Testplan

> Stand: 2026-07-19 · MVP V0.1 · Teil von Arbeitspaket 1

## Teststrategie

Zweistufig: automatisierte technische Prüfungen (Lint, Typecheck, Build, DB-Migration) und manuelle funktionale Prüfungen (Login, Rollen, Navigation, später Fachfunktionen). Der Testumfang wächst mit den Arbeitspaketen.

## Umfang Arbeitspaket 1 (jetzt testbar)

| Prüfung | Art | Inhalt |
| --- | --- | --- |
| Build | automatisch | `npm run build` erzeugt fehlerfreien Produktions-Build |
| Lint | automatisch | `npm run lint` ohne Fehler |
| Typecheck | automatisch | TypeScript-Prüfung ohne Fehler |
| Migration | automatisch/manuell | DB-Migration läuft gegen leere Postgres-DB durch |
| RLS | manuell | Rollen-Policies greifen (Zugriff nur gemäß Rolle) |
| Login | manuell | Anmeldung/Abmeldung, Schutz der Routen |
| Rollen | manuell | Navigation je Rolle admin/disponent/monteur korrekt |
| Grundnavigation | manuell | geschützte Routen leiten ohne Sitzung auf `/login` |

## Umfang spätere Arbeitspakete (geplant)

| Bereich | Prüfung |
| --- | --- |
| Vorgang | Anlegen, Zuweisen, Statuslauf, Chronik-Unveränderbarkeit |
| Zustand | Zustandsbewertung setzen |
| Bilder | Upload, EXIF-Auswertung, Verhalten ohne GPS/EXIF, privater Bucket |
| Material | Bewegungen, Bestandsableitung, keine negativen Bestände, Vorgang+Lager-Bindung |
| Export | CSV-Format, Filterwirkung |

## Werkzeuge

- Manuelle Tests: Browser (Desktop + mobile Ansicht/Responsive-Modus).
- Automatisierte Prüfungen: npm-Skripte im Ordner `app`.
- DB-Prüfung: Supabase-CLI / lokale Postgres-Instanz.

## Testdaten

Seed-Daten für Rollen (je ein admin/disponent/monteur), Baustufen und Stammdaten werden mit der Migration bereitgestellt. Keine echten personenbezogenen Daten in Testumgebungen.

## AP2 – Vorgangsverwaltung (Prüfumfang)
Automatisch geprüft (ausgeführt): `npm run lint`, `tsc --noEmit`, `next build`,
Migration 0001–0003 + RLS-/Trigger-Smoke-Test inkl. Prioritätsprüfung gegen PostgreSQL 18.

Manuell zu prüfen (benötigt verbundenes Supabase-Projekt):
- Dashboard Disponent (Kennzahlen, Tabelle, Filter/Suche) und Monteur (nur eigene Einsätze).
- Vorgang anlegen (Pflichtfeldvalidierung, Status=Neu, Chronikeintrag).
- Vorgang bearbeiten (nur Disposition/Admin).
- Monteur zuweisen / entfernen; Statuswechsel rollenabhängig; Zustandsbewertung; Notiz.
- Timeline zeigt Ereignisse chronologisch, unveränderbar.
- Responsiv (Sidebar/Hamburger, Tabellen/Karten).

## AP3 – Material- und Lagerverwaltung (Prüfumfang)
Automatisch **ausgeführt am 2026-07-19 – alle PASS** (Node v22, PostgreSQL 16 user-space):
`npm run lint`, `npx tsc --noEmit`, `next build`, Migration 0001–0004 (inkl. Idempotenz der
additiven Migrationen 0003/0004) sowie die Smoke-Tests `test/10_smoke_test.sql` und
`test/11_ap3_smoke.sql`. Der neue `11_ap3_smoke.sql` deckt alle 11 AP3-Szenarien ab:
Wareneingang, Umbuchung, Entnahme mit Vorgang, Entnahme ohne Vorgang (blockiert),
Rückgabe ≤ Restmenge, Rückgabe > Restmenge (abgelehnt, App-Regel `returnableQuantity`),
Verbrauch berechtigter Monteur, Verbrauch unberechtigt (RLS-blockiert), negative Bestände
(Trigger-blockiert), RLS Admin/Disposition/Monteur, Bestandsberechnung via `material_stock`.
Umgebungsnotiz: lokal wurde nur die Zeile `create extension pgcrypto` in `0001_init.sql`
übersprungen (`gen_random_uuid()` ist PG13+ Core; Supabase liefert die Erweiterung ohnehin).
Manuell (mit verbundenem Supabase, noch offen): Stammdaten-CRUD Material/Lager, Bestandsübersicht,
Admin-Bewegungen (Wareneingang/Umbuchung/Korrektur/Verlust/Beschädigung),
Monteur-Entnahme/Rückgabe/Verbrauch, Materialhistorie-Filter, Material-im-Vorgang,
Karte „Material unter Mindestbestand".

## AP4 – Bilddokumentation, EXIF/GPS, CSV (Prüfumfang)
Automatisch **ausgeführt am 2026-07-19 – alle PASS** (Node v22, PostgreSQL 16 user-space):
`npm ci`, `npm run lint`, `npx tsc --noEmit`, `next build`, Migration 0001–0005 (leer und auf
AP3-Datenbestand, idempotent), Smoke-Test `test/12_ap4_smoke.sql` (**20/20 OK**) sowie
Regression `test/10_smoke_test.sql` und `test/11_ap3_smoke.sql` (**16/16 OK**). CSV-Sicherheit
über Node-Test (`csv.ts`, **12/12 OK**: Formel-Injektion `= + - @`/Tab, Maskierung, BOM).
Der Smoke-Test deckt ab: Upload berechtigt/unberechtigt, Upload ohne Vorgang (blockiert),
EXIF mit/ohne Aufnahmedatum, GPS gültig/ungültig, Kategorie-/Beschreibungsänderung (Chronik),
Soft-Delete (Ausblenden + Chronik), Audit, RLS Admin/Disposition/Monteur, Storage-RLS,
Bucket-Härtung, Dashboard-Kennzahl.
Manuell (mit verbundenem Supabase, noch offen): tatsächlicher Datei-Upload/Vorschau im Browser,
signierte-URL-Anzeige, Drag-and-drop, HEIC-Ablehnung, Galerie/Großansicht responsiv,
CSV-Download inkl. Filterwirkung.

## AP5 – Offlinefähigkeit (PWA), Synchronisation (Prüfumfang)
Automatisch **ausgeführt am 2026-07-19 – alle PASS** (Node v22, PostgreSQL 16 user-space):
`npm ci`, `npm run lint` (0), `npx tsc --noEmit` (0), `next build` (neue Routen `/api/sync`,
`/api/images/upload`, `/manifest.webmanifest`, `/offline`), `node --check public/sw.js` (gültig),
CSV-Sicherheitstest (12/12). Regression Migration 0001–0005 + Smokes 10/11/12 erneut grün.
Keine neue Migration (Konflikt über vorhandenes `updated_at`).

**Manuelle Browser-QA (in der Build-Umgebung ohne Browser nicht ausführbar):**
Offline-Start, Offline-Dashboard, Offline-Incident, Offline-Timeline, Offline-Notiz,
Offline-Statusänderung, Upload-Warteschlange (Fortschritt/Abbruch/Retry), Wiederverbindung,
Konfliktfall, Synchronisation, PWA-Installation, Service-Worker-Registrierung/-Update,
Cache-Invalidierung. Erwartetes Verhalten siehe OFFLINE.md/PWA.md.
