# Rollen und Rechte

> Stand: 2026-07-19 · MVP V0.1 · Teil von Arbeitspaket 1

Die Rolle liegt als Feld `role` (Enum `user_role`) auf der Tabelle `profiles`. Zulässige Werte: `administrator`, `disponent`, `monteur`. Die Durchsetzung erfolgt technisch über Row Level Security in Supabase.

## Rollenmatrix (Aktion × Rolle)

| Aktion | Monteur | Disponent | Administrator |
| --- | :---: | :---: | :---: |
| Vorgang anlegen | – | ✓ | ✓ |
| Monteur zuweisen | – | ✓ | ✓ |
| Alle Vorgänge sehen | – | ✓ | ✓ |
| Nur zugewiesene Vorgänge sehen | ✓ | – | – |
| Einsatz annehmen | ✓ | – | – |
| Status ändern (eigener Vorgang) | ✓ | ✓ | ✓ |
| Technische Feststellung erfassen | ✓ | – | ✓ |
| Zustandsbewertung setzen | ✓ | – | ✓ |
| Bilder hochladen + Kategorie/Beschreibung | ✓ | – | ✓ |
| Material entnehmen/zurückgeben (an Vorgang + Lagerort gebunden) | ✓ | – | ✓ |
| Maßnahmen dokumentieren | ✓ | – | ✓ |
| Technischen Abschluss melden | ✓ | – | ✓ |
| Folgearbeiten anfordern | ✓ | – | ✓ |
| Abweichenden Einsatzort als Korrekturvorschlag melden | ✓ | – | ✓ |
| Korrekturvorschlag Standort bestätigen | – | ✓ | ✓ |
| Doku prüfen | – | ✓ | ✓ |
| Administrativ abschließen | – | ✓ | ✓ |
| Benutzer/Rollen verwalten | – | – | ✓ |
| Baustufen / Bereitschaftsnummern pflegen | – | – | ✓ |
| Status-/Zustandswerte pflegen | – | – | ✓ |
| Materialstammdaten / Lagerorte pflegen | – | – | ✓ |
| Anfangsbestände / Korrekturbuchungen | – | – | ✓ |
| CSV-Export | – | – | ✓ |

## Ausdrückliche Sperren für Monteure

Ein Monteur darf **nicht**: Vorgänge anlegen, fremde Vorgänge bearbeiten, Benutzer verwalten, Lagerbestände frei überschreiben, Materialbewegungen löschen, administrativ abschließen.

## Grundsätze

- Lese-/Schreibrechte auf Vorgänge des Monteurs sind an einen aktiven Eintrag in `incident_assignments` gebunden.
- Bestände werden nie überschrieben, sondern ausschließlich über Bewegungen (`inventory_movements`) verändert.
- Die Chronik (`incident_status_history`, `audit_events`) ist unveränderbar (nur Anfügen).
