# Lagerverwaltung – Screens

> Stand: 2026-07-19 · MVP V0.1 · Teil von Arbeitspaket 1
>
> *Fachliche Funktionen geplant für spätere Arbeitspakete; AP1 liefert Grundnavigation und geschützte Routen.*

## Materialstammdaten (`/material`, Admin)

- Liste der Materialien: Bezeichnung, Materialnummer, Einheit, aktiv-Kennzeichen.
- Anlegen/Bearbeiten/Deaktivieren durch Administrator.

## Lagerorte (`/lager`, Admin)

- Liste der Lagerorte mit **Typ** (Zentrallager, Fahrzeuglager, Baustellenlager, Materialcontainer, Temporäres Lager).
- Anlegen/Bearbeiten/Deaktivieren durch Administrator.

## Bestände

- Bestandsanzeige je Material und Lagerort als **Ableitung (View)** aus `inventory_movements`.
- Keine direkte Bestandsbearbeitung – Änderungen nur über Bewegungen.

## Bewegungen (`/lager`)

- Buchung der 8 Bewegungstypen: Wareneingang, Entnahme für Vorgang, Rückgabe, Umbuchung, Korrektur, Verlust, Beschädigung, Verbrauch.
- Anfangsbestände und Korrekturbuchungen nur durch Administrator.
- **Negative Bestände werden verhindert** (Prüfung vor Buchung).
- Bewegungen sind unlöschbar; Fehlbuchung → Gegenbuchung/Korrektur.

## Monteur-Entnahme (Auszug im Vorgangskontext)

- Der Monteur bucht „Entnahme für Vorgang" bzw. „Rückgabe" gebunden an **Vorgang + Lagerort**.
- Umbuchung, Korrektur, Wareneingang und Stammdatenpflege sind dem Administrator vorbehalten.
