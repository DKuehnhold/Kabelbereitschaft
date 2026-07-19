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

## Umsetzung (AP3)

Umgesetzt auf dem bestehenden Datenmodell (keine neuen Tabellen/Views):

- **Materialstammdaten** (`/material`, Administrator): Anlegen, Bearbeiten, Aktivieren/Deaktivieren,
  Suche, Sortierung – kein Löschen. Felder: Materialnummer, Bezeichnung, Kurzbeschreibung (`note`),
  Einheit, Kategorie, Mindestbestand (optional), Status.
- **Lagerorte** (`/lager`, Administrator): analog, mit Typ-Auswahl; kein Löschen.
- **Bestandsübersicht** (`/bestand`): ausschließlich aus der View `material_stock`
  (Material, Lager, Istbestand, Einheit, Status „unter Mindestbestand"), mit Suche/Filter/Sortierung.
- **Lagerbewegungen** (Administrator, Dialog auf `/bestand`): Wareneingang, Umbuchung, Korrektur,
  Verlust, Beschädigung. **Monteur** (im Vorgang): Entnahme, Rückgabe, Verbrauch.
- **Materialhistorie** (`/materialhistorie`): alle Bewegungen mit Filtern (Material, Lager, Vorgang,
  Person, Zeitraum, Bewegungstyp), neueste zuerst.
- **Material im Vorgang**: Karte im Vorgangsdetail, berechnet aus `inventory_movements`
  (keine eigene Tabelle).

### Regeln/Validierungen (durchgesetzt)
- Keine negativen Bestände (DB-Trigger `check_inventory_nonnegative`, autoritativ).
- Keine Entnahme ohne Vorgang (Constraint `mv_entnahme` + Server-Action).
- Rückgabe ≤ (entnommene − bereits zurückgegebene) Menge (Server-Action `returnMaterial`).
- Nur aktive Materialien/Lager in Auswahllisten.

### Modellhinweise
- **Verbrauch** wird als Abgang aus einem Quelllager mit Vorgangsbezug gebucht
  (Bewegungstyp `verbrauch`, Quelllager −). Migration `0004` ergänzt **additiv** eine RLS-Policy,
  damit Monteure Verbrauch für zugewiesene Vorgänge buchen dürfen (bestehende Policies unverändert).
- **DB-Ansprechpartner/Telefon** und **Abschlussdaten** wurden bereits in AP1/AP2 modelliert und
  wiederverwendet – es wurden keine Strukturen doppelt angelegt.
