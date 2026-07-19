# Architektur – Überblick (Stand AP5)
> Stand: 2026-07-19 · Ergänzt SYSTEMARCHITEKTUR.md um Offline/PWA

## Schichten
- **Frontend**: Next.js 16 (App Router, React 19, Server Components + Server Actions), Tailwind.
- **Datenzugriff**: Supabase (PostgreSQL, RLS, Storage) über `@supabase/ssr` (Cookie-Session).
- **Auth/Guard**: `middleware.ts` → `updateSession` (Redirect nicht-öffentlicher Routen auf `/login`).
- **Datenmodell**: Migrationen `0001`–`0005` (additiv), RLS + Trigger (Audit, Status-/Bestands-/
  Bildchronik). Bilder in privatem Storage-Bucket, Zugriff nur über signierte URLs.

## AP5 – Offline/PWA-Ergänzungen (additiv)
- **PWA**: `app/manifest.ts`, Icons, `public/sw.js` (Cache-Strategien + Offline-Fallback),
  `ServiceWorkerRegister`. Details: `PWA.md`.
- **Offline-Datenhaltung**: IndexedDB (`kb-offline`) für Outbox (Notizen/Status), Upload-Queue
  (Bilder) und Konflikte; `lib/offline/{types,db,manager,useOffline}`. Details: `OFFLINE.md`.
- **Synchronisationsendpunkte**:
  - `POST /api/sync` – wendet Notizen/Statusänderungen an, mit Konflikterkennung über `updated_at`.
  - `POST /api/images/upload` – multipart-Bildupload (Offline-Replay UND interaktiver Upload),
    nutzt gemeinsame Kernlogik `lib/image-upload-core.ts` (auch von der AP4-Server-Action verwendet).
- **UI**: schwebende Offline-Leiste (`OfflineBar`), offline-fähige Erfassung im Vorgang
  (`OfflineIncidentActions`), Dashboard-Kennzahlen (`OfflineDashboardCards`).

## Sicherheitsprinzipien (unverändert + AP5)
- RLS ist maßgeblich; Client-Prüfungen dienen nur der Benutzerführung.
- Offline werden keine Tokens/Secrets/Service-Keys/Passwörter gespeichert; der Service Worker cacht
  keine `/api`-/`/auth`-/Cross-Origin-Antworten.
- Signierte URLs mit begrenzter Gültigkeit für Bildzugriff; privater Bucket.

## Datenfluss Offline → Online (Kurz)
1. Nutzer erfasst offline Notiz/Status/Bild → IndexedDB (Outbox/Upload-Queue).
2. Bei Verbindung: `manager.flush()` → `/api/sync` (Notizen/Status) + `/api/images/upload` (Bilder).
3. Serverseitig: Auth + RLS + Konfliktprüfung; Ergebnis zurück an den Client.
4. Erfolg → lokalen Eintrag entfernen; Konflikt → dokumentieren und anzeigen; Fehler → erneut versuchen.

## AP6-Ergänzung
E2E-Absicherung (Playwright), Idempotenz/Dedup (`sync_actions`, Migration 0006),
kontrollierte Konfliktauflösung und Service-Worker-Update-Anzeige. Details:
`06-Tests/E2E_TESTS.md`, `03-Architektur/SYNCHRONISATION.md`, `03-Architektur/KONFLIKTBEHANDLUNG.md`.
