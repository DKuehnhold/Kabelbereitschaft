# Architekturauftrag: AP15-2 – quellentreue operative Dokumentkonsolidierung

## Ausgangslage

- `main` und `origin/main` stehen nach AP15-1-Dokumentation auf `f35a354`.
- AP15-1 ist technisch und in der CI abgeschlossen: Fachcommit `8b65f4e`, CI
  `30800335370` und Container-Image `30800335380` jeweils `completed/success`.
- Das AP15-Inventar hat aktuelle Betriebs- und Einstiegsdokumente mit überholten
  Supabase-, Migrations- und Testaussagen belegt. Historische Dokumente dürfen nicht
  still umgeschrieben oder archiviert werden.
- Zielplattform bleibt PostgreSQL 18 + Auth.js v5 + MinIO + Container hinter internem
  Reverse-Proxy. Supabase Cloud und selbst gehostetes Supabase sind ausgeschlossen.

## Ziel

Konsolidiere ausschließlich die aktuellen Einstiegs-, Betriebs-, Backup- und
Changelog-Aussagen auf den belegten Ist-Stand. Trenne tatsächlichen technischen Bestand,
noch offene Zielinfrastruktur und historische Pfadnamen klar. Keine Produktänderung,
keine Archivierung, kein Löschen und keine erfundene Betriebsfreigabe.

## Positivliste

- `README.md`
- `app/README.md`
- `app/supabase/README.md` – Pfad bleibt aus historischen Gründen unverändert; Inhalt
  erklärt den heutigen PostgreSQL-18-Migrations- und Testbestand.
- `07-Betrieb/BETRIEB.md`
- `07-Betrieb/BACKUP_UND_RECOVERY.md`
- `00-Projektsteuerung/CHANGELOG.md` – ausschließlich neue Einträge oberhalb der
  bestehenden Historie; bestehende Einträge nicht still korrigieren.
- `PROJEKT_WISSEN.md` und `PROJEKTSTATUS.md` nur für eine knappe Abschlussnotiz nach
  tatsächlich bestandener Prüfung.
- `.claude/automation/status/fortschritt.json` nach Staffelstab.
- Read-only Quellprüfung von Git-Historie, Workflows, `deploy/`, Migrationen 0001–0017,
  Test-Runnern und führenden Projektdateien.

## Verbindliche Inhalte

1. README-Dateien nennen den aktuellen Stack und verweisen auf die tatsächlich vorhandenen
   Start-, Migrations-, Test- und Deploymentwege. Keine Supabase-URL, kein Anon-Key, keine
   Supabase-CLI und keine Migrationen 0001–0004 als aktueller Stand.
2. `app/supabase/README.md` erklärt den historischen Verzeichnisnamen, ohne einen neuen Ordner,
   eine Umbenennung oder eine zweite Migrationsquelle zu erzeugen. Aktueller Stand ist 0001–0017.
3. `BETRIEB.md` beschreibt nur belegte lokale/CI-Wege und trennt sie ausdrücklich von dem noch
   nicht ausgeführten produktiven Deployment. Echte IT-Adressen bleiben offen.
4. `BACKUP_UND_RECOVERY.md` ersetzt die aktuelle Supabase-Zielannahme durch PostgreSQL 18,
   MinIO und die nötige gemeinsame Konsistenzgrenze. Keine konkrete Aufbewahrungsfrist erfinden;
   Recovery-Test und produktive Sicherung bleiben offen, solange nicht nachgewiesen.
5. Der führende Changelog erhält neue, quellentreue Einträge für AP12, AP13, AP14/A, AP14/B
   (Daten, Stammdaten/Inventar, MinIO, Benutzerverwaltung) und AP15-1. Commits und CI-IDs nur
   aus Git bzw. den führenden Projektdateien übernehmen. Bestehende historische Zeilen bleiben
   unverändert.
6. Widersprüche zwischen Quellen werden als Befund gemeldet; keine Entscheidung durch
   stilles Überschreiben.

## Negativliste

- Keine Änderung an Produktcode, SQL, Migrationen, Tests, Workflows, Deploy-Skripten,
  Abhängigkeiten oder Konfiguration.
- Keine Änderung an `AGENTS.md`, `CLAUDE.md`, ADRs, Roadmap-Historienzeilen,
  `00-Projektsteuerung/PROJEKTSTATUS.md`, Root-`CHANGELOG.md`, Release Notes oder
  `OFFENE_PUNKTE.md` in diesem Schritt.
- Keine Datei verschieben, umbenennen, archivieren oder löschen; `_sandbox_write_test` nicht
  anfassen.
- Keine Behauptung zu produktivem Backup, Restore, Deployment, DNS, Reverse-Proxy, Browser-
  oder Offline-Abnahme ohne echten Nachweis.
- Keine Aufbewahrungsfrist, kein RC1-, V1-, Tag- oder Release-Status erfinden oder freigeben.
- Keine echte IT-Verbindung und kein externer Cloud-Dienst.
- Kein Commit, Push, Merge, Tag oder Release durch Claude oder einen Agenten.
- `07-Betrieb/IT_ANFRAGE_INFRASTRUKTUR.md` nicht anfassen oder als Projektbestand vereinnahmen.

## Definition of Done

1. Jede geänderte aktuelle Aussage ist auf Repositoryquelle, Commit oder CI-Nachweis
   zurückgeführt; keine erfundenen Nachweise.
2. Die sechs operativen Dokumente nennen konsistent PostgreSQL 18, Auth.js v5, MinIO und
   Containerbetrieb hinter internem Reverse-Proxy; Supabase erscheint dort nur noch eindeutig
   als historischer Altstand bzw. im historischen Pfadnamen.
3. Migrationsstand 0001–0017 und aktuelle Runner/CI-Wege sind korrekt; Testmengen nur nennen,
   wenn sie aus dem bestätigten Stand stammen.
4. Backup/Recovery trennt Konzept, offenen Betreiberentscheid und noch fehlenden echten
   Recovery-Test. Datenbank- und Objektstand werden als gemeinsam zu sichernde Einheit behandelt.
5. Changelog wird append-only ergänzt; bestehende Historie bleibt bytegleich.
6. Markdown-Links und referenzierte Pfade existieren; `git diff --check` ist Exit 0.
7. Der vollständige Diff enthält ausschließlich die Positivliste; die fremde IT-Datei bleibt
   unangetastet. Vorher-/Nachher-Status und nicht ausgeführte Prüfungen werden geliefert.

## Stopppunkt

Nach dieser operativen Dokumentkonsolidierung stoppen und an Codex übergeben. Sobald eine
Archivierung, Löschung, Umbenennung, sichtbare Produktentscheidung, Aufbewahrungsentscheidung,
echte IT-Angabe oder endgültige Releaseentscheidung nötig wäre, nur den belegten Blocker melden.

## Evidence je Agent

Jeder beteiligte Claude-Agent nennt Rolle, gelesene/geänderte Dateien, konkrete Quellen,
Positiv-/Negativlistenabgleich, ausgeführte Befehle mit Exitcodes, nicht ausgeführte Prüfungen
und Stopppunkt. Der Orchestrator prüft den Gesamt-Diff selbst und liefert zusätzlich eine
Quellenmatrix je geänderter Aussage. Schreibende Agenten laufen strikt sequenziell; read-only
Prüfagenten dürfen parallel laufen; kein Agent startet weitere Agents.
