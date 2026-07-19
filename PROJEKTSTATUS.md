# Projektstatus – Kabelbereitschaft
> Stand: 2026-07-19

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

## Git / Push
Lokaler `main` ist Remote (`origin/main` = `8d83371`) voraus: **AP4, AP5, AP6 sind noch nicht
gepusht** (kein Git-Zugang in der Build-Umgebung). Push durch den Nutzer erforderlich.

## Offen
- Manuelle UI-/Browser-Abnahme gegen ein verbundenes Supabase-Projekt (Upload/Vorschau/signierte URLs,
  CSV-Download, Offline-Start/Cache/Installation/Reconnect/Konflikt-UI).
