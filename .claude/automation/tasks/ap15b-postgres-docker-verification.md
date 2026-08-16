# AP15-b PostgreSQL-Verifikation in isolierter Docker-Umgebung

## Ziel
Verifiziere den bestehenden AP15-b-Stand gegen eine echte PostgreSQL-18-Instanz in einem temporären Docker-Container.

## Positivliste
- Bestehenden Vault und vorhandene Migration `app/supabase/migrations/0018_ap15b_incident_metrics.sql` verwenden.
- PostgreSQL 18-Container ausschließlich für synthetische lokale Tests starten.
- Migration, `incident_list_view`, Fehlalarm-Trigger und Vollmengen-Export prüfen.
- Testnachweise und Fehler im Laufbericht dokumentieren.
- Temporäre Container, Volumes und synthetische Daten am Ende vollständig entfernen.

## Negativliste
- Keine echten IT-Verbindungsdaten oder produktiven Daten verwenden.
- Keine Supabase-Cloud, keine fremden Cloud-Dienste und keine Ersatzordner verwenden.
- Keine Änderungen außerhalb des AP15-b-Scopes.
- Kein Commit, Push, Merge, Tag oder Release durch Agents.

## Definition of Done
- PostgreSQL 18 ist erreichbar und die Migration läuft erfolgreich durch.
- `is_false_alarm` ist in View und Anwendungspfad korrekt verfügbar.
- Trigger erlaubt die Disponent-Rolle und blockiert unzulässige Rollen nachweisbar.
- Vollmengen-Export wird gegen eine synthetische Menge oberhalb des bisherigen Limits geprüft.
- Unabhängige read-only Validierung bestätigt die Nachweise.
- `result.json` und `stderr.log` enthalten konkrete Evidence; temporäre Artefakte sind entfernt.

## Stopppunkt
Bei fehlendem Docker-Zugriff, fehlendem Claude-Profil, Schemafehlern oder unklarer Rollen-/Exportsemantik sofort stoppen und den konkreten Blocker melden.

## Evidence je Agent
Jeder Agent dokumentiert Befehle, Exitcodes, relevante Testausgaben, geprüfte Dateien und Stop-/Freigabegrund. Der Orchestrator prüft den vollständigen Diff unabhängig.
