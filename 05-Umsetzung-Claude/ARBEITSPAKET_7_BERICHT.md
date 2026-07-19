# Arbeitspaket 7 – Umsetzungsbericht
> Stand: 2026-07-19 · Release Readiness, Security Review, produktionsnahe Abnahme

## Git-/Repository-Stand & Push-Stand AP4–AP7
- Remote `https://github.com/DKuehnhold/Kabelbereitschaft.git`, Branch `main`, keine ManagementOS-Verbindung.
- `origin/main` = `8d83371`. **Unpushed (lokal in `main`, nicht auf origin):** AP4 `e9e16ac`,
  AP5 `e13b4cf`, AP6 `88336f8` und der AP7-Commit. Alle bekannten Commits sind vorhanden, Teil von
  `main`, keine fremden Änderungen. **AP7 wurde nicht neu implementiert**, sondern auf dem Stand aufgesetzt.
- Push in dieser Umgebung nicht möglich (keine Git-Zugangsdaten) → am Ende erneut zu versuchen.

## Bestandsreview AP1–AP6 (aus tatsächlichem Code)
| Bereich | Soll | Ist | Nachweis | Risiko | Status |
|---|---|---|---|---|---|
| Auth/Session | Cookie-SSR, Guard | vorhanden | `auth.ts`, `middleware.ts` | niedrig | OK |
| Rollen/RLS | admin/dispo/monteur | vorhanden | `0001_init.sql` Policies | niedrig | OK |
| Audit/Timeline | unveränderbar | Trigger + Chronik | `tg_audit`, `incident_notes` | niedrig | OK |
| Vorgänge/Dashboard | CRUD/Filter/Kennzahlen | vorhanden | `incidents.ts`, `dashboard` | niedrig | OK |
| Bilder/Storage | privat, signierte URLs | vorhanden | `images-server.ts`, `0002` | niedrig | OK |
| EXIF/GPS/Soft-Delete | validiert | vorhanden | `exif.ts`, `0005` | niedrig | OK |
| CSV-Export | gefiltert, injektionssicher | vorhanden | `csv.ts` (Test 12/12) | niedrig | OK |
| PWA/SW/IndexedDB | Manifest/SW/Cache | vorhanden | `manifest.ts`, `sw.js`, `offline/*` | niedrig | OK |
| Outbox/Upload-Queue | persistiert, Retry | vorhanden | `manager.ts` | niedrig | OK |
| Idempotenz | Dedup pro Aktion | `sync_actions` (0006) | Smoke 13 (5/5) | niedrig* | OK |
| Konflikt (Erkennung/Auflösung) | keine stille Überschreibung | vorhanden | `/api/sync`, `OfflineBar` | niedrig | OK |
| Benutzertrennung offline | ownerId | vorhanden | `manager.ts` | mittel** | OK |
| Playwright/CI | Struktur + Workflow | vorhanden | `e2e/*`, `ci.yml` | mittel*** | OK |
| Doku/Betrieb | vollständig | erweitert (AP7) | siehe Doku | niedrig | OK |

\* Kompensationslogik ist nicht in einer DB-Transaktion gekapselt (Supabase-JS) – kleines
Restfenster; siehe „Idempotenz/Race" und `SYNCHRONISATION.md`.
\** Trennung greift; die tatsächliche Browserprüfung (Benutzerwechsel) benötigt einen echten
Browser (hier nicht ausführbar).
\*** E2E-Vollausführung benötigt Browser-Systembibliotheken + Test-Supabase.

## Erledigte AP7-Maßnahmen (additiv)
- **HTTP-Sicherheitsheader** (`next.config.ts`): `X-Content-Type-Options`, `Referrer-Policy`,
  `X-Frame-Options`, `Permissions-Policy`, `Strict-Transport-Security`, `X-DNS-Prefetch-Control`,
  `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`; **CSP als Report-Only** (bewusst,
  um nichts unbemerkt zu blockieren – Browser-Verifikation vor Umstellung auf durchsetzend).
- **Health-Check** `/api/health` (öffentlich, minimal: status/version/time; keine Secrets/DB).
- **Accessibility-Tests** (`@axe-core/playwright`, `e2e/a11y.spec.ts`, `@public`).
- **E2E ergänzt:** Health-Check- und Security-Header-Prüfung (request-basiert, ausführbar).
- **CI gehärtet:** `npm audit --audit-level=high` als Gate (moderate = dokumentiertes Risiko),
  `@public`-E2E inkl. a11y.
- **`.env.example`** um neutrale Hinweise (Bildgröße, App-Version, E2E-Variablen) ergänzt.
- Umfangreiche Release-/Betriebsdokumentation (siehe „geänderte Dateien").

## Geänderte/neue Dateien
- Code: `app/next.config.ts` (Header), `app/src/app/api/health/route.ts` (neu),
  `app/src/middleware.ts` + `app/src/lib/supabase/middleware.ts` (Health öffentlich),
  `app/.env.example`, `app/package.json`/`package-lock.json` (@axe-core/playwright).
- Tests: `app/e2e/a11y.spec.ts` (neu), `app/e2e/public.spec.ts` (Health/Header), `.github/workflows/ci.yml`.
- Doku: ARCHITEKTUR, SICHERHEIT (Endpunkt-/RLS-Matrix, Header, Secrets), DATENSCHUTZ, PWA, OFFLINE,
  SYNCHRONISATION, KONFLIKTBEHANDLUNG, E2E_TESTS, TESTPLAN, TESTFAELLE, BETRIEB, DEPLOYMENT,
  BACKUP_UND_RECOVERY (neu), MONITORING (neu), RELEASEPROZESS (neu), RELEASE_CHECKLISTE (neu),
  RELEASE_NOTES_RC1 (neu), CHANGELOG, PROJEKTSTATUS, OFFENE_PUNKTE, PROJEKT_WISSEN (neu).

## Abhängigkeits-/Audit-Ergebnis
`npm audit`: **2 moderate**, 0 hoch/kritisch. Ursache: `postcss` 8.4.31 **build-time gebündelt in
Next.js 16.2.10** (Tailwind nutzt bereits gepatchtes 8.5.20). Der einzige npm-„Fix" wäre
`--force` → Downgrade Next auf 9.x (schwerwiegender Bruch, abgelehnt). Bewertung: Angriffsfläche
praktisch null (postcss verarbeitet nur entwicklereigenes, vertrauenswürdiges CSS zur Buildzeit;
kein Nutzer-CSS zur Laufzeit). **Maßnahme:** kein Force-Downgrade; Next.js aktualisieren, sobald
eine Patch-Version mit postcss ≥ 8.5.10 vorliegt. CI-Gate: `--audit-level=high`.

## Security Review (Kurz)
Auth serverseitig (`getSessionProfile`) auf allen API-Routen; RLS + DB-Trigger maßgeblich;
Storage privat + signierte URLs; Upload-Validierung (Magic Bytes, Größe, Kategorie,
Dateinamenbereinigung); CSV-Injektionsschutz; Logout POST-only; keine `console.*`-Leaks; keine
Stacktraces im UI. Endpunkt-/RLS-Matrix siehe `SICHERHEIT.md`. Offene, nicht browserausführbare
Punkte klar markiert.

## API-Endpunktprüfung
`/api/sync` (POST, Auth, RLS, Dedup, Konflikt), `/api/images/upload` (POST, Auth, RLS, Validierung,
Dedup), `/api/incidents/[id]/meta` (GET, Auth, RLS), `/api/health` (GET, öffentlich, minimal),
`/auth/signout` (POST). Detailmatrix in `SICHERHEIT.md`.

## RLS- und Storage-Prüfung
Alle fachlichen Tabellen mit RLS; `SECURITY DEFINER`-Hilfsfunktionen mit gesetztem `search_path`;
Storage-Policies auf `incident-images`; `sync_actions` benutzergetrennt. DB-seitig über Smokes
10–13 verifiziert (nicht nur über UI).

## Secrets-Prüfung
`git grep`/Trackingliste: **keine** Secrets/Tokens/Keys/`.env` im Repo (nur `.env.example` mit
Variablennamen; Service-Role auskommentiert). Treffer im Scan sind ausschließlich Variablennamen in
Doku bzw. das Detektionsmuster im E2E-Test.

## Security Header
Gesetzt und (request-basiert) verifiziert; CSP als Report-Only (Browser-Verifikation ausstehend).

## Datenschutzprüfung (technisch, keine juristische Freigabe)
Datenminimierung, Zweckbindung Bild/GPS, Soft-Delete + geplante physische Löschung, Audit-Aufbewahrung,
Offline-Datenumfang und Benutzertrennung bewertet – siehe `07-Betrieb/DATENSCHUTZ.md`. GPS/Bild:
fachlich für Vorgangsdokumentation notwendig, Zugriffskreis via RLS begrenzt, Löschkonzept in
`RELEASE`/`BETRIEB` dokumentiert (Frist offen, nicht erfunden).

## Offline-Benutzertrennung
Über `ownerId` je Aktion; Ansicht/Flush strikt pro Benutzer; nicht synchronisierte Änderungen werden
nicht still gelöscht. Verhalten bei Logout definiert (siehe `OFFLINE.md`/`DATENSCHUTZ.md`);
Browserprüfung Benutzerwechsel offen (kein Browser).

## Idempotenz & Race Conditions
`sync_actions` `unique(actor, client_action_id)`; Marker-vor-Anwendung + Kompensation. DB-seitig
verifiziert (Smoke 13). **Restrisiko:** Kompensation nicht in einer DB-Transaktion gekapselt →
theoretisch verwaistes Storage-Objekt bei Absturz zwischen Storage-Upload und Metadatensatz.
Dokumentiert; Bereinigung verwaister Objekte als Betriebsaufgabe. Parallelität im echten Browser
noch abzunehmen.

## Performance
Produktionsbuild erfolgreich; Server-Components für Datenzugriff; gezielte Client-Components;
signierte URLs batchweise; CSV/Galerie clientseitig gefiltert. Detaillierte Messungen (Bundle,
Ladezeiten) benötigen produktionsnahes Hosting/Browser – als offen markiert (`MONITORING.md`).

## Accessibility
Fokusringe/aria/role in Offline-/Konflikt-UI ergänzt (AP6/AP7); `@axe-core/playwright`-Tests
(`/login`, `/offline`) vorhanden. **Browserausführung hier nicht möglich** (Chromium-Libs fehlen);
manuelle Tastatur-/Screenreader-Prüfung in `RELEASE_CHECKLISTE.md`.

## Browsermatrix / PWA-/SW-Abnahme
Chromium: Suite valide (26 Tests), request-basierte `@public`-Tests bestanden (6/9). Seitenbasierte
Tests + Firefox/WebKit + PWA-Installation/SW-Update-Runtime **nicht in der Sandbox ausführbar**
(getrennt dokumentiert). CI nutzt `--with-deps chromium`.

## Backup/Recovery, Monitoring, Deployment, Release
Konzepte erstellt (`BACKUP_UND_RECOVERY.md`, `MONITORING.md`, `DEPLOYMENT.md`, `RELEASEPROZESS.md`,
`RELEASE_CHECKLISTE.md`). Keine Backup-/Recovery-Funktion behauptet, die nicht eingerichtet ist;
Recovery-Test benötigt Zielinfrastruktur (offen).

## Release-Gates (Stand)
Gate 1 Codequalität **bestanden** (lint/tsc/build). Gate 2 Datenbank **bestanden** (Migration/RLS/
Smokes). Gate 3 Security **weitgehend** (keine Secrets/kritischen Lücken; CSP-Enforcing offen).
Gate 4 E2E **teilweise** (`@public` request-basiert grün; seitenbasiert/`@app` offen). Gate 5
Accessibility **teilweise** (axe-Struktur; Browser-/Manuell offen). Gate 6 Betrieb **Konzepte
vorhanden** (Recovery-Test offen). Gate 7 Release **offen** (Freigabe/Push durch Nutzer).

## Tatsächlich ausgeführte Befehle & Ergebnisse
`npm ci` OK · `npm run lint` **0** · `npx tsc --noEmit` **0** · `npm run build` **PASS** ·
`npm audit` 2 moderate/0 hoch · Migration `0001–0006` (leer + AP6-Bestand, idempotent) **OK** ·
Smokes `10` (0 Fehler)/`11` (16/16)/`12` (20/20)/`13` (5/5) · `node --check sw.js` **gültig** ·
CSV-Test **12/12** · `playwright test --list` **26** · `playwright test public.spec.ts` **6/9**
(request-basiert grün, inkl. Health + Security-Header).

## Regression AP1–AP6
Keine Regression: Migration 0001–0006 + Smokes 10–13 + CSV weiterhin grün.

## Gefundene und behobene Fehler
- Keine neuen Defekte. Sicherheitsfeststellung postcss dokumentiert (Maßnahme: Next-Update).

## Nicht behobene Risiken
- postcss (moderate, build-time) bis Next-Patch – akzeptiert.
- Idempotenz-Kompensation nicht transaktional – Restfenster, dokumentiert.
- CSP nur Report-Only bis Browser-Verifikation.

## Nicht ausführbare Prüfungen (nicht als bestanden gewertet)
Seitenbasierte Browser-E2E, `@app`-E2E (Test-Supabase), a11y-Browserlauf, Benutzerwechsel im Browser,
PWA-Installation/SW-Update-Runtime, Performance-Messungen, Deployment- und Recovery-Test, Push.

## Commit-Hash / Push
Siehe Abschlussausgabe. Push nicht möglich (keine Zugangsdaten). **Kein Git-Tag, kein Release**
(bedürfen gesonderter Nutzerfreigabe).
