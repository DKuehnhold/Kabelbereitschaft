# Betrieb – Überblick (Stand AP6)
> Stand: 2026-07-19 · Ergänzt HOSTING.md, BACKUP.md, DATENSCHUTZ.md, BENUTZERVERWALTUNG.md

## Build & Prüfungen
```
cd app
npm ci
npm run lint
npx tsc --noEmit
npm run build
```
DB-/RLS-Prüfungen (lokale PostgreSQL): Migrationen `0001`–`0006` + Smoke-Tests `10`–`13`
(siehe `06-Tests/TESTPLAN.md`). E2E: siehe `06-Tests/E2E_TESTS.md`.

## Migrationen
Reihenfolge `0001`→`0006`, additiv und idempotent (soweit vorgesehen). In Supabase im SQL-Editor
oder per CLU `supabase db push` anwenden. `test/*`-Dateien niemals in Supabase ausführen.

## CI
`.github/workflows/ci.yml`: install → lint → tsc → build → Playwright(Chromium) → `@public`-E2E.
Vollständige `@app`-E2E benötigen Test-Supabase-Secrets (GitHub Secrets). Kein produktiver
Datenbestand für CI-Tests.

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

## Bekannte Umgebungsanforderungen für Tests
- Browser-E2E: `playwright install --with-deps chromium` (Systembibliotheken erforderlich).
- App-E2E: Test-Supabase-Instanz + Testbenutzer.

## AP7-Ergänzung
Health-Check `/api/health`; HTTP-Sicherheitsheader (SICHERHEIT.md); Release-/Betriebskonzepte:
`BACKUP_UND_RECOVERY.md`, `MONITORING.md`, `00-Projektsteuerung/RELEASEPROZESS.md`,
`RELEASE_CHECKLISTE.md`, `RELEASE_NOTES_RC1.md`. Release-Gates siehe RELEASE_CHECKLISTE.md.
