# Changelog

Alle nennenswerten Änderungen an diesem Projekt.

## [Unveröffentlicht]
### Geändert
- Eigenständiges Git-Repository eingerichtet: `origin = https://github.com/DKuehnhold/Kabelbereitschaft.git`, Branch `main`. Keine Verbindung zu `ManagementOS-Core`.

## 2026-07-19
### Hinzugefügt
- **AP3** – Material- und Lagerverwaltung: Migration `0004_ap3_inventory_rls.sql`, Bestände/Bewegungen/Entnahme/Rückgabe/Verbrauch, Materialhistorie, Karte „Material unter Mindestbestand", vollständiger Smoke-Test `11_ap3_smoke.sql`. Commit `ac7b4d1`.
- **AP2** – Vorgangsverwaltung: Migration `0003_ap2_priority.sql`. Commit `bcaea7e`.
- **AP1** – Grundgerüst, Datenmodell mit RLS/Triggern, Login, rollenbasierte Navigation.
