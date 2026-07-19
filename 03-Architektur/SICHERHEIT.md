# Sicherheit
> Stand: 2026-07-19 · MVP V0.1 · Teil von Arbeitspaket 1

## Authentifizierung
Supabase Auth (E-Mail/Passwort), Session über sichere HTTP-Cookies (`@supabase/ssr`).
Middleware erneuert die Session und schützt nicht-öffentliche Routen.

## Autorisierung (rollenbasiert + RLS)
Rollen: **admin**, **disponent**, **monteur** (`profiles.role`). Durchsetzung primär in der
Datenbank über **Row Level Security**. Hilfsfunktionen (SECURITY DEFINER):
`is_admin()`, `is_staff()`, `is_assigned_to_incident()`.

Kernregeln:
- Vorgänge anlegen: nur Disposition/Admin (`incidents_insert WITH CHECK is_staff()`).
- Monteur sieht/bearbeitet **nur zugewiesene** Vorgänge (`is_assigned_to_incident`).
- Stammdaten (Material, Lager, Baustufen, Bereitschaftsnummern): Schreiben nur Admin, Lesen alle Angemeldeten.
- Status-Chronik & Materialbewegungen sind **unveränderbar** (kein UPDATE/DELETE-Policy;
  Chronik nur per Trigger geschrieben).
- Materialentnahme durch Monteur nur mit Vorgangs- und Lagerortbezug.
- Rolle/Aktivstatus ändert nur der Admin (zusätzlicher Trigger-Schutz).
- Monteur darf bestimmte Status (durch Disposition geprüft/abgeschlossen/storniert) und den
  administrativen Abschluss nicht setzen (Trigger `tg_incident_guard`).

## Bestandsschutz
Trigger `check_inventory_nonnegative()` (SECURITY DEFINER) verhindert negative Lagerbestände –
autoritativ über alle Bewegungen, unabhängig von RLS.

## Storage
Privater Bucket `incident-images` (nicht öffentlich). Zugriff nur über Policies auf
`storage.objects` analog zur Vorgangs-Sichtbarkeit. Pfadkonvention `incidents/<id>/<datei>`.
Zugriffe erfolgen über signierte/serverseitig geprüfte URLs (kein öffentlicher Bucket).

## Upload-Prüfungen (vorgesehen)
Datei-Typ- und Größenprüfung serverseitig; Dateihash; EXIF-Auswertung serverseitig,
fehlende EXIF/GPS führen nicht zum Fehler. GPS ausschließlich aus Bildmetadaten.

## Secrets & Daten
- Keine Secrets im Repository; `.env.example` als Vorlage, echte Werte in `.env.local`.
- Datenminimierung; kein permanentes Standorttracking.

## Validierung
RLS, Trigger und Bestandsschutz wurden gegen PostgreSQL 18 mit einem Smoke-Test geprüft
(`app/supabase/test/`): korrekte Sichtbarkeit, Blockade von Fremdanlage, Statusschutz,
Bestandsguard und unveränderbare Chronik.

## AP6 – Offline/Sync-Sicherheit (Ergänzung)
- **Keine Secrets offline/clientseitig:** IndexedDB (`kb-offline`) enthält nur fachliche Daten und
  eigene Warteschlangen; keine Tokens/Passwörter/Supabase-/Service-Role-Schlüssel/Auth-Cookies.
  (Automatisiert prüfbar über `@app`-E2E „keine Tokens in IndexedDB".)
- **Service-Worker-Cache:** ausschließlich Same-Origin-GET; `/api`, `/auth` und Cross-Origin
  (Supabase) werden nie gecacht.
- **Benutzertrennung:** Offline-Aktionen tragen `ownerId`; Ansicht/Synchronisation strikt pro
  Benutzer; nicht synchronisierte Aktionen werden bei Benutzerwechsel nicht still gelöscht.
- **Idempotenz/Dedup:** `sync_actions` mit `unique(actor, client_action_id)` + RLS (`actor = auth.uid()`);
  Retry erzeugt keine Dublette; Anwendung ausschließlich serverseitig unter RLS.
- **Konflikte:** keine stille Überschreibung (Vergleich `updated_at`); Auflösung serverseitig validiert.
- **Secrets im Betrieb/CI:** nur über Umgebungsvariablen bzw. GitHub Secrets; keine produktiven Daten in CI.

## AP7 – Security Review (Ergänzung)

### API-Endpunktmatrix
| Route | Methode | Auth | Rolle | RLS | Eingabevalidierung | Fehlerverhalten | Ergebnis |
|---|---|---|---|---|---|---|---|
| `/api/sync` | POST | ja | alle (RLS) | ja | Kind/Status/Body geprüft; Dedup | JSON-Ergebnis je Item | OK |
| `/api/images/upload` | POST | ja | alle (RLS) | ja | Magic-Bytes/Größe/Kategorie/Dedup | 4xx + Fehlerliste | OK |
| `/api/incidents/[id]/meta` | GET | ja | sichtbar via RLS | ja | ID aus Pfad | 401/404 | OK |
| `/api/health` | GET | nein (öffentlich) | – | – | – | minimal, keine Details | OK |
| `/auth/signout` | POST | – | – | – | – | 303 → /login | OK |
Rate Limiting: aktuell nicht auf App-Ebene; Empfehlung Hosting/Reverse-Proxy/Supabase (siehe unten).

### RLS-/Storage-Matrix (aus Migrationen)
| Tabelle | RLS | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|---|
| profiles | ja | eigen/Staff | Admin | Admin/eigen (Trigger schützt Rolle) | Admin |
| incidents | ja | Staff/zugewiesen | Staff | Staff/zugewiesen (Trigger-Guard) | Admin |
| incident_notes | ja | Staff/zugewiesen | Staff/zugewiesen | – | – |
| incident_images | ja | Staff/zugewiesen | Staff/zugewiesen | Staff/Uploader | Admin |
| inventory_movements | ja | Staff/erstellt/zugewiesen | Staff / Monteur (entnahme/rueckgabe/verbrauch) | – | – |
| materials/storage_locations | ja | angemeldet | Admin | Admin | Admin |
| audit_events | ja | Admin | nur Trigger | – | – |
| sync_actions | ja | eigen (actor) | eigen | – | eigen (Kompensation) |
| storage.objects (incident-images) | ja | Staff/zugewiesen | Staff/zugewiesen | – | Admin |
`SECURITY DEFINER`-Funktionen mit gesetztem `search_path=public`. DB-seitig über Smokes 10–13 geprüft.

### HTTP-Sicherheitsheader (next.config.ts)
Durchsetzend: `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `X-Frame-Options: SAMEORIGIN`,
`Permissions-Policy` (camera/mic/geo/payment/usb aus), `Strict-Transport-Security`,
`X-DNS-Prefetch-Control: off`, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`.
**CSP als Report-Only** (default-src 'self'; img/connect erlauben `*.supabase.co`; style/script
'unsafe-inline'). Vor Umstellung auf durchsetzend im Browser verifizieren.

### Secrets & Supply-Chain
Keine Secrets im Repo (nur `.env.example`, Service-Role auskommentiert). `npm audit`: 2 moderate
(postcss build-time via Next), 0 hoch/kritisch → akzeptiertes Risiko, Behebung mit Next-Update;
CI-Gate `--audit-level=high`. Kein `audit fix --force`.

### Rate Limiting / Missbrauchsschutz
Nicht clientseitig als Schutz ausgewiesen. Umsetzungsebene abhängig von der (noch offenen)
Hosting-Plattform: Reverse-Proxy/Plattform-WAF für Login/Sync/Upload; Supabase-seitige Limits.
Dokumentiert als offen bis Plattformentscheidung.
