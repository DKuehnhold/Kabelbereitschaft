# Vorgangsmodell

> Stand: 2026-07-19 · MVP V0.1 · Teil von Arbeitspaket 1

Ein Vorgang (`incidents`) bildet einen Bereitschaftseinsatz vom eingehenden Anruf bis zum administrativen Abschluss ab.

## Lebenszyklus

1. **Anruf/Meldung** – Disponent legt den Vorgang an (Status „Neu"), erfasst Standort und Bereitschaftsnummer.
2. **Zuweisung** – Disponent weist einen Monteur zu (`incident_assignments`), Status „Monteur zugewiesen".
3. **Annahme und Anfahrt** – Monteur nimmt an („Einsatz angenommen"), meldet „Anfahrt", dann „Vor Ort".
4. **Aufnahme** – Status „Zustandsaufnahme"; Monteur erfasst technische Feststellungen und setzt eine Zustandsbewertung.
5. **Bearbeitung** – Status „In Bearbeitung"; Maßnahmen, Bilder und Materialbewegungen werden dokumentiert. Zwischenzustände möglich: „Warten auf Material", „Warten auf DB", „Übergabe erforderlich", „Provisorisch instandgesetzt".
6. **Technischer Abschluss** – Monteur meldet „Technisch abgeschlossen"; ggf. „Folgearbeiten anfordern".
7. **Dokuprüfung** – „Dokumentation vollständig" → Disponent prüft → „Durch Disposition geprüft".
8. **Abschluss** – Disponent/Admin setzt „Abgeschlossen". Sonderausgänge: „Storniert", „Fehlalarm".

## Standortmodell (bahnfachlich)

Keine Navigation, kein Routing, kein Live-GPS. Der Standort wird ausschließlich fachlich beschrieben.

| Feld | Pflicht | Bemerkung |
| --- | :---: | --- |
| Baustufe | ✓ | Kernangabe |
| VzG-Streckennummer | ✓ | Kernangabe |
| Streckenkilometer von | ✓ | Kernangabe |
| Streckenkilometer bis | – | optional |
| Betriebsstelle | – | optional |
| Gleis | – | optional |
| Richtung / Richtungsgleis | – | optional |
| Objektart | – | optional |
| Objektbezeichnung | – | optional |
| Ergänzende Ortsbeschreibung | – | optional |
| Externe Referenz / DB-Navi-Referenz | – | optional, reine Textreferenz |

Abweichungen vom erfassten Standort meldet der Monteur als **Korrekturvorschlag** (`incident_location_corrections`); die Übernahme bestätigt Disponent/Admin.

## Zuweisung

Die Zuordnung Monteur ↔ Vorgang erfolgt über `incident_assignments`. Der Lese-/Schreibzugriff des Monteurs auf einen Vorgang ist an einen aktiven Eintrag gebunden (RLS).

## Chronik-Ereignisse

| Ereignis | Tabelle |
| --- | --- |
| Statuswechsel | `incident_status_history` |
| Notizen / Feststellungen / Maßnahmen | `incident_notes` |
| Bild-Upload | `incident_images` |
| Materialbewegung (mit `incident_id`) | `inventory_movements` |
| Standort-Korrekturvorschlag | `incident_location_corrections` |
| Allgemeine Audit-Ereignisse | `audit_events` |

Alle Chronikeinträge sind unveränderbar (nur Anfügen).
