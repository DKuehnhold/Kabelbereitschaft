# AP15-4: Read-only Audit der lokalen Integrationssuiten und historischen Smokes

## Rolle und Ziel

Du bist der alleinige Claude-Orchestrator für eine **rein lesende** Architektur- und Evidence-Prüfung. Ermittle quellentreu, welche PostgreSQL-/Node-Integrationssuiten und historischen SQL-Smokes im aktuellen Linux-CI-Lauf tatsächlich ausgeführt werden, welche nur lokal laufen und ob eine sichere, deterministische Aufnahme in CI fachlich und technisch vertretbar ist. Noch nichts implementieren.

## Verbindliche Positivliste

- Lesen des gesamten Vaults, soweit für diese Prüfung erforderlich
- Schwerpunktquellen:
  - `.github/workflows/ci.yml`
  - `app/supabase/test/run_db_tests.sh`
  - `app/supabase/test/run_ap14b_local.ps1`
  - `app/supabase/test/10_smoke_test.sql` bis `24_ap15_dashboard_metrics.sql`
  - `app/test/integration/*.int.mjs` sowie deren Hooks/Stubs
  - `app/package.json`, relevante Konfigurationsdateien
  - `PROJEKT_WISSEN.md`, `PROJEKTSTATUS.md`, `00-Projektsteuerung/ROADMAP_AP12_AP15_ENTWURF.md`
- Ausgabe ausschließlich im Orchestrator-Ergebnis und in der bestehenden ignorierten operativen Fortschrittsdatei, falls der Starter sie verlangt

## Verbindliche Negativliste

- Keine versionierte Datei ändern oder neu anlegen
- Insbesondere keine Änderung an CI, Runnern, Tests, Produktcode, Lockfiles, Dokumentation oder Migrationen
- Die drei fremden unversionierten Dateien `00-Projektsteuerung/CODEX_ANFRAGE_BILDSPEICHER_DATEISYSTEM.md`, `07-Betrieb/IT_ANFRAGE_INFRASTRUKTUR.md`, `07-Betrieb/IT_RUECKMELDUNG_INFRASTRUKTUR.md` weder lesen noch verändern
- Keine Netzwerkzugriffe, keine echten IT-Verbindungsdaten, keine fremden Cloud-Dienste
- Keine Git-Schreiboperationen: kein Add, Commit, Push, Merge, Tag oder Release
- Keine GUI-/Designentscheidung, kein V1-/RC1-Urteil
- Keine Umsetzung und keine Scope-Erweiterung in AP15-Fachbefunde wie `fehlalarm`, Datumsgrenze, Filter oder Vollmengen-Reads

## Prüffragen

1. Erstelle eine genaue Matrix aller Integrationssuiten (`ap14b-platform`, `ap14b-masterdata-inventory`, `ap14b-images`, `ap14b-admin-users`, `ap15-dashboard-metrics`, `ap14b-minio-live`): lokaler Runner, Linux-CI-Runner/Job, Voraussetzungen, Fallzahl/Skip-Verhalten, Daten-/Rollen-Isolation, Bereinigung, Plattformabhängigkeiten, aktueller Nachweisstatus.
2. Erstelle eine genaue Matrix der SQL-Dateien `10` bis `24`, insbesondere der sechs historischen Smokes `10` bis `15`: in welchem Runner/CI-Job sie wirklich laufen, Reihenfolge, Abhängigkeiten, ob sie weiterhin eigenständigen Schutzwert haben oder nur Historienevidence sind.
3. Falsifiziere die aktuelle Dokumentaussage, die drei bzw. fünf Integrationssuiten seien nur lokal: Zeige exakt, was `run_db_tests.sh` heute wirklich startet und was nicht. Keine Schlussfolgerung nur aus Kommentaren.
4. Bewerte für jede derzeit nicht in Linux-CI ausgeführte Suite: sichere Aufnahme möglich ja/nein, minimaler Änderungsumfang, erwartete Laufzeitklasse, notwendige Environment-Variablen, Fail-closed-Anforderungen, Cleanup/Parallelität und Risiko doppelter oder widersprüchlicher Evidence.
5. Leite **einen** klar begrenzten Folgeauftrag zur Umsetzung ab oder empfehle quellentreu, den Stand unverändert zu lassen. Der Folgeauftrag muss Positivliste, Negativliste, Definition of Done, Stopppunkt und erforderliche Evidence nennen.

## Definition of Done

- Keine versionierten Änderungen; `git diff --check` Exit 0 und `git status --short` zeigt außer dieser von Codex angelegten Taskdatei nur die drei bekannten fremden unversionierten Dateien.
- Beide Matrizen beruhen auf konkreten Dateipfaden und Zeilen-/Aufrufnachweisen.
- Lokale und CI-Evidence sind klar getrennt; keine erfundenen Ausführungen.
- Jede Empfehlung nennt Nutzen, Risiko und begrenzten Änderungsumfang.
- Kein Testlauf ist Pflicht. Falls ein kurzer synthetischer read-only/isolierter Test zur Falsifikation nützlich ist, darf er nur ohne versionierte Änderung und mit vollständiger Bereinigung laufen; tatsächliche Exitcodes berichten.

## Evidence je eingesetztem Claude-Agent

Jeder Agent berichtet sein Profil, reinen Lese-Scope, gelesene Quellen, konkrete Befunde mit Pfaden/Zeilen, ausgeführte Befehle und echte Exitcodes sowie Unsicherheiten. Kein Agent darf weitere Agents starten.

## Stopppunkt

Stoppe nach dem read-only Audit, den zwei Matrizen und genau einem begrenzten Folgeauftrag. Nichts implementieren, nicht dokumentieren, nicht committen oder pushen und keinen Folgeauftrag selbst beginnen.
