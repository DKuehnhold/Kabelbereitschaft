# AP15-3 Abschluss: grünen Korrekturlauf quellentreu dokumentieren

## Rolle und Ziel

Du bist der alleinige ausführende Claude-Orchestrator. Ziehe ausschließlich die AP15-3-Dokumentation auf den von Codex bereits unabhängig belegten Commit-/CI-Stand nach. Keine Produktcode-, Lockfile-, Workflow- oder Designänderung.

## Verbindliche Positivliste

- `PROJEKT_WISSEN.md`
- `PROJEKTSTATUS.md`
- `00-Projektsteuerung/CLAUDE_FORTSCHRITT.md`, aber nur falls das bestehende Fortschrittsformat einen knappen Eintrag zwingend verlangt

## Verbindliche Negativliste

- Alle anderen Dateien und Verzeichnisse, insbesondere `app/**`, `.github/**`, `deploy/**`, Migrationen, Tests und Konfiguration
- Die drei fremden unversionierten Dateien `00-Projektsteuerung/CODEX_ANFRAGE_BILDSPEICHER_DATEISYSTEM.md`, `07-Betrieb/IT_ANFRAGE_INFRASTRUKTUR.md`, `07-Betrieb/IT_RUECKMELDUNG_INFRASTRUKTUR.md`
- Keine GUI-/Designentscheidung
- Keine Git-Schreiboperation: kein `git add`, Commit, Push, Merge, Tag oder Release
- Keine Agenten-Orchestrierung außerhalb deiner eigenen spezialisierten Claude-Agents und keine Scope-Erweiterung

## Von Codex verbindlich gelieferte Evidence

- Korrekturcommit auf `main`: `47704e027371fe4a0c0b70c579ee26f09756029a` (`fix(deps): update transitive nanoid`)
- CI-Lauf `31276526201`: `completed/success`
- CI-Jobs: `verify` `93150848358`, `database` `93150848347`, `container` `93150848324`, `objectstore` `93150848342`, jeweils `completed/success`
- Container-Image-Lauf `31276526192`: `completed/success`
- Der historische Erstlauf zum Featurecommit `0f3d0bd...` bleibt wahrheitsgemäß als zunächst roter Produktionsaudit-Lauf dokumentiert; er darf nicht umgedeutet oder entfernt werden.

## Auftrag

1. Aktualisiere die aktuelle AP15-3-Zusammenfassung in beiden Projektdokumenten: Die Nanoid-Korrektur ist nicht mehr lokal/uncommittet, sondern als obiger Commit auf `main` gepusht.
2. Dokumentiere den vollständig grünen Folgelauf mit den obigen Lauf- und Job-IDs. Damit ist AP15-3 technisch abgeschlossen.
3. Erhalte die historische rote Evidence des Featurecommits knapp und korrekt als Verlauf; entferne nur Aussagen, die den nun belegten grünen Folgelauf verneinen oder die Korrektur als uncommittet bezeichnen.
4. Halte `PROJEKT_WISSEN.md` knapp konsistent. Keine neue Release-, RC1-, V1- oder IT-Freigabe ableiten.
5. Als nächsten nicht-visuellen Block nur die bereits dokumentierten verbliebenen AP15-Fachbefunde und die Einordnung lokal laufender Integrationssuiten nennen; nichts davon umsetzen.

## Definition of Done

- Nur Dateien der Positivliste sind geändert.
- Beide Dokumente nennen Korrekturcommit, grünen CI-Lauf, alle vier grünen Jobs und grünen Container-Image-Lauf korrekt.
- Keine aktuelle Aussage behauptet weiterhin, die Korrektur sei uncommittet oder ein grüner Folgelauf sei unbelegt.
- Historischer roter Lauf bleibt als historische Evidence klar erkennbar.
- Keine RC1-/V1-/Releasefreigabe.
- `git diff --check` Exit 0.

## Evidence je eingesetztem Claude-Agent

Jeder Agent berichtet Positivliste, Negativliste, gelesene Quellen, konkret geänderte Dateien, ausgeführte Prüfungen mit echten Exitcodes sowie verbleibende Grenzen. Keine erfundenen Nachweise.

## Stopppunkt

Stoppe nach Dokumentänderung, Diff-Prüfung und Evidence-Bericht. Nicht committen oder pushen und keinen Folgeauftrag beginnen.
