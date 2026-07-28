# Projektstatus – Kabelbereitschaft

> **FÜHRENDES DOKUMENT (Projektstatus).** Kennzeichnung vom 2026-07-26 gemäß Auflage vor AP12
> (`00-Projektsteuerung/ROADMAP_AP12_AP15_ENTWURF.md`, B.1/B.8). Abgelöste Dublette:
> `00-Projektsteuerung/PROJEKTSTATUS.md` (als historisch markiert, nicht gelöscht).
> Endgültige Konsolidierung und Archivierung erfolgen in AP15.
> Stand: 2026-07-28

## Repository
- Repository: Kabelbereitschaft
- Remote: https://github.com/DKuehnhold/Kabelbereitschaft.git
- Branch: main
- ManagementOS-Verbindung: keine

## Arbeitspakete
- **AP1** – Grundgerüst, Datenmodell (RLS/Trigger), Login, rollenbasierte Navigation: abgeschlossen.
- **AP2** – Vorgangsverwaltung (Dashboards, Anlegen/Bearbeiten, Zuweisung, Statuswechsel, Priorität, Timeline): abgeschlossen.
- **AP3** – Material- und Lagerverwaltung (Bestände, Bewegungen, Entnahme/Rückgabe/Verbrauch, Historie, additive RLS 0004): abgeschlossen und verifiziert (lint/tsc/build/Migration 0001–0004/Smoke-Tests grün), Commit `ac7b4d1`.
- **AP4** – Bilddokumentation (privater Upload, EXIF/GPS, Galerie/Großansicht, Soft-Delete,
  Timeline/Audit, Dashboard-Kennzahl) + gefilterter, injektionssicherer CSV-Export:
  abgeschlossen und verifiziert (lint/tsc/build, Migration 0001–0005 leer + auf AP3-Bestand,
  Smoke 12_ap4 20/20, Regression 11_ap3 16/16, CSV-Test 12/12). Migration `0005_ap4_images.sql`.
- **AP5** – Offlinefähigkeit (PWA), Synchronisation, Hintergrundbetrieb: abgeschlossen und
  verifiziert (lint/tsc/build, SW-Syntax, CSV 12/12, Regression Migration 0001–0005 + Smokes
  10/11/12). Manifest/Icons/Service Worker, IndexedDB-Outbox + Upload-Queue, `/api/sync` +
  `/api/images/upload`, Konflikterkennung, Offline-Leiste/Dashboard-Kennzahlen. Keine neue Migration.
  Offline-Runtime als manuelle Browser-QA offen.
- **AP6** – E2E-Tests, Offline-Verifikation, Synchronisationshärtung: umgesetzt und (soweit in der
  Build-Umgebung ausführbar) verifiziert. Playwright-Struktur (22 Tests), Idempotenz/Dedup
  (Migration `0006`), Konfliktauflösung, SW-Update, Benutzertrennung, Diagnose, CI-Workflow.
  Geprüft: lint/tsc/build, Migration 0001–0006 (leer + AP5-Bestand), Smokes 10–13, CSV 12/12,
  SW-Syntax; Playwright `--list` 22 Tests + `@public` 4/7 (Rest browser-/Supabase-abhängig).
- **AP7** – Vorschläge: CI mit Test-Supabase scharfschalten, Middleware→Proxy mit E2E, Push/Release,
  WebCrypto/Background-Sync.

## Git / Push (VERALTET — siehe „Aktueller Stand 2026-07-26" am Dateiende)
> Der folgende Absatz beschreibt den Stand vom 2026-07-19 und ist überholt.
Lokaler `main` ist Remote (`origin/main` = `8d83371`) voraus: **AP4, AP5, AP6 sind noch nicht
gepusht** (kein Git-Zugang in der Build-Umgebung). Push durch den Nutzer erforderlich.

## Offen
- Manuelle UI-/Browser-Abnahme gegen ein verbundenes Supabase-Projekt (Upload/Vorschau/signierte URLs,
  CSV-Download, Offline-Start/Cache/Installation/Reconnect/Konflikt-UI).

## AP7 – Release Readiness (2026-07-19)
Umgesetzt: Security Review, HTTP-Sicherheitsheader (CSP Report-Only), Health-Check `/api/health`,
Accessibility-Tests (axe), CI-Härtung (Audit-Gate), Betriebs-/Release-Doku (Backup/Recovery,
Monitoring, Deployment, Releaseprozess, Gates, RC1-Notes), `PROJEKT_WISSEN.md`. Keine neue Migration.
Geprüft (ausführbar): lint/tsc/build, `npm audit` (2 moderate/0 hoch – akzeptiert), Migration
0001–0006 (leer+AP6-Bestand), Smokes 10–13, CSV 12/12, SW-Syntax, Playwright `--list` 26 +
`@public` request-basiert 6/9. Status: **AP7 freigabefähig** im Rahmen der ausführbaren Prüfungen;
Release/Tag/Push benötigen Nutzerfreigabe bzw. Zugangsdaten. Empfohlene Version: `v1.0.0-rc.1`.

## AP8 – GUI-/UX-Finalisierung (2026-07-19)
Umgesetzt (additiv, ohne Fachfunktionsänderung): zentrales Designsystem (Tokens/Primitive),
Dark Mode (Light/Dark/System), theme-fähiges App-Chrome, Skeleton-Ladezustände, Accessibility
(Fokus/aria/Touch/reduced-motion), Safe-Area. Geprüft: lint (0), tsc (0), build (PASS);
AP1–AP7-Regression unverändert grün. Offen: App-Screenshots + visuelle/Screenreader-Feinabnahme
(benötigen Browser + Test-Supabase). Details: `04-UI-UX/GUI.md`, `04-UI-UX/DESIGNSYSTEM.md`.

## Aktueller Stand 2026-07-26

- **AP9** – Stammdatenverwaltung: abgeschlossen, Commit `008f648`.
- **AP10** – Stammdaten in die Vorgangsanlage integriert: abgeschlossen, Commit `156e43f`.
- **AP11** – Operative Vorgangsliste: abgeschlossen, Commit `1b8d071`.
- **Git:** AP9–AP11 wurden am 2026-07-26 nach GitHub gepusht; funktionaler AP11-Stand ist
  `1b8d071`. `main` und `origin/main` sind synchron und enthalten zusätzlich die
  nachfolgenden Dokumentations-Commits.
- **Sicherung:** vollständige, hashidentisch geprüfte Dateisystemkopie unter
  `C:\Backup\Kabelbereitschaft_2026-07-25_191847`; verifiziertes Git-Bundle unter
  `C:\Backup\kabelbereitschaft_main_2026-07-26.bundle`.
- **Repository-Stabilisierung:** Die verwaisten `index.lock` und `HEAD.lock` wurden
  wiederherstellbar nach
  `C:\Backup\Kabelbereitschaft_Lockquarantaene_2026-07-26_093108` verschoben.
  `git status` und `git fsck --connectivity-only` sind anschließend ohne Korruptionsbefund
  durchgelaufen; die übrigen `.git`-Altlasten wurden nicht verändert.
- **Roadmap:** AP12–AP15 sind in
  `00-Projektsteuerung/ROADMAP_AP12_AP15_ENTWURF.md` geplant. AP12 wurde von Dennis am
  2026-07-27 ausdrücklich zur Implementierung freigegeben.
- **Produktionssperre:** V1 (Aufbewahrungsfristen für Personen-, EXIF-/GPS- und Auditdaten)
  ist offen. Bis zur Entscheidung sind ausschließlich synthetische Stage-/Testdaten zulässig.
- **Branding:** AP8.1 ist separat als Commit `04253a2` auf
  `feat/ap8.1-branding` gesichert und nach erfolgreicher TypeScript-, ESLint- und
  Produktions-Build-Prüfung nach GitHub gepusht.
- **Arbeitsort (Entscheidung Dennis, 2026-07-26):** **Führend und alleiniger Projekt- und
  Arbeitsort ist dieser Kabelbereitschaft-Vault**
  `C:\Users\DennisKühnhold\OneDrive - W & S Technik GmbH\Kabelbereitschaft-App\Kabelbereitschaft-App`.
  Die frühere Festlegung auf den Clone `C:\dev\Kabelbereitschaft` ist ausdrücklich aufgehoben.
- **Repository-Stand:** `main` und `origin/main` sind synchron; die Standortkorrektur ist seit
  Commit `efdadfb` enthalten. Der Branding-Branch
  `feat/ap8.1-branding` steht lokal und remote auf `04253a2` und ist **nicht** nach `main`
  gemergt. Die Arbeitskopie ist nach der Windows-Reparatur des unvollständigen Checkouts sauber;
  einzige bewusste Ausnahme ist die unveränderte Benutzerdatei `Willkommen.md`.
- **Vorübergehender Clone:** `C:\dev\Kabelbereitschaft` wurde nach vollständiger Kontrolle und
  dem Nachweis, dass dort keine einzigartige relevante Projektdatei lag, am 2026-07-26 in den
  Windows-Papierkorb verschoben. `C:\dev` selbst blieb bestehen.
- **AP12-Start:** Alle acht technischen Punkte der Checkliste B.8 sind abgeschlossen; die
  Implementierungsfreigabe wurde am 2026-07-27 erteilt.

## AP12 – Umsetzung (2026-07-27)

- Implementiert: Migration `0010_ap12_incident_details.sql`, versionierte
  `create_incident_ap12`-/`update_incident_ap12`-RPCs und Entzug des AP10-Schreibaltpfads.
- Implementiert: mehrere Kabelpositionen je Vorgang mit `quantity_value`,
  `quantity_unit` (`piece`/`meter`) und `condition_code`.
- Implementiert: Kontakt-FK, historischer Snapshot und auf zugewiesene Vorgänge begrenzte
  Monteur-Projektion ohne Kontaktliste.
- Implementiert: überarbeitete Vorgangsformulare/-detailseite und Staff-CRUD für
  Bereitschaftsnummern.
- Verifiziert: TypeScript ohne Fehler, ESLint ohne Befund, Next.js-Produktions-Build
  erfolgreich einschließlich Route `/stammdaten/bereitschaftsnummern`.
- Verifiziert: `app/supabase/test/run_ap12_local.ps1` hat die Migrationen 0001–0010 in
  einer temporären lokalen PostgreSQL-18-Datenbank sowie sämtliche AP10–AP12-Smoke-Tests
  erfolgreich ausgeführt. Datenregeln, Snapshot-Historisierung, RLS/Monteur-Projektion,
  Staff-CRUD und der Entzug des AP10-Schreibaltpfads sind nachgewiesen. Die Testdatenbank
  wurde anschließend entfernt.
- **AP12 ist technisch abgeschlossen.** V1 bleibt davon unabhängig Produktionssperre.

## AP13 – Umsetzung (2026-07-28)

- **Status: technisch abgeschlossen.** Commit, Push und grüner CI-Nachweis liegen vor.
- Implementiert: Aufgabenmodell `incident_tasks` mit persistierten Ableitungen, minimierter
  Monteur-Sicht sowie auditierbare Massenaktionen für Statusänderung und Monteurzuweisung
  (Migration `0011_ap13_tasks_bulk.sql`).
- Verifiziert: TypeScript ohne Fehler, ESLint ohne Befund, Next.js-Produktions-Build erfolgreich.
- Verifiziert: lokaler Datenbanklauf mit Migration `0011` und den Smokes 15–18 erfolgreich,
  einschließlich E20a–E20c (Quittierung bleibt bei fortbestehender Ursache, `void` mit geleerten
  Quittierungsfeldern bei entfallener Ursache, Wiederöffnung bei Wiederauftreten) und E21a–E21c
  (kein frei nutzbarer Informationszugriff auf den Aufgabenstatus). Temporäre Testdatenbank
  anschließend entfernt.
- Verifiziert: GitHub-CI-Lauf `30376903965` mit Ergebnis `success` (https://github.com/DKuehnhold/Kabelbereitschaft/actions/runs/30376903965) auf
  `main` = `origin/main` = `5c60031`. Produktions-Audit erfolgreich, Playwright Chromium
  installiert, alle 11 öffentlichen E2E-/a11y-Tests erfolgreich. Arbeitskopie sauber.
- Commits: AP13 `76d93ca`, Abhängigkeitskorrektur `e102532`, PWA-Korrektur `5c60031`.
- **PWA-Korrektur:** Der Reload beim ersten Service-Worker-Controllerwechsel entfällt; ein
  Reload erfolgt nur, wenn die Seite zuvor bereits kontrolliert war. Die axe-core-Prüfungen
  auf `/login` und `/offline` sind damit ohne Testabschaltung grün.
- Einzelheiten: `PROJEKT_WISSEN.md` (Abschnitt „AP13 – Umsetzung") und
  `00-Projektsteuerung/ROADMAP_AP12_AP15_ENTWURF.md` (B.3, Version 1.15).
- **Nächstes Arbeitspaket: AP14** (reale Supabase-, Browser-, Offline-, Sicherheits- und
  Betriebsabnahme).
- V1 bleibt Produktionssperre; Branding bleibt separat auf `feat/ap8.1-branding` (`04253a2`)
  und ist nicht gemergt; **kein RC1-Tag.**
