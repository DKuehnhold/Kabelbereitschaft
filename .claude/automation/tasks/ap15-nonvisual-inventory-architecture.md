# Architekturauftrag: AP15 Phase 1 – nicht-visuelles Inventar und Umsetzungsgrenzen

## Ausgangslage

- main steht nach abgeschlossenem AP14B-Backend und finaler Dokumentation auf a86d7a6.
- CI 30791223313 ist mit verify, database, container und objectstore vollständig grün; Container-Image 30791223304 ist ebenfalls grün.
- AP14 insgesamt bleibt wegen echter IT-Adressen, Same-Origin-Reverse-Proxy, produktivem Deployment, vollständiger Browser-/Offline-Abnahme und CSP-Auswertung offen.
- Sichtbare GUI-/Designentscheidungen, V1, RC1-Tag und endgültige Releasefreigabe bleiben Dennis vorbehalten.
- Roadmap B.5 nennt für AP15: eine Leseschicht für Vorgangslisten, rollenspezifische Dashboarddaten inklusive AP13-Aufgaben, kontrollierte Dokumentkonsolidierung und RC1-Vorbereitung.

## Ziel

Erstelle als Claude-Orchestrator ein ausschließlich read-only Architektur- und Bestandsinventar für den ersten nicht-visuellen AP15-Implementierungsblock. Liefere Codex eine belastbare, eng geschnittene Folgeaufgabe, die bestehende Dashboard-UI und Gestaltung unverändert lässt.

## Positivliste

- Read-only Analyse von app/, 00-Projektsteuerung/, 01-Architektur/, 02-Datenmodell/, 04-UI-UX/, 05-Tests/, 07-Betrieb/, README.md, PROJEKTSTATUS.md, PROJEKT_WISSEN.md, CHANGELOG-Dateien und Git-Status/Historie.
- Read-only Ausführung statischer Suchläufe und vorhandener Tests, sofern keine dauerhaften Artefakte entstehen.
- Claude darf spezialisierte Claude-Agents parallel read-only einsetzen.
- Als einzige Vault-Schreiboperation ist die Pflege von .claude/automation/status/fortschritt.json bei Übergabe zulässig.

## Negativliste

- Keine Änderung an versionierten Dateien, Produktcode, Schema, Tests, Dokumenten oder Workflows.
- Kein Verschieben, Archivieren, Löschen oder Umbenennen.
- Keine sichtbare Dashboard-/GUI-/Designentscheidung.
- Keine neue Migration, neue Fachfunktion, Benachrichtigung, Karte oder Nach-RC1-Funktion.
- Kein Zugriff auf echte IT-Verbindungsdaten; keine externen Cloud-Dienste.
- Kein Commit, Push, Merge, Tag oder Release.
- 07-Betrieb/IT_ANFRAGE_INFRASTRUKTUR.md nicht anfassen und nicht als Projektbestand vereinnahmen.

## Pflichtinventar

1. Dashboard-Lesepfade:
   - alle produktiven Dateien und Funktionen, die Dashboard-Kennzahlen oder Dashboard-Vorgangslisten laden,
   - alle produktiven Dateien und Funktionen hinter /vorgaenge und incident_list_view,
   - konkrete Doppelführungen, abweichende Filter/Rollenregeln, N+1- oder Aggregatrisiken,
   - AP13-Aufgabenquellen für Admin/Disposition und Monteur.
2. Sicherheitsgrenzen:
   - wie RLS/Transaktionsidentität für Listen, Counts und Aufgaben erhalten bleibt,
   - Gefahr von Zähllecks und konkrete Testfälle pro Rolle,
   - ob eine neue View/Migration wirklich nötig ist; bevorzugt keine Migration.
3. Nicht-visueller Implementierungsschnitt:
   - exakte Positivliste für einen ersten Codeauftrag,
   - exakte Negativliste,
   - erwarteter Diff und entfernbare Alt-Reads,
   - DoD mit TypeScript, ESLint, Unit-, Integrations-, PostgreSQL- und Buildnachweisen,
   - klare Abgrenzung dessen, was wegen sichtbarer GUI-Entscheidung auf Dennis wartet.
4. Dokumentkonsolidierung:
   - je Thema führendes Dokument und gefundene Dubletten für Projektstatus, Changelog, Backup/Recovery und AP8-Bericht,
   - vorhandener _sandbox_write_test-Bestand,
   - README-Migrationsangaben und tatsächlicher Stand 0001–0017,
   - kontrollierter Archivplan ohne Ausführung und ohne Historienverlust.
5. RC1-Grenze:
   - Liste der noch nicht erfüllten harten Gates; keine RC1-, V1-, Tag- oder Releaseaussage.

## Definition of Done

1. Für jeden Befund werden Datei und Zeile/Funktion genannt; keine Vermutungen als Tatsachen.
2. Dashboard und /vorgaenge werden als Datenfluss vom Einstieg bis zur PostgreSQL-Abfrage gegenübergestellt.
3. Die kleinste sinnvolle erste AP15-Implementierung ist mit Positivliste, Negativliste, DoD und Stopppunkt formuliert.
4. Sichtbare Entscheidungen werden separat aufgelistet, aber Dennis wird in diesem Audit nicht gefragt.
5. Dokumentdubletten und Archivkandidaten sind vollständig inventarisiert, ohne sie zu verändern.
6. Ausgeführte Befehle/Tests und Exitcodes sowie nicht ausgeführte Prüfungen werden ehrlich als Evidence berichtet.
7. Git-Status vor/nach Audit wird verglichen; außer fortschritt.json entsteht kein Diff.

## Stopppunkt

Nach Inventar, Risikobewertung und einem direkt ausführbaren Folgeauftrag an Codex stoppen. Bei unklarer Führungsdatei, möglichem Datenverlust durch Archivierung, notwendiger sichtbarer UI-Entscheidung oder erforderlichen echten IT-Zugängen nur den Blocker benennen und nicht handeln.

## Evidence je Agent

Jeder beteiligte Claude-Agent nennt Rolle, gelesene Pfade, konkrete Befunde mit Quellen, Befehle mit Exitcodes, nicht ausgeführte Prüfungen und bestätigt die Negativliste. Der Orchestrator liefert zusätzlich Datenflussvergleich, Dokumentinventar, Folgeauftrag, DoD-Matrix, Stopppunkt und Restrisiken.
