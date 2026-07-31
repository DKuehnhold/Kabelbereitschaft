# AP14B Datenpfade – begrenzter Korrektur- und Abschlussauftrag

## Ziel

Behebe ausschließlich die beim unabhängigen Architektur-Gate gefundenen AP14B-Mängel und liefere danach einen belastbaren Abschlussnachweis. Keine GUI-Arbeit und keine Erweiterung des Arbeitspakets.

## Verbindlicher Ablauf

Du bist der alleinige ausführende Claude-Orchestrator. Lies zuerst `AGENTS.md`, `CLAUDE.md`, `PROJEKT_WISSEN.md`, `PROJEKTSTATUS.md`, `.claude/automation/runtime/state.json` und `.claude/automation/status/fortschritt.json`. Aktualisiere den Dashboard-Status zu Beginn und beim Handoff. Zerlege die Arbeit in begrenzte Aufträge für `kb-sicherheit-rls`, `kb-implementierung` und `kb-tests-evidence`. Read-only Analysen dürfen parallel laufen; im Vault schreibt höchstens ein Agent gleichzeitig. Kein Agent darf committen, pushen, mergen, taggen, releasen, weitere Agents orchestrieren oder den Scope erweitern.

## Positivliste

1. **D13 reparieren:** In `app/supabase/test/20_ap14b_data.sql` die PostgreSQL-18-inkompatible Aggregation `min(uuid)` in beiden Abfragen durch eine UUID-sichere, inhaltlich gleich starke Prüfung ersetzen. Der Test muss weiterhin exakt eine eigene sichtbare Zeile und den erwarteten Actor nachweisen; keine Erwartung abschwächen.
2. **Transitive Supabase-Abhängigkeit schließen:** `app/src/lib/incidents.ts` darf für seine benötigten Stammdaten-Lesewege nicht mehr `@/lib/masterdata` importieren, weil dieses Modul weiterhin Supabase nutzt. Implementiere die für `getIncidentFormOptions` und `getIncidentListData` erforderlichen Leseabfragen innerhalb des bereits freigegebenen AP14B-Scope über PostgreSQL und `withUserTransaction`. `app/src/lib/masterdata.ts` bleibt unverändert. Erhalte bestehende Rückgabetypen, Sortierung, Filter, Berechtigungssemantik und Fehlermodell nachweisbar.
3. **Least Privilege für Refresh:** Prüfe unabhängig, ob Produktcode `public.refresh_incident_tasks_ap13(uuid)` aufruft. Wenn kein Produktaufruf existiert, entziehe in der noch uncommitteten Migration `0014_ap14b_data_grants.sql` das Execute-Recht mindestens `public`, `anon`, `authenticated` und `app_user`; der interne Triggerpfad muss funktionieren. Ergänze einen negativen Test, der den Entzug trotz Rollenvererbung belegt. Falls ein Produktaufruf zwingend nötig ist, stoppe vor einer Rechteausweitung und berichte den konkreten Caller.
4. **Aussagekräftiger Rechte-Test:** Frühere Smokes vergeben pauschale Tabellen- und Funktionsrechte an `app_user`. Sorge dafür, dass Smoke 20 den finalen Produkt-Rechtestand prüft und nicht von diesen Alt-Grants falsch-grün wird. Bevorzuge eine gezielte, idempotente Wiederanwendung der Migration 0014 unmittelbar vor Smoke 20 oder einen gleichwertig kleinen, dokumentierten Testaufbau. Keine historischen Migrationen umschreiben.
5. **Test-Exitcode:** Der finale Datenbanklauf muss seinen echten numerischen Prozess-Exitcode erfassen und berichten; `$?` nach einer Ausgabe ist kein Nachweis.
6. Führe nach den Korrekturen genau einen vollständigen synchronen PostgreSQL-18-Lauf im Vordergrund aus. Nutze ausschließlich synthetische Daten. Entferne Testdatenbank, temporären Cluster, Prozesse, Ports und Logs am Laufende und belege die Bereinigung.
7. Führe lokale Prüfungen wegen des `&` im Vault-Pfad direkt über die Node-Binaries aus, nicht über die nachweislich unzuverlässige lokale `npm run`-Hülle: TypeScript, ESLint, Unit-Tests und Produktions-Build. Zusätzlich `git diff --check`, Suche nach verbleibenden Supabase-Zugriffen in den sieben ursprünglichen Zielmodulen sowie PowerShell-/Bash-Syntaxprüfung der Runner.

## Negativliste

- Keine GUI-, Design-, MinIO-, Auth.js-, Deployment-, Masterdata- oder Inventory-Migration außerhalb der ausdrücklich nötigen lokalen PostgreSQL-Lesehelfer in `incidents.ts`.
- `app/src/lib/masterdata.ts` nicht ändern.
- Keine bestehenden Migrationen 0001–0013 umschreiben.
- Keine Testanforderung abschwächen, kein Fehler schlucken, kein Gate deaktivieren.
- Keine Ersatzordner, Clones oder dauerhaften Wegwerfkopien.
- Keine echten IT-Verbindungsdaten.
- Kein zweiter Datenbanklauf nach einem Fehlschlag. Bei erneutem Fehler sofort an Codex übergeben.
- Keine Dokumentation als „AP14B abgeschlossen“ markieren.

## Definition of Done

- D13 läuft unter PostgreSQL 18 ohne `min(uuid)` und prüft weiter Identität plus Isolation.
- Kein Import von `@/lib/masterdata` und kein direkter oder transitiver Supabase-Leseweg aus `incidents.ts` für die AP14B-Incidentpfade.
- Refresh-RPC ist für Anwendungsrollen nicht ausführbar, sofern kein belegter Produktcaller existiert; negativer Test grün.
- Smoke 20 prüft nachweislich den finalen 0014-Rechtestand statt Alt-Grants.
- Migrationen 0001–0014 und alle vorgesehenen Smokes einschließlich D1–D14 laufen grün; echter Exitcode 0 liegt vor.
- TypeScript, ESLint, Unit-Tests, Build, Diff-Check und Runner-Syntaxprüfungen sind mit echten Exitcodes grün.
- Keine temporären DB-/Prozess-/Port-/Log-Artefakte verbleiben.
- `result.json` enthält je Prüfung Befehl, Exitcode und kompakten Befund; `stderr.log`, vollständiger Diff und `git status` liegen für Codex bereit.

## Stopppunkt

Nach dem Handoff an Codex anhalten. Nicht committen oder pushen. Bei einem Testfehler, erforderlicher Scope-Erweiterung oder fehlender Berechtigung sofort mit erstem echten Fehler und kleinstmöglicher Empfehlung stoppen.
