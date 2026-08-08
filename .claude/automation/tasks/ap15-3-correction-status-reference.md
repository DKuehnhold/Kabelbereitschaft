# AP15-3 Korrektur: Referenzstand im Projektstatus

## Ziel

Behebe ausschließlich den belegten Restwiderspruch im aktuellen Kopfblock von `PROJEKTSTATUS.md`: Nach dem AP15-3-Datumsupdate darf dort nicht mehr AP15-1 als jüngster bestätigter technischer Referenzstand stehen, obwohl AP15-2 bereits abgeschlossen und CI-grün ist.

## Rollenmodell

Claude ist alleiniger ausführender Orchestrator. Höchstens ein Schreiber. Jeder Agentenauftrag enthält Positivliste, Negativliste, Definition of Done, Stopppunkt und Evidence. Kein Agent darf Git-Schreiboperationen, Releasehandlungen, Agentenorchestrierung oder Scope-Erweiterung ausführen.

## Positivliste

- `PROJEKTSTATUS.md`: ausschließlich die zwei Zeilen des technischen Referenzstands im aktuellen Kopfblock.
- `.claude/automation/status/fortschritt.json` nur operativ und gitignoriert.
- Bestehende AP15-3-Auftragsdateien und übrige Arbeitsbaumänderungen bleiben unverändert.

## Negativliste

- Keine andere versionierte Datei und kein anderer Abschnitt von `PROJEKTSTATUS.md`.
- Keine Produkt-, Workflow-, Konfigurations-, Test-, SQL-, Deploy- oder Dokumentänderung außerhalb der genannten zwei Zeilen.
- Alle fremden unversionierten Dateien, insbesondere `00-Projektsteuerung/CODEX_ANFRAGE_BILDSPEICHER_DATEISYSTEM.md`, `07-Betrieb/IT_ANFRAGE_INFRASTRUKTUR.md` und `07-Betrieb/IT_RUECKMELDUNG_INFRASTRUKTUR.md`, sind strikt tabu.
- Kein Commit, Push, Merge, Tag, Release, Archivieren, Löschen, Verschieben oder Umbenennen.

## Arbeitsauftrag

Ersetze im aktuellen Kopfblock von `PROJEKTSTATUS.md` den veralteten AP15-1-Referenzstand `8b65f4ed9c1175ddec3aca5045a5a59906b95c68` durch den bestätigten AP15-2-Fachstand `40606eeea98baccf6192ad99d3ccac81fc7f0258` und ergänze die zugehörige Commitbezeichnung `docs: consolidate operational platform guidance`, entsprechend dem bereits quellentreuen Kopfblock von `PROJEKT_WISSEN.md`. Der nachfolgende AP15-2-CI-Dokumentationscommit `4f61348f1dcd542ff2edb220849544219b61d319` bleibt als Nachweiscommit auf `main`, ist aber kein neuer technischer Fachstand. Keine andere Aussage ändern.

## Definition of Done

- Der Kopfblock von `PROJEKTSTATUS.md` nennt den gleichen bestätigten technischen AP15-2-Fachstand wie `PROJEKT_WISSEN.md`.
- Der Diff dieses Laufs beschränkt sich auf die genannten zwei Zeilen.
- Alle vorbestehenden AP15-3-Änderungen bleiben unverändert.

## Evidence

- `git diff --check` mit Exit-Code.
- Vorher-/Nachher-Auszug des Kopfblocks.
- Mechanischer Vergleich des gesamten Arbeitsbaum-Diffs vor und nach dem Lauf: außer den zwei erlaubten Zeilen in `PROJEKTSTATUS.md` keine neue Änderung.
- `git status --short`; keine temporären Artefakte.

## Stopppunkt

Sofort stoppen bei Scope-Konflikt, zweitem Schreiber, notwendiger Änderung außerhalb der Positivliste oder dreimal demselben Fehler; Rohbefund an Codex.
