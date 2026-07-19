# Offlinebetrieb & Synchronisation (AP5)
> Stand: 2026-07-19

## Überblick
Die App ist ohne Verbindung sinnvoll nutzbar: zuletzt geöffnete Seiten bleiben lesbar,
Notizen/Statusänderungen/Bilder werden verlustfrei vorgemerkt und bei Verbindung automatisch
synchronisiert. Konflikte werden erkannt und angezeigt.

## Offline-Cache (lesen)
- Seiten (Dashboard, Vorgänge, Detail inkl. Timeline) über den Service-Worker-Navigations-Cache
  (network-first, Fallback Cache/`/offline`).
- Bildmetadaten sind Teil der gecachten Detailseite; **Bild-Originale nur, wenn bereits geöffnet**
  (Asset-Cache) – keine proaktive Vorabladung.

## Lokale Speicherung (IndexedDB `kb-offline`)
- `outbox`: vorgemerkte Notizen/Statusänderungen.
- `uploads`: Bild-Blobs der Upload-Warteschlange.
- `conflicts`: erkannte Synchronisationskonflikte.
- `kv`: u. a. `lastSync`.
- **Sicherheit**: keine Tokens/Secrets/Service-Keys/Passwörter offline; nur fachliche Daten und
  eigene Warteschlangen. Die Supabase-Session verbleibt in Cookies.

## Offline-Arbeiten
Komponente `OfflineIncidentActions` (Vorgangsdetail): Notiz erfassen, Status vormerken, Bilder zur
Upload-Warteschlange hinzufügen. Online erfolgt sofortige Synchronisation, offline verlustfreie Vormerkung.

## Synchronisation (`lib/offline/manager.ts`)
- Automatisch beim `online`-Event und beim App-Start; manuell über „Jetzt synchronisieren".
- Outbox → `POST /api/sync` (JSON). Ergebnis je Eintrag: `applied` (löschen), `conflict`
  (dokumentieren + Nutzerhinweis), `error` (Versuch erhöhen, erneut versuchen).
- Uploads → `POST /api/images/upload` (multipart, XHR) mit Fortschritt/Abbruch/Retry.
- `lastSync` wird nach jedem Lauf gesetzt.

## Konfliktbehandlung
`/api/sync` vergleicht `incidents.updated_at` mit dem Basiswert, den der Client bei der
Offline-Erfassung kannte. Bei Abweichung wird **nicht überschrieben**, sondern ein Konflikt
zurückgegeben, lokal gespeichert und in der Offline-Leiste angezeigt (mit Serverstand).

## Upload-Warteschlange
Sichtbar in der schwebenden Offline-Leiste (`OfflineBar`): ausstehende Uploads, Fortschritt,
Abbruch, erneuter Versuch. Wiederaufnahme bei Reconnect automatisch.

## Dashboard-Kennzahlen (`OfflineDashboardCards`)
„Offline vorgemerkt", „Wartende Uploads", „Letzte Synchronisation" – rein clientseitig aus IndexedDB.

## Rollen/RLS
Synchronisation nutzt die Session des Nutzers; alle Anwendungen von Mutationen laufen serverseitig
über RLS (und DB-Trigger, z. B. Statusschutz für Monteure). Offline-Vormerkungen setzen keine
Berechtigungen außer Kraft.

## AP6-Ergänzung
E2E-Absicherung (Playwright), Idempotenz/Dedup (`sync_actions`, Migration 0006),
kontrollierte Konfliktauflösung und Service-Worker-Update-Anzeige. Details:
`06-Tests/E2E_TESTS.md`, `03-Architektur/SYNCHRONISATION.md`, `03-Architektur/KONFLIKTBEHANDLUNG.md`.
