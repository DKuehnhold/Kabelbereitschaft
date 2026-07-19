# Bild- und EXIF-Logik

> Stand: 2026-07-19 · MVP V0.1 · Teil von Arbeitspaket 1

Bilder werden je Vorgang erfasst (`incident_images`) und im privaten Storage-Bucket abgelegt. Die EXIF-Auswertung erfolgt **serverseitig**.

## Upload-Ablauf

1. Monteur wählt Bild(er) zum Vorgang, vergibt **Bildkategorie** und **Beschreibung**.
2. Server prüft MIME-Typ und Dateigröße, berechnet einen **Dateihash**.
3. Server liest EXIF aus (sofern vorhanden) und speichert die extrahierten Felder.
4. Datei wird in den privaten Bucket geschrieben; Metadaten in `incident_images`.
5. Fehlende GPS-/EXIF-Daten führen **nicht** zum Fehlschlag – das Bild wird mit `EXIF vorhanden = nein` gespeichert.

## Bildkategorien (9)

Übersicht · Zugang · Schadstelle · Zustand vor Arbeit · Arbeitsausführung · Materialeinsatz · Zustand nach Arbeit · Restmangel · Sonstige Dokumentation

## EXIF-Felder (serverseitig, sofern vorhanden)

- GPS-Breite
- GPS-Länge
- Aufnahmezeitpunkt
- Bildausrichtung
- Kameramodell (optional)

GPS wird ausschließlich aus dem Bild-EXIF gewonnen – es gibt kein Live-GPS und kein Tracking.

## Pflichtfelder pro Bild

| Feld | Pflicht |
| --- | :---: |
| Bild-ID | ✓ |
| Vorgangs-ID | ✓ |
| Dateiname | ✓ |
| MIME-Typ | ✓ |
| Dateigröße | ✓ |
| Speicherpfad | ✓ |
| Bildkategorie | ✓ |
| Beschreibung | ✓ |
| Hochgeladen durch | ✓ |
| Uploadzeitpunkt | ✓ |
| EXIF vorhanden (ja/nein) | ✓ |
| Dateihash | ✓ |
| Aufnahmezeitpunkt | optional |
| GPS-Breite | optional |
| GPS-Länge | optional |

## Sicherheit

- **Privater Bucket** – keine öffentlichen Bild-Buckets.
- Zugriff nur über **signierte/geschützte** URLs, rollenbasiert (RLS).
- **Dateihash** zur Integritäts- und Dublettenkontrolle.
- Prüfung von **MIME-Typ** und **Dateigröße** vor dem Speichern.
