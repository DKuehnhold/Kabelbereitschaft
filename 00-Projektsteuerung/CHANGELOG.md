# Changelog

> **FÜHRENDES DOKUMENT (Changelog).** Kennzeichnung vom 2026-07-26 gemäß Auflage vor AP12
> (`00-Projektsteuerung/ROADMAP_AP12_AP15_ENTWURF.md`, B.1/B.8). Abgelöste Dublette:
> `CHANGELOG.md (Repository-Wurzel)` (als historisch markiert, nicht gelöscht).
> Endgültige Konsolidierung und Archivierung erfolgen in AP15.

> **Nachtrag vom 2026-08-03 (AP15-2).** Die folgenden neun Einträge wurden quellentreu aus der Git-Historie sowie aus
> `PROJEKTSTATUS.md` und `PROJEKT_WISSEN.md` nachgetragen; die darunter stehende Historie ist unverändert.
> Der Block ist neueste zuerst sortiert; dadurch stehen AP12 (2026-07-27) und AP13 (2026-07-28) oberhalb des
> älteren Bestandseintrags zu AP14 / Arbeitspaket A — Folge der Append-only-Auflage, keine Neudatierung.
> Es existiert kein Git-Tag, kein Release und keine V1-Freigabe.

## [Nachgetragen] – 2026-08-03 – AP15-1: RLS-gebundene Dashboard-Statuskennzahlen

### Hinzugefügt
- `app/src/lib/incident-metrics.ts`, Tests `app/test/ap15-incident-metrics.test.mjs` und
  `app/test/integration/ap15-dashboard-metrics.int.mjs`, Smoke
  `app/supabase/test/24_ap15_dashboard_metrics.sql`; beide Runner (`run_ap14b_local.ps1`,
  `run_db_tests.sh`) ergänzt.

### Geändert
- `app/src/app/(app)/dashboard/page.tsx`: die fünf statusbasierten Dashboardkennzahlen werden in einer
  identitätsgebundenen, parametrisierten Abfrage über `public.incident_list_view` berechnet. Keine Migration,
  kein neues Recht, kein `SECURITY DEFINER`, keine zweite Terminalstatusliste; die Migrationskette endet
  unverändert bei `0017`. Sichtbare Oberfläche, Tageskennzahlen, Listen und `/meine-einsaetze` blieben unverändert.
- Fachcommit `8b65f4e` (`8b65f4ed9c1175ddec3aca5045a5a59906b95c68`, „feat: add RLS-bound dashboard status
  metrics"), 9 Dateien, +2505/-23; Dokumentationscommit `f35a354` („docs: record AP15-1 architecture gate").

### Nachweise
- CI `30800335370` mit `verify`, `database`, `container` und `objectstore` sowie Container-Image `30800335380`
  je `completed/success`.
- Codex-Gate: TypeScript und ESLint je Exit 0, 97/97 Einheitentests, Produktions-Build Exit 0,
  `git diff --check` Exit 0, vollständiger PostgreSQL-18-Lauf mit Migrationen `0001`–`0017`, Smokes `15`–`24`
  und 141/141 Integrationsfällen bei `skipped 0`.

### Offen
- Semantik von `fehlalarm`, Datumsherkunft der Tageskennzahlen, Vollmengen-Reads der Listen, drei getrennte
  Transaktionen der Filteroptionen, sichtbare Dashboardgestaltung.

## [Nachgetragen] – 2026-08-02 – AP14/B: administrative Benutzerverwaltung (Backend)

### Hinzugefügt
- Migration `0017_ap14b_admin_user_management.sql`, Modul `app/src/lib/admin-users.ts`, Smoke
  `23_ap14b_admin_users.sql`, Integrationstest `app/test/integration/ap14b-admin-users.int.mjs` mit den
  Fällen V1–V31.
- Passwort-Reset mit temporärem Passwort und `must_change_password`, Deaktivierung und Reaktivierung,
  Rollenwechsel; die Zielsitzungen werden transaktional widerrufen und erzeugen Auditereignisse. `0017`
  enthält spaltenbezogenes `update` auf `role`, vier Audittrigger, den race-sicheren Schutz des letzten
  aktiven Administrators, den Entzug des `delete`-Rechts auf `auth_accounts` und zwei `BEFORE UPDATE`-Wächter
  mit SQLSTATE `KB003`.
- Fachcommit `47c0521` („feat: add audited administrative user management"); Testnachträge `efb7d02`,
  `6f29447`, `62ab167`, `530a1f0`; Dokumentationscommits `82c4167` und `a86d7a6`.

### Geändert
- Der Wettlauftest V24 akzeptiert ausschließlich den exakt belegten `pg`-`DatabaseError` mit Name, Code
  `KB003` und zeichengenauer Meldung (`530a1f0`); andere SQLSTATEs bleiben rot.

### Nachweise
- CI-Lauf `30790933496` und Container-Image-Lauf `30790933449` je `completed/success` zum Fachstand
  `530a1f0` („test: accept exact fail-closed KB003 race", 2026-08-03 08:39:47 +0200).
- CI-Lauf `30791223313` und Container-Image-Lauf `30791223304` je `completed/success` zum nachfolgenden
  Dokumentationsstand `a86d7a6` („docs: record final AP14B admin CI gate", 2026-08-03 08:45:06 +0200).
- Provenienz: beide Paare gehören zu zwei aufeinanderfolgenden grünen Commitständen — `530a1f0` ist
  Vorfahr von `a86d7a6` (`git merge-base --is-ancestor` Exit 0). Das ist kein Widerspruch. Die
  Laufergebnisse selbst hat Codex über die GitHub-API erhoben und bestätigt; Claude hat sie nicht selbst
  abgerufen. Der Dateistand von `a86d7a6` hält im Text das erste Paar fest; der heutige Kopftext von
  `PROJEKTSTATUS.md` und `PROJEKT_WISSEN.md` nennt keines von beiden, weil `f35a354` den Absatz durch die
  AP15-1-Kennungen ersetzt hat. Die Vorfahrbeziehung, die Commitzeiten, die Commitbetreffe und die beiden
  vorstehenden Aussagen zum Dateistand hat Claude selbst über `git merge-base`, `git log` und `git show`
  erhoben.

### Offen
- Die sichtbare GUI der Benutzerverwaltung wartet auf die Designentscheidung mit Dennis.

## [Nachgetragen] – 2026-08-01 – AP14/B: Bilder und Uploads auf MinIO

### Hinzugefügt
- Migration `0016_ap14b_image_grants.sql` mit spaltenbezogenem `update`, Smoke `22_ap14b_images.sql`,
  CI-Job `objectstore`, Integrationssuiten `app/test/integration/ap14b-images.int.mjs` (lokal) und
  `ap14b-minio-live.int.mjs` (CI).

### Geändert
- Bilder und Uploads laufen auf PostgreSQL 18 mit RLS und einem privaten MinIO-/S3-Objektspeicher. Die
  Supabase-Clientdateien und die Pakete `@supabase/ssr` und `@supabase/supabase-js` sind entfernt; CSP und
  `connect-src` nennen Supabase nicht mehr.
- Fachcommit `edfafb4` („feat: migrate incident images to MinIO"), CI-Korrektur `cbe17b3`
  („fix(ci): verify MinIO private anonymous state"), Dokumentationscommit `880975a`
  („docs: record verified AP14B MinIO migration"); Pull Request #5 gemergt.

### Nachweise
- Echter MinIO-Nachweis im PR-Lauf `30691249168` mit `verify`, `database`, `container` und `objectstore`
  je `completed/success`; abschließende main-Läufe CI `30692250157` mit allen vier Jobs und Container-Image
  `30692250154` je `completed/success`.

### Offen
- Die Provisionierung von MinIO-Bucket und Dienstidentität bleibt ein verbindlicher Schritt der internen IT
  und ist nicht erbracht.

## [Nachgetragen] – 2026-08-01 – AP14/B: Stammdaten und Inventar auf PostgreSQL

### Hinzugefügt
- Migration `0015_ap14b_masterdata_inventory_grants.sql`, Smoke `21_ap14b_masterdata_inventory.sql`,
  Integrationstest `app/test/integration/ap14b-masterdata-inventory.int.mjs`.

### Geändert
- Umgestellt sind `masterdata.ts`, `masterdata-actions.ts`, `inventory.ts` und `inventory-actions.ts`.
- Drei Befunde des Codex-Reviews wurden behoben: Rollenprüfung als ausdrückliche Allowlist (`admin`,
  `disponent`) statt Verbotsliste; kein Rückfall auf die Einheit `Stk` bei fehlender Materialzeile;
  Serialisierung der Buchungswege durch `select … for update` auf der Vorgangszeile vor der Prüfung der
  rückgabefähigen Menge.
- Fachcommit `79d8844` („feat: migrate masterdata and inventory to PostgreSQL"), 14 Dateien, +6021/-478;
  Dokumentationscommit `7989ac4` („docs: record verified masterdata inventory migration"). Der Commit ist
  ein Fast-Forward, also ohne Merge-Commit und ohne Force-Push.

### Nachweise
- CI-Lauf `30677465341` und Container-Image-Lauf `30677465340` je `completed/success` — durch Codex bestätigt
  und von Claude nicht selbst abgerufen, weil `gh` auf dem Arbeitsrechner nicht installiert ist.

## [Nachgetragen] – 2026-07-31 – AP14/B: Vorgänge, Aufgaben und Offline-Sync auf PostgreSQL

### Hinzugefügt
- Migration `0014_ap14b_data_grants.sql`, Smokes `19a_ap14b_grant_reset.sql` und `20_ap14b_data.sql`,
  Erweiterung von `18_ap13_tasks.sql`, Integrationstest `app/test/integration/ap14b-platform.int.mjs`;
  beide Runner ergänzt.

### Geändert
- Umgestellt sind unter anderem `lib/incidents.ts`, `lib/incident-actions.ts`,
  `lib/incident-list-actions.ts`, `lib/tasks.ts`, `lib/task-actions.ts`, `lib/db/pg-errors.ts`,
  `app/src/app/api/sync/route.ts` und `app/src/app/api/incidents/[id]/meta/route.ts`.
- Jeder Lese- und Schreibpfad läuft über `withUserTransaction()`; die Identität stammt ausschließlich aus
  `getSessionProfile()`. Idempotenz über den Unique-Index `(actor, client_action_id)` auf `sync_actions`.
  Fehlerabbildung ausschließlich über SQLSTATE; Klartext-Datenbankmeldungen verlassen den Server nicht.
- Fachcommit `6b9d8dd` („feat: migrate incident and task data paths to PostgreSQL"), 18 Dateien, +4422/-583;
  Dokumentationscommit `9ba2979` („docs: record verified AP14B data migration").

### Nachweise
- CI-Lauf `30635566629` und Container-Image-Lauf `30635566645` je `completed/success` — durch Codex bestätigt.

## [Nachgetragen] – 2026-07-30 – AP14/B: Auth-Basis auf Auth.js v5 und PostgreSQL

### Hinzugefügt
- Migrationen `0012_ap14b_platform_auth.sql` und `0013_ap14b_drop_supabase_compat.sql`, Smoke
  `19_ap14b_platform.sql`, Bootstrap-Werkzeug `app/scripts/bootstrap-admin.mjs`.
- Commits `877c6ab` („feat(db): add AP14B PostgreSQL platform migration") und `2db40d7`
  („feat(auth): replace Supabase auth with Auth.js sessions"), Merge-Commit `22db6da`
  („Merge AP14B PostgreSQL authentication platform").

### Geändert
- `app/src/proxy.ts` ersetzt `middleware.ts` und `lib/supabase/middleware.ts`.
- Auth.js v5 mit verschlüsselten JWTs, die an Nutzdaten ausschließlich `sub` und `sid` tragen (Auth.js
  ergänzt lediglich `iat`, `exp` und `jti`), Lebensdauer 10 Minuten;
  Argon2id nach OWASP-Mindestsatz; serverseitiger Sitzungswiderruf bei jeder Auswertung; Kontosperre nach
  fünf Fehlversuchen; erzwungener Passwortwechsel über `/passwort-aendern`. `0013` entfernt die
  Kompatibilitätsschemata `auth` und `storage` sowie `public.handle_new_user()` und prüft vorher fail-closed
  auf verbliebene Referenzen.

### Nachweise
- TypeScript, ESLint und Produktions-Build je Exit 0; 41/41 Einheitentests; 30/30 Integrationstests gegen
  echtes PostgreSQL 18; Migrationen `0001`–`0013` mit den Smokes AP10–AP13 und AP14/B P1–P19; Playwright
  `@public` 21/21 in echtem Chromium; zusätzlich ein HTTP-Nachweis zu ADR-011/2.12(e) mit 16 erfolgreichen
  Prüfungen (alle 13 geschützten Seiten und alle 3 geschützten APIs gesperrt).
- Für diesen Merge ist in den führenden Projektdateien kein CI-Lauf dokumentiert.

## [Nachgetragen] – 2026-07-28 – AP14/A: Merge- und CI-Stand der Container-/CI-Grundlage

### Nachweise
- Commits `8ec9731` („feat: prepare AP14 internal platform and CI") und `761ff23`
  („fix(ci): pin available Trivy action release"), Merge-Commit `651d34e`
  („Merge AP14 internal platform foundation"), Dokumentationscommit `4274009`
  („docs: record verified AP14 platform foundation"); Pull Request #1.
- GitHub-CI-Lauf `30380208864` vollständig grün — Anwendung, PostgreSQL-18-Smokes und echter Containerbau
  einschließlich Startschutz, Compose, Hadolint und Trivy.

### Abgrenzung
- Dieser Eintrag ergänzt ausschließlich den Merge- und CI-Stand. Der Umsetzungsumfang steht unverändert im
  bestehenden Eintrag „[Unveröffentlicht] – 2026-07-28 – AP14 / Arbeitspaket A" weiter unten in dieser Datei
  und wurde nicht geändert.

## [Nachgetragen] – 2026-07-28 – AP13: Aufgabenmodell und auditierbare Massenaktionen

### Hinzugefügt
- Migration `0011_ap13_tasks_bulk.sql`; Aufgabenmodell `incident_tasks` mit persistierten Ableitungen,
  minimierter Monteur-Sicht und auditierbaren Massenaktionen für Statusänderung und Monteurzuweisung.
- Fachcommit `76d93ca` („feat: implement AP13 incident tasks and auditable bulk actions"),
  Abhängigkeitskorrektur `e102532`, PWA-Korrektur `5c60031`, Dokumentationscommit `9a61106`
  („docs: record AP13 CI completion").

### Geändert
- PWA-Korrektur: der Reload beim ersten Service-Worker-Controllerwechsel entfällt; ein Reload erfolgt nur,
  wenn die Seite zuvor bereits kontrolliert war.

### Nachweise
- TypeScript ohne Fehler, ESLint ohne Befund, Produktions-Build erfolgreich; lokaler Datenbanklauf mit
  Migration `0011` und den Smokes `15`–`18` erfolgreich, einschließlich E20a–E20c und E21a–E21c.
- GitHub-CI-Lauf `30376903965` mit Ergebnis `success` auf `main` = `origin/main` = `5c60031`,
  Produktions-Audit erfolgreich und alle 11 öffentlichen E2E-/Accessibility-Tests erfolgreich.

## [Nachgetragen] – 2026-07-27 – AP12: Vorgangsdetails, Kabelpositionen, Kontakt-FK

### Hinzugefügt
- Migration `0010_ap12_incident_details.sql` mit den versionierten RPCs `create_incident_ap12` und
  `update_incident_ap12` sowie dem Entzug des AP10-Schreibaltpfads; Smoke `17_ap12_details.sql`.
- Mehrere Kabelpositionen je Vorgang mit `quantity_value`, `quantity_unit` (`piece`/`meter`) und
  `condition_code`; Kontakt-Fremdschlüssel mit historischem Snapshot; auf zugewiesene Vorgänge begrenzte
  Monteur-Projektion ohne Kontaktliste; Staff-CRUD für Bereitschaftsnummern.
- Fachcommit `761e89d` („feat: implement AP12 incident details"), Dokumentationscommit `37a91ae`
  („docs: record AP12 delivery").

### Geändert
- Überarbeitete Vorgangsformulare und -detailseite.

### Nachweise
- TypeScript ohne Fehler, ESLint ohne Befund, Produktions-Build erfolgreich einschließlich Route
  `/stammdaten/bereitschaftsnummern`; `app/supabase/test/run_ap12_local.ps1` hat die Migrationen
  `0001`–`0010` in einer temporären lokalen PostgreSQL-18-Datenbank sowie sämtliche AP10–AP12-Smokes
  erfolgreich ausgeführt; die Testdatenbank wurde anschließend entfernt.
- Für AP12 ist in den führenden Projektdateien kein CI-Lauf dokumentiert.

## [Unveröffentlicht] – 2026-07-28 – AP14 / Arbeitspaket A (Container- und CI-Grundlage)

> **Auf Feature-Branch implementiert, lokal geprüft und durch GitHub-CI-Lauf
> `30380208864` vollständig verifiziert; Merge, Deployment und Release offen.**
> Der Stack ist bis zum Abschluss von Arbeitspaket B ausdrücklich **nicht produktionsfähig**.

### Entschieden
- **ADR-011 (Entwurf):** Zielarchitektur ohne Supabase — ausschließlich PostgreSQL, Auth.js v5 mit
  serverseitiger Widerrufstabelle, MinIO für Bilder, RLS bleibt Autorisierungsträger.
  Rolle `kunde` ausdrücklich ausgeklammert. Details:
  `00-Projektsteuerung/ADR-011-postgres-eigenplattform.md`, Kurzzeile in `ENTSCHEIDUNGEN.md` (#11).

### Hinzugefügt
- `app/Dockerfile` (Multi-Stage, Node 22, non-root, Healthcheck) und `app/.dockerignore`.
- `app/docker/`: Startvalidierung (`verify-runtime-config.mjs`, Exit-Code 78 bei fehlender
  Pflichtvariable), `healthcheck.mjs` (ohne curl/wget), `entrypoint.sh`.
- `deploy/`: `compose.yml` (app + postgres, keine veröffentlichten Ports), Overlays für Stage und
  Produktion, Environment-Vorlagen, Skripte für Deployment, Rollback, Healthcheck, Backup und
  Wiederherstellung, Betriebsdokumentation `deploy/README.md`.
- `.github/workflows/container-image.yml`: GHCR-Build und -Push, OCI-Labels, kein `latest`,
  `packages: write` nur in diesem Workflow.
- `app/supabase/test/run_db_tests.sh`: POSIX-Fassung von `run_ap12_local.ps1` (gleiche Dateien,
  gleiche Reihenfolge) — die SQL-Smokes laufen damit erstmals in der CI.

### Geändert
- `app/next.config.ts`: Standalone-Ausgabe ausschließlich für den Containerbau
  (`BUILD_STANDALONE=1`) ergänzt. Normale Builds und der Playwright-Webserver
  verwenden weiterhin `next start`. Header und CSP unverändert (CSP bleibt Report-Only).
- `app/src/lib/supabase/config.ts`: stille Platzhalter entfernt; `assertSupabaseConfigured()` mit
  klarer Meldung; Exportform unverändert.
- `app/src/lib/supabase/{client,server}.ts`: Abbruch statt Client mit Platzhalterwerten.
- `app/src/app/api/health/route.ts`: Version aus `APP_VERSION` (serverseitig, zur Laufzeit setzbar);
  `NEXT_PUBLIC_APP_VERSION` bleibt übergangsweise als Rückfall.
- `.github/workflows/ci.yml`: kontrolliert erweitert — `permissions: contents: read`,
  Concurrency-Gruppe, Service-Worker-Syntaxprüfung, neue Jobs `database` (PostgreSQL 18) und
  `container` (Hadolint, Docker-Build, Startvalidierung, `docker history`-Prüfung,
  `docker compose config`, Trivy informativ). Alle bestehenden Schritte unverändert erhalten.
- `03-Architektur/DEPLOYMENT.md`, `07-Betrieb/HOSTING.md`: Vercel-/Supabase-Cloud-Annahme als
  überholt gekennzeichnet, nichts gelöscht; Richtigstellung zu `SUPABASE_SERVICE_ROLE_KEY`.
- `07-Betrieb/MONITORING.md`: Abschnitt zum Containerbetrieb ergänzt.

### Nicht enthalten
- Keine Fachänderung, keine Supabase-Ablösung, keine AP12-/AP13-/AP15-Änderung.
- Kein Deployment-Workflow, kein SSH, kein Push, kein Merge, kein Tag.
- Keine Aktualisierung von `PROJEKT_WISSEN.md` und `PROJEKTSTATUS.md`: beide tragen derzeit nicht
  committete Änderungen und werden bewusst nicht mit AP14-Inhalten vermischt.

### Lokal geprüft
- ESLint, TypeScript und normaler Produktions-Build erfolgreich.
- Produktions-Build ohne Supabase-Konfiguration erfolgreich.
- Container-Startvalidierung: fehlende Konfiguration = Exit 78, gültige
  Übergangskonfiguration = Exit 0, verbotener Service-Role-Key = Exit 78.
- Standalone-Build erfolgreich; `.next/standalone/server.js` vorhanden.
- 11/11 öffentliche Playwright-/Accessibility-Tests erfolgreich.
- Fünf YAML-Dateien erfolgreich geparst; sieben Shell-Skripte mit `bash -n`
  erfolgreich geprüft.

### Offen
- Merge des Pull Requests. Deployment bleibt bis AP14/B und bis zur Übergabe
  der internen IT-Zielparameter gesperrt.

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

## AP11 – Operative Vorgangsliste
feat: implement operational incident list (AP11)
- Migration 0009: RLS-konforme View incident_list_view (security_invoker) mit Aggregaten/Suchtext.
- /vorgaenge: serverseitige Suche/Filter/Mehrfachsortierung/Pagination, Desktop-Tabelle + Mobile-Karten,
  Kabelart-Chips, Monteure, offene Hinweise, Auswahl + vorbereitete Massenaktionen, CSV-Export (gefiltert).
- StatusBadge/PriorityBadge auf AP8-Badge-Primitive umgestellt.
- Verifikation: lint/tsc/build ok; AP11-Smoke 8/8; Performance (600) ok; Regression 11/13/14/15 grün.
