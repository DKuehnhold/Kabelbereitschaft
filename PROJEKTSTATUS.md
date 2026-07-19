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
- **AP5** – Vorschläge: Bereinigung soft-gelöschter Bilder, Kartenansicht, Benutzerverwaltungs-UI, E2E-Tests.

## Offen
- Manuelle UI-Abnahme gegen ein verbundenes Supabase-Projekt (Upload/Vorschau/signierte URLs, CSV-Download).
