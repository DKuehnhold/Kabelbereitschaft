# AP14B Datenpfade – letzter Testaufbau-Fix und Abschlussnachweis

## Ziel

Behebe ausschließlich den belegten Bootstrap-Fixture-Konflikt und die unvollständige Ausgabe der relevanten Smoke-Nachweise. Führe danach genau einen vollständigen AP14B-Prüflauf aus. Keine weitere Fachimplementierung.

## Vorbedingungen und Rollen

Du bist der alleinige Claude-Orchestrator. Lies zuerst die Projekt- und Automationsgrundlagen sowie den letzten Ergebnisbericht. Prüfe vor jedem Schreibzugriff, dass kein anderer Orchestrator- oder Agentenprozess aktiv ist. Aktualisiere `.claude/automation/status/fortschritt.json` zu Beginn und bei der Übergabe. Höchstens ein Schreiber im Vault; read-only Prüfung darf parallel erfolgen. Kein Agent darf committen, pushen, mergen, taggen, releasen oder weitere Agents orchestrieren.

Dokumentiere im Handoff offen, dass beim vorigen Auftrag zwei Claude-Orchestratorprozesse überlappten. Für diesen Lauf darf es keine Überlappung geben.

## Positivliste

1. In `app/supabase/test/20_ap14b_data.sql` ausschließlich die Admin-Fixture so ändern, dass sie nicht als anmeldefähiger Administrator zählt: nutze den bereits im Projekt etablierten Platzhalter `!MIGRATED-ACCOUNT-REQUIRES-RESET!`. Belege, dass Smoke 20 den Hash nicht für eine Anmeldung benötigt und die UUID-/FK-Fixture erhalten bleibt.
2. In `app/supabase/test/run_ap14b_local.ps1` den bestehenden Ausgabefilter minimal erweitern, sodass die tatsächlichen OK-/FAIL-Zeilen für `SMOKE R1`, `SMOKE R2`, `SMOKE D13`, `SMOKE D26` und `SMOKE D27` im Laufprotokoll sichtbar sind. Keine Prüfzeile erfinden oder nachträglich synthetisieren.
3. Prüfe statisch die beiden Änderungen und führe danach genau einen synchronen PostgreSQL-18-Gesamtlauf im Vordergrund aus. Erfasse den echten numerischen Exitcode unmittelbar nach dem Prozess.
4. Der Lauf muss Bootstrap, Migrationen 0001–0014, Smokes 15–20 samt 19a, die Node-Integrationstests und die vorhandenen lokalen Gates ausführen. Berichte die fünf genannten Smoke-OK-Zeilen wörtlich aus der echten Ausgabe.
5. Belege am Ende die vollständige Bereinigung von Testdatenbank, temporärer Rolle, Cluster, Port 55432, Prozessen, Arbeitsverzeichnissen und Logs. Der bestehende PostgreSQL-Dienst muss unverändert bleiben.
6. Aktualisiere das Dashboard wahrheitsgemäß. Fachstatusdokumente bleiben unverändert, bis Codex den Gesamtstand unabhängig freigibt.

## Negativliste

- Keine Änderung an Produktcode, Migrationen oder sonstigen Tests außer den zwei ausdrücklich genannten Dateien.
- Keine Testanforderung abschwächen, keine Reihenfolge ändern, kein Gate deaktivieren.
- Keine GUI-, MinIO-, Auth-, Masterdata-, Inventory-, Deployment- oder Dokumentationsarbeit.
- Keine Ersatzordner, Clones, echten IT-Daten oder fremden Dienste.
- Kein zweiter Datenbanklauf. Bei erneutem Fehler sofort mit dem ersten echten Fehler stoppen.
- Kein Commit oder Push.

## Definition of Done

- Admin-Fixture ist nicht anmeldefähig, bleibt aber als synthetische FK-/Identitätsfixture nutzbar.
- R1, R2, D13, D26 und D27 erscheinen als echte Zeilen in der Lauf-Ausgabe.
- Der vollständige Gesamtlauf endet mit echtem Exitcode 0; sämtliche SQL- und Node-Tests sind grün.
- TypeScript, ESLint, Unit-Tests, Produktions-Build, `git diff --check` und Runner-Syntaxprüfungen sind grün oder werden vom Gesamtlauf nachweislich umfasst.
- Keine temporären Artefakte verbleiben.
- `result.json` enthält Befehle, Exitcodes, die fünf wörtlichen Smoke-Zeilen, Bereinigungsnachweis, vollständigen Git-Status und die Bestätigung, dass nur die zwei erlaubten Dateien geändert wurden.

## Stopppunkt

Nach Übergabe an Codex anhalten. Nicht committen oder pushen. Bei einem Fehler keine Wiederholung.
