# Statusmodell

> Stand: 2026-07-19 · MVP V0.1 · Teil von Arbeitspaket 1

Vorgangsstatus und technische Zustandsbewertung sind **zwei getrennte Dimensionen**. Der Status beschreibt den Bearbeitungsfortschritt des Vorgangs, die Zustandsbewertung den technischen Befund an der Anlage. Beide werden unabhängig geführt.

## Vorgangsstatus (16)

| # | Status | Bedeutung |
| --- | --- | --- |
| 1 | Neu | Vorgang angelegt, noch nicht zugewiesen. |
| 2 | Monteur zugewiesen | Ein Monteur wurde zugeordnet, Annahme steht aus. |
| 3 | Einsatz angenommen | Monteur hat den Einsatz bestätigt. |
| 4 | Anfahrt | Monteur ist auf dem Weg zum Einsatzort. |
| 5 | Vor Ort | Monteur ist am Einsatzort eingetroffen. |
| 6 | Zustandsaufnahme | Technische Aufnahme des Ist-Zustands läuft. |
| 7 | In Bearbeitung | Arbeiten werden ausgeführt. |
| 8 | Warten auf Material | Bearbeitung pausiert wegen fehlenden Materials. |
| 9 | Warten auf DB | Bearbeitung pausiert, Rückmeldung/Freigabe der DB erforderlich. |
| 10 | Übergabe erforderlich | Übergabe an anderen Monteur/Schicht nötig. |
| 11 | Provisorisch instandgesetzt | Anlage vorläufig gesichert, Folgearbeit offen. |
| 12 | Technisch abgeschlossen | Technische Arbeiten vom Monteur beendet. |
| 13 | Dokumentation vollständig | Alle Pflichtangaben und Bilder liegen vor. |
| 14 | Durch Disposition geprüft | Disponent hat die Dokumentation geprüft. |
| 15 | Abgeschlossen | Vorgang administrativ abgeschlossen. |
| 16 | Storniert | Vorgang aufgehoben, keine Bearbeitung. |
| 17 | Fehlalarm | Kein tatsächlicher Schaden/Einsatzgrund. |

> Hinweis: Die Liste enthält 16 Bearbeitungsstatus plus die Sonderausgänge „Storniert" und „Fehlalarm". Die genaue technische Kodierung wird in der DB-Migration als Wertetabelle geführt.

## Technische Zustandsbewertung (7)

| # | Zustand | Bedeutung |
| --- | --- | --- |
| 1 | Keine Beschädigung erkennbar | Anlage ohne Befund. |
| 2 | Geringfügig beschädigt | Leichter Schaden, keine Funktionsbeeinträchtigung. |
| 3 | Funktionsfähig mit Einschränkung | Betrieb möglich, aber eingeschränkt. |
| 4 | Provisorisch instandgesetzt | Vorläufig gesichert, endgültige Instandsetzung offen. |
| 5 | Nicht betriebsbereit | Anlage außer Funktion. |
| 6 | Sofortiger Handlungsbedarf | Akute Gefährdung / dringende Maßnahme nötig. |
| 7 | Weitere Prüfung erforderlich | Befund unklar, zusätzliche Untersuchung nötig. |

## Chronik

Jede Statusänderung wird als Ereignis in `incident_status_history` festgehalten (Zeitpunkt, alter/neuer Status, auslösende Person). Die Chronik ist **unveränderbar**: Einträge können nur angefügt, nicht geändert oder gelöscht werden.
