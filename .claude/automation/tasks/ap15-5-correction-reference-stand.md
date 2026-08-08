# AP15-5 Korrektur: technischer Referenzstand in beiden Leitdokumenten

## Ziel

Behebe ausschließlich den widersprüchlichen technischen Referenzstand in `PROJEKT_WISSEN.md` und `PROJEKTSTATUS.md`: Beide Dokumente beschreiben AP15-5 auf Commit `9aaebdf7df0f76b5d80d1e39801e42480ac82b37` als abgeschlossen, nennen im Kopf aber weiterhin `40606eeea98baccf6192ad99d3ccac81fc7f0258` als bestätigten technischen Referenzstand.

## Positivliste

- Lies `AGENTS.md`, `CLAUDE.md`, `PROJEKT_WISSEN.md`, `PROJEKTSTATUS.md` und den aktuellen Git-Status.
- Ändere ausschließlich `PROJEKT_WISSEN.md` und `PROJEKTSTATUS.md`.
- Setze in beiden Kopfblöcken den bestätigten technischen Referenzstand auf den vollständigen Commit `9aaebdf7df0f76b5d80d1e39801e42480ac82b37` mit der korrekten Commit-Betreffzeile `test(ci): gate all postgres integration suites`.
- Bewahre die bestehende AP15-3/AP15-4/AP15-5-Historie und alle offenen Grenzen unverändert.
- Prüfe `git diff --check`, den vollständigen Diff und die identische Referenzangabe in beiden Dateien.
- Liefere Evidence mit den exakt geänderten Stellen und dem finalen Git-Status.

## Negativliste

- Kein Produktcode, keine Tests, Workflows, Pakete, Lockfiles oder sonstige Dokumentation ändern.
- Keine neue fachliche Behauptung ergänzen und keine bestehende Evidence umdeuten.
- Die drei fremden unversionierten IT-/Anfragedateien weder lesen noch ändern.
- Kein Commit, Push, Merge, Tag, Release oder Freigabestatus.
- Keine Agents orchestrieren lassen; Claude bleibt alleiniger Orchestrator und höchstens ein Schreiber arbeitet gleichzeitig.

## Definition of Done

- Beide Leitdokumente nennen identisch `9aaebdf7df0f76b5d80d1e39801e42480ac82b37` samt korrekter Betreffzeile als bestätigten technischen Referenzstand.
- Der alte Referenzstand `40606eeea98baccf6192ad99d3ccac81fc7f0258` steht nicht mehr als aktueller Referenzstand in den beiden Kopfblöcken.
- Ausschließlich die beiden erlaubten Dokumentdateien wurden durch diesen Korrekturlauf geändert.
- `git diff --check` endet mit Exit 0.

## Stopppunkt

Nach Korrektur, Prüfung und Evidence an Codex übergeben. Keinen Folgeauftrag beginnen.

## Evidence je Agent

Für jedes eingesetzte Profil: Profilname, read-only/schreibend, geprüfte oder geänderte Dateien, genaue Befunde, ausgeführte Prüfungen mit Exitcodes und bestätigte Negativgrenzen. Ein Schreiber maximal.
