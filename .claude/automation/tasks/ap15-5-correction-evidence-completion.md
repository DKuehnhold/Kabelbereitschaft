# AP15-5 Korrektur: bestehenden Diff prüfen, minimal korrigieren und Evidence abschließen

## Ausgangslage und Ziel

Der vorherige Claude-Orchestratorlauf `kb-ap15-5-integration-suites-ci-gate` wurde durch das äußere 30-Minuten-Fenster beendet. `state.json` ist verwaist, `result.json` und `stderr.log` sind leer. Im Arbeitsbaum liegt ein uncommitteter Diff in exakt fünf erlaubten Dateien. Prüfe diesen bestehenden Stand vollständig, korrigiere nur echte Mängel innerhalb derselben Grenze und liefere belastbare Test-/Cleanup-Evidence. Nicht neu entwerfen und keinen Scope hinzufügen.

## Verbindliche Positivliste

- `.github/workflows/ci.yml`
- `app/supabase/test/run_db_tests.sh`
- `app/test/integration/ap14b-platform.int.mjs`
- `app/test/integration/ap14b-masterdata-inventory.int.mjs`
- `app/test/integration/ap14b-images.int.mjs`
- Bestehende ignorierte operative Fortschrittsdatei, falls der Starter sie verlangt

## Verbindliche Negativliste

- Alle anderen versionierten Dateien, insbesondere Produktcode, Migrationen, SQL-Smokes, lokale Runner, Pakete/Lockfiles, Dokumentation, Deploy-/Containerdateien und andere Workflows
- Die beiden von Codex angelegten Taskdateien `ap15-4-integration-ci-readonly-audit.md` und `ap15-5-integration-suites-ci-gate.md` nicht verändern
- Die drei fremden unversionierten IT-/Anfragedateien weder lesen noch verändern
- Keine echten IT-Verbindungsdaten, keine fremden Cloud-Dienste, keine GUI-/Fach-/Releaseänderung
- Kein Git Add/Commit/Push/Merge/Tag/Release; kein RC1-/V1-Urteil

## Prüf- und Korrekturauftrag

1. Lies den vollständigen bestehenden Diff und gleiche ihn gegen den Ursprungsauftrag `ap15-5-integration-suites-ci-gate.md` ab.
2. Falsifiziere insbesondere: exakt fünf Aufrufe; Reihenfolge platform → masterdata/inventory → images → admin-users → dashboard-metrics; je eigener Prozessblock; richtige Hook-Datei; gleiche synthetische Verbindungswerte; `AP14B_REQUIRE_INTEGRATION=1`; Fehler stoppt vor der nächsten Suite; keine Zugangswerte in Argumentlisten oder Meldungen.
3. Prüfe für alle drei neuen Pflichtmodi separat: mit Pflichtmodus und fehlenden Variablen Exit ungleich 0, Fehlermeldung nennt nur Variablennamen; ohne Pflichtmodus weiterhin Exit 0 mit vollständig geskippten Fällen. Keine temporären Endpunkte/Prozesse hinterlassen.
4. Prüfe Shellsyntax unter echtem Git Bash sowie Node-Syntax aller drei Dateien.
5. Führe den vollständigen synthetischen PostgreSQL-18-Lauf des geänderten `run_db_tests.sh` mit `AP14B_INTEGRATION=require` aus, sofern die vorhandene lokale Umgebung dies erlaubt. Erwartung: gesamte SQL-Kette und 141/141 Integrationsfälle, skipped 0, Exit 0, temporäre Datenbank/Rolle/Port/Arbeitsartefakte vollständig bereinigt. Wenn objektiv nicht möglich, exakten Blocker belegen und nichts erfinden.
6. Korrigiere nur Befunde, die Definition of Done oder Architekturgrenzen verletzen. Entferne übermäßige Kommentare nur, wenn sie falsch, redundant oder wartungsgefährdend sind; keine kosmetische Neufassung als Selbstzweck.

## Definition of Done

- Nur die fünf Dateien der Positivliste sind geändert.
- Fünf Suiten exakt einmal, richtige Reihenfolge, drei neue Suiten fail-closed im Pflichtmodus und optional lokal.
- Syntaxnachweise erfolgreich; negativer Pflichtmodus und optionaler Skip je Suite mit echten Exitcodes belegt.
- Voller PostgreSQL-Lauf mit 141/141 und Cleanup belegt oder exakter objektiver Blocker.
- `git diff --check` Exit 0.

## Evidence je Agent

Jeder Agent nennt Profil, Teil-Scope, gelesene/geänderte Dateien, Befunde, Befehle mit echten Exitcodes, Fall-/Skip-Zahlen, Cleanup und Grenzen. Genau ein Agent darf sequenziell schreiben; Prüfer read-only.

## Stopppunkt

Stoppe nach minimaler Korrektur und vollständigem Evidence-Bericht. Nicht committen/pushen, keine Dokumentation und keinen Folgeauftrag beginnen.
