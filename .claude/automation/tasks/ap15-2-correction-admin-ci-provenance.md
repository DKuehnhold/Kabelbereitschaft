# Korrekturauftrag: AP15-2 – AP14B-CI-Provenienz ohne Scheinwiderspruch

## Ausgangslage und belegter Befund von Codex

Der AP15-2-Diff ist noch nicht committet. Die Dokumentkonsolidierung ist grundsätzlich
plausibel, enthält aber einen sachlichen Reviewbefund:

- GitHub-API für Commit `530a1f05f079ee2f2ce04403475c6a32d03a9e3a` bestätigt CI
  `30790933496` und Container-Image `30790933449`, jeweils `completed/success`.
- GitHub-API für den späteren Dokumentationscommit
  `a86d7a674cbfd70cf901287eb473327a972a714c` bestätigt CI `30791223313` und
  Container-Image `30791223304`, jeweils `completed/success`.
- Das sind zwei aufeinanderfolgende grüne Commitstände, kein Widerspruch. Die operative
  Statusdatei nennt zutreffend den späteren Abschlussstand; die damaligen führenden Dateien
  nannten im Text noch den vorangehenden Fachkorrekturstand.

## Ziel

Korrigiere ausschließlich diese Provenienz im vorhandenen AP15-2-Arbeitsstand. Beide
Nachweispaare bleiben erhalten, werden ihrem Commit eindeutig zugeordnet und nicht als
Widerspruch dargestellt.

## Positivliste

- `00-Projektsteuerung/CHANGELOG.md`
- `PROJEKT_WISSEN.md`
- `PROJEKTSTATUS.md`
- `.claude/automation/status/fortschritt.json`
- Read-only Prüfung von Git-Historie, aktuellem Diff und den vorhandenen Runtime-/Projektbelegen.

## Negativliste

- Keine Änderung an den fünf übrigen AP15-2-Dokumenten, Produktcode, SQL, Tests, Workflows,
  Deploy-Dateien, Konfiguration oder Abhängigkeiten.
- Keine sonstige inhaltliche Erweiterung oder sprachliche Gesamtredaktion.
- Keine historische Zeile des vor AP15-2 bestehenden Changelogs ändern; nur den neu
  eingefügten AP15-2-Nachtragsblock korrigieren.
- Keine Datei verschieben, umbenennen, archivieren oder löschen.
- Kein Commit, Push, Merge, Tag oder Release.
- `07-Betrieb/IT_ANFRAGE_INFRASTRUKTUR.md` nicht anfassen.

## Definition of Done

1. Der Changelog nennt für `530a1f0` das Paar `30790933496`/`30790933449` und für
   `a86d7a6` das Paar `30791223313`/`30791223304`, jeweils `completed/success`.
2. `PROJEKT_WISSEN.md` und `PROJEKTSTATUS.md` enthalten keinen offenen Widerspruch mehr,
   sondern die zeitliche Zuordnung der beiden Nachweisstände.
3. Keine andere Sachaussage oder Datei ändert sich durch diesen Korrekturlauf.
4. `git diff --check` ist Exit 0; vollständiger Diff und Positiv-/Negativlistenabgleich liegen vor.
5. Keine erfundenen Nachweise. GitHub-API wurde von Codex erhoben; Claude kennzeichnet diese
   Herkunft ausdrücklich und behauptet keinen eigenen Abruf.

## Stopppunkt

Nach dieser punktuellen Provenienzkorrektur stoppen und an Codex übergeben. Kein Scope-Ausbau.

## Evidence je Agent

Jeder Agent nennt Rolle, Dateien, konkrete Änderung, Befehle/Exitcodes, nicht ausgeführte
Prüfungen und bestätigt die Negativliste. Schreibende Arbeit strikt sequenziell; read-only
Prüfung unabhängig; kein Agent startet weitere Agents.
