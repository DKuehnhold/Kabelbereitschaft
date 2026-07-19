# CSV-Export

> Stand: 2026-07-19 · MVP V0.1 · Teil von Arbeitspaket 1
>
> *Geplant für ein späteres Arbeitspaket. In AP1 ist die Vorgangserfassung und damit der Export noch nicht funktional.*

## Zweck

Export der Vorgangsübersicht zur Auswertung außerhalb der App (Tabellenkalkulation, Ablage). Der Export berücksichtigt die aktiven Filter (Status, Baustufe, Monteur, Zeitraum). Der Export ist dem Administrator vorbehalten.

## Formatvorgaben

| Eigenschaft | Wert |
| --- | --- |
| Zeichensatz | UTF-8 (mit BOM für Excel-Kompatibilität) |
| Trennzeichen | Semikolon `;` |
| Textbegrenzer | doppelte Anführungszeichen `"` bei Bedarf |
| Zeilenende | CRLF |
| Datumsformat | ISO 8601 (`YYYY-MM-DD` bzw. `YYYY-MM-DD HH:MM`) |

## Spaltenvorschlag Vorgangsübersicht

| Spalte | Inhalt |
| --- | --- |
| Vorgangsnummer | fachliche/laufende Nummer |
| Bereitschaftsnummer | zugeordnete Bereitschaft |
| Status | aktueller Vorgangsstatus |
| Zustandsbewertung | aktueller technischer Zustand |
| Baustufe | Baustufe |
| VzG-Streckennummer | Streckennummer |
| Streckenkilometer von | km von |
| Streckenkilometer bis | km bis (optional) |
| Betriebsstelle | optional |
| Zugewiesener Monteur | Name/Kennung |
| Angelegt am | Zeitpunkt Anlage |
| Angenommen am | Zeitpunkt Einsatzannahme |
| Technisch abgeschlossen am | Zeitpunkt |
| Abgeschlossen am | Zeitpunkt |
| Anzahl Bilder | Zähler |
| Anzahl Materialbewegungen | Zähler |

## Optionaler Kopf

Optional kann dem Export ein Metadatenkopf vorangestellt werden (Firmenlogo-Verweis als Text/Dateiname, Exportzeitpunkt, angewendete Filter, exportierender Benutzer). Der Kopf ist von den Datenzeilen klar getrennt.
