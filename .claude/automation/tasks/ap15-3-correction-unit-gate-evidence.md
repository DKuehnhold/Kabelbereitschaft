# AP15-3 Korrektur: Unit-Gate-Evidence

## Ausgangsbefund und Ziel

Im CI-Lauf `31273906163`, Job `verify` (`93144296811`), ist Schritt 7 `Unit-Tests (hartes Gate)` nachweislich `completed/success` (19:14:36Z–19:14:38Z). Erst Schritt 10 `Audit Produktion (high/critical als Gate)` scheiterte. Korrigiere ausschließlich die falschen Aussagen, das Unit-Test-Gate sei auf dem Runner nicht belegt.

## Rollenmodell

Claude ist alleiniger ausführender Orchestrator; höchstens ein Schreiber. Jeder Agentenauftrag enthält Positivliste, Negativliste, DoD, Stopppunkt und Evidence. Keine Git-Schreiboperationen, Releases, Agentenorchestrierung oder Scope-Erweiterung.

## Positivliste

- `PROJEKT_WISSEN.md`
- `PROJEKTSTATUS.md`
- `.claude/automation/status/fortschritt.json` nur operativ und gitignoriert.
- Diese Auftragsdatei darf unversioniert verbleiben.

## Negativliste

- `app/package-lock.json` und `app/package.json` bleiben bytegleich zum Laufbeginn.
- Keine andere versionierte Datei, kein Produktcode, Workflow, Test, Konfiguration, SQL, Runner oder Deploy-Dokument.
- Die drei fremden unversionierten Dateien unter `00-Projektsteuerung/` und `07-Betrieb/` sind strikt tabu.
- Kein Commit, Push, Merge, Tag, Release, Löschen, Verschieben, Umbenennen oder Archivieren.

## Arbeitsauftrag

1. Ersetze in beiden Leitdokumenten jede Aussage, das neue Unit-Test-Gate sei erst nach einem künftigen Push oder wegen des Auditabbruchs noch nicht belegt.
2. Dokumentiere knapp und exakt: Im roten CI-Lauf `31273906163` war `Unit-Tests (hartes Gate)` `completed/success`; ebenfalls grün waren Lint, TypeScript, Service-Worker-Syntax und Build. Der Gesamtjob `verify` blieb rot, weil erst der nachfolgende harte Produktionsaudit scheiterte. Playwright und der informative Dev-Audit wurden danach übersprungen. Ein vollständig grüner CI-Folgelauf bleibt weiterhin unbelegt.
3. Keine andere Aussage ändern.

## Definition of Done und Evidence

- Beide Leitdokumente unterscheiden korrekt zwischen erfolgreichem Unit-Gate und rotem Gesamtjob.
- Kein grüner Gesamt-CI-Folgelauf wird behauptet.
- Mechanischer Diffvergleich zeigt nur die erforderlichen Textstellen in zwei Leitdokumenten.
- `app/package-lock.json` und `app/package.json` sind gegenüber Laufbeginn bytegleich.
- `git diff --check` Exit 0; `git status --short`; keine temporären Artefakte.

## Stopppunkt

Sofort stoppen bei Scope-Konflikt, zweitem Schreiber, erforderlicher Änderung außerhalb der Positivliste oder dreimal demselben Fehler; Rohbefund an Codex.
