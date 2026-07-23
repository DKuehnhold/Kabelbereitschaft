# Arbeitspaket 11 – Operative Vorgangsliste (Umsetzungsbericht)

Status: umgesetzt und lokal verifiziert. Additiv/read-only. Commit: `feat: implement operational incident list (AP11)`.

## 1. Implementierter Umfang
`/vorgaenge` ist die zentrale operative Arbeitsliste für Admin und Disposition (staff-only).
Serverseitige Suche, Filter, Mehrfachsortierung und Pagination; Desktop-Tabelle (Sticky Header)
und Mobile-Karten; Kabelarten- und Monteurdarstellung; abgeleitete „offene Hinweise";
Zeilenauswahl + vorbereitete Massenaktionsleiste; CSV-Export der vollständigen gefilterten Menge.
Ausschließlich AP8-Designsystem, keine externe UI-Bibliothek. Dashboard bleibt bis AP15 unverändert.

## 2. Listenarchitektur / Server-Client-Aufteilung
Server Component `/vorgaenge/page.tsx` liest die URL-Parameter (Suche/Filter/Sortierung/Seite/
Seitengröße) über `parseIncidentListQuery`, lädt die berechtigte Seite via `listIncidentsPaged`
und die Filteroptionen via `getIncidentListFilterOptions`. Die **URL ist die verbindliche
Zustandsquelle**. Client Component `OperationalList` rendert nur die gelieferte Seite und
manipuliert die URL (Suche/Filter/Sortierung/Pagination/Seitengröße/Auswahl/Export). Die
vollständige Liste wird nicht clientseitig geladen/gefiltert/sortiert.

## 3. Erweiterte Incident-Reads
Migration `0009_ap11_incident_list_view.sql`: RLS-konforme View `incident_list_view`
(`security_invoker = true` → RLS der Basistabellen greift für den aufrufenden Benutzer, keine
Service-Role). Flache Felder + Aggregate (Bildanzahl nur nicht gelöschte, Kabelarten, aktive
Monteure inkl. `monteur_ids`), abgeleitete Booleans (no_monteur/no_images/no_cable/historic_vzg),
`created_date_local` (Europe/Berlin) und `search_text`. Reads in `incidents.ts`:
`listIncidentsPaged` (Filter/Sort/Pagination + exakter Count) und `listIncidentsForExport`
(Cap 5.000). Keine parallele Listenimplementierung, keine N+1-Abfragen.

## 4. Datenumfang je Zeile
id, incident_no, status, priority, Kunde, Bauabschnitt (Code/Name), VzG (+historischer
`vzg_line_number`-Fallback), Betriebsstelle, km von/bis, Bereitschaftsnummer, alle Kabelpositionen
(zusammengefasst), Erstellt/Geändert, Ersteller, aktive Monteure, Bildanzahl, offene Hinweise.

## 5. Filter / Suche / Sortierung / Pagination
Filter (kombinierbar): Status, Priorität, Kunde, Bauabschnitt, VzG, Bereitschaftsnummer, Monteur
(über `monteur_ids`), Erstellt von, Datum von/bis (lokal, inklusive, tz-korrekt über
`created_date_local`), Bilder (Alle/Mit/Ohne), Aktivität (Alle/Aktiv/Abgeschlossen – konkreter
Statusfilter hat Vorrang), Freitextsuche. Suche serverseitig über `search_text` (Nr., Kunde,
Bauabschnitt-Code/Name, VzG, historische VzG, Betriebsstelle, Beschreibung, ext. Referenz),
`ilike` mit escaptem Term (kein SQL-Injektions-/Wildcardrisiko). Mehrfachsortierung über
`sort=feld:richtung,…` mit Klickfolge auf/ab/entfernt, sichtbarer Reihenfolge und stabiler
Standardsortierung `updated_at desc, incident_no desc`. Pagination serverseitig (50/100/250),
Bereichs-/Gesamtanzeige, ungültige Seite wird normalisiert; Filter-/Sortier-/Größenänderung setzt
Seite auf 1.

## 6. Darstellung
Desktop: große Tabelle, Sticky Header, horizontaler Scrollcontainer, Token-Hover, Zeilenklick →
Detailseite (Checkbox/Link stoppen Navigation), sortierbare Spaltenköpfe. Mobile: Kartenansicht mit
gleicher Datenbasis/Filter/Auswahl/Detailnavigation. Kabelarten als `Badge`-Chips (gleiche Art
zusammengefasst, „Keine Kabelart" bei historischen Vorgängen). Monteure kompakt
(„Name, Name +N" / „Nicht zugewiesen"). Offene Hinweise als Anzahl + Warn-Badges/Tooltip.

## 7. Offene Hinweise
Kein Aufgabenmodell, keine Mutation/Audit. Abgeleitet aus vorhandenen Daten: „Kein Monteur
zugewiesen", „Keine Bilder vorhanden", „Keine Kabelposition vorhanden", „Historische
VzG-Zuordnung". `deriveOpenHints` ist so gebaut, dass später eine echte Aufgabenanzahl ergänzt
werden kann.

## 8. Auswahl & Massenaktionen (Vorbereitung)
Zeilen-Checkbox, „alle auf dieser Seite", Auswahl aufheben, Anzahl. Aktionsleiste mit „Status
ändern" und „Monteur zuweisen" (deaktiviert, „noch nicht verfügbar") sowie „Auswahl exportieren"
(client-seitiger CSV der ausgewählten Zeilen). Keine Bulk-Mutation, keine Bulk-Server-Action.

## 9. CSV-Export
Vollständige gefilterte Treffermenge mit aktueller Sortierung, ohne Pagination, über die
bestehende `lib/csv.ts` (UTF-8-BOM, Semikolon, Formel-Injektionsschutz). Serveraktion
`exportIncidentList` (RLS greift, kein Audit). Exportobergrenze 5.000 Datensätze; Benutzerhinweis
und exportierte Anzahl werden angezeigt.

## 10. Badge-Umstellung
`StatusBadge`/`PriorityBadge` nutzen jetzt das AP8-`Badge`-Primitive mit Tones
(`STATUS_TONE`/`PRIORITY_TONE`): neu→info, in_bearbeitung/warten*→warning,
technisch_abgeschlossen/abgeschlossen→success, storniert/fehlalarm→danger; Priorität
niedrig/normal→info, hoch→warning, kritisch→danger. Keine Farbklassen in der Liste. Betrifft
technisch auch das Dashboard (gleiche Komponenten), fachlich unverändert.

## 11. RLS / Audit / Offline
RLS unverändert; die View ist `security_invoker`, Count/Filter/Export zeigen nur berechtigte
Vorgänge; keine Service-Role. Liste erzeugt keine Audit-Einträge. `lib/offline/*` unverändert;
keine Offline-Liste. Verifiziert: Admin=2, Monteur A (zugewiesen)=1, Monteur B=0.

## 12. Performance
Serverseitige Pagination (`.range`) + exakter Count; Aggregate in der View (kein App-N+1).
Test mit 600 Vorgängen: Seitenabfrage (50) ~97 ms, Count ~15 ms, Suche funktionsfähig.

## 13. Testergebnisse (lokal)
- `npx tsc --noEmit`: 0 Fehler.
- `npx eslint`: 0 Fehler.
- `npx next build`: erfolgreich (`/vorgaenge` als dynamische Route).
- Migration 0009 auf 0001–0008 angewendet; AP11-Smoke (`16_ap11_list.sql`): 8/8 OK
  (RLS staff/monteur, Aggregate, Hinweise, Suchtext, Aktivitätsfilter, lokales Datum).
- Performance (600 Vorgänge): Seite/Count/Suche wie oben.
- Regression: Smokes 11 (16), 13 (5), 14 (26), 15 (12) – alle grün.
- Nicht ausführbar: Browser-E2E, Push (privates Repo, keine Zugangsdaten).

## 14. Offene Punkte
- Massenaktionen „Status ändern"/„Monteur zuweisen" sind vorbereitet, aber (bewusst) nicht
  funktional (spätere APs mit Bulk-Server-Actions).
- „Offene Hinweise" sind abgeleitet; ein echtes Aufgabenmodell bleibt späteren APs vorbehalten.
- Dashboard-Umstellung auf die neue Liste erst in AP15.
- Push AP4–AP11 durch den Nutzer.
