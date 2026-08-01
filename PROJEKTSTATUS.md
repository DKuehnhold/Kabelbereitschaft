# Projektstatus – Kabelbereitschaft

> **FÜHRENDES DOKUMENT (Projektstatus).** Kennzeichnung vom 2026-07-26 gemäß Auflage vor AP12
> (`00-Projektsteuerung/ROADMAP_AP12_AP15_ENTWURF.md`, B.1/B.8). Abgelöste Dublette:
> `00-Projektsteuerung/PROJEKTSTATUS.md` (als historisch markiert, nicht gelöscht).
> Endgültige Konsolidierung und Archivierung erfolgen in AP15.
> Stand: 2026-08-01

> **Aktueller Stand (2026-08-01).** Zielplattform bleibt ADR-011: PostgreSQL 18, Auth.js v5, MinIO
> und Containerbetrieb hinter dem internen Reverse-Proxy; Supabase ist kein Ziel. Bestätigter
> Technischer Referenzstand vor diesem Dokumentationsabschluss ist
> `cbe17b3c1bf9118ae3b36ef85353cce46aa7d8c9`
> (`fix(ci): verify MinIO private anonymous state`) über dem fachlichen Commit
> `edfafb482f6d4d95e69bd99e9b28c54ef7d92a87` (`feat: migrate incident images to MinIO`);
> Pull Request #5 ist geschlossen und gemergt. Die früheren Stände
> `79d88449f9e481b1148f902e175f46f9d07ef35d` und `22db6dad8958146be4de667a55e89ba170e73b7c` sind
> Vorfahren und damit überholt. Die Datenpfade für Vorgänge, Aufgaben und Offline-Sync, für
> Stammdaten und Inventar sowie für Bilder und Uploads sind auf PostgreSQL 18 und den privaten
> MinIO-Objektspeicher migriert und gemergt; der echte MinIO-Nachweis liegt mit dem CI-Job
> `objectstore` vor (PR-Lauf `30691249168`, main-Lauf `30692250157`, Container-Image
> `30692250154`, je `completed/success`). Die weiter unten mit „2026-07-28“ datierten
> AP14/B-Angaben beschreiben den Stand jenes Tages, sind in diesen Merges enthalten und behalten
> ihre historischen Prüfnachweise unverändert. **AP14 insgesamt bleibt offen:** echte IT-Adressen
> und die Same-Origin-Route am internen Reverse-Proxy, produktiver Betrieb und Deployment, die
> vollständige `@app`-/Offline-Abnahme und die CSP-Auswertung sind nicht erbracht. Nächster
> nicht-visueller Arbeitsblock ist die administrative Benutzerverwaltung nach ADR-011 (Reset mit
> temporärem Passwort und `must_change_password`, Deaktivierung, Rollenwechsel, jeweils mit
> Sitzungswiderruf und Audit). V1 bleibt
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
  **AP14/B – Auth-Basis ist gemergt** (siehe folgender Punkt). **Stand 2026-07-31:** auch die
  Datenpfade für Vorgänge, Aufgaben und Offline-Sync (AP14B `data-incidents-tasks-sync`) sind
  gemäß ADR-011 auf PostgreSQL/RLS umgestellt und mit Commit `6b9d8dd` gemergt (siehe Abschnitt
  „AP14/B – Datenpfade"). **Stand 2026-08-01:** ebenso sind Stammdaten und Inventar umgestellt und
  mit Commit `79d8844` gemergt (siehe Abschnitt „AP14/B – Datenpfade Stammdaten und Inventar").
  **Ebenfalls 2026-08-01:** auch Bilder und Uploads sind auf den MinIO-Objektspeicher umgestellt und
  mit Commit `edfafb4` gemergt (siehe Abschnitt „AP14/B – Bilder und Uploads auf MinIO"); damit
  sind die AP14/B-Datenpfade technisch abgeschlossen.
  Kein Deployment; IT-Zielparameter fehlen noch. AP14 insgesamt ist nicht abgeschlossen:
  echte IT-Adressen und Same-Origin-Reverse-Proxy, produktiver Betrieb und Deployment, die
  vollständige `@app`-/Offline-Abnahme sowie die CSP-Auswertung stehen aus.
- **AP14/B – Auth-Basis:** implementiert, lokal vollständig verifiziert und inzwischen auf `main`
  gemergt, Stand `22db6dad8958146be4de667a55e89ba170e73b7c` (2026-07-30; inzwischen Vorfahre des
  aktuellen Stands `cbe17b3`). Auth.js v5 mit
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
  **Stand 2026-08-01:** die Rechtematrix der Fachtabellen ist vollständig geliefert — für
  Vorgänge, Aufgaben und Offline-Sync mit Migration `0014_ap14b_data_grants.sql`, für
  Stammdaten und Inventar mit `0015_ap14b_masterdata_inventory_grants.sql` und für Bilder und
  Uploads mit `0016_ap14b_image_grants.sql`; der MinIO-Bildspeicher ist umgesetzt und gemergt.
  **Offen bleibt** die administrative Benutzerverwaltung nach ADR-011 (Reset mit temporärem
  Passwort und `must_change_password`, Deaktivierung, Rollenwechsel, jeweils mit Sitzungswiderruf
  und Audit) als eigenes Arbeitspaket.
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
- **Nächstes nicht-visuelles Fachpaket war AP14B `data-incidents-tasks-sync`** (Ablösung der
  verbliebenen Supabase-Zugriffe in Vorgängen, Aufgaben und Offline-Sync durch PostgreSQL/RLS);
  seit 2026-07-31 gemergt — siehe Abschnitt „AP14/B – Datenpfade (2026-07-31)".
- V1 bleibt Produktionssperre; Branding bleibt separat auf `feat/ap8.1-branding` (`04253a2`)
  und ist nicht gemergt; **kein RC1-Tag.**

## AP14/B – Datenpfade (2026-07-31)

- **Status: technisch abgeschlossen und gemergt.** Commit
  `6b9d8dd7b4b937b3a2cb055b509557ed17313430` (`feat: migrate incident and task data paths to
  PostgreSQL`), 18 Dateien, +4422/-583. Dieser Commit war am 2026-07-31 die Spitze von `main`;
  danach folgten am 2026-08-01 `79d8844` (folgender Abschnitt) und `edfafb4`/`cbe17b3` für Bilder
  und Uploads. Aktueller Stand ist `cbe17b3`.
- Umgestellt sind die Datenpfade für Vorgänge, Aufgaben und Offline-Sync (u. a. `incidents.ts`,
  `incident-actions.ts`, `incident-list-actions.ts`, `tasks.ts`, `task-actions.ts`,
  `db/pg-errors.ts`, `/api/sync`, `/api/incidents/[id]/meta`), Migration
  `0014_ap14b_data_grants.sql` sowie die Smokes `19a_ap14b_grant_reset.sql` und `20_ap14b_data.sql`.
- **Rechtematrix `0014`:** Rechte ausschließlich an `app_user`, kein Grant an `public`, `anon` oder
  `authenticated`, eng geschnittene Schreibrechte, kein Recht auf `audit_events`, ein `revoke` auf
  `refresh_incident_tasks_ap13`, vier fail-closed Prüfblöcke (zwei Positiv-, zwei
  Negativprüfungen); nur Rechte geändert, RLS-Policies und
  Zeilensichtbarkeit unverändert.
- **Transaktionsabsicherung:** alle Pfade über `withUserTransaction()` mit der Identität aus
  `getSessionProfile()`, mehrschrittige Aktionen in einer Transaktion, `/api/sync` bewusst je
  Eintrag; Konflikterkennung über `updated_at`, Idempotenz über `(actor, client_action_id)`,
  Fehlerabbildung ausschließlich über SQLSTATE.
- **Verifiziert lokal:** PostgreSQL-18-Gesamtlauf mit Exitcode 0 (Migrationen 0001–0014, Smokes
  15–20 einschließlich 19a, 30/30 Node-Integrationstests, R1/R2/D13/D26/D27 grün, Bereinigung
  belegt). **Unabhängig durch Codex wiederholt:** TypeScript 0, ESLint 0, 41/41 Einheitentests,
  Produktions-Build 0, `git diff --check` 0. **Durch Codex bestätigte Push-Läufe zu `6b9d8dd`:**
  CI-Lauf `30635566629` completed/success, Container-Image-Lauf `30635566645` completed/success.
- **Grenze:** Bilder und Uploads laufen weiterhin über Supabase; Stammdaten und Inventar sind mit
  dem folgenden Abschnitt umgestellt und gemergt. AP14 insgesamt ist **nicht** abgeschlossen
  (Browser-/Offline-Abnahme, CSP-Durchsetzung, MinIO, Betrieb/Deployment), es gibt **kein** Tag,
  **kein** Release und keine V1-Freigabe.
- **Nächster nicht-visueller Arbeitsblock:** Ablösung der verbliebenen Supabase-Datenpfade in
  Bildern und Uploads mit dem MinIO-Bildspeicher. **GUI-/Designarbeit wartet weiter auf Dennis.**
- Offen bleiben außerdem die Rechtematrix für Bilder und Uploads, der MinIO-Bildspeicher, die
  administrative Benutzerverwaltung (Reset, Deaktivierung, Rollenwechsel), AP15 und V1 als
  Produktionssperre.
- **Nachtrag 2026-08-01:** Rechtematrix und MinIO-Bildspeicher sind mit Commit `edfafb4` geliefert
  und gemergt; siehe Abschnitt „AP14/B – Bilder und Uploads auf MinIO (2026-08-01)".
- Einzelheiten: `PROJEKT_WISSEN.md` (Abschnitt „AP14/B — Datenpfade Vorgänge, Aufgaben,
  Offline-Sync") und `00-Projektsteuerung/ROADMAP_AP12_AP15_ENTWURF.md` (B.4, Version 1.17).

## AP14/B – Datenpfade Stammdaten und Inventar (2026-08-01)

- **Status: technisch abgeschlossen und gemergt.** Commit
  `79d88449f9e481b1148f902e175f46f9d07ef35d` (`feat: migrate masterdata and inventory to
  PostgreSQL`), 14 Dateien, +6021/-478; Fast-Forward von
  `cb8bb888280b5509ae2c273789183767e3b7b4db` mit genau einem Commit Abstand, ohne Merge-Commit und
  ohne Force-Push. Zum damaligen Zeitpunkt standen `main`, `origin/main` sowie der lokale und der
  remote Feature-Branch `feat/ap14b-data-masterdata-inventory` auf demselben Commit; `main` steht
  inzwischen auf `cbe17b3`.
- Umgestellt sind `lib/masterdata.ts`, `masterdata-actions.ts`, `inventory.ts` und
  `inventory-actions.ts` — in allen vier Dateien null Supabase-Importe und null
  `supabase.`-Zugriffe. Neu sind Migration `0015_ap14b_masterdata_inventory_grants.sql`, der Smoke
  `21_ap14b_masterdata_inventory.sql` und der Integrationstest
  `app/test/integration/ap14b-masterdata-inventory.int.mjs` mit `module-hooks-app.mjs` und zwei
  Stubs; die Runner `run_ap14b_local.ps1` und `run_db_tests.sh` sind um `0015` und Smoke 21
  erweitert.
- **Rechtematrix `0015`:** 16 `grant`-Anweisungen, alle ausschließlich an `app_user`, kein `revoke`
  und keine DDL. Nur `insert`/`update` auf den **sieben** Tabellen `on_call_numbers`, `customers`,
  `construction_stages`, `vzg_lines`, `contacts`, `cable_types` und `app_settings` (Leserecht
  bereits aus `0014`; bei `app_settings` Singleton-Upsert statt `is_active`-Deaktivierung);
  `select`/`insert`/`update` auf `technicians` und `teams`, wo das Leserecht **neu** ist, weil
  `0014` dort kein Recht erteilt; `insert`/`delete` auf `contact_phone_numbers` (dessen `select`
  besteht aus `0014`) sowie `select`/`insert`/`delete` auf `construction_stage_contacts` und
  `team_members` mit hier erstmals erteiltem Leserecht — alle drei Zuordnungstabellen ohne
  `update`; im Inventar `select`/`insert`/`update` auf `materials` und `storage_locations` (kein
  `delete`), `select` auf der Bestands-View `material_stock` und `select`/`insert` auf
  `inventory_movements` (kein `update`, kein `delete`). Kein Grant an `public`, `anon` oder
  `authenticated`, kein Recht auf `audit_events`. Vier fail-closed `do`-Blöcke: ein Positivblock
  über 40 Objekt/Recht-Paare (drei davon nur als Wächter über Rechte, die schon aus `0012`/`0014`
  stammen — direkte Vergaben, keine Rollenvererbung) und drei Negativblöcke (19 verweigerte
  Tabellenrechte, die sieben klassischen Tabellenprivilegien auf `audit_events`, `app_user` ohne
  `SUPERUSER` und ohne `BYPASSRLS`).
- **Transaktionsabsicherung:** alle Lese- und Schreibpfade über `withUserTransaction()` mit der
  Identität aus `getSessionProfile()`; `saveContact`, `saveTeam` und die vier Buchungswege je in
  einer Transaktion; SQL durchgängig parametrisiert; Fehlerabbildung ausschließlich über SQLSTATE.
- **Drei Reviewkorrekturen:** F1 — `createMovement()` entscheidet über eine ausdrückliche Allowlist
  (`admin`, `disponent`) statt über eine Verbotsliste. F2 — der Rückfall auf die Einheit `Stk` bei
  fehlender Materialzeile ist entfallen, alle vier Buchungswege brechen fail-closed vor dem Insert
  ab. F3 — Entnahme, Rückgabe und Verbrauch sperren die RLS-sichtbare Vorgangszeile mit
  `for update` **vor** Prüfung und Insert; die Sperre wirkt nur innerhalb desselben Vorgangs, die
  verbleibende Lücke und die Voraussetzung `READ COMMITTED` sind in `PROJEKT_WISSEN.md` benannt.
- **Verifiziert lokal (von Claude selbst erhoben):** vollständiger PostgreSQL-18-Lauf mit
  Prozess-Exitcode 0 (Migrationen `0001`–`0015`, Smokes 15–21 einschließlich 19a, 30/30
  Plattform- und 31/31 Stammdaten-/Inventar-Integrationstests, Bereinigung belegt).
  **Unabhängig durch Codex erhoben:** TypeScript 0, ESLint 0, 41/41 Einheitentests,
  Produktions-Build 0, `git diff --check` 0 sowie ein eigener vollständiger PostgreSQL-18-Lauf
  Exit 0 mit denselben Mengen einschließlich Rollen-Allowlist, fehlendem Material, fremdem Vorgang
  und echter Parallelrückgabe; temporäres Cluster, Datenbank, Rolle, Port und Arbeitsverzeichnis
  entfernt, der vorhandene Dienst unverändert. **Durch Codex bestätigte Push-Läufe zu `79d8844`:**
  CI-Lauf `30677465341` completed/success, Container-Image-Lauf `30677465340` completed/success
  (`gh` ist auf diesem Rechner nicht installiert; Claude konnte sie nicht selbst abrufen).
- **Grenze:** Supabase bleibt ausschließlich für Bilder und Uploads sowie die dafür benötigten
  Clientdateien und Pakete in Betrieb (`lib/images-server.ts`, `lib/image-upload-core.ts`,
  `lib/image-actions.ts`, `app/api/images/upload/route.ts`, `lib/supabase/client.ts`,
  `lib/supabase/server.ts`, `lib/supabase/config.ts`, `lib/database.types.ts`, Pakete
  `@supabase/ssr` und `@supabase/supabase-js`); CSP/`connect-src` nennen weiterhin Supabase.
  **AP14 insgesamt ist nicht abgeschlossen** (Browser-/Offline-Abnahme, CSP-Durchsetzung, MinIO,
  Betrieb/Deployment); **RC1 ist nicht abgeschlossen**, es gibt **kein** Tag, **kein** Release und
  keine V1-Freigabe. Branding bleibt separat auf `feat/ap8.1-branding` (`04253a2`, ungemergt),
  GUI-/Designarbeit wartet auf Dennis.
  **Nachtrag 2026-08-01:** diese Grenze ist mit Commit `edfafb4` aufgehoben — Bilder und Uploads
  laufen über MinIO, die Supabase-Clientdateien und beide Pakete sind entfernt, CSP/`connect-src`
  nennen Supabase nicht mehr; siehe folgenden Abschnitt.
- Einzelheiten: `PROJEKT_WISSEN.md` (Abschnitt „AP14/B — Datenpfade Stammdaten und Inventar") und
  `00-Projektsteuerung/ROADMAP_AP12_AP15_ENTWURF.md` (B.4, Version 1.18).

## AP14/B – Bilder und Uploads auf MinIO (2026-08-01)

- **Status: technisch abgeschlossen und gemergt.** Fachlicher Commit
  `edfafb482f6d4d95e69bd99e9b28c54ef7d92a87` (`feat: migrate incident images to MinIO`),
  CI-Korrektur `cbe17b3c1bf9118ae3b36ef85353cce46aa7d8c9`
  (`fix(ci): verify MinIO private anonymous state`); `main` = `origin/main` = `cbe17b3`.
  Pull Request #5 ist geschlossen und gemergt. Arbeitsbaum sauber.
- Umgestellt sind Bilder und Uploads auf PostgreSQL 18 mit RLS und einen privaten
  MinIO-/S3-Objektspeicher; die Supabase-Clientdateien und die Pakete `@supabase/ssr` und
  `@supabase/supabase-js` sind entfernt, CSP/`connect-src` nennen Supabase nicht mehr. Neu sind
  die Rechtematrix `0016_ap14b_image_grants.sql` mit spaltenbezogenem `update`, der Smoke
  `22_ap14b_images.sql` und der CI-Job `objectstore`.
- **Echter MinIO-Nachweis erbracht:** PR-CI-Lauf `30691249168` mit `verify`, `database`,
  `container` und `objectstore` je `completed/success`; `objectstore` läuft gegen einen echten
  MinIO-Container. Abschließende main-Läufe: CI `30692250157` mit allen vier Jobs
  `completed/success` und Container-Image `30692250154` `completed/success`.
- **Unabhängig durch Codex erhoben:** TypeScript, ESLint, 67 Einheitentests, Produktions-Build und
  21 `@public` Browser-/a11y-Tests; PostgreSQL 18 mit den Migrationen `0001`–`0016`, 103 Smokes
  ohne Fehler sowie die Integrationssuiten 30/30, 31/31 und 37/37; das temporäre Cluster wurde
  vollständig entfernt.
- **Grenze:** die Bucket- und Identitätsprovisionierung ist ein verbindlicher, dokumentierter
  Schritt der internen IT (`deploy/README.md`); ohne sie startet die Anwendung, aber jeder Upload
  scheitert zur Laufzeit. **AP14 insgesamt bleibt offen:** echte IT-Adressen und die
  Same-Origin-Route am internen Reverse-Proxy, produktiver Betrieb und Deployment, die
  vollständige `@app`-/Offline-Abnahme sowie die CSP-Auswertung sind nicht erbracht. **RC1 ist
  nicht abgeschlossen**, es gibt **kein** Tag, **kein** Release und keine V1-Freigabe.
- **Nächstes nicht-visuelles Paket:** administrative Benutzerverwaltung nach ADR-011 — Reset mit
  temporärem Passwort und `must_change_password`, Deaktivierung und Rollenwechsel, jeweils mit
  Widerruf aller Sitzungen des Kontos und Auditeintrag (ADR-011 §2.2 und §2.3). **GUI-/Designarbeit
  wartet weiter auf Dennis.**
- Einzelheiten: `PROJEKT_WISSEN.md` (Abschnitt „AP14/B — Bilder und Uploads auf MinIO") und
  `00-Projektsteuerung/ROADMAP_AP12_AP15_ENTWURF.md` (B.4, Version 1.19).
