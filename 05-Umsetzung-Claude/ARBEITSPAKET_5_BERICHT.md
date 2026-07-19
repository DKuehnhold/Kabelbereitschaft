# Arbeitspaket 5 – Umsetzungsbericht
> Stand: 2026-07-19 · MVP V0.1 · Offlinefähigkeit (PWA), Synchronisation, Hintergrundbetrieb

## Bestandsanalyse (AP1–AP4 berücksichtigt)
- Keine bestehenden Service-Worker/Manifest/PWA-/IndexedDB-Strukturen → AP5 vollständig neu (additiv).
- `next.config.ts` leer; Root-Layout ohne Manifest/Theme → erweitert.
- Auth: Supabase SSR über Cookies + `middleware.ts` (`updateSession`) mit Redirect nicht-öffentlicher
  Routen auf `/login`. PWA-Ressourcen (`/sw.js`, `/manifest.webmanifest`, `/offline`, `/icons`) mussten
  öffentlich gestellt werden (Matcher + `PUBLIC_PREFIXES`), damit sie ohne Session/offline abrufbar sind.
- AP4-Upload (`uploadImages`) war Server-Action → gemeinsame Kernlogik nach `image-upload-core.ts`
  extrahiert und von Action UND neuem Offline-Replay-Endpunkt genutzt (keine Doppelimplementierung).
- Timeline/Audit/Rollen/RLS aus AP1–AP4 unverändert wiederverwendet.
Abweichung: **Keine neue Migration nötig** – Konflikterkennung nutzt vorhandenes `incidents.updated_at`.

## Umsetzung
- **PWA**: `app/manifest.ts` (→ `/manifest.webmanifest`), PNG-Icons (192/512/maskable/apple),
  `theme_color`, `display: standalone`, Installierbarkeit; `public/sw.js` (Service Worker) +
  `ServiceWorkerRegister`; öffentliche `/offline`-Seite.
- **Service-Worker-Cache-Strategien** (ohne Third-Party-Libs): Navigationen network-first →
  Cache → `/offline`; statische Assets stale-while-revalidate; Cache-Versionierung/-Invalidierung
  bei `activate`. Nur Same-Origin-GET; `/api/*`, `/auth/*` und Cross-Origin (Supabase) werden nie gecacht.
- **Offline-Cache**: Zuletzt geöffnete Seiten (Dashboard, Vorgänge, Detail inkl. Timeline) über die
  SW-Navigations-Cache verfügbar; Bilder nur, wenn bereits geöffnet (Asset-Cache). Bild-Originale
  werden nicht proaktiv vorgeladen.
- **Offline-Arbeiten** (`OfflineIncidentActions`): Notiz erstellen, Statusänderung vormerken,
  Bilder zur Upload-Warteschlange hinzufügen – online sofortige Synchronisation, offline verlustfrei vorgemerkt.
- **Speicherung**: IndexedDB (`kb-offline`) mit Stores `outbox` (Notizen/Status), `uploads`
  (Bild-Blobs), `conflicts`, `kv` (u. a. `lastSync`). Kein Token/Secret/Service-Key/Passwort offline.
- **Synchronisation** (`offline/manager.ts`): automatisch bei `online`-Event und App-Start;
  Outbox → `POST /api/sync`, Uploads → `POST /api/images/upload` (XHR mit Fortschritt).
- **Konflikte**: `/api/sync` prüft `incidents.updated_at` gegen den Client-Basiswert; bei Abweichung
  **kein Überschreiben**, sondern dokumentierter Konflikt (in IndexedDB + Offline-Leiste, Nutzerhinweis).
- **Upload-Warteschlange**: ausstehend/Fortschritt/Abbruch/Retry in der Offline-Leiste; erneuter
  Versuch automatisch bei Reconnect bzw. manuell.
- **Dashboard-Kennzahlen** (`OfflineDashboardCards`): „Offline vorgemerkt", „Wartende Uploads",
  „Letzte Synchronisation".
- **Sicherheit**: Offline werden ausschließlich fachliche Daten + eigene Warteschlangen gespeichert;
  Supabase-Session bleibt in Cookies (nicht in IndexedDB); SW cacht keine Auth/API-Antworten.

## Geänderte/neue Dateien
- PWA: `src/app/manifest.ts`, `src/app/offline/page.tsx`, `public/sw.js`,
  `src/components/pwa/ServiceWorkerRegister.tsx`, `public/icons/*` (4 PNG).
- Offline-Lib: `src/lib/offline/{types,db,manager,useOffline}.ts`.
- API: `src/app/api/sync/route.ts`, `src/app/api/images/upload/route.ts`.
- Upload-Kern: `src/lib/image-upload-core.ts` (neu); `src/lib/image-actions.ts` (refaktoriert).
- UI: `src/components/offline/{OfflineBar,OfflineIncidentActions,OfflineDashboardCards}.tsx`.
- Geändert: `src/app/layout.tsx` (Manifest/Theme/SW), `src/middleware.ts` + `src/lib/supabase/middleware.ts`
  (PWA-Routen öffentlich), `src/app/(app)/layout.tsx` (OfflineBar), `dashboard/page.tsx`,
  `vorgaenge/[id]/page.tsx`.
- Doku: ARCHITEKTUR, PWA, OFFLINE, TESTPLAN, TESTFAELLE, CHANGELOG, PROJEKTSTATUS.

## Testergebnisse (tatsächlich ausgeführt, 2026-07-19, Node v22 / PostgreSQL 16)
- `npm ci` OK · `npm run lint` **PASS (0)** · `npx tsc --noEmit` **PASS (0)** · `next build` **PASS**
  (neue Routen `/api/sync`, `/api/images/upload`, `/manifest.webmanifest`, `/offline`; nicht-blockierende
  `middleware`→`proxy`-Deprecation-Warnung aus AP1).
- `node --check public/sw.js` → **gültiges JavaScript**.
- CSV-Sicherheitstest (`csv.ts`) → **12/12 OK** (unverändert).

## Migrationsergebnis
Keine neue Migration erforderlich (AP5 ist client-/PWA-seitig; Konflikt über vorhandenes
`updated_at`). Regression Migration 0001–0005 auf leerer DB → **OK**.

## Offlineprüfung
Automatisch verifiziert: SW-Syntax, Build der Offline-/PWA-Routen, Typsicherheit der Offline-Lib.
**Nicht in dieser Umgebung ausführbar** (kein Browser mit Service-Worker/IndexedDB gegen einen
laufenden Server + Supabase): Offline-Start, Offline-Dashboard/Incident/Timeline aus Cache,
SW-Registrierung/-Update, Cache-Invalidierung, PWA-Installation. Diese Punkte sind als **manuelle
Browser-QA** vorgesehen (siehe TESTPLAN, „AP5 – manuell"). Logik (Outbox/Sync/Konflikt/Queue) ist
typgeprüft und gebaut; die serverseitige Konflikt-/Anwendungslogik läuft über `/api/sync` (RLS).

## Synchronisation
Automatischer Flush bei Reconnect/Start; Outbox (Notizen/Status) über `/api/sync`, Uploads über
`/api/images/upload` mit Fortschritt/Abbruch/Retry; `lastSync` in IndexedDB. Konflikte werden erkannt,
dokumentiert und dem Nutzer angezeigt – ohne stille Überschreibung.

## PWA-Test
Manifest (Metadata-Route) gebaut und als `/manifest.webmanifest` ausgeliefert; Icons vorhanden
(192/512/maskable/apple); `theme_color`/`display: standalone` gesetzt; SW registrierbar. Tatsächliche
Installation/Anzeige des Install-Prompts ist Browser-QA.

## Regression AP1–AP4
Migration 0001–0005 OK; Smoke `10` (AP1/AP2) 0 Fehler; `11` (AP3) **16/16 OK**; `12` (AP4) **20/20 OK**;
CSV-Test 12/12. Keine Regression.

## Commit-Hash
Siehe Abschlussausgabe (Commit auf `main`).

## Offene Punkte
- Manuelle Browser-QA der Offline-Runtime (Start/Cache/Installation/Reconnect/Konflikt-UI).
- Optional: SW-Background-Sync-API als zusätzliche Absicherung (aktuell Client-getriebener Flush).
- Optional: Verschlüsselung der IndexedDB-Nutzdaten (aktuell keine Secrets offline; bei Bedarf WebCrypto).
- Feinschliff Offline-Cache einzelner Datenlisten (derzeit über SW-Navigations-Cache abgedeckt).

## Empfehlung für Arbeitspaket 6
1. Browser-/E2E-Tests (Playwright) inkl. Offline-Szenarien und PWA-Installations-/SW-Prüfung.
2. SW-Background-Sync + Push-Benachrichtigungen (z. B. neue Zuweisung).
3. Optionale clientseitige Verschlüsselung der Offline-Nutzdaten (WebCrypto).
4. Migration `middleware` → `proxy` (Next 16) und Ausbau der Konfliktauflösungs-UI (Feldebene).
