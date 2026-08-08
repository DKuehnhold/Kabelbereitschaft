# AP15-5: Drei PostgreSQL-Integrationssuiten fail-closed in Linux-CI aufnehmen

## Rolle und Ziel

Du bist der alleinige ausführende Claude-Orchestrator. Setze den unabhängig geprüften AP15-4-Befund eng begrenzt um: Die bislang nur lokal laufenden Suiten `ap14b-platform`, `ap14b-masterdata-inventory` und `ap14b-images` müssen im bestehenden Linux-CI-Job `database` gegen dieselbe temporäre PostgreSQL-18-Datenbank ausgeführt werden und im CI-Pflichtmodus niemals still überspringen. Kein neuer Job, keine neuen Secrets, keine Fach- oder GUI-Änderung.

## Verbindliche Positivliste

- `app/supabase/test/run_db_tests.sh`
- `app/test/integration/ap14b-platform.int.mjs`
- `app/test/integration/ap14b-masterdata-inventory.int.mjs`
- `app/test/integration/ap14b-images.int.mjs`
- `.github/workflows/ci.yml` ausschließlich für eine sachlich notwendige Aktualisierung des bestehenden `database`-Schrittnamens oder direkt zugehöriger Kommentare; keine Ablaufänderung außer dem Aufruf des bestehenden Runners
- Bestehende ignorierte operative Fortschrittsdatei, falls der Starter sie verlangt

## Verbindliche Negativliste

- Alle anderen versionierten Dateien, insbesondere Produktcode, Migrationen, SQL-Smokes, `run_ap14b_local.ps1`, `run_ap12_local.ps1`, `package.json`, Lockfiles, Dokumentation, Deploy-/Containerdateien und andere Workflows
- Keine Änderung der bereits laufenden Suiten `ap14b-admin-users`, `ap15-dashboard-metrics`, `ap14b-minio-live` außer der notwendigen Reihenfolge ihrer unveränderten Runner-Aufrufe in `run_db_tests.sh`
- Keine Aufnahme, Löschung oder Bearbeitung der historischen Dateien `00_stub_auth_storage.sql` und `10` bis `14`
- Die drei fremden unversionierten Dateien `00-Projektsteuerung/CODEX_ANFRAGE_BILDSPEICHER_DATEISYSTEM.md`, `07-Betrieb/IT_ANFRAGE_INFRASTRUKTUR.md`, `07-Betrieb/IT_RUECKMELDUNG_INFRASTRUKTUR.md` weder lesen noch verändern
- Keine echten IT-Verbindungsdaten, keine fremden Cloud-Dienste, kein Supabase-Betrieb
- Keine GUI-/Designentscheidung; keine Umsetzung von `fehlalarm`, Tagesgrenze, Filteroptionen oder Vollmengen-Reads
- Kein Commit, Push, Merge, Tag, Release, RC1- oder V1-Urteil

## Architekturgrenzen und Auftrag

1. Ergänze in jeder der drei Suiten den Pflichtmodus nach dem belegten Muster von `ap14b-admin-users.int.mjs`/`ap15-dashboard-metrics.int.mjs`: `AP14B_REQUIRE_INTEGRATION=1` plus fehlende getrimmte `AP14B_APP_DATABASE_URL`/`AP14B_ADMIN_DATABASE_URL` muss **beim Modulladen** mit neutraler Meldung nur der Variablennamen und Exitcode ungleich 0 abbrechen. Ohne Pflichtmodus bleibt der bisherige optionale Skip unverändert.
2. Ergänze `run_db_tests.sh` um existenzgeprüfte Aufrufe der drei Suiten. Leite die jeweils korrekte Hook-Datei aus `run_ap14b_local.ps1` und dem Modulinventar ab; nicht raten.
3. Führe alle fünf PostgreSQL-Node-Suiten in genau dieser Reihenfolge aus: `ap14b-platform` → `ap14b-masterdata-inventory` → `ap14b-images` → `ap14b-admin-users` → `ap15-dashboard-metrics`. Hintergrund: Der Plattformtest zählt nutzbare Admin-Hashes global und muss vor der Admin-Suite laufen. Jede Suite ist ein eigener, eindeutig protokollierter Prozessblock und stoppt den Runner bei Fehler.
4. Verwende für alle fünf Aufrufe dieselben bereits synthetisch erzeugten Anwendungs-/Admin-Verbindungswerte und setze `AP14B_REQUIRE_INTEGRATION=1` ausschließlich als Umgebungsvariable des jeweiligen Node-Prozesses. Keine Zugangswerte in Argumentlisten oder Logs.
5. Bewahre die ephemere Datenbank- und Rollenbereinigung des Runners. Bei Fehlschlag einer Suite darf keine nachfolgende Suite einen grünen Scheinnachweis erzeugen. Temporäre lokale Testartefakte vollständig entfernen.
6. Aktualisiere gegebenenfalls nur den bestehenden CI-Schrittnamen/Kommentar, sodass er die fünf Suiten quellentreu nennt; `ci.yml` ruft weiterhin nur `run_db_tests.sh` auf.

## Definition of Done

- Der Linux-Runner startet die fünf Suiten exakt einmal in der festgelegten Reihenfolge.
- Die drei neuen CI-Suiten sind bei `AP14B_REQUIRE_INTEGRATION=1` fail-closed; fehlende Pflichtvariablen ergeben je Suite Exitcode ungleich 0 und keine Secrets im Fehlertext.
- Ohne Pflichtmodus bleibt der lokale Skip-Vertrag der drei Dateien erhalten.
- Keine neuen Jobs, Secrets, Pakete, Migrationen oder Fachänderungen.
- Syntaxprüfungen für Shell und alle drei `.mjs`-Dateien erfolgreich.
- Vollständiger synthetischer PostgreSQL-18-Lauf des geänderten `run_db_tests.sh` mit allen Migrationen/Smokes und fünf Suiten ist nach Möglichkeit lokal mit echten Exitcodes belegt. Erwarteter Integrationsumfang: 32 + 31 + 37 + 31 + 10 = 141 Fälle, skipped 0. Falls die lokale Umgebung den Lauf objektiv nicht erlaubt, nicht behaupten; exakten Blocker und alle sicher möglichen Teilnachweise liefern.
- `git diff --check` Exit 0; nur Dateien der Positivliste geändert.

## Pflicht-Evidence je Agent

Jeder eingesetzte Claude-Agent berichtet Profil, Teil-Scope, Positiv-/Negativliste, gelesene Quellen, konkret geänderte Dateien, ausgeführte Befehle mit echten Exitcodes, Fall-/Skip-Zahlen, Cleanup-Nachweis und Grenzen. Keine erfundenen Nachweise. Read-only Prüfer dürfen parallel arbeiten; genau ein Agent schreibt sequenziell.

## Stopppunkt

Stoppe nach Implementierung, lokalen Nachweisen, vollständiger Bereinigung und Evidence-Bericht. Nicht committen oder pushen; keinen Dokumentations- oder Folgeauftrag beginnen.
