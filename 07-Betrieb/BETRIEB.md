# Betrieb – Überblick
> Stand: 2026-08-03 · Ergänzt HOSTING.md, BACKUP.md, DATENSCHUTZ.md, BENUTZERVERWALTUNG.md
> Dieses Dokument beschreibt **ausschließlich belegte lokale und CI-Wege**. Produktive
> Abläufe sind getrennt im Abschnitt „Produktives Deployment – nicht ausgeführt" geführt.

## Build & Prüfungen
```
cd app
npm ci
npm run lint
npx tsc --noEmit
npm run test:unit
npm run build
```
`npm run test:unit` läuft **in keinem CI-Job**; die Ausführung ist lokal vorzunehmen.
DB-/RLS-Prüfungen (lokale PostgreSQL 18): Migrationen `0001`–`0017` sowie die Smokes `15`–`24`
einschließlich `19a`, angewandt in **verschränkter** Reihenfolge über die beiden Runner
(siehe `app/supabase/README.md`, Abschnitt „Anwenden", und `06-Tests/TESTPLAN.md`).
E2E: siehe `06-Tests/E2E_TESTS.md`.

## Migrationen
Bestand `0001`–`0017`, Kette lückenlos. Die Fachmigrationen sind additiv und idempotent
(soweit vorgesehen); die **Kette als Ganzes ist es nicht** — `0013` entfernt Schemata und eine
Funktion, und `19a_ap14b_grant_reset.sql` entzieht Rechte pauschal.
Angewandt wird sie ausschließlich über die beiden Testrunner
`app/supabase/test/run_db_tests.sh` (POSIX, auch CI-Weg) und
`app/supabase/test/run_ap14b_local.ps1` (Windows, mit `-TemporaryCluster`) gegen eine
**Testdatenbank**; beide führen zuvor `bootstrap/01_roles.sql`, `02_compat_auth.sql` und
`03_compat_storage.sql` aus. Details: `app/supabase/README.md`.

**Es gibt kein produktives Migrationsverfahren.** Weder die CI noch der Containerstart
führen Migrationen aus (`deploy/README.md`). Der Verzeichnisname `app/supabase/` ist ein
historischer Pfadname. Die Kette darf nie gegen eine fremde Plattform laufen, weil
Migration `0013` die Kompatibilitätsschemata entfernt.

## CI
`.github/workflows/` enthält genau zwei Workflows.

`ci.yml` (Trigger `push` und `pull_request` auf `main`) mit vier Jobs:
- `verify`: `npm ci`, `npm run lint`, `npx tsc --noEmit`, `node --check` auf `public/sw.js`,
  `docker/healthcheck.mjs` und `docker/verify-runtime-config.mjs`, `npm run build`,
  `npm audit --audit-level=high --omit=dev` als hartes Gate, ein zweiter informativer
  Audit-Lauf, `npx playwright install --with-deps chromium`,
  `npx playwright test --grep @public`.
- `database`: PostgreSQL-18-Dienst, `npm ci` (zwingend — ohne `app/node_modules` findet das
  Skript kein `pg` und bricht ab), Installation des PostgreSQL-Clients, danach
  `app/supabase/test/run_db_tests.sh` mit `AP14B_INTEGRATION: require`.
- `container`: Hadolint, echter Docker-Build **ohne** Push, Startvalidierung muss Exit-Code
  78 liefern, `docker history`-Prüfung gegen Secret-Muster, `docker compose config` für
  Stage und Produktion, Trivy informativ.
- `objectstore`: echter MinIO-Container, Provisionierung, danach die Integrationssuite
  `ap14b-minio-live.int.mjs`.

`container-image.yml` baut und pusht das Image nach GHCR, ohne `latest`, und enthält
**keinen Prüfschritt**.

Integrationssuiten: in der CI laufen `ap14b-admin-users.int.mjs` und
`ap15-dashboard-metrics.int.mjs` (über `run_db_tests.sh`) sowie `ap14b-minio-live.int.mjs`
(Job `objectstore`). Die drei Suiten `ap14b-platform.int.mjs`,
`ap14b-masterdata-inventory.int.mjs` und `ap14b-images.int.mjs` laufen **ausschließlich
lokal** über `run_ap14b_local.ps1`. Kein produktiver Datenbestand für CI-Tests.

## Produktives Deployment – nicht ausgeführt
- `deploy/` enthält `compose.yml` mit den Diensten `app`, `postgres` und `minio`
  (**keine veröffentlichten Ports**), die Overlays für Stage und Produktion sowie die
  Skripte `deploy.sh`, `rollback.sh`, `healthcheck.sh`, `db-backup.sh` und `db-restore.sh`.
- `deploy/README.md` ist selbst als **Entwurf, nicht freigegeben** markiert.
- **Es hat kein Containerlauf stattgefunden** (`deploy/README.md`).
- Echte IT-Adressen, DNS und die Same-Origin-Route am internen Reverse-Proxy sind **offen**.
- Die Provisionierung von MinIO-Bucket und Dienstidentität ist ein verbindlicher IT-Schritt
  und **nicht erbracht**.

## PWA-Betrieb
Service Worker (`/sw.js`) mit versionierten Caches (`CACHE_VERSION`); neue Versionen aktivieren sich
und melden „Neue Version verfügbar". Cache-Invalidierung bei `activate`. Details: `03-Architektur/PWA.md`.

## Diagnose
Offline-Leiste und Dashboard zeigen Sync-/Queue-/Konflikt-/SW-Status. Keine sicherheitskritischen
Details (keine Tokens/IDs). Eine erweiterte Diagnoseansicht wäre in Produktion nur für Administratoren
vorzusehen bzw. deaktivierbar zu halten.

## Sicherheit im Betrieb
Siehe `03-Architektur/SICHERHEIT.md`: keine Secrets im Repo/Client/Offline-Speicher; signierte URLs;
RLS maßgeblich; Benutzertrennung der Offline-Daten. Secrets ausschließlich über Umgebungsvariablen
bzw. GitHub Secrets.

Ergänzend belegt:
- **RLS ist der Autorisierungsträger** für die Fachtabellen; die Anwendungsprüfung ist die
  zweite Schicht. Ausnahme, ausdrücklich benannt: `public.auth_accounts` und
  `public.auth_sessions` sind **nicht** RLS-geschützt, sondern über eng geschnittene
  Tabellenrechte; ihr Zugriffsweg läuft bewusst ohne gesetzte Identität.
- Die Identität wird **transaktionslokal** gesetzt (`set_config('app.user_id', …, true)`) und in
  der Datenbank über `app.current_user_id()` gelesen. Eine fehlende oder unplausible
  Benutzer-ID bricht bereits vor dem SQL ab.
- Die Anwendungsrolle `app_user` hat weder `SUPERUSER` noch `BYPASSRLS`; zusätzlich verweigert
  ein Startgate im Datenbankmodul den Betrieb bei privilegierter Rolle.
- Sitzungen: Auth.js v5, verschlüsselte JWTs; an Nutzdaten trägt der Token ausschließlich
  `sub` und `sid` (Auth.js ergänzt lediglich `iat`, `exp` und `jti`) — keine Rolle, keine
  Berechtigung, keinen Namen. Lebensdauer
  10 Minuten; Widerruf über `public.auth_sessions` (`revoked_at`), geprüft bei jeder
  Sitzungsauswertung. Rolle und Anzeigename stammen immer aus der Datenbank, nie aus einem Claim.
- Bilder: Auslieferung über kurzlebige signierte GET-URLs (TTL 3600 Sekunden), erzeugt erst
  **nach** der RLS-Prüfung. Uploads laufen serverseitig, kein presigned PUT im Browser.
  Der Bucket ist als **privat ohne anonyme Freigabe** ausgelegt und ohne veröffentlichten Port
  definiert; belegt ist das durch die versionierte Policy-Datei und den CI-Job `objectstore`.
  Für eine betriebene Umgebung ist es **nicht** belegt, weil die Provisionierung von Bucket und
  Dienstidentität noch aussteht (siehe „Produktives Deployment – nicht ausgeführt").
- Durchsetzende Sicherheitsheader: `X-Content-Type-Options`, `Referrer-Policy`,
  `X-Frame-Options`, `Permissions-Policy`, `Strict-Transport-Security`,
  `X-DNS-Prefetch-Control`, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`.
- **CSP ausschließlich `Content-Security-Policy-Report-Only`**, also nicht durchsetzend. Ein
  Report-Endpunkt ist nicht konfiguriert; die Umstellung ist **offen**.
- Verbotene Variablennamen: `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Ihr Vorhandensein – wie auch eine fehlende Pflichtvariable –
  bricht den Containerstart mit **Exit-Code 78** ab.

## Bekannte Umgebungsanforderungen für Tests
- Browser-E2E: `playwright install --with-deps chromium` (Systembibliotheken erforderlich).
- App-E2E: interner Stack aus PostgreSQL 18 und MinIO mit Testbenutzern; erster Administrator
  über `app/scripts/bootstrap-admin.mjs`.
- Die vollständige `@app`-/Offline-Abnahme ist **nicht erbracht**.

## AP7-Ergänzung
Health-Check `/api/health`; HTTP-Sicherheitsheader (SICHERHEIT.md); Release-/Betriebskonzepte:
`BACKUP_UND_RECOVERY.md`, `MONITORING.md`, `00-Projektsteuerung/RELEASEPROZESS.md`,
`RELEASE_CHECKLISTE.md`, `RELEASE_NOTES_RC1.md`. Release-Gates siehe RELEASE_CHECKLISTE.md.
