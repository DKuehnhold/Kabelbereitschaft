# Monteuransicht – Screens und Abläufe

> Stand: 2026-07-19 · MVP V0.1 · Teil von Arbeitspaket 1
>
> *Fachliche Funktionen geplant für spätere Arbeitspakete; AP1 liefert Grundnavigation und geschützte Routen.*

Zielgruppe: Rolle `monteur`. Der Monteur sieht ausschließlich ihm zugewiesene Vorgänge (durch RLS erzwungen).

## Meine Einsätze (`/meine-einsaetze`)

- Liste der zugewiesenen Vorgänge mit Status, Zustand, Standort-Kurzangabe.
- Einstieg in den einzelnen Vorgang.

## Einsatz annehmen und Status wechseln

- Einsatz annehmen → „Einsatz angenommen".
- Statusfolge: „Anfahrt" → „Vor Ort" → „Zustandsaufnahme" → „In Bearbeitung".
- Zwischenstatus je nach Lage: „Warten auf Material", „Warten auf DB", „Übergabe erforderlich", „Provisorisch instandgesetzt".
- Abschluss durch Monteur: „Technisch abgeschlossen"; optional „Folgearbeiten anfordern".

## Zustandsbewertung

- Auswahl genau eines Werts aus den 7 zulässigen Zustandsbewertungen.
- Technische Feststellungen als Textdokumentation.

## Bilder

- Upload je Vorgang mit **Bildkategorie** (9 Kategorien) und **Beschreibung**.
- EXIF-Auswertung serverseitig; Upload auch ohne GPS/EXIF möglich.

## Material

- Entnahme für den Vorgang, gebunden an **Vorgang + Lagerort** (Bewegungstyp „Entnahme für Vorgang").
- Rückgabe nicht verbrauchten Materials (Bewegungstyp „Rückgabe").
- Keine freie Bestandsänderung, kein Löschen von Bewegungen.

## Standortkorrektur

- Weicht der reale Einsatzort ab, meldet der Monteur einen **Korrekturvorschlag** (`incident_location_corrections`).
- Die Übernahme in die Vorgangsdaten bestätigt Disponent/Admin.
