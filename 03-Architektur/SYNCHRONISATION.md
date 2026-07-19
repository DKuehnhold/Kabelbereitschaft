# Synchronisation & Idempotenz – AP6
> Stand: 2026-07-19 · Ergänzt OFFLINE.md

## Ablauf
1. Offline erfasste Aktionen liegen in IndexedDB: `outbox` (Notizen/Status) und `uploads` (Bilder),
   jeweils mit stabiler `id` (= Client-Action-ID/Idempotenz-ID) und `ownerId` (Benutzertrennung).
2. Auslöser für den Flush: `online`-Event, App-Start und manuell („Jetzt synchronisieren").
3. Outbox → `POST /api/sync` (JSON, inkl. `clientActionId`). Uploads → `POST /api/images/upload`
   (multipart, inkl. `client_action_id`, XHR-Fortschritt).
4. Ein Warteschlangeneintrag wird **erst nach bestätigtem Servererfolg** entfernt.

## Idempotenz / Deduplizierung (Migration 0006)
- Tabelle `public.sync_actions` mit `unique(actor, client_action_id)`.
- Der Server setzt vor der Anwendung einen Dedup-Marker:
  - **Unique-Verletzung** → Aktion galt bereits als angewendet → Ergebnis `applied` (keine Dublette).
  - **Erfolg** → Mutation anwenden. Schlägt die Anwendung fehl, wird der Marker wieder entfernt
    (Kompensation), sodass ein späterer Retry erneut versuchen kann.
- Wirkung: dieselbe Notiz/Statusänderung/derselbe Bild-Upload wird höchstens einmal angewendet;
  ein Retry nach Netzwerkabbruch erzeugt keine Dublette. RLS trennt Aktionen pro Benutzer.

## Retry-Verhalten
- Temporärer Fehler → Eintrag bleibt mit erhöhtem `attempts`-Zähler; erneuter Flush versucht wieder.
- Nach 5 Versuchen kein automatischer Retry mehr (kein Endlosloop); Eintrag bleibt sichtbar als Fehler.
- Permanente Validierungsfehler führen nicht zu einer Endlosschleife.

## Statusanzeige
Offline-Leiste + Dashboard zeigen: vorgemerkt, wartende Uploads, fehlgeschlagen, offene Konflikte,
Service-Worker-/Online-Status und letzten erfolgreichen Synchronisationszeitpunkt (`lastSync`).

## Sicherheit
Keine Tokens/Secrets in IndexedDB; Sync nutzt die Session-Cookies des Nutzers; alle Mutationen
laufen serverseitig über RLS (und DB-Trigger, z. B. Statusschutz für Monteure).

## AP7 – Hinweis Transaktionssicherheit
Die Dedup-Kompensation (`sync_actions`-Marker setzen → Mutation → bei Fehler Marker löschen) läuft
über getrennte Supabase-JS-Aufrufe, nicht in einer DB-Transaktion. Restrisiko: Absturz zwischen
Storage-Upload und Metadatensatz kann ein verwaistes Storage-Objekt hinterlassen. Bewertung: gering
(Retry ist idempotent über die Client-Action-ID; kein Datenverlust, keine Dublette). Maßnahme:
Bereinigung verwaister Storage-Objekte als Betriebsaufgabe (siehe Lösch-/Aufbewahrungskonzept).
