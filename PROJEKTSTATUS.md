# Projektstatus – Kabelbereitschaft

> **FÜHRENDES DOKUMENT (Projektstatus).** Kennzeichnung vom 2026-07-26 gemäß Auflage vor AP12
> (`00-Projektsteuerung/ROADMAP_AP12_AP15_ENTWURF.md`, B.1/B.8). Abgelöste Dublette:
> `00-Projektsteuerung/PROJEKTSTATUS.md` (als historisch markiert, nicht gelöscht).
> Endgültige Konsolidierung und Archivierung erfolgen in AP15.
> Stand: 2026-07-30

> **Aktueller Stand (2026-07-30).** Zielplattform bleibt ADR-011: PostgreSQL 18, Auth.js v5, MinIO
> und Containerbetrieb hinter dem internen Reverse-Proxy; Supabase ist kein Ziel. Der gemergte
> Auth.js/PostgreSQL-Stand auf `main` `22db6dad8958146be4de667a55e89ba170e73b7c` ist bestätigt; die
> weiter unten mit „2026-07-28“ datierten AP14/B-Angaben beschreiben den Stand jenes Tages, sind in
> diesem Merge enthalten und behalten ihre historischen Prüfnachweise unverändert. Nächstes
> nicht-visuelles Fachpaket ist AP14B `data-incidents-tasks-sync`: Ablösung der verbliebenen
> Supabase-Zugriffe in Vorgängen, Aufgaben und Offline-Sync durch PostgreSQL/RLS. V1 bleibt
> Produktionssperre, Branding bleibt separat, GUI-/Designarbeit wartet auf Dennis.

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
- **AP7** – Vorschläge (Stand 2026-07-19, teilweise überholt): authentifizierte CI-E2E gegen die
  interne PostgreSQL-/Auth.js-Testumgebung mit synthetischen Daten scharfschalten (die frühere
  Idee einer Test-Supabase ist durch ADR-011 aufgehoben); Middleware→Proxy mit E2E (der Proxy ist
  mit AP14/B umgesetzt); Push/Release; WebCrypto/Background-Sync.
- **AP14/A** – interne Plattform- und CI-Grundlage: technisch verifiziert auf
  `feat/ap14-docker-postgres-ci` (Commits `8ec9731`, `761ff23`, PR #1).
  GitHub-CI-Lauf `30380208864` vollständig grün: Anwendung, PostgreSQL-18-Smokes
  und echter Containerbau einschließlich Startschutz, Compose, Hadolint und Trivy.
  **AP14/B – Auth-Basis ist gemergt** (siehe folgender Punkt). **Offen bleibt aus AP14/B nur
  noch die Ablösung der Datenmodule:** Vorgänge, Aufgaben und Offline-Sync
  (AP14B `data-incidents-tasks-sync`) nach PostgreSQL/RLS gemäß ADR-011.
  Kein Deployment; IT-Zielparameter fehlen noch.
- **AP14/B – Auth-Basis:** implementiert, lokal vollständig verifiziert und inzwischen auf `main`
  gemergt, Stand `22db6dad8958146be4de667a55e89ba170e73b7c` (2026-07-30). Auth.js v5 mit
  Credentials-Provider, Argon2id, transaktionslokaler Benutzer-ID, serverseitig
  widerrufbaren `auth_sessions`,
  kurzen verschlüsselten JWTs (nur `sub`/`sid`) und Next-16-`proxy.ts` statt der
  Supabase-Middleware. Migration `0012` um drei Blocker korrigiert
  (`auth_accounts.updated_by`, `grant select on public.profiles to app_user`,
  Widerrufs-Audittrigger). Nachgewiesen (Stand **vor** der Routensperre, siehe die aktuellen
  Zahlen weiter unten): TypeScript, ESLint und Produktions-Build je Exit 0;
  25/25 Einheitentests; 19/19 Integrationstests des Anwendungscodes; Migrationen 0001–0013 mit
  Smokes AP10–AP13 und AP14/B P1–P17 erfolgreich; vollständiger Anmelde-/Abmeldelauf gegen
  echte PostgreSQL 18 mit nicht privilegierter Rolle (10 Szenarien);
  Playwright `@public` 18/18 in echtem Chromium.
  **Sechs Reviewfeststellungen korrigiert (2026-07-28):** Mehrfachanweisungssperre über
  erzwungenes Extended-Query-Protokoll, Einzelwiderruf nur der eigenen Sitzung, fail-closed
  gehärteter Massenwiderruf mit Adminbestätigung aus der Datenbank, Bootstrap des ersten
  Administrators mit verdeckter Kennworteingabe, korrigierte Mengenangaben sowie Entfernen der
  Sitzungs-ID aus der Antwort von `/api/auth/session`.
  **Erzwungener Passwortwechsel umgesetzt (2026-07-28, inzwischen auf `main` gemergt):** Ein Konto mit
  `must_change_password = true` erreicht serverseitig nur noch `/passwort-aendern`, die
  Auth-Endpunkte und die Abmeldung. Die Sperre liegt in `lib/auth.ts` – `getSessionProfile()`
  liefert NULL und `requireSession()` leitet um –, nicht in einer Client-Komponente; der
  Proxy ist nur die grobe Weiche über die pure Funktion `evaluateAccess()`. Der Wechsel
  verlangt aktuelles Passwort, neues Passwort und Bestätigung, nutzt die zentrale
  Argon2id-Implementierung und dieselben zentralen Passwortregeln wie das Bootstrap-Werkzeug,
  setzt Hash, `password_hash_version`, `must_change_password = false` und
  `password_changed_at` und widerruft in derselben Transaktion alle Sitzungen des Kontos;
  danach ist eine erneute Anmeldung zwingend. Migration `0012` um Spalte
  `password_changed_at` und Wechsel-Audittrigger ergänzt. Die Browser-Sitzungsfilterung ist
  fail-closed: eine nicht auswertbare Antwort des Session-Endpunkts wird durch den neutralen
  Rumpf `null` ersetzt, Status und alle `Set-Cookie`-Zeilen bleiben erhalten. Keine neue
  Gestaltung: Karte, Felder und Hinweiskasten sind von der Anmeldeseite übernommen.
  Nachgewiesen: TypeScript, ESLint und Produktions-Build je Exit 0 (Route
  `ƒ /passwort-aendern` registriert); **41/41** Einheitentests; **30/30** Integrationstests
  gegen echtes PostgreSQL 18; Migrationen 0001–0013 mit Smokes AP10–AP13 und AP14/B
  **P1–P19** erfolgreich; Playwright `@public` **21/21** in echtem Chromium; zusätzlich ein
  **HTTP-Nachweis zu ADR-011/2.12(e)** gegen laufenden Produktionsserver und temporäres
  PostgreSQL-Cluster mit 16 erfolgreichen Prüfungen (alle 13 geschützten Seiten und alle 3
  geschützten APIs gesperrt). Temporäres Cluster, temporärer Server und Hilfsdateien wurden
  entfernt; der vorhandene Dienst blieb unangetastet.
  **Offen:** Rechtematrix der Fachtabellen, MinIO-Bildspeicher, administrative
  Benutzerverwaltung (Reset, Deaktivierung, Rollenwechsel) als eigenes Arbeitspaket.
  Einzelheiten: `PROJEKT_WISSEN.md`, Abschnitt „AP14/B — Auth-Basis".

## Git / Push (VERALTET — siehe „Aktueller Stand 2026-07-26" am Dateiende)
> Der folgende Absatz beschreibt den Stand vom 2026-07-19 und ist überholt.
Lokaler `main` ist Remote (`origin/main` = `8d83371`) voraus: **AP4, AP5, AP6 sind noch nicht
gepusht** (kein Git-Zugang in der Build-Umgebung). Push durch den Nutzer erforderlich.

## Offen
- Manuelle UI-/Browser-Abnahme: öffentliche Browsertests laufen lokal und in der CI ohne externes
  Backend; die authentifizierte Abnahme (Upload/Vorschau/geschützter Bildabruf, CSV-Download,
  Offline-Start/Cache/Installation/Reconnect/Konflikt-UI) folgt später gegen die interne
  PostgreSQL-/Auth.js-Testumgebung mit synthetischen Daten. Keine Supabase-Stage und kein
  Supabase-Zugang sind zu beschaffen.

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
(benötigen Browser + interne PostgreSQL-/Auth.js-Testumgebung mit synthetischen Daten).
Details: `04-UI-UX/GUI.md`, `04-UI-UX/DESIGNSYSTEM.md`.

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
- **Nächstes nicht-visuelles Fachpaket: AP14B `data-incidents-tasks-sync`** (Ablösung der
  verbliebenen Supabase-Zugriffe in Vorgängen, Aufgaben und Offline-Sync durch PostgreSQL/RLS).
- V1 bleibt Produktionssperre; Branding bleibt separat auf `feat/ap8.1-branding` (`04253a2`)
  und ist nicht gemergt; **kein RC1-Tag.**
