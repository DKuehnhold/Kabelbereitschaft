# Zielbild

> Stand: 2026-07-19 · MVP V0.1 · Teil von Arbeitspaket 1

## Zweck der App

"Kabelbereitschaft" ist eine responsive Webanwendung zur Erfassung, Steuerung und Dokumentation von Bereitschaftseinsätzen an Kabelanlagen im Bereich der Deutschen Bahn. Die App bildet den Weg eines Vorgangs vom eingehenden Anruf über die Zuweisung an einen Monteur bis zum technischen und administrativen Abschluss lückenlos ab.

Ziel ist eine nachvollziehbare, revisionssichere Dokumentation von Zustand, Maßnahmen, Material und Bildern je Vorgang.

## Nutzergruppen

| Rolle | Aufgabe |
| --- | --- |
| Disponent | Vorgänge anlegen, Monteure zuweisen, Status/Chronik verfolgen, Doku prüfen, administrativ abschließen. |
| Monteur | Zugewiesene Einsätze annehmen und vor Ort abarbeiten, Zustand bewerten, Bilder und Material dokumentieren, technischen Abschluss melden. |
| Administrator | Stammdaten, Benutzer/Rollen, Lagerorte, Materialstammdaten pflegen; alle Vorgänge einsehen; Exporte erstellen. |

## Abgrenzung (bewusst nicht Teil der App)

- Keine eigene Navigation und keine Routenführung.
- Kein Live-GPS-Tracking von Personen oder Fahrzeugen.
- GPS-Koordinaten ausschließlich aus Bild-EXIF, sofern im Bild vorhanden.
- Der Standort wird bahnfachlich beschrieben (Baustufe, VzG-Streckennummer, Streckenkilometer), nicht kartografisch geführt.

## Kernnutzen

- Einheitlicher, prüfbarer Vorgangs-Lebenszyklus mit unveränderbarer Chronik.
- Klar getrennte Rollenrechte mit technischer Durchsetzung (Row Level Security).
- Vollständige technische Dokumentation je Einsatz: Zustand, Maßnahmen, Bilder mit Kategorie, Materialverbrauch.
- Materialbestände jederzeit aus Bewegungen nachvollziehbar (keine freien Überschreibungen).
- CSV-Export der Vorgangsübersicht für Auswertung außerhalb der App.
