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
Keine Secrets im Repo (nur `.env.example`, Service-Role auskommentiert). Kein `audit fix --force`.

**Stand 2026-07-28 (korrigiert).** Die frühere Aussage „2 moderate (postcss build-time via Next),
0 hoch/kritisch → akzeptiertes Risiko" ist **überholt**. Der CI-Lauf zu Commit `76d93ca` meldete
**12 Pakete mit hoher Einstufung**; das Gate `--audit-level=high` brach mit Exit 1 ab. Behandelt
wurde das so:

- **`next` 16.2.10 → 16.2.12** (und `eslint-config-next` gleichlautend). Das beseitigt die **neun
  Next.js-Advisories** (Middleware-/Proxy-Bypass mit Turbopack, DoS über Server Actions, SSRF in
  Server Actions und Rewrites, zwei Cache-Confusion-Befunde, unbegrenzte Server-Action-Payload in
  der Edge-Runtime, DoS der Image-Optimization über SVG, Offenlegung interner
  Server-Function-Endpunkte). Verifiziert: TypeScript, ESLint und Next.js-Produktions-Build
  erfolgreich.
- **`postcss` und `sharp` bleiben von `next@16.2.12` in verwundbaren Versionen gebündelt**
  (`postcss 8.4.31` bei betroffener Spanne `<= 8.5.17`, `sharp 0.34.5` bei betroffener Spanne
  `< 0.35.0`). Für die 16.x-Linie existiert **kein** Vorwärtsfix — npm bietet nur einen Downgrade
  auf `next@9.3.3` an. Beide werden daher über `overrides` in `app/package.json` auf **postcss
  8.5.24** und **sharp 0.35.3** gezogen. Beide Zielversionen liegen in derselben Major-Linie,
  formal jedoch außerhalb der von `next` deklarierten Angaben (`"postcss": "8.4.31"` exakt,
  `"sharp": "^0.34.5"` optional). Der Override ist damit eine bewusste Entscheidung und **muss bei
  jedem Next-Update erneut auf Notwendigkeit und Verträglichkeit geprüft werden**.
- **Entwicklungsseitige Kette `eslint 9 → minimatch 3.1.5 → brace-expansion 1.1.16`**
  (GHSA-mh99-v99m-4gvg, DoS durch unbegrenzte Expansion): Es existiert **kein Patch in der
  1.x-Linie** von `brace-expansion` — die höchste Version ist `1.1.16` und liegt in der
  betroffenen Spanne. `minimatch 3.1.5` ist ebenfalls betroffen (`2.0.0 – 10.0.2`) und hat in der
  3.x-Linie keinen Fix. Der einzige von npm angebotene Weg ist `eslint@10.8.0` und damit ein
  Breaking Change an der Flat-Config. Diese Befunde sind **nicht laufzeitrelevant** (reine
  devDependencies, nicht im Produktionsbundle).

**Daraus folgt das zweistufige CI-Gate** (`.github/workflows/ci.yml`): Produktionsabhängigkeiten
werden hart über `npm audit --audit-level=high --omit=dev` gegated; die Dev-Kette wird in einem
zweiten, ausdrücklich **nicht blockierenden** Schritt (`continue-on-error`) sichtbar gemacht. Das
Laufzeitrisiko bleibt damit vollständig auf `high` gegated; ausgenommen ist ausschließlich die
Entwicklungskette. Wiedervorlage bei jedem Next- oder ESLint-Update, spätestens im
Sicherheitsteil von AP14.

**Lokal gemessenes Ergebnis (2026-07-28).** Nach `npm install` sind die Overrides wirksam —
`postcss 8.5.24` in beiden Pfaden (`next` und `@tailwindcss/postcss`, dedupliziert) und
`sharp 0.35.3`. `npm audit --audit-level=high --omit=dev` meldet **0 Schwachstellen**; das
vollständige Audit meldet **9 statt zuvor 12** hohe Befunde, alle ausschließlich in der
Entwicklungskette (`brace-expansion`, `minimatch`, `@eslint/config-array`, `eslint`,
`@eslint/eslintrc`, `eslint-plugin-import`, `eslint-plugin-jsx-a11y`, `eslint-config-next`,
`eslint-plugin-react`). Kein laufzeitrelevantes Paket ist mehr betroffen. TypeScript und ESLint
ohne Befund, Next.js-Produktions-Build erfolgreich (alle 31 Routen). Weiterhin nicht
sicherheitsrelevant, aber offen: die Deprecation-Warnung zur `middleware`-Konvention, die in AP14
durch `proxy` ersetzt wird.

> **Offen:** Der erneute GitHub-CI-Lauf mit diesen Änderungen ist noch **nicht** erfolgt. Solange
> er nicht vollständig grün ist, gilt hier keine CI-Freigabe.

### Rate Limiting / Missbrauchsschutz
Nicht clientseitig als Schutz ausgewiesen. Umsetzungsebene abhängig von der (noch offenen)
Hosting-Plattform: Reverse-Proxy/Plattform-WAF für Login/Sync/Upload; Supabase-seitige Limits.
Dokumentiert als offen bis Plattformentscheidung.
