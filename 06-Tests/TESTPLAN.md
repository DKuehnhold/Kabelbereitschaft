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

## AP6 – E2E, Idempotenz, Konflikt (Prüfumfang)
Automatisch **ausgeführt am 2026-07-19** (Node v22, PostgreSQL 16 user-space):
`npm ci`, `npm run lint` (0), `npx tsc --noEmit` (0, inkl. E2E-Specs), `next build` (PASS),
Migration `0001–0006` (leer + auf AP5-Bestand, idempotent), Smoke-Tests `10`–`13`
(Idempotenz `13` 5/5, AP3 `11` 16/16, AP4 `12` 20/20, AP1/AP2 `10` 0 Fehler), `node --check sw.js`,
CSV-Sicherheitstest (12/12), `playwright test --list` (22 Tests), `playwright test public.spec.ts`
(4/7 gegen Prod-Server bestanden – request-basiert).
**Nicht ausführbar in der Build-Umgebung (nicht als bestanden gewertet):** seitenbasierte
Browser-E2E (Chromium-Systembibliotheken fehlen, kein root) und `@app`-E2E (benötigen Test-Supabase).
Siehe `06-Tests/E2E_TESTS.md`.

## AP7 – Release-Prüfungen (Prüfumfang)
Automatisch **ausgeführt am 2026-07-19**: `npm ci`, `npm run lint` (0), `npx tsc --noEmit` (0),
`npm run build` (PASS), `npm audit` (2 moderate/0 hoch – akzeptiert, postcss build-time via Next),
Migration `0001–0006` (leer + AP6-Bestand, idempotent), Smokes `10`–`13`, `node --check sw.js`,
CSV-Test 12/12, `playwright test --list` (26), `playwright test public.spec.ts` (6/9 – request-basiert
grün inkl. Health-Check und Sicherheitsheader). Accessibility (`@axe-core/playwright`) als `@public`-Test
vorhanden; **Browserlauf in der Build-Umgebung nicht möglich** (Chromium-Systembibliotheken).
**Nicht ausführbar/offen (nicht als bestanden gewertet):** seitenbasierte Browser-E2E, `@app`-E2E,
a11y-Browserlauf, PWA-Installation/SW-Update-Runtime, Performance-Messung, Deployment-/Recovery-Test.

## Nachtrag AP9 – Stammdaten
- `supabase/test/14_ap9_smoke.sql`: CRUD, RLS (admin/disponent/monteur), feldgenaues Audit
  (Insert/Update/Aktiv/M:N), Constraints (VzG-Format & Unique je Bauabschnitt, erp_id,
  profile_id, M:N-Unique, app_settings-Singleton), Seeds. Ergebnis lokal: 26/26 OK.
- Migration 0007 auf leerer DB und auf 0001–0006 angewendet; zweite Anwendung idempotent.
- Rückwärtskompatibilität `tg_audit`: bestehende Smokes 10/11/12/13 weiterhin grün.
- CSV-Import: Parser/Classifier-Unittest (BOM, `;`/`,`, Quotes, Header-Aliase, Validierung,
  Datei-/DB-/Profil-Dublette) – 14/14 OK.
- `npm run lint`, `tsc --noEmit`, `npm run build`: fehlerfrei.
- Nicht ausführbar in der Sandbox: Browser-E2E, Push (privates Repo).

## Nachtrag AP10 – Vorgangserfassung
- `supabase/test/15_ap10_smoke.sql`: transaktionale Anlage (Incident + Pflicht-Kabelposition),
  VzG-Snapshot, RLS (admin/disponent/monteur), VzG↔Bauabschnitt, km optional, Update-Snapshot/Kabelart,
  sort_order-Unique, Kabelpositions-RLS, feldgenaues Audit. Ergebnis lokal: 12/12 OK.
- Migration 0008 auf leerer DB (nach 0001–0007), auf Bestand und Zweitanwendung (idempotent).
- Backfill: eindeutiger VzG-Treffer gesetzt, Nicht-Treffer NULL, Standardkunde gesetzt, 0 Positionen.
- Regression: Smokes 11/13/14 grün (tg_audit/Incident-Writes unverändert lauffähig).
- lint/tsc/build fehlerfrei. Nicht ausführbar in der Sandbox: Browser-E2E, Push.

## Nachtrag AP11 – Operative Vorgangsliste
- `supabase/test/16_ap11_list.sql`: RLS (staff/monteur) über `incident_list_view`, Aggregate,
  abgeleitete Hinweise, Suchtext, Aktivitätsfilter, lokales Erstelldatum. Ergebnis lokal: 8/8 OK.
- Performance: 600 Vorgänge – Seitenabfrage (50) ~97 ms, Count ~15 ms, Suche funktionsfähig.
- Regression: Smokes 11/13/14/15 grün.
- lint/tsc/build fehlerfrei. Nicht ausführbar in der Sandbox: Browser-E2E, Push.
