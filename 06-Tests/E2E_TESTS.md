# E2E-Tests (Playwright) – AP6
> Stand: 2026-07-19

## Aufbau
- Konfiguration: `app/playwright.config.ts` (Chromium verbindlich; Firefox/WebKit optional über
  `PLAYWRIGHT_ALL_BROWSERS=1`). Basis-URL `E2E_BASE_URL` (Standard `http://localhost:3000`).
- Testserver: `webServer` startet `npm run start` (setzt `next build` voraus); mit
  `E2E_NO_WEBSERVER=1` gegen eine externe URL deaktivierbar.
- Testverzeichnis: `app/e2e/` — `public.spec.ts`, `auth.spec.ts`, `incidents.spec.ts`,
  `offline-sync.spec.ts`, Helfer `helpers.ts`, neutrales Fixture `fixtures/sample.jpg`.
- Skripte: `npm run test:e2e`, `test:e2e:headed`, `test:e2e:debug`.
- Artefakte (`playwright-report/`, `test-results/`, `blob-report/`) sind über `.gitignore` ausgeschlossen.

## Testebenen
1. **Statisch (immer):** lint, tsc, build, SW-Syntax, CSV-Logik.
2. **DB/RLS (lokale PostgreSQL):** Migrationen 0001–0006, Smoke-Tests `10`–`13`.
3. **Browser-E2E `@public`:** ohne Supabase; benötigt Chromium + laufenden Server.
4. **App-E2E `@app`:** benötigt zusätzlich Test-Supabase + Testbenutzer (sonst automatisch übersprungen).

## Testbenutzer / -daten (nur über Umgebungsvariablen)
`E2E_ADMIN_EMAIL/PASSWORD`, `E2E_DISPO_*`, `E2E_MONTEUR_*` (zugewiesen), `E2E_MONTEUR2_*`
(unberechtigt), `E2E_INCIDENT_ID` (dem Test-Monteur zugewiesener Vorgang),
`NEXT_PUBLIC_SUPABASE_URL/ANON_KEY`. Keine Zugangsdaten im Repository; keine produktiven Daten;
keine echten personenbezogenen Daten; keine Service-Role-Schlüssel im Browser.

## Tatsächlich ausgeführt (2026-07-19)
- `playwright test --list` → 22 Tests erkannt.
- `playwright test public.spec.ts` gegen Prod-Server: **4/7 bestanden** (request-basiert: Manifest,
  Icons, Service Worker, öffentliche Routen). 3 seitenbasierte Tests **nicht ausführbar** in der
  Sandbox (Chromium-Systembibliotheken fehlen, kein root). Kein App-Defekt.

## Ausführung lokal
```
cd app
npm ci && npm run build
npx playwright install --with-deps chromium   # Browser + Systembibliotheken
npx playwright test                            # @public läuft; @app nur mit E2E_*-Env
```

## CI
`.github/workflows/ci.yml`: install → lint → tsc → build → `playwright install --with-deps chromium`
→ `playwright test public.spec.ts`. Vollständige `@app`-E2E benötigen Test-Supabase-Secrets
(als GitHub Secrets), sonst werden sie übersprungen.

## AP7-Ergänzung
- Neue `@public`-Tests (request-basiert, ausführbar): Health-Check (`/api/health`) und
  Sicherheitsheader. Accessibility via `@axe-core/playwright` (`e2e/a11y.spec.ts`, `@public`;
  Browserlauf benötigt Systembibliotheken).
- CI führt `npx playwright test --grep @public` aus (inkl. a11y) sowie `npm audit --audit-level=high`.
- Ausgeführt am 2026-07-19: `playwright test --list` = 26 Tests; `public.spec.ts` = 6/9 bestanden
  (request-basiert grün inkl. Health/Header; 3 seitenbasierte scheitern am Chromium-Start in der Sandbox).
