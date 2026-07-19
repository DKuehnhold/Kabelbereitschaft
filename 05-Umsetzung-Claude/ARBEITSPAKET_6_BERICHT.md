# Arbeitspaket 6 – Umsetzungsbericht
> Stand: 2026-07-19 · E2E-Tests, Offline-Verifikation, Synchronisationshärtung

## Bestandsanalyse
- Remote `https://github.com/DKuehnhold/Kabelbereitschaft.git`, Branch `main`.
- AP5-Commit `e13b4cff04bb5f3e2b7f07adcbecf369ce5d1683` ist **lokal vorhanden**, aber der
  Remote-Tracking-Stand `origin/main` zeigt auf `8d83371` → **AP4 und AP5 sind noch nicht gepusht**
  (kein Git-Zugang in der Build-Umgebung). AP5 wurde NICHT neu implementiert; AP6 baut darauf auf.
- Kein Playwright, kein `.github/`, keine Test-Skripte vorhanden → additiv ergänzt.
- PWA/Offline/Sync-Module aus AP5 (Manifest, SW, IndexedDB, Outbox, Upload-Queue,
  Konfliktspeicher, Manager, `/api/sync`, `/api/images/upload`, Middleware) vorhanden und wiederverwendet.

## AP5-Ausgangsstand (unverändert übernommen)
PWA + Offline-Grundlage aus AP5 (Commit `e13b4cf`), inkl. Migrationen 0001–0005.

## Erledigte AP6-Funktionen
- **Playwright-E2E-Struktur** (`playwright.config.ts`, `e2e/`): 22 Tests in 4 Dateien,
  Chromium als Mindestbrowser, optional Firefox/WebKit (`PLAYWRIGHT_ALL_BROWSERS`), webServer,
  Screenshots/Trace bei Fehlern, Artefakt-Ignore via `.gitignore`.
- **Idempotenz/Deduplizierung** (Migration 0006 `sync_actions` + Server-Dedup in `/api/sync`
  und `/api/images/upload`): jede Offline-Aktion trägt eine stabile Client-Action-ID; Retry
  erzeugt keine Dublette; Kompensation bei fehlgeschlagener Anwendung.
- **Konfliktauflösung**: Anzeige von Konflikttyp, lokalem Wert und Serverstand; Aktionen
  „Serverstand übernehmen", „lokale Änderung erneut anwenden (aktueller Stand)", „verwerfen";
  keine stille Auswahl; Re-Apply lädt frischen Serverstand über `/api/incidents/[id]/meta`.
- **Service-Worker-Update**: dezente Anzeige „Neue Version verfügbar" (jetzt/später), sicheres
  Reload ohne Löschen nicht synchronisierter Offline-Aktionen; Reload-Endlosschutz.
- **Benutzertrennung**: Offline-Aktionen tragen `ownerId`; Ansicht/Flush strikt pro Benutzer;
  keine stille Löschung nicht synchronisierter Daten beim Benutzerwechsel.
- **Diagnose/Dashboard**: zusätzliche Kennzahlen (fehlgeschlagene Aktionen, offene Konflikte,
  Service-Worker-/Online-Status) ohne sicherheitskritische Details.
- **Barrierefreiheit**: Fokusringe, `aria-label`/`role`/`aria-live`, `progressbar`-Semantik,
  Tastaturbedienbarkeit der Offline-/Konflikt-Bedienelemente.
- **CI-Vorbereitung**: `.github/workflows/ci.yml` (install/lint/tsc/build/Playwright-Chromium/E2E,
  Artefakt-Upload bei Fehler; Secrets ausschließlich über GitHub Secrets).

## Testarchitektur
Vier Ebenen, klar getrennt: (1) statisch automatisierbar (lint/tsc/build, SW-Syntax, CSV-Logik);
(2) DB-/RLS-Tests gegen lokale PostgreSQL (Migrationen + Smoke-Tests 10–13); (3) Browser-E2E
(Playwright/Chromium, benötigt Browser-Systembibliotheken + laufenden Server); (4) App-E2E mit
Login/Daten (benötigt zusätzlich eine Test-Supabase-Instanz). Details: `06-Tests/E2E_TESTS.md`.

## E2E-Szenarien (22 Tests)
`@public` (ohne Supabase): Manifest, Icons, Service Worker, Offline-Seite, Login-Rendering,
Auth-Guard-Redirect, öffentliche PWA-Routen. `@app` (mit Test-Supabase): Login gültig/ungültig,
Logout, Rollen-Navigation, direkter URL-/API-Zugriff geschützt, Vorgangsübersicht/Filter/CSV,
Detail/Timeline/Notiz, Bild-Upload, Fremdzugriff blockiert, Offline-Erkennung/Notiz/Status/Queue,
Persistenz nach Reload, Reconnect-Sync, keine Tokens in IndexedDB.

## Geänderte/neue Dateien
- Migration (neu): `app/supabase/migrations/0006_ap6_sync_idempotency.sql`; Test (neu):
  `app/supabase/test/13_ap6_idempotency.sql`.
- API: `api/sync` + `api/images/upload` (Dedup ergänzt), `api/incidents/[id]/meta` (neu).
- Offline-Lib: `offline/{types,manager}` (Idempotenz-IDs, ownerId, failed/swActive, Konfliktauflösung),
  `useOffline` unverändert nutzbar.
- UI: `OfflineBar` (Konfliktauflösung/Diagnose/A11y), `OfflineDashboardCards` (Diagnose),
  `ServiceWorkerRegister` (Update-Prompt), `(app)/layout` (userId), `database.types` (sync_actions).
- E2E: `playwright.config.ts`, `e2e/{helpers,public,auth,incidents,offline-sync}.spec.ts`,
  `e2e/fixtures/sample.jpg` (neutral generiert).
- CI: `.github/workflows/ci.yml`; `app/.gitignore` (Test-Artefakte).
- Doku: ARCHITEKTUR, PWA, OFFLINE, TESTPLAN, TESTFAELLE, SICHERHEIT, BETRIEB, CHANGELOG,
  PROJEKTSTATUS, OFFENE_PUNKTE, E2E_TESTS, SYNCHRONISATION, KONFLIKTBEHANDLUNG.

## Tatsächlich ausgeführte Befehle & Ergebnisse (2026-07-19, Node v22 / PostgreSQL 16)
- `npm ci` OK · `npm run lint` **PASS (0)** · `npx tsc --noEmit` **PASS (0)** (inkl. E2E-Specs) ·
  `npm run build` **PASS** (neue Route `/api/incidents/[id]/meta`).
- Migration `0001–0006` leer → **OK**; `0006` auf **AP5-Bestand** → OK (Incidents erhalten 1/1,
  `sync_actions` ergänzt); `0006` idempotent (Re-Run OK).
- Smoke-Tests: Idempotenz `13` **5/5 OK**, AP3 `11` **16/16**, AP4 `12` **20/20**, AP1/AP2 `10` 0 Fehler.
- `node --check public/sw.js` **gültig**; CSV-Sicherheitstest **12/12**.
- `npx playwright test --list` → **22 Tests** erkannt (Suite valide).
- `npx playwright test public.spec.ts` gegen laufenden Prod-Server: **4 von 7 bestanden**
  (Manifest, Icons, Service Worker, öffentliche Routen – request-basiert). Die 3 seitenbasierten
  Tests konnten **nicht ausgeführt** werden: Chromium startet in der Sandbox nicht
  (`libXdamage.so.1` fehlt; kein root für `playwright install --with-deps`). Kein App-Defekt.

## Migration und Migrationsentscheidung
Migration `0006` war erforderlich: Idempotenz/Dedup ließ sich mit dem AP5-Datenmodell nicht sicher
abbilden. Additiv (neue Tabelle `sync_actions` + Unique-Constraint + RLS), kein Datenverlust,
funktioniert auf leerer DB und auf AP5-Bestand, idempotent.

## Datenbank- und RLS-Ergebnis
`sync_actions` mit `unique(actor, client_action_id)` dedupliziert pro Benutzer; RLS trennt Benutzer
(nur eigene Aktionen sichtbar). Bestehende RLS (Vorgänge/Bilder/Storage) unverändert und in den
Regressions-Smokes bestätigt.

## Playwright-Ergebnisse / Browsermatrix
- Chromium: Suite valide (22 Tests), request-basierte `@public`-Tests bestanden; seitenbasierte
  Tests in der Sandbox nicht lauffähig (fehlende Systembibliotheken). In CI (`--with-deps chromium`)
  lauffähig.
- Firefox/WebKit: optional (`PLAYWRIGHT_ALL_BROWSERS`), in der Sandbox nicht geprüft.

## Offline-/Service-Worker-/Sync-/Konflikt-Ergebnis
Logik implementiert, typgeprüft, gebaut; SW-Syntax gültig; Idempotenz DB-seitig verifiziert (Smoke 13).
Das reale Offline-/SW-/Reconnect-/Konflikt-Verhalten im Browser ist über die `@app`-E2E abgedeckt,
benötigt jedoch Browser-Systembibliotheken + Test-Supabase und wurde in dieser Umgebung nicht ausgeführt.

## Cache- und Datenschutzprüfung
SW cacht nur Same-Origin-GET; `/api`, `/auth`, Cross-Origin (Supabase) nie. IndexedDB enthält nur
fachliche Daten + Warteschlangen, keine Tokens/Secrets/Session (in `keine Tokens`-E2E zusätzlich
automatisiert geprüft, ausführbar mit Browser+Supabase). Benutzertrennung über `ownerId`.

## Regression AP1–AP5
Migration 0001–0006 OK; Smokes 10/11/12 grün; CSV 12/12; keine Regression.

## Gefundene und behobene Fehler
- `sync_actions` fehlte in `database.types.ts` → ergänzt (tsc grün).
- E2E-Spec-Tippfehler (`toHavecount`) → korrigiert.
- Sonst keine Defekte.

## Nicht ausführbare Prüfungen (ehrlich ausgewiesen, NICHT als bestanden gewertet)
- Seitenbasierte Browser-E2E (Chromium-Start scheitert an fehlenden Systembibliotheken; kein root).
- `@app`-E2E (Login/Daten/Offline-Runtime/Konflikt-UI) – benötigen Test-Supabase + Testbenutzer.
- Lighthouse-PWA-Audit: bewusst nicht als hartes Gate eingeführt (nicht stabil reproduzierbar hier).
- Middleware→Proxy-Migration: **bewusst nicht** durchgeführt (siehe unten).

## Commit-Hash / Push
Siehe Abschlussausgabe. Push in dieser Umgebung nicht möglich (keine Git-Zugangsdaten).

## Middleware/Proxy-Entscheidung
Next 16.2 meldet `middleware` als deprecated. Migration zu `proxy` **bewusst nicht** durchgeführt,
da sie sicherheitskritische Auth-/PWA-Routen betrifft und ohne ausführbare Browser-E2E in dieser
Umgebung nicht vollständig testbar ist. Einstufung: **später erforderlich** (mit voller E2E-Abnahme).

## Offene Punkte
- Push von AP4/AP5/AP6 nach GitHub (Zugangsdaten erforderlich).
- Test-Supabase-Instanz + Testbenutzer für die vollständige `@app`-E2E-Ausführung.
- Browser-Systembibliotheken in der Ausführungsumgebung (`playwright install --with-deps`).
- Middleware→Proxy-Migration mit voller E2E-Abnahme.

## Empfehlung für Arbeitspaket 7
1. CI vollständig scharfschalten (Test-Supabase als GitHub-Secret, `--with-deps`-Browser, @app-E2E).
2. Middleware→Proxy-Migration inkl. Regressions-E2E.
3. Push-/Release-Prozess (Tags, Versionsstände) etablieren; AP4–AP6 hochladen.
4. Optionale WebCrypto-Verschlüsselung der Offline-Nutzdaten + Background-Sync/Push.
