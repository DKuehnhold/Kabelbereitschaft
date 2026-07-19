# Changelog

Alle nennenswerten Änderungen an diesem Projekt.

## [Unveröffentlicht]
### Hinzugefügt
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
