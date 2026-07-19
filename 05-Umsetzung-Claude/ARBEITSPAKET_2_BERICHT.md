# Arbeitspaket 2 – Umsetzungsbericht
> Stand: 2026-07-19 · MVP V0.1 · Vorgangsverwaltung

## Erledigte Funktionen
- **Dashboard Disponent/Admin:** Kennzahlkarten (Offene Vorgänge, Technisch abgeschlossen,
  Heute erstellt, Monteure im Einsatz, Warten auf DB, Warten auf Material) + Tabelle
  „Aktuelle Vorgänge" (Nummer, Status, Baustufe, Monteur, Priorität, Letzte Änderung, Aktionen)
  mit Filtern (Status, Baustufe, Monteur, Zeitraum), Volltextsuche und Sortierung (neueste zuerst).
- **Dashboard Monteur:** Karten (offene Einsätze, technisch abgeschlossen, heute übernommen) +
  Liste „Meine Einsätze" (nur eigene, RLS-geschützt).
- **Vorgang anlegen:** Eingabemaske mit den AP2-Pflichtfeldern (km bis optional); Server-Action
  setzt Status = „Neu" und erzeugt Chronikeintrag.
- **Vorgang bearbeiten:** Standort, Beschreibung, Priorität, Bemerkungen, Monteur, Status
  (nur Disposition/Admin); Chronik/Audit bleiben unveränderbar.
- **Monteur zuweisen/entfernen:** Eintrag in `incident_assignments`, Statusfolge „Monteur zugewiesen",
  Chronik/Audit über bestehende Trigger.
- **Statuswechsel:** rollenabhängig (Monteur nur erlaubte Status; DB-Trigger als Backstop),
  jede Änderung erzeugt Chronikeintrag + Audit.
- **Priorität:** Enum niedrig/normal/hoch/kritisch, im Dashboard farbig.
- **Timeline:** moderne, chronologische Chronik (neueste oben) mit Erstellung, Zuweisung,
  Statuswechsel, Notizen, technischem/administrativem Abschluss; Material/Bilder als Platzhalter.
- **UI:** Desktop-Sidebar + Header, mobiles Hamburger-Menü, responsive Tabellen/Karten, Logo beibehalten.

## Geänderte/neue Dateien
- Migration: `app/supabase/migrations/0003_ap2_priority.sql` (additiv: Priorität + Bemerkungen).
- Libs: `src/lib/priority.ts` (neu), `src/lib/incidents.ts` (neu, Queries/Sichtmodelle),
  `src/lib/incident-actions.ts` (neu, Server-Actions), `src/lib/status.ts` (Statusgruppen/Badges),
  `src/lib/database.types.ts` (Priorität + Felder).
- Komponenten (neu): `AppShell`, `incidents/StatCard`, `StatusBadge`, `PriorityBadge`,
  `IncidentsTable`, `EinsatzListe`, `Timeline`, `IncidentControls`, `NewIncidentForm`, `EditIncidentForm`.
- Seiten: `dashboard`, `vorgaenge`, `vorgaenge/neu`, `vorgaenge/[id]`, `vorgaenge/[id]/bearbeiten`,
  `meine-einsaetze`, `(app)/layout` (Sidebar).

## Testergebnisse (tatsächlich ausgeführt)
| Prüfung | Ergebnis |
|---|---|
| `npm run lint` | ✅ 0 Fehler |
| `tsc --noEmit` | ✅ 0 Fehler |
| `next build` | ✅ erfolgreich, alle neuen Routen erzeugt |
| Migration 0001–0003 (PostgreSQL 18) | ✅ fehlerfrei angewendet |
| Smoke-Test RLS/Trigger/Bestand/Priorität | ✅ grün (u. a. Priorität-Default „normal", Setzen „kritisch") |

## Offene Punkte
- Laufzeittest der Oberfläche gegen ein verbundenes Supabase-Projekt (bisher Build-/DB-geprüft).
- Benutzerverwaltungs-UI (aktuell über Supabase Auth-Dashboard).
- Timeline-Erweiterung um Material-/Bildereignisse (Platzhalter vorhanden).
- `middleware` → `proxy` (Next 16) modernisieren.

## Empfehlung für Arbeitspaket 3
Material- und Lagerverwaltung auf dem bestehenden Datenmodell:
Materialstammdaten- und Lagerort-UI (Admin), Bestandsanzeige über View `material_stock`,
Materialbewegungen (Wareneingang/Umbuchung/Korrektur) sowie Monteur-Entnahme/Rückgabe
vorgangs- und lagerbezogen (RLS/Bestandsschutz bereits vorhanden). Anschließend AP4:
Bild-Upload + EXIF und CSV-Export.
