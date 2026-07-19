# Changelog

Alle nennenswerten Änderungen an diesem Projekt.

## [Unveröffentlicht]
### Sicherheit / Release (AP7)
- Release Readiness & Security Review: HTTP-Sicherheitsheader (`next.config.ts`; CSP zunächst
  Report-Only), Health-Check `/api/health`, Accessibility-Tests (`@axe-core/playwright`),
  E2E-Ergänzung (Health/Header), CI-Härtung (`npm audit --audit-level=high`, `@public`+a11y),
  `.env.example` erweitert. Supply-Chain: 2 moderate (postcss build-time via Next) – akzeptiert,
  Behebung mit Next-Update. Umfangreiche Betriebs-/Release-Doku (Backup/Recovery, Monitoring,
  Deployment, Releaseprozess, Gates, RC1-Notes, PROJEKT_WISSEN). Keine neue Migration.
  Geprüft: lint/tsc/build/audit, Migration 0001–0006 (leer+AP6-Bestand), Smokes 10–13, CSV 12/12,
  SW-Syntax, Playwright `--list` 26 + `@public` request-basiert 6/9. Details: `ARBEITSPAKET_7_BERICHT.md`.

### Hinzugefügt
- **AP6** – E2E-Tests, Offline-Verifikation & Synchronisationshärtung: Playwright-E2E-Struktur
  (22 Tests, Chromium; `@public` ohne Supabase, `@app` mit Test-Supabase), Idempotenz/Dedup über
  Migration `0006` (`sync_actions`, Client-Action-IDs, Server-Dedup in `/api/sync` und
  `/api/images/upload`), kontrollierte Konfliktauflösung (Serverstand übernehmen / erneut anwenden /
  verwerfen), Service-Worker-Update-Anzeige, Benutzertrennung der Offline-Daten (`ownerId`),
  Dashboard-Diagnose, Barrierefreiheit, CI-Workflow. Route `/api/incidents/[id]/meta` (neu).
  Geprüft: lint/tsc/build, Migration 0001–0006 (leer + AP5-Bestand, idempotent), Smokes 10–13
  (Idempotenz 5/5, AP3 16/16, AP4 20/20, AP1/AP2 0 Fehler), SW-Syntax, CSV 12/12,
  Playwright `--list` 22 Tests + `@public` 4/7 gegen Prod-Server (3 seitenbasierte in der Sandbox
  nicht lauffähig: Chromium-Systembibliotheken fehlen). Details: `05-Umsetzung-Claude/ARBEITSPAKET_6_BERICHT.md`.
- **AP5** – Offlinefähigkeit (PWA) & Synchronisation: Web-App-Manifest + Icons + Service Worker
  (Cache-Strategien, Offline-Fallback, Cache-Invalidierung), Installierbarkeit; IndexedDB-Outbox
  für Notizen/Statusänderungen und Upload-Warteschlange (Fortschritt/Abbruch/Retry); automatische
  Synchronisation bei Reconnect über `/api/sync` und `/api/images/upload` (gemeinsame Upload-Kernlogik
  `image-upload-core`); Konflikterkennung über `updated_at` ohne stille Überschreibung; Offline-Leiste,
  offline-fähige Erfassung im Vorgang, Dashboard-Kennzahlen (offline vorgemerkt/wartende Uploads/letzte
  Sync). Keine neue Migration. Geprüft: lint/tsc/build, SW-Syntax, CSV 12/12, Regression 0001–0005 +
  Smokes 10/11/12. Offline-Runtime als manuelle Browser-QA. Details: `05-Umsetzung-Claude/ARBEITSPAKET_5_BERICHT.md`.
- **AP4** – Bilddokumentation: privater Mehrfach-Bildupload (JPG/PNG, signierte URLs), serverseitige
  EXIF-/GPS-Auswertung mit Validierung, Galerie + Großansicht, Kategorie-/Beschreibungsänderung,
  Soft-Delete, Timeline-/Audit-Integration, Dashboard-Kennzahl „Heute hochgeladene Bilder",
  gefilterter CSV-Export der Vorgangsübersicht (UTF-8+BOM, Semikolon, Formel-Injektionsschutz).
  Migration `0005_ap4_images.sql` (additiv, idempotent). 6 zusätzliche Bildkategorien (→ 15).
  Alle Prüfungen ausgeführt und grün (lint/tsc/build, Migration 0001–0005, Smoke 12_ap4 20/20,
  Regression 11_ap3 16/16, CSV-Test 12/12). Details: `05-Umsetzung-Claude/ARBEITSPAKET_4_BERICHT.md`.

### Geändert
- Eigenständiges Git-Repository eingerichtet: `origin = https://github.com/DKuehnhold/Kabelbereitschaft.git`, Branch `main`. Keine Verbindung zu `ManagementOS-Core`.

## 2026-07-19
### Hinzugefügt
- **AP3** – Material- und Lagerverwaltung: Migration `0004_ap3_inventory_rls.sql`, Bestände/Bewegungen/Entnahme/Rückgabe/Verbrauch, Materialhistorie, Karte „Material unter Mindestbestand", vollständiger Smoke-Test `11_ap3_smoke.sql`. Commit `ac7b4d1`.
- **AP2** – Vorgangsverwaltung: Migration `0003_ap2_priority.sql`. Commit `bcaea7e`.
- **AP1** – Grundgerüst, Datenmodell mit RLS/Triggern, Login, rollenbasierte Navigation.
