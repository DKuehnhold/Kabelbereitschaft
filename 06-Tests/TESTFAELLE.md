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

## AP4 – Testfälle Bilddokumentation / CSV
> DB-/RLS-/Trigger-seitig automatisiert verifiziert am 2026-07-19 über
> `app/supabase/test/12_ap4_smoke.sql` (20/20 OK); CSV-Sicherheit über Node-Test
> zu `src/lib/csv.ts` (12/12 OK). UI-Fälle (Upload/Vorschau/Download im Browser) manuell abzunehmen.

| ID | Vorbedingung | Schritte | Erwartung |
|---|---|---|---|
| AP4-01 | Monteur (zugewiesen) | JPG hochladen | Upload erfolgreich, Bild in Galerie |
| AP4-02 | Monteur (zugewiesen) | PNG hochladen | Upload erfolgreich |
| AP4-03 | Berechtigt | Mehrere Bilder gleichzeitig | Alle hochgeladen |
| AP4-04 | Berechtigt | Datei mit falschem Typ (z. B. .txt/HEIC) | Blockiert (nur JPG/PNG) |
| AP4-05 | Berechtigt | Datei > Maximalgröße | Blockiert (Client-Hinweis + Storage-Limit) |
| AP4-06 | — | Upload ohne Vorgang | Blockiert (incident_id Pflicht) |
| AP4-07 | Monteur (zugewiesen) | Upload | Erfolgreich (RLS) |
| AP4-08 | Monteur (nicht zugewiesen) | Upload in fremden Vorgang | Blockiert (RLS) |
| AP4-09 | Kein Login/keine Berechtigung | Direktzugriff auf Objekt ohne signierte URL | Blockiert (privat + Storage-RLS) |
| AP4-10 | Berechtigt | Bild in Galerie öffnen | Anzeige über signierte URL |
| AP4-11 | Bild mit EXIF | Upload | Aufnahmedatum/Kamera/GPS/Ausrichtung gespeichert |
| AP4-12 | Bild ohne EXIF | Upload | Erfolgreich, EXIF-Felder leer |
| AP4-13 | Bild mit gültigem GPS | Upload | GPS gespeichert, Maps-Link in Großansicht |
| AP4-14 | Bild mit ungültigem GPS | Upload | GPS verworfen (Validierung + Constraint) |
| AP4-15 | Vorhandenes Bild | Kategorie ändern | Chronik- + Audit-Eintrag |
| AP4-16 | Vorhandenes Bild | Beschreibung ändern | Chronik- + Audit-Eintrag |
| AP4-17 | Vorhandenes Bild | Soft-Delete | Bild aus Galerie ausgeblendet |
| AP4-18 | Vorhandenes Bild | Soft-Delete | Chronik- + Audit-Eintrag, `deleted_at/by` gesetzt |
| AP4-19 | — | AP1-Kategorie (z. B. Schadstelle) wählen | Weiterhin gültig |
| AP4-20 | — | AP4-Kategorie (z. B. Reparatur) wählen | Auswählbar |
| AP4-21 | Gefilterte Übersicht | CSV-Export | Nur gefilterte Vorgänge enthalten |
| AP4-22 | Werte mit `;` / `"` / Umbruch | CSV-Export | Korrekt maskiert |
| AP4-23 | Wert beginnt mit `= + - @` | CSV-Export | Mit Apostroph neutralisiert (keine Formel) |
| AP4-24 | Admin/Disposition/Monteur | Bilder ansehen | RLS: nur berechtigte Bilder sichtbar |
| AP4-25 | Bilder heute hochgeladen | Dashboard | Kennzahl zählt nur heutige, nicht gelöschte Bilder |

## AP5 – Testfälle Offline / PWA
> Build-/Typ-/SW-/Migrations-Regression automatisch verifiziert (2026-07-19). Die Runtime-Fälle
> (offline im Browser) sind manuelle QA – erwartetes Verhalten siehe OFFLINE.md / PWA.md.

| ID | Vorbedingung | Schritte | Erwartung |
|---|---|---|---|
| AP5-01 | App online besucht | Netzwerk trennen, App neu laden | Offline-Start: Shell/Offline-Seite lädt |
| AP5-02 | Dashboard zuvor geöffnet | Offline Dashboard aufrufen | Aus Cache lesbar |
| AP5-03 | Vorgang zuvor geöffnet | Offline Vorgang öffnen | Detail + Timeline aus Cache lesbar |
| AP5-04 | Offline | Notiz erfassen | Vorgemerkt (Outbox), kein Verlust |
| AP5-05 | Offline | Statusänderung vormerken | In Outbox gespeichert |
| AP5-06 | Offline | Bild zur Warteschlange | Upload-Queue-Eintrag angelegt |
| AP5-07 | Offene Outbox | Verbindung wiederherstellen | Automatische Synchronisation |
| AP5-08 | Wartende Uploads | Reconnect | Upload mit Fortschritt, dann entfernt |
| AP5-09 | Upload läuft | Abbrechen | Upload gestoppt, Eintrag entfernt |
| AP5-10 | Fehlgeschlagener Sync | „Jetzt synchronisieren" | Erneuter Versuch |
| AP5-11 | Vorgang serverseitig geändert | Offline-Status synchronisieren | Konflikt gemeldet, keine Überschreibung |
| AP5-12 | — | App installieren | Installierbar (Manifest/Icons/Theme) |
| AP5-13 | — | Service Worker | Registriert, cacht Shell/Assets |
| AP5-14 | Neue Version (CACHE_VERSION) | SW aktiviert | Alte Caches gelöscht (Invalidierung) |
| AP5-15 | Offline | Dashboard-Kennzahlen | „Offline vorgemerkt/Wartende Uploads/Letzte Sync" korrekt |
| AP5-16 | — | Sicherheit | Keine Tokens/Secrets in IndexedDB/Cache |

## AP6 – E2E / Idempotenz / Konflikt (automatisiert, Playwright + DB)
> Ausführung: DB/Idempotenz automatisiert verifiziert; `@public`-E2E teils gegen Prod-Server
> ausgeführt; seitenbasierte/`@app`-E2E benötigen Browser-Systembibliotheken bzw. Test-Supabase.

| ID | Bereich | Erwartung |
|---|---|---|
| AP6-01 | Manifest (@public) | erreichbar, korrekte Metadaten/Icons |
| AP6-02 | Service Worker (@public) | ausgeliefert, versioniert (`CACHE_VERSION`) |
| AP6-03 | Offline-Seite/Guard (@public) | Offline-Fallback erreichbar; geschützte Route → /login |
| AP6-04 | Auth (@app) | Login gültig/ungültig, Logout, Rollen-Nav, API/URL-Schutz |
| AP6-05 | Vorgänge/CSV (@app) | Übersicht/Filter/Detail/Timeline/Notiz, gefilterter CSV-Download |
| AP6-06 | Bilder (@app) | Upload erscheint in Galerie; Fremdzugriff blockiert |
| AP6-07 | Offline (@app) | Erkennung, Notiz/Status/Upload-Queue, Persistenz nach Reload |
| AP6-08 | Sync (@app) | Reconnect-Flush, Retry, keine Dubletten, letzter Sync-Zeitpunkt |
| AP6-09 | Idempotenz (DB `13`) | gleiche Client-Action-ID dedupliziert; RLS trennt Benutzer |
| AP6-10 | Konflikt (@app) | Serveränderung erkannt; keine stille Überschreibung; Auflösung |
| AP6-11 | Datenschutz (@app) | keine Tokens/Secrets in IndexedDB |

## AP7 – Release-/Security-Testfälle
| ID | Bereich | Erwartung | Ausführung |
|---|---|---|---|
| AP7-01 | Health-Check `/api/health` | Status ok, Version/Zeit, keine Secrets | automatisiert (bestanden) |
| AP7-02 | Sicherheitsheader | nosniff, Referrer/Frame/Permissions gesetzt | automatisiert (bestanden) |
| AP7-03 | Supply-Chain-Audit | keine hoch/kritisch | automatisiert (bestanden) |
| AP7-04 | Secrets-Scan | keine Secrets/.env im Repo | ausgeführt (bestanden) |
| AP7-05 | RLS/Storage-Matrix | Zugriffe rollen-/besitzergerecht | DB-Smokes 10–13 (bestanden) |
| AP7-06 | Idempotenz/Race | keine Dublette bei Retry | Smoke 13 (bestanden); Browser-Parallelität offen |
| AP7-07 | Accessibility (axe) | keine kritischen Verstöße (/login, /offline) | Struktur vorhanden; Browserlauf offen |
| AP7-08 | CSP durchsetzend | keine Funktion blockiert | offen (Report-Only, Browser-Verifikation) |
| AP7-09 | Benutzerwechsel offline | keine fremden Daten, keine stille Löschung | Logik vorhanden; Browserprüfung offen |
| AP7-10 | Recovery-Test | Wiederherstellung mit Testdaten | offen (Zielinfrastruktur) |
