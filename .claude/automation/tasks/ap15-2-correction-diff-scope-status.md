# Korrekturauftrag: AP15-2 – Diffumfang und operative Statusfakten

## Ausgangslage

Der AP15-2-Gesamtdiff umfasst acht versionierte Dokumente: sechs operative Kerndokumente
plus die Abschlussnotizen in `PROJEKT_WISSEN.md` und `PROJEKTSTATUS.md`. Der letzte
Korrekturlauf hat zwei Restbefunde selbst gemeldet:

1. Beide führenden Dateien formulieren an einer Nachweisstelle ungenau „Diffumfang exakt die
   sechs Dokumente", obwohl acht versionierte Dateien geändert sind.
2. `.claude/automation/status/fortschritt.json` nennt im Arbeitspaket Benutzerverwaltung
   weiterhin drei Audittrigger; Migration 0017 enthält belegt vier. Außerdem darf der operative
   Status AP15-1 nicht mehr als noch bei Codex/zu mergen führen: AP15-1 ist auf main und CI-grün;
   aktuell liegt AP15-2 bei Codex zur Prüfung.

## Ziel

Korrigiere ausschließlich diese drei Restfakten, ohne weitere Redaktion.

## Positivliste

- `PROJEKT_WISSEN.md`
- `PROJEKTSTATUS.md`
- `.claude/automation/status/fortschritt.json`

## Negativliste

- Keine andere Datei und keine andere Sachaussage ändern.
- Changelog und die fünf operativen AP15-2-Dokumente bleiben bytegleich zum jetzigen Arbeitsstand.
- Kein Produktcode, SQL, Test, Workflow, Deploy-Inhalt oder Konfiguration.
- Kein Commit, Push, Merge, Tag oder Release.
- `07-Betrieb/IT_ANFRAGE_INFRASTRUKTUR.md` nicht anfassen.

## Definition of Done

1. Beide führenden Dateien nennen exakt: sechs operative Kerndokumente plus zwei führende
   Abschlussnotizen, insgesamt acht versionierte Dateien.
2. Die Statusdatei nennt vier Audittrigger für 0017 und führt AP15-1 als auf main/CI-grün,
   AP15-2 als aktuellen Reviewstand.
3. `git diff --check` Exit 0; die fünf operativen Dokumente und der Changelog sind gegenüber
   dem Eingang dieses Laufs unverändert.
4. Vollständiger Positiv-/Negativlistenabgleich und ehrliche Evidence.

## Stopppunkt

Nach den drei Faktkorrekturen sofort an Codex übergeben; kein Scope-Ausbau.

## Evidence je Agent

Agenten nennen Rolle, Dateien, Befund, Befehle/Exitcodes und Negativlistenbestätigung.
Einzelschreiberregel strikt; kein Agent startet weitere Agents.
