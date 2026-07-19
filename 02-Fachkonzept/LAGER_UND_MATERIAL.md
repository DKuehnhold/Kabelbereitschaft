# Lager und Material

> Stand: 2026-07-19 · MVP V0.1 · Teil von Arbeitspaket 1

Material und Lager werden über getrennte Stammdaten und ein bewegungsbasiertes Bestandsmodell geführt.

## Materialstammdaten (`materials`)

Zentrale Felder: Material-ID (UUID), Bezeichnung, Materialnummer/Kennung, Einheit, optionale Beschreibung, aktiv-Kennzeichen. Pflege ausschließlich durch Administrator.

## Lagerorte (`storage_locations`)

Felder: Lagerort-ID (UUID), Bezeichnung, Typ, optionale Beschreibung, aktiv-Kennzeichen.

**Lagerorttypen (5):** Zentrallager · Fahrzeuglager · Baustellenlager · Materialcontainer · Temporäres Lager

## Bewegungstypen (8)

| Typ | Bedeutung |
| --- | --- |
| Wareneingang | Zugang neuer Ware in einen Lagerort. |
| Entnahme für Vorgang | Abgang für einen konkreten Vorgang. |
| Rückgabe | Nicht verbrauchtes Material zurück ins Lager. |
| Umbuchung | Verschiebung zwischen zwei Lagerorten. |
| Korrektur | Bestandskorrektur (nur Administrator). |
| Verlust | Abgang durch Verlust. |
| Beschädigung | Abgang durch Beschädigung. |
| Verbrauch | Endgültiger Verbrauch. |

## Bestandsregeln

- Der **aktuelle Bestand** ist eine **View** (Ableitung) aus `inventory_movements` – Bestände werden **nie** durch Überschreiben geändert.
- Jede Bestandsänderung ist eine **Bewegung** (`inventory_movements`).
- **Negative Bestände** werden im MVP verhindert (Prüfung vor Buchung).
- Materialbewegungen werden **nicht gelöscht**; Fehlbuchungen werden per Gegenbuchung/Korrektur ausgeglichen (Korrektur nur Administrator).
- `incident_materials` ist eine Ableitung aus `inventory_movements` mit gesetzter `incident_id`.

## Monteur-Entnahme

- Eine Entnahme durch einen Monteur ist immer an **Vorgang + Lagerort** gebunden (Bewegungstyp „Entnahme für Vorgang").
- Rückgaben laufen analog als Bewegungstyp „Rückgabe".
- Der Monteur darf Bestände nicht frei überschreiben und keine Bewegungen löschen.
