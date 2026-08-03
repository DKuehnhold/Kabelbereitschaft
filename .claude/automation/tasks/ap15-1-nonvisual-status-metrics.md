# Architekturauftrag: AP15-1 – verhaltensgleiche RLS-gebundene Statuskennzahlen

## Ausgangslage

- main steht auf a86d7a6; die finalen main-Läufe CI 30791223313 und Container-Image 30791223304 sind completed/success.
- Das read-only Inventar kb-ap15-nonvisual-inventory-architecture ist abgeschlossen.
- Dashboard und meine-einsaetze laden heute listIncidents() als unbeschränkte Vollmenge und aggregieren Statuskennzahlen in JavaScript.
- /vorgaenge nutzt incident_list_view, serverseitige Filter und Paginierung.
- Sichtbare Tabellen-, Filter-, Kachel- und Aufgabenentscheidungen warten auf Dennis und sind nicht Teil dieses Auftrags.

## Ziel

Führe einen ersten rein nicht-visuellen AP15-Implementierungsschritt aus: statusbasierte Dashboardkennzahlen werden in einer RLS-gebundenen PostgreSQL-Abfrage über incident_list_view berechnet. Angezeigte Werte und sichtbare Oberfläche müssen für den heutigen fachlichen Stand unverändert bleiben. Tageskennzahlen, Listen und sichtbare Aufgabenintegration bleiben ausdrücklich unverändert.

## Verbindliche Architektur

1. Neues Modul app/src/lib/incident-metrics.ts mit genau einer öffentlichen Serverfunktion für Statuskennzahlen.
2. Jede Abfrage läuft ausschließlich in withUserTransaction() unter der transaktionslokalen Benutzeridentität und der bestehenden nichtprivilegierten Runtime-Rolle.
3. Datenquelle ist public.incident_list_view mit security_invoker/RLS; keine neue View und keine Migration.
4. Offene Statuswerte werden aus der zentralen TERMINAL_STATUS-Definition abgeleitet. Keine zweite, divergierende Statusliste.
5. Werte werden über feste SQL-Struktur und gebundene Parameter berechnet. Keine Interpolation von Eingabewerten.
6. Die Metrik liefert mindestens:
   - offen,
   - technisch_abgeschlossen,
   - warten_auf_db,
   - warten_auf_material,
   - monteure_im_einsatz als Anzahl verschiedener aktiver monteur_ids in offenen Vorgängen.
7. Dashboard und meine-einsaetze verwenden nur für diese statusbasierten Zahlen die neue Funktion. Die gerenderten Listen bleiben auf listIncidents(), damit kein sichtbarer Tabellen-/Listenumbau erfolgt.

## Positivliste

- app/src/lib/incident-metrics.ts neu
- app/src/app/(app)/dashboard/page.tsx
- app/src/app/(app)/meine-einsaetze/page.tsx
- app/test/ap15-incident-metrics.test.mjs neu
- app/test/integration/ap15-dashboard-metrics.int.mjs neu
- app/supabase/test/24_ap15_dashboard_metrics.sql neu
- app/supabase/test/run_db_tests.sh
- app/supabase/test/run_ap14b_local.ps1
- Falls zwingend für Modulimport/Tests erforderlich: app/test/integration/module-hooks.mjs nur nach expliziter Begründung; bevorzugt unverändert.
- Claude darf spezialisierte Claude-Agents einsetzen; im Vault schreibt höchstens ein Agent gleichzeitig.

## Negativliste

- Keine Migration, kein Schemaobjekt, kein grant/revoke und keine Änderung an 0001–0017.
- Keine Änderung an app/src/lib/incidents.ts, insbesondere nicht CLOSED_STATUS oder activity-Filter.
- Keine Änderung der Tageskennzahlen Heute erstellt / Heute übernommen und ihrer Zeitzonenlogik.
- Keine Änderung der Datenquelle oder Props von IncidentsTable und EinsatzListe.
- Kein Entfernen von listIncidents(), kein CSV-Umbau, keine Paginierungs-/Filteränderung.
- Keine Änderung an JSX-Struktur, sichtbaren Texten, Kachelanzahl/-reihenfolge, Tailwind-Klassen oder Accent-Werten.
- Keine Aufgaben-Kacheln oder sichtbare AP13-Integration.
- Keine Änderung an getTodaysImageCount(), getLowStockMaterials(), Auth-, Bild-, Inventar- oder Stammdatenmodulen.
- Kein SECURITY DEFINER, keine RLS-Umgehung, kein privilegierter Runtime-Read.
- Keine Workflow-, package.json-, Lockfile-, Next-Konfigurations- oder Abhängigkeitsänderung.
- Kein Commit, Push, Merge, Tag oder Release.
- 07-Betrieb/IT_ANFRAGE_INFRASTRUKTUR.md nicht anfassen.

## Fachliche Gleichheit

- offen entspricht exakt rows.filter(isOpenStatus).length.
- technisch_abgeschlossen entspricht exakt dem bisherigen Statusvergleich.
- warten_auf_db und warten_auf_material entsprechen exakt den bisherigen Statusvergleichen.
- monteure_im_einsatz entspricht exakt der bisherigen Anzahl verschiedener aktiver Monteur-Zuweisungen in offenen Vorgängen; incident_list_view.monteur_ids enthält nur aktive Zuweisungen.
- Für Monteur, Disponent und Admin muss das DB-Aggregat denselben Wert wie die bisherige JS-Auswertung der jeweils RLS-sichtbaren listIncidents()-Zeilen liefern.
- Ein fremder Monteur darf weder Zeilen noch Counts fremder Vorgänge gewinnen.

## Definition of Done

1. Positiv- und Negativliste sind vollständig eingehalten.
2. Das neue Modul hat eine kleine, klar typisierte Rückgabe und nutzt genau eine identitätsgebundene DB-Transaktion/Abfrage pro Aufruf.
3. Die beiden Seiten ändern ausschließlich Imports, Datenabruf und Wertquellen; JSX, Texte, Klassen, Reihenfolge und Listenprops sind im Diff zeichengleich.
4. Unit-Tests belegen mindestens zentrale Ableitung der offenen Statusmenge, Rückgabeform und keine Wiederholung einer abweichenden Terminalstatusliste.
5. Integrationstest gegen echtes PostgreSQL 18 vergleicht neue DB-Metrik mit der bisherigen JS-Aggregation mindestens für Admin, Disponent, zugewiesenen Monteur und fremden Monteur. Er läuft fail-closed nur im Pflichtmodus und wird in beiden bestehenden Runnern aufgenommen.
6. Smoke 24 belegt RLS-sichere Counts je Rolle, einschließlich Monteur-Gesamtzahl ohne Zählleck. Keine freien SECURITY-DEFINER-Helfer.
7. TypeScript, vollständiges ESLint, mindestens 84 bestehende plus neue Unit-Tests, Produktions-Build und git diff --check sind Exit 0.
8. Vollständiger PostgreSQL-18-Gesamtlauf: Migrationen 0001–0017 unverändert, Smokes 15–24, alle bisherigen Integrationssuiten und die neue AP15-Suite grün, Pflichtmodus gesetzt, skipped 0.
9. Temporäres Cluster, Testdatenbank, Rolle, Port, Arbeitsverzeichnis und sonstige synthetische Artefakte sind vollständig entfernt; Aufräumbilanz belegt.
10. Vollständiger Diff, Befehle, Exitcodes, Testzahlen, Aufräumbilanz und nicht ausgeführte Prüfungen werden als Evidence geliefert.

## Stopppunkt

Nach der nicht-visuellen Statuskennzahlenschicht und den Nachweisen stoppen und an Codex übergeben. Sofort ohne Scope-Ausbau stoppen, falls eine sichtbare JSX-/Designänderung, Änderung der Tagesgrenze, Änderung des fehlalarm-Verhaltens, neue Migration, neue Berechtigung oder ein echter IT-Zugang erforderlich wäre.

## Evidence je Agent

Jeder beteiligte Claude-Agent nennt Rolle, gelesene/geänderte Dateien, konkrete Befunde, Befehle mit Exitcodes, nicht ausgeführte Prüfungen und bestätigt die Negativliste. Der Orchestrator liefert zusätzlich Positivlistenabgleich, Negativlistenabgleich, DoD-Matrix, Stopppunkt, Sicherheitsbewertung und Restrisiken.
