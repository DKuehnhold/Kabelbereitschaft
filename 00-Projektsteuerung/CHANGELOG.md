# Changelog

> **FÜHRENDES DOKUMENT (Changelog).** Kennzeichnung vom 2026-07-26 gemäß Auflage vor AP12
> (`00-Projektsteuerung/ROADMAP_AP12_AP15_ENTWURF.md`, B.1/B.8). Abgelöste Dublette:
> `CHANGELOG.md (Repository-Wurzel)` (als historisch markiert, nicht gelöscht).
> Endgültige Konsolidierung und Archivierung erfolgen in AP15.

## [Unveröffentlicht] – 2026-07-28 – AP14 / Arbeitspaket A (Container- und CI-Grundlage)

> **Auf Feature-Branch implementiert und lokal geprüft; CI-Nachweis, Merge,
> Deployment und Release offen.**
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
- `docker build`, realer Containerlauf, `docker compose config`, Hadolint,
  Trivy und der neue Linux-Datenbankrunner werden durch die GitHub-CI geprüft;
  Docker ist auf dem lokalen Windows-Rechner nicht installiert.

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
