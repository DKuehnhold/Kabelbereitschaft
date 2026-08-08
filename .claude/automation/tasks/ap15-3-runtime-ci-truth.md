# AP15-3 — Runtime- und CI-Wahrheit konsolidieren

## Ziel

Korrigiere den eng begrenzten, nicht-visuellen Rest aus AP15-2: Die Deployment-Dokumentation und
die lokale Umgebungsvariablen-Vorlage müssen den belegten PostgreSQL-18-/Auth.js-v5-/MinIO-Stand
wiedergeben, und die vorhandenen Unit-Tests müssen als hartes Gate im bestehenden CI-Job `verify`
laufen. Keine neue Produktfunktion und keine Erweiterung der Datenbank-Integrationssuiten.

## Verbindliche Architekturgrenzen

- Zielplattform ausschließlich PostgreSQL 18 + Auth.js v5 + MinIO + Container hinter internem
  Reverse-Proxy. Supabase Cloud und selbst gehostetes Supabase bleiben ausgeschlossen.
- Arbeite ausschließlich im bestehenden Vault. Keine Clones, Ersatzordner, dauerhaften
  Wegwerfkopien oder fremden Dienste.
- Claude ist alleiniger Orchestrator. Ausführungs-Agents starten keine Agents und führen keinen
  Commit, Push, Merge, Tag oder Release aus.
- Im gemeinsamen Vault schreibt höchstens ein Agent gleichzeitig; read-only Prüfungen dürfen
  parallel laufen.
- Jeder Agentenvertrag enthält Positivliste, Negativliste, DoD, Stopppunkt und konkrete Evidence.
- Echte IT-Verbindungsdaten fehlen weiterhin. Nur lokale/synthetische Werte und vorhandene CI-
  Dienste verwenden. Keine erfundenen Betriebsnachweise.

## Positivliste

Produktiv versionierbare Änderungen sind ausschließlich erlaubt an:

1. `deploy/README.md`
2. `app/.env.example`
3. `.github/workflows/ci.yml`
4. `PROJEKT_WISSEN.md`
5. `PROJEKTSTATUS.md`
6. `.claude/automation/status/fortschritt.json` nur als operative, gitignorierte Statusdatei

Die vorliegende Taskdatei darf als Auftragsnachweis bestehen bleiben.

## Konkreter Auftrag

1. Prüfe die Aussagen in `deploy/README.md` gegen die aktuellen Quellen, mindestens:
   `.github/workflows/ci.yml`, `app/supabase/test/run_db_tests.sh`,
   `app/supabase/test/run_ap14b_local.ps1`, `deploy/compose.yml`,
   `app/docker/verify-runtime-config.mjs` und den aktuellen Migrationsbestand.
2. Korrigiere nur nachweislich überholte Aussagen. Insbesondere muss klar und widerspruchsfrei
   festgehalten sein:
   - aktuelle Migrationskette `0001`–`0017`;
   - der CI-Job `database` führt diese Kette aus, während Containerstart und produktives
     Deployment keine Migration automatisch ausführen;
   - `docker compose config` wird für Stage und Produktion in CI geprüft;
   - ein echter MinIO-Container und der Produktivcode werden im Job `objectstore` geprüft;
     dies ist kein Nachweis einer produktiven Umgebung oder der echten Reverse-Proxy-Route;
   - die manuelle produktive MinIO-Provisionierung, Sicherung/Recovery und IT-Endpunkte bleiben
     offen, soweit sie nicht belegt sind.
3. Ergänze in `app/.env.example` eine ausdrücklich sichtbare, auskommentierte `AUTH_URL=`-Zeile
   samt wahrer Einordnung: im Containerbetrieb Pflicht; lokal nur so weit erforderlich, wie es
   der Quelltext tatsächlich verlangt. Keine echte interne URL und kein scheinbar produktiver
   Beispielwert.
4. Ergänze im bestehenden CI-Job `verify` genau ein hartes Unit-Test-Gate über das bereits
   vorhandene Skript `npm run test:unit`. Keine Testabschaltung, kein `continue-on-error`.
5. Halte `PROJEKT_WISSEN.md` und `PROJEKTSTATUS.md` knapp und quellentreu: AP15-3 umgesetzt,
   exakter Umfang, tatsächlich ausgeführte lokale Nachweise und weiterhin offene Grenzen. Keine
   Vorabbehauptung grüner GitHub-CI; die ergänzt Codex erst nach Push und tatsächlichem Lauf.

## Negativliste

- Keine Änderung an Produktcode, SQL, Migrationen, Datenbankrollen, RLS, Authentifizierung,
  MinIO-Produktivcode, Compose-Dateien, Dockerfile, Deploy-Skripten oder Tests selbst.
- Keine Aufnahme der drei bislang nur lokal laufenden Integrationssuiten in CI; das ist ein
  separates Folgepaket mit eigener Laufzeit- und Isolationsprüfung.
- Keine Aktivierung der sechs historischen Smokes `00`, `10`, `11`, `12`, `13`, `14`; ihre
  Einordnung ist ein separates Paket.
- Keine sichtbare GUI-/Designänderung, keine fachliche Entscheidung zu `fehlalarm`, Tagesgrenze,
  Dashboard oder Benutzerverwaltungsoberfläche.
- Keine Archivierung, Umbenennung, Verschiebung oder Löschung.
- `07-Betrieb/IT_ANFRAGE_INFRASTRUKTUR.md` weder lesen noch ändern noch versionieren.
- Keine echten Zugangsdaten, keine neuen Secrets, keine externen Cloud-Dienste.

## Definition of Done

- Der Gesamtdiff enthält außer Taskdatei und operativer Statusdatei nur die fünf Dateien der
  Positivliste und keine Datei der Negativliste.
- Jede geänderte Aussage ist mit einer konkreten Quellstelle belegt; historische Aussagen bleiben
  historisch erkennbar.
- `deploy/README.md` enthält keine aktuelle Behauptung mehr, die CI führe keine Migrationen aus,
  keine aktuelle Kette `0001`–`0016` und keine pauschale Behauptung, MinIO/Compose seien ungeprüft.
- `app/.env.example` enthält genau eine auskommentierte `AUTH_URL=`-Beispielzeile ohne echte
  Adresse und beschreibt die Containerpflicht korrekt.
- `.github/workflows/ci.yml` führt `npm run test:unit` im Job `verify` als hartes Gate aus.
- Von Claude selbst ausgeführt und mit Exitcode berichtet: `npm run test:unit`,
  `npm run typecheck`, `npm run lint`, `npm run build`, `git diff --check`.
- Zusätzlich mechanisch geprüft: YAML lässt sich mit einer bereits vorhandenen lokalen
  Projektabhängigkeit oder einem vorhandenen Systemwerkzeug parsen, sofern ohne Installation
  möglich; andernfalls ehrlich als nicht lokal geparst markieren. Keine neue Abhängigkeit.
- Keine temporären synthetischen Artefakte verbleiben; Git-Status vor und nach den Nachweisen wird
  berichtet. Keine Behauptung eines GitHub-CI-Ergebnisses vor dem späteren Push.

## Stopppunkt

Sofort stoppen und mit Rohbefund an Codex übergeben, wenn eine Korrektur Produktcode, Tests,
Runner, Compose/Deploy-Skripte, echte IT-Daten oder eine sichtbare Entscheidung erfordern würde;
wenn die Positivliste nicht genügt; wenn ein Schreibkonflikt oder aktiver zweiter Schreiblauf
festgestellt wird; oder wenn derselbe Fehler dreimal auftritt. Scope nicht eigenmächtig erweitern.

## Evidence je Agent

Claude muss je eingesetztem Agenten dokumentieren: Agentenprofil, Positivliste, Negativliste, DoD,
Stopppunkt, gelesene Quellen, geänderte Dateien, exakte Befunde und Rohresultate der Prüfungen.
Claude prüft danach selbst Agentenergebnisse, vollständigen Gesamtdiff, Positiv-/Negativliste,
Git-Status und alle behaupteten Nachweise und setzt den Staffelstab erst dann auf Codex.
