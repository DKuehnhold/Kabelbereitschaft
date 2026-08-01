# AP14B Stammdaten/Inventar – formale Abschlussübergabe rekonstruieren

## Anlass

Der Implementierungslauf `kb-ap14b-data-masterdata-inventory` hat seinen
fachlichen Abschluss um 2026-07-31 20:05 Europe/Berlin in
`.claude/automation/status/fortschritt.json` dokumentiert und ist danach
beendet. Der registrierte PID 19668 läuft nicht mehr; `state.json` blieb jedoch
auf `running`, während die laufbezogene Ergebnis- und Fehlerdatei leer blieb.
Dieser Auftrag rekonstruiert ausschließlich die formale Abschlussübergabe für
Codex. Er ist kein neuer Implementierungs- oder Korrekturlauf.

## Verbindlicher Scope

- Lies vollständig `AGENTS.md`, `CLAUDE.md`, `PROJEKT_WISSEN.md`,
  `PROJEKTSTATUS.md`, den ursprünglichen Auftrag
  `.claude/automation/tasks/ap14b-data-masterdata-inventory.md`, den aktuellen
  Git-Diff und `.claude/automation/status/fortschritt.json`.
- Prüfe read-only, dass der registrierte Vorlauf-PID nicht mehr existiert und
  kein anderer schreibender Claude-Lauf aktiv ist.
- Prüfe den vorhandenen Gesamt-Diff und den aktuellen Git-Status read-only.
- Rekonstruiere die Abschlussübergabe aus dem tatsächlichen Diff und den im
  Dashboard festgehaltenen Nachweisen. Kennzeichne klar, welche Tests aus dem
  Vorlauf stammen und in diesem Rekonstruktionslauf nicht erneut ausgeführt
  wurden.
- Zulässige eigene read-only Nachprüfungen: Git-Status/-Diff, Quelltextsuche,
  TypeScript, ESLint, Einheitentests und `git diff --check`. Keine Datenbank
  erzeugen und keinen Server starten, weil dieser Auftrag nur die fehlende
  Übergabedatei wiederherstellt.

## Negativliste

- Keine versionierte Fach-, SQL-, Test- oder Dokumentationsdatei ändern.
- Den vorhandenen Arbeitsdiff nicht korrigieren, formatieren, stagen,
  verwerfen oder erweitern.
- Keine Agents mit Schreibrecht starten; read-only Prüfung darf Claude selbst
  oder durch read-only Profile erfolgen.
- Kein Commit, Push, Merge, Branchwechsel, Restore, Reset, Stash, Tag oder
  Release.
- Kein neuer Fachauftrag und keine GUI-, MinIO-, Bild- oder Uploadarbeit.

## Definition of Done

Die laufbezogene Ergebnisdatei dieses neuen Laufs enthält:

1. vollständige Liste aller vorhandenen geänderten und neuen Dateien,
2. Zusammenfassung des tatsächlich umgesetzten Verhaltens,
3. Zuordnung der Agentenprofile aus dem Vorlauf, soweit im Dashboard belegt,
4. exakte Trennung zwischen Vorlaufnachweisen und eigenen Nachprüfungen,
5. offene Risiken und die gemeldete CheckOnly-Strukturabweichung,
6. vollständigen Git-Status,
7. ausdrücklich: kein Commit und kein Push.

Wenn der Diff nicht zum Dashboardbericht passt, ein fremder Prozess aktiv ist
oder ein Nachweis nicht belegt werden kann: sofort mit Rohbefund an Codex
melden, nichts ändern.
