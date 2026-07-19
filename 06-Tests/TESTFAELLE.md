# Testfälle

> Stand: 2026-07-19 · MVP V0.1 · Teil von Arbeitspaket 1

Fokus auf in Arbeitspaket 1 prüfbare Fälle. Fälle für spätere Fachfunktionen sind als *geplant* markiert.

## AP1 – jetzt prüfbar

| ID | Vorbedingung | Schritte | Erwartung |
| --- | --- | --- | --- |
| T-01 | App läuft lokal | `/vorgaenge` ohne Anmeldung aufrufen | Weiterleitung auf `/login` |
| T-02 | Gültiger Admin-Account | Mit Admin anmelden | Login erfolgreich, Header mit Logo sichtbar |
| T-03 | Angemeldet als Admin | Navigation prüfen | Punkte Vorgänge, Lager, Material, Verwaltung sichtbar |
| T-04 | Angemeldet als Disponent | Navigation prüfen | Vorgänge/Anlegen sichtbar, keine Verwaltung |
| T-05 | Angemeldet als Monteur | Navigation prüfen | Meine Einsätze sichtbar, keine Anlage/Verwaltung |
| T-06 | Angemeldet | Abmelden | Sitzung beendet, Rückkehr auf `/login` |
| T-07 | Mobile Ansicht (schmales Fenster) | Startseite öffnen | Mobiler Header mit Logo + Burger-Menü |
| T-08 | Leere Postgres-DB | Migration ausführen | Alle Tabellen/Enums/Views/Policies angelegt, kein Fehler |
| T-09 | Migration eingespielt | Monteur-Session versucht Fremdvorgang zu lesen | RLS verweigert Zugriff |
| T-10 | Repo ausgecheckt | `npm run lint`, Typecheck, `npm run build` | Alle drei fehlerfrei |
| T-11 | Repo ausgecheckt | Repo auf Secrets prüfen | Keine Secrets im Repo, nur `.env.example` |

## Spätere APs – geplant

| ID | Vorbedingung | Schritte | Erwartung |
| --- | --- | --- | --- |
| T-20 (geplant) | Disponent angemeldet | Vorgang mit Pflichtfeldern anlegen | Vorgang „Neu" gespeichert |
| T-21 (geplant) | Vorgang „Neu" | Monteur zuweisen | Status „Monteur zugewiesen", Chronikeintrag |
| T-22 (geplant) | Vorgang zugewiesen | Statuslauf bis „Technisch abgeschlossen" | Jede Änderung in Chronik, unveränderbar |
| T-23 (geplant) | Vorgang offen | Zustandsbewertung setzen | Einer der 7 Werte gespeichert |
| T-24 (geplant) | Vorgang offen | Bild ohne GPS/EXIF hochladen | Upload erfolgreich, `EXIF vorhanden = nein` |
| T-25 (geplant) | Bild mit GPS-EXIF | Upload | GPS-Breite/-Länge + Aufnahmezeit gespeichert |
| T-26 (geplant) | Bestand 0 | Entnahme buchen | Buchung verhindert (kein negativer Bestand) |
| T-27 (geplant) | Monteur, Vorgang, Lagerort | Entnahme buchen | Bewegung mit `incident_id` + Lagerort |
| T-28 (geplant) | Vorgänge vorhanden | CSV-Export mit Filter | UTF-8-CSV, gefilterte Zeilen, vereinbarte Spalten |

## AP2 – Testfälle Vorgangsverwaltung
| ID | Vorbedingung | Schritte | Erwartung |
|---|---|---|---|
| AP2-01 | Als Disponent angemeldet | Dashboard öffnen | Kennzahlkarten + Tabelle „Aktuelle Vorgänge" sichtbar |
| AP2-02 | Vorgänge vorhanden | Filter Status/Baustufe/Monteur/Zeitraum + Suche anwenden | Tabelle filtert entsprechend, Zähler aktualisiert |
| AP2-03 | Als Disponent | „Vorgang anlegen", Pflichtfeld leer lassen, speichern | Fehlermeldung nennt fehlende Pflichtfelder |
| AP2-04 | Als Disponent | Vorgang vollständig anlegen | Redirect auf Detail, Status „Neu", Chronikeintrag „Vorgang erstellt" |
| AP2-05 | Vorgang offen | Monteur zuweisen | Zuweisung sichtbar, Status → „Monteur zugewiesen", Timeline-Eintrag |
| AP2-06 | Vorgang mit Monteur | Als Disponent Status ändern | Neuer Status + Chronikeintrag, Zeitstempel |
| AP2-07 | Als Monteur (zugewiesen) | Status auf „Vor Ort" setzen | Erlaubt; Chronikeintrag |
| AP2-08 | Als Monteur (zugewiesen) | Status „Abgeschlossen" versuchen | Auswahl nicht angeboten; DB-Trigger blockt zusätzlich |
| AP2-09 | Als Monteur | Fremden Vorgang per URL öffnen | Kein Zugriff (RLS) |
| AP2-10 | Priorität „Kritisch" gesetzt | Dashboard/Tabelle ansehen | Priorität farbig hervorgehoben |
| AP2-11 | Detailansicht | Mobil öffnen | Timeline unterhalb, Desktop rechts |

## AP3 – Testfälle Material/Lager
> DB-/RLS-seitig automatisiert verifiziert am 2026-07-19 über `app/supabase/test/11_ap3_smoke.sql`
> (alle Szenarien PASS). AP3-06 (Rückgabe > Restmenge) wird auf App-Ebene via
> `returnableQuantity` erzwungen und im Smoke-Test über dieselbe Rechenregel geprüft.
> AP3-01/02/03/10/11 zusätzlich manuell in der UI abzunehmen.

| ID | Vorbedingung | Schritte | Erwartung |
|---|---|---|---|
| AP3-01 | Als Admin | Material anlegen/bearbeiten/deaktivieren | Liste aktualisiert; kein Löschen möglich |
| AP3-02 | Als Admin | Lagerort anlegen/deaktivieren | Liste aktualisiert |
| AP3-03 | Bewegungen vorhanden | Bestandsübersicht öffnen | Istbestand je Material/Lager aus `material_stock` |
| AP3-04 | Als Admin | Wareneingang +10 buchen | Bestand steigt um 10 |
| AP3-05 | Monteur (zugewiesen) | Entnahme 3 mit Vorgang+Lager | Bestand −3; Bewegung im Vorgang sichtbar |
| AP3-06 | Entnahme vorhanden | Rückgabe > Restmenge versuchen | Fehler „größer als entnommene Restmenge" |
| AP3-07 | Bestand 7 | Entnahme 100 versuchen | Blockiert (kein negativer Bestand) |
| AP3-08 | Monteur | Entnahme ohne Vorgang | Nicht möglich (Vorgang erforderlich) |
| AP3-09 | Monteur (zugewiesen) | Verbrauch buchen | Erlaubt (additive RLS 0004); Bestand −Menge |
| AP3-10 | Bewegungen vorhanden | Materialhistorie filtern | Filter (Material/Lager/Vorgang/Person/Zeit/Typ) wirken |
| AP3-11 | min_stock gesetzt, Bestand ≤ min | Admin-Dashboard | Karte „Material unter Mindestbestand" zählt korrekt |
