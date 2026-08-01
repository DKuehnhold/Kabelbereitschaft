# Architekturauftrag: AP14B Bilder/MinIO – Sicherheits-Gate

## Ausgangslage

Der Lauf `kb-ap14b-images-minio-review-continuation` ist technisch abgeschlossen. Codex hat im unabhängigen Review zwei Freigabeblocker bestätigt und einen noch fehlenden Produktnachweis festgestellt. Bearbeite ausschließlich diese Punkte im bestehenden Vault und auf dem vorhandenen Branch `feat/ap14b-images-minio`.

## Positivliste

1. MinIO-Bootstrap so ändern, dass weder Root- noch Anwendungs-Zugangsdaten in Prozessargumenten oder Logs erscheinen. Die derzeitigen Aufrufe `mc alias set ... <secret>` und `mc admin user add ... <secret>` sind unzulässig. Wenn die installierte `mc`-Schnittstelle keine belastbar nachweisbare geheimnisfreie Provisionierung erlaubt, entferne die automatische Benutzer-/Policy-Provisionierung aus dem produktiven Compose und lasse sie fail-closed als dokumentierten IT-Provisionierungsschritt offen. Keine behauptete Absicherung ohne echten Nachweis. Fehler beim Policy-Attach dürfen nicht mit `|| true` verschluckt werden.
2. Datenbankrecht `UPDATE` auf `public.incident_images` auf exakt die vom Produkt benötigten Spalten begrenzen: `category`, `description`, `deleted_at`, `deleted_by`. Geschützte Identitäts-, Zuordnungs-, Storage- und Metadatenspalten dürfen für `app_user` kein UPDATE-Recht erhalten. Migration und Smoke 22 entsprechend mit `has_column_privilege` und echten Negativversuchen korrigieren.
3. Einen echten MinIO-Nachweis in GitHub Actions vorbereiten. Der Nachweis muss gegen einen wirklichen, versionsfest referenzierten MinIO-Container laufen und mindestens autorisiertes PUT, signiertes GET und DELETE sowie abgewiesene ungültige Signaturen prüfen. Synthetische Test-Zugangsdaten sind erlaubt; keine echten IT-Daten. Wenn ein sicherer CI-Aufbau innerhalb dieses Auftrags nicht möglich ist, halte mit einem konkreten Blocker an und melde den fehlenden Nachweis – nicht als Erfolg.
4. `PROJEKT_WISSEN.md` nur knapp und wahrheitsgemäß nachziehen. AP14B Bilder/MinIO bleibt offen, bis der echte MinIO-CI-Lauf grün belegt ist.
5. Dashboard-/Fortschritts-Evidence nach dem bestehenden Schema vollständig pflegen.

## Negativliste

- Keine GUI-/Designänderungen.
- Keine Änderungen außerhalb des AP14B-Bilder-/MinIO-Scopes.
- Kein Supabase Cloud oder selbst gehostetes Supabase.
- Keine echten IT-Zugangsdaten, keine Secrets in Dateien, Logs oder Kommandozeilen.
- Kein Commit, Push, Merge, Tag oder Release.
- Keine zweite schreibende Orchestrierung und keine Scope-Erweiterung.
- Keine erfundenen Testnachweise.

## Definition of Done

- Prozessargument-/Log-Leak im produktiven Bootstrap beseitigt oder Provisionierung explizit fail-closed an IT abgegeben.
- Spaltenrechte minimal und positive/negative SQL-Smokes belastbar.
- TypeScript, ESLint, Unit-Tests, Build, Produktions-Audit und vollständiger PostgreSQL-18-Lauf grün.
- CI-Konfiguration syntaktisch geprüft; echter MinIO-Test ist Bestandteil der Pipeline. Ohne ausgeführten CI-Lauf nur `vorbereitet`, nicht `bestanden` melden.
- Vollständiger Diff, Exit-Codes, temporäre Artefakte und offene Grenzen in `result.json` dokumentiert; `stderr.log` ausgewertet.

## Stopppunkt

Nach Umsetzung und lokalen Prüfungen an Codex übergeben. Nichts committen oder pushen. Bei drei Wiederholungen desselben Fehlers Circuit Breaker auslösen.
