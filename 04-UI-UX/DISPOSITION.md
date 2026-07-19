# Disposition – Screens und Abläufe

> Stand: 2026-07-19 · MVP V0.1 · Teil von Arbeitspaket 1
>
> *Fachliche Funktionen geplant für spätere Arbeitspakete; AP1 liefert Grundnavigation und geschützte Routen.*

Zielgruppe: Rolle `disponent` (und `administrator`).

## Vorgangsübersicht (`/vorgaenge`)

- Tabellarische Liste aller Vorgänge mit Status, Zustandsbewertung, Baustufe, Strecke, zugewiesenem Monteur, Anlage-/Abschlusszeitpunkt.
- **Filter:** Status, Baustufe, Monteur, Zeitraum.
- Aktionen: Detail öffnen, neuen Vorgang anlegen, CSV-Export (Admin).

## Vorgang anlegen (`/vorgaenge/neu`)

- Pflichtfelder Standort: Baustufe, VzG-Streckennummer, Streckenkilometer von.
- Optionale Standortfelder gemäß Standortmodell.
- Bereitschaftsnummer zuordnen; Meldungs-/Anrufangaben erfassen.
- Nach dem Speichern: Status „Neu".

## Monteur zuweisen

- Auswahl eines Monteurs aus aktiven Profilen.
- Erzeugt Eintrag in `incident_assignments`; Status wechselt auf „Monteur zugewiesen".
- Chronikeintrag wird geschrieben.

## Vorgangsdetail und Chronik (`/vorgaenge/[id]`)

- Kopf: Standort, Bereitschaftsnummer, aktueller Status und Zustand.
- **Chronik:** chronologische, unveränderbare Ereignisliste (Statuswechsel, Notizen, Bilder, Materialbewegungen, Standortkorrekturen).
- Bereiche: Feststellungen/Maßnahmen, Bilder (mit Kategorie), Materialverbrauch.
- Aktionen des Disponenten: Doku prüfen, Standortkorrektur bestätigen, administrativ abschließen.

## Prüfen und Abschließen

- Nach „Dokumentation vollständig" prüft der Disponent die Angaben.
- Setzt „Durch Disposition geprüft" und anschließend „Abgeschlossen".
- Sonderausgänge „Storniert" / „Fehlalarm" sind mit Begründung möglich.
