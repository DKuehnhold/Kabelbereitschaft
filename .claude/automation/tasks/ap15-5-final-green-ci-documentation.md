# AP15-5 Abschlussdokumentation: fünf PostgreSQL-Suiten als grünes Linux-CI-Gate

## Rolle und Ziel

Du bist der alleinige Claude-Orchestrator. Aktualisiere ausschließlich die Projektwahrheit zu AP15-4/AP15-5 anhand der von Codex gelieferten und lokal belegten Evidence. Keine technische, fachliche oder visuelle Änderung.

## Positivliste

- `PROJEKT_WISSEN.md`
- `PROJEKTSTATUS.md`
- bestehende ignorierte operative Fortschrittsdatei, falls verlangt

## Negativliste

- Alle anderen Dateien, insbesondere CI, Runner, Tests, Produktcode, Migrationen, Pakete, Lockfiles, Roadmap, Deploy-/Containerdateien
- Die fremden unversionierten IT-/Anfragedateien weder lesen noch verändern
- Kein Commit/Push/Merge/Tag/Release; keine RC1-/V1-/IT-/GUI-Freigabe
- Keine Umsetzung der verbleibenden Fachbefunde (`fehlalarm`, Tagesgrenze, Filteroptionen, Vollmengen-Reads)

## Verbindliche Evidence

- AP15-4 read-only Audit: `run_db_tests.sh` startete vor AP15-5 bereits `ap14b-admin-users` und `ap15-dashboard-metrics`; die frühere Aussage „nur Admin-Suite" war überholt. Nur lokal liefen `ap14b-platform`, `ap14b-masterdata-inventory`, `ap14b-images`.
- Historische SQL-Dateien `00` und `10` bis `14` bleiben unverändert als Historienevidence und werden nicht in die aktuelle CI-Kette aufgenommen; `15` bis `24` laufen im `database`-Job.
- AP15-5-Commit auf `main`: `9aaebdf7df0f76b5d80d1e39801e42480ac82b37` (`test(ci): gate all postgres integration suites`).
- Verhalten: fünf PostgreSQL-Node-Suiten im bestehenden `database`-Job, Reihenfolge `ap14b-platform` → `ap14b-masterdata-inventory` → `ap14b-images` → `ap14b-admin-users` → `ap15-dashboard-metrics`; je eigener fail-closed Prozess mit `AP14B_REQUIRE_INTEGRATION=1`. Bildsuite gegen synthetischen In-Memory-S3-Endpunkt, kein MinIO-Ersatz; echter MinIO-Nachweis bleibt `objectstore`.
- Lokal von Claude belegt: PostgreSQL 18.4, SQL-Kette ohne `SMOKE ... FAIL`, 141/141 Integrationsfälle (32+31+37+31+10), fail 0, skipped 0, Exit 0; temporäres Cluster/DB/Rolle/Port/Artefakte vollständig bereinigt, Dienst `postgresql-x64-18` unangetastet.
- Unabhängig von Codex: Shell-/Node-Syntax und `git diff --check` Exit 0; fünf Aufrufe exakt einmal und korrekt geordnet; fünf Pflichtmodus-Zuweisungen; drei Pflichtmodus-Negativläufe Exit 1 mit Variablennamen; drei optionale Läufe Exit 0 und vollständig geskippt.
- GitHub zum Commit `9aaebdf...`: CI-Lauf `31282034577` `completed/success`; Jobs `verify` `93164818889`, `objectstore` `93164818903`, `database` `93164818909`, `container` `93164818928`, jeweils `completed/success`; Container-Image-Lauf `31282034552` `completed/success`.

## Auftrag

1. Korrigiere aktuelle Aussagen, die Node-Integrationssuiten pauschal als nur lokal oder den Linux-Runner als nur Admin-Suite beschreiben. Historische Abschnitte als damaligen Stand klar erhalten, nicht umdeuten.
2. Ergänze einen knappen AP15-4/AP15-5-Abschluss: Auditbefund, minimaler technischer Umfang, Reihenfolge/fail-closed-Schutz, lokale Evidence, GitHub-Evidence und Grenzen.
3. Halte `PROJEKT_WISSEN.md` knapp; vermeide Wiederholungen. In `PROJEKTSTATUS.md` nur die verdichtete aktuelle Lage.
4. Als nächsten nicht-visuellen Block bleiben ausschließlich die bereits dokumentierten Fachbefunde (`fehlalarm`, Datumsherkunft/Tagesgrenze, Filtertransaktionen, Vollmengen-Reads). Keine neue Priorität oder Lösung erfinden.
5. AP14 Betrieb/Abnahme, echte IT-Endpunkte, Reverse-Proxy, Browser-/Offline-Abnahme, CSP, RC1, V1, Tag und Release bleiben offen.

## Definition of Done

- Nur beide Leitdokumente geändert.
- Commit- und alle Lauf-/Job-IDs korrekt; keine aktuelle Aussage nennt die drei Suiten weiter nur lokal.
- Historische Smokes korrekt als unverändert/nicht aufgenommen; keine Löschung empfohlen.
- Lokale, Codex- und GitHub-Evidence sauber getrennt; keine erfundenen Nachweise.
- `git diff --check` Exit 0; keine Freigabeausweitung.

## Evidence je Agent und Stopppunkt

Jeder Agent nennt Scope, Quellen, geänderte Dateien, Befehle/Exitcodes und Grenzen. Genau ein Schreiber. Stoppe nach Dokumentation und Evidence; nicht committen/pushen und keinen Folgeauftrag beginnen.
