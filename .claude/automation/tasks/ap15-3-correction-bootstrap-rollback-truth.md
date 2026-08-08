# AP15-3 Korrektur: Bootstrap- und Rollback-Wahrheit

## Ziel

Korrigiere ausschließlich drei bereits belegte Dokumentationsreste im ungecommitten AP15-3-Stand. Keine neue Funktion und keine Scope-Erweiterung.

## Verbindliches Rollenmodell

Claude ist der alleinige ausführende Orchestrator. Nur Claude darf spezialisierte Claude-Agents starten und steuern. Im gemeinsamen Vault schreibt höchstens ein Agent gleichzeitig. Jeder Agentenauftrag muss Positivliste, Negativliste, Definition of Done, Stopppunkt und konkrete Evidence enthalten. Kein Agent darf committen, pushen, mergen, taggen, releasen, andere Agents orchestrieren oder den Scope erweitern.

## Positivliste

- `deploy/scripts/rollback.sh`: ausschließlich den sachlich falschen Kommentar korrigieren; alle ausführbaren Zeilen müssen bytegleich zu `HEAD` bleiben.
- `deploy/README.md`
- `PROJEKT_WISSEN.md`
- `PROJEKTSTATUS.md`
- `.claude/automation/status/fortschritt.json` nur operativ; bleibt gitignoriert.
- Bereits vorhandene AP15-3-Auftragsdateien dürfen unverändert im Arbeitsbaum verbleiben.

## Negativliste

- Keine ausführbare Zeile in `deploy/scripts/rollback.sh` ändern.
- Keine Änderung an Workflow, Environment-Beispiel, Produktcode, Tests, SQL, Migrationen, Datenbankrunnern, Compose, Dockerfiles oder anderen Deploy-Skripten.
- Keine GUI-/Designänderung, keine echten IT-Verbindungsdaten, keine Archivierung, Löschung, Verschiebung oder Umbenennung.
- `07-Betrieb/IT_ANFRAGE_INFRASTRUKTUR.md` ist fremder unversionierter Bestand und strikt tabu.
- Keine Git-Schreiboperation, kein Commit, Push, Merge, Tag oder Release.

## Arbeitsauftrag

1. Ersetze in `deploy/scripts/rollback.sh` nur den falschen Kommentar durch eine quellentreue Aussage: Das Rollback betrifft nur das Anwendungs-Image; das Schema wird nicht zurückgesetzt; Rückwärtsmigrationen sind nicht vorgesehen; bei Schema-Inkompatibilität ist ein Forward-Fix erforderlich. Keine Aussage, die die Migrationen pauschal als additiv bezeichnet.
2. Stelle in `deploy/README.md` klar: Der CI-Datenbanklauf führt auf einer leeren PostgreSQL-Instanz zuerst die versionierten Bootstrap-Dateien `bootstrap/01_roles.sql`, `bootstrap/02_compat_auth.sql` und `bootstrap/03_compat_storage.sql` aus, danach die Migrationen `0001` bis `0017` in der durch den Runner festgelegten, mit Smokes verschachtelten Reihenfolge. Bootstrap ist von der nummerierten Migrationskette getrennt. Das ist kein Nachweis eines produktiven Deployments.
3. Korrigiere in `PROJEKT_WISSEN.md` die historische AP15-2-Aussage: Migration `0013` belegt die Nicht-Additivität der Migrationskette. `19a` ist ein Test und belegt die erforderliche Reihenfolge beziehungsweise Verschachtelung des Testlaufs, nicht die Additivität einer Migration.
4. Halte `PROJEKT_WISSEN.md` und `PROJEKTSTATUS.md` knapp und widerspruchsfrei. Behaupte weiterhin keinen AP15-3-GitHub-CI-Lauf, keinen Commit und keinen Push.

## Definition of Done

- Der Rollback-Kommentar ist fachlich korrekt; alle ausführbaren Zeilen von `deploy/scripts/rollback.sh` sind gegenüber `HEAD` bytegleich.
- Bootstrap, Migrationen und Smokes sind in `deploy/README.md` quellentreu getrennt und beschrieben.
- `0013` und Test `19a` sind in `PROJEKT_WISSEN.md` korrekt eingeordnet.
- Keine Datei außerhalb der Positivliste wurde durch diesen Lauf verändert.
- Keine temporären synthetischen Testartefakte verbleiben.

## Evidence

- Mechanischer Vergleich der ausführbaren Zeilen von `deploy/scripts/rollback.sh` gegen `HEAD`, Kommentare und Leerzeilen beim Vergleich ausgeschlossen; Ergebnis und Exit-Code berichten.
- Wenn Bash verfügbar ist: `bash -n deploy/scripts/rollback.sh` mit Exit-Code; sonst Verfügbarkeit ehrlich als Grenze berichten.
- `git diff --check` mit Exit-Code.
- Vollständiger Diff der Positivliste und quellenbasierte Falsifikationssuche nach den drei Ausgangsfehlern.
- `git status --short` und Nachweis, dass keine temporären Artefakte verbleiben.
- Die vollständigen App-Gates müssen nicht wiederholt werden: Der unmittelbar vorherige Korrekturlauf und Codex haben Unit 97/97, TypeScript, ESLint und Produktions-Build bereits erfolgreich erhoben; dieser Auftrag ändert nur Dokumentation und einen Kommentar.

## Stopppunkt

Sofort stoppen und mit Rohbefund an Codex melden bei Scope-Konflikt, zweitem Schreiber, notwendiger Änderung außerhalb der Positivliste oder dreimal demselben Fehler. Keine eigenmächtige Erweiterung.
