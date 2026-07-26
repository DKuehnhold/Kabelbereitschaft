# Projektwissen – Kabelbereitschaft
> Stand: 2026-07-19 · Nur bestätigte Ergebnisse. Nicht ausgeführte Prüfungen sind als offen markiert.

## Projektziel
Offlinefähige Web-Anwendung (PWA) zur Erfassung und Dokumentation von Kabel-Bereitschaftsvorgängen:
Vorgänge, Rollen/Rechte (RLS), Material-/Lagerverwaltung, Bilddokumentation (privat, EXIF/GPS),
CSV-Export, Offlinebetrieb mit Synchronisation und Konfliktbehandlung.

## Getroffene Entscheidungen
- **Eigenständiges Repo** `DKuehnhold/Kabelbereitschaft` (Branch `main`), keine ManagementOS-Verbindung.
- **Stack:** Next.js 16 (App Router, RSC + Server Actions), Supabase (PostgreSQL, RLS, Storage), Tailwind.
- **Sicherheit:** RLS ist maßgeblich; signierte URLs für private Bilder; keine Secrets im Client/Offline-Speicher.
- **CSV:** Semikolon + UTF-8-BOM (deutsches Excel), Formel-Injektionsschutz.
- **PWA/Offline:** handgeschriebener Service Worker (kein next-pwa), IndexedDB-Outbox/Upload-Queue,
  Sync über `/api/sync` + `/api/images/upload`.
- **Idempotenz (AP6):** Tabelle `sync_actions` (`unique(actor, client_action_id)`), Dedup + Kompensation.
- **HEIC:** nicht akzeptiert (keine zuverlässige Browser-Vorschau/Verarbeitung).
- **Sicherheitsheader (AP7):** harte Header durchsetzend; CSP zunächst Report-Only.
- **Release:** Semantic Versioning; erster RC `v1.0.0-rc.1`; **Tag/Release nur mit Nutzerfreigabe**.
- **Migrationen:** additiv/idempotent; `0001`–`0006`.

## Definitionen und Begriffe
- **AP1–AP7:** Arbeitspakete (Grundgerüst → Vorgänge → Material → Bilder → Offline/PWA → E2E/Härtung → Release Readiness).
- **Outbox:** IndexedDB-Warteschlange vorgemerkter Notizen/Statusänderungen.
- **Upload-Queue:** IndexedDB-Warteschlange für Bild-Uploads.
- **Client-Action-ID:** stabile Idempotenz-ID je Offline-Aktion.
- **Konflikt:** serverseitige Änderung (`updated_at`) seit lokaler Erfassung → keine stille Überschreibung.
- **@public/@app:** E2E-Testklassen ohne bzw. mit Test-Supabase.

## Wichtige Änderungen (mit Datum)
- 2026-07-19 AP3: Material-/Lagerverwaltung (Migration 0004), Commit `ac7b4d1`.
- 2026-07-19 AP4: Bilddokumentation/CSV (Migration 0005), Commit `e9e16ac`.
- 2026-07-19 AP5: Offline/PWA, Commit `e13b4cf`.
- 2026-07-19 AP6: E2E + Idempotenz (Migration 0006), Commit `88336f8`.
- 2026-07-19 AP7: Release Readiness/Security/Doku (Commit siehe CHANGELOG).

## Offene Punkte (nicht verifiziert / benötigt Infrastruktur)
- **Push AP4–AP7 nach GitHub** (Zugangsdaten) – lokal committet, nicht gepusht.
- Vollständige Browser-E2E + `@app`-E2E (Browser-Systembibliotheken + Test-Supabase).
- a11y-Browserlauf, PWA-Installation/SW-Update-Runtime, Benutzerwechsel im Browser.
- Deployment- und Recovery-Test (Zielinfrastruktur), Performance-Messungen.
- CSP auf durchsetzend umstellen (nach Browser-Verifikation).
- postcss-Schwachstelle (moderate, build-time) – mit Next-Update beheben.
- Middleware→Proxy-Migration (Next 16 Deprecation).
- Aufbewahrungsfristen für Soft-Delete/Audit (fachlich/juristisch festzulegen – nicht erfunden).

## Nachtrag AP8 (2026-07-19)
- **GUI/UX:** zentrales Designsystem in `globals.css` (Tokens) + `components/ui/`-Primitive;
  Dark Mode (Light/Dark/System) über `data-theme` + `prefers-color-scheme`, Umschalter in der
  Seitenleiste, No-FOUC-Init. App-Chrome (AppShell) theme-fähig; Skeleton-Ladezustände; Fokus/A11y/
  Safe-Area verbessert. Keine Fachfunktion geändert.
- **Entscheidung:** Politur bewusst konservativ und buildsicher; volle `dark:`-Ausgestaltung aller
  Altscreens + App-Screenshots/visuelle Feinabnahme sind Folgeausbau (Browser + Test-Supabase nötig).
- Commit AP8: siehe CHANGELOG. Push weiterhin offen (Zugangsdaten).

## Nachtrag AP9 (Stammdaten & Einstellungen)
- Migration `0007_ap9_master_data.sql` (additiv): customers, vzg_lines, contacts (+Telefonnummern,
  +M:N Bauabschnitte), technicians, teams (+M:N Mitglieder), cable_types (Seed), app_settings
  (Singleton); `construction_stages` um `wus_bst`/`default_on_call_number_id` erweitert; Enum
  `phone_type`. RLS `is_staff()` (admin+disponent), Monteur nur lesend; `construction_stages`
  auf `is_staff()` erweitert. Löschen fachlich nur über `is_active`.
- `tg_audit` feldgenau (CREATE OR REPLACE, `detail.op` erhalten) – eine Auditlösung.
- UI: Navigationsgruppe „Stammdaten" + 8 token-basierte, responsive CRUD-Seiten; Monteur-CSV-Import
  (Vorschau/Validierung/Dublettenerkennung, keine stille Überschreibung).
- Verifiziert lokal: lint/tsc/build grün; AP9-Smoke 26/26; Bestandssmokes 10/11/12/13 grün; CSV-Test 14/14.
- Commit `feat: implement master data management (AP9)`. AP8.1-Branding nicht Teil des Commits.

## Nachtrag AP10 (Vorgangserfassung auf Stammdatenbasis)
- Migration `0008`: incidents.customer_id/vzg_line_id (FK, nullable), NOT-NULL auf km_from/vzg_line_number
  gelöst; `incident_cable_positions` (Kabelart positionsbezogen, kein incidents.cable_type_id);
  transaktionale RPCs `create_incident_ap10`/`update_incident_ap10` (SECURITY INVOKER); Backfill vzg/customer.
- Erfassungs-/Bearbeitungsmaske neu (AP8-Tokens, abhängige Dropdowns, Pflicht ≥1 Kabelposition).
- Offline-Neuanlage NICHT Teil von AP10; Bilder zweiphasig; AP9-Kontakte noch nicht verknüpft.
- Verifiziert lokal: lint/tsc/build; AP10-Smoke 12/12; Backfill ok; Regression 11/13/14 grün.
- Commit `feat: integrate master data into incident creation (AP10)`; AP8.1-Branding nicht im Commit.

## Nachtrag AP11 (Operative Vorgangsliste)
- Migration `0009`: View `incident_list_view` (`security_invoker`) für RLS-konforme, serverseitige
  Suche/Filter/Sortierung/Pagination inkl. Aggregaten (Bilder/Kabelarten/Monteure) + `search_text` +
  `created_date_local`. Reads `listIncidentsPaged`/`listIncidentsForExport`; Typen/Helfer in `incident-list.ts`.
- `/vorgaenge` = zentrale operative Liste (staff-only), URL als Zustandsquelle; Desktop-Tabelle (Sticky) +
  Mobile-Karten; Auswahl + vorbereitete (deaktivierte) Massenaktionen; CSV-Export der gefilterten Menge (Cap 5.000).
- StatusBadge/PriorityBadge nutzen jetzt das AP8-Badge-Primitive (Tones). Dashboard bis AP15 unverändert.
- Offene Hinweise abgeleitet (kein Aufgabenmodell); keine Offline-Liste; kein Audit durch die Liste.
- Verifiziert lokal: lint/tsc/build; AP11-Smoke 8/8; Performance 600; Regression 11/13/14/15 grün.
- Commit `feat: implement operational incident list (AP11)`; AP8.1-Branding nicht im Commit.

## Nachtrag Stabilisierung und Roadmap (2026-07-26)
- **Git:** AP9–AP11 wurden nach `origin/main` gepusht; lokal und remote stehen auf `1b8d071`.
- **Sicherung:** Vollständige, hashidentisch verifizierte Dateisystemkopie unter
  `C:\Backup\Kabelbereitschaft_2026-07-25_191847`; vollständiges Git-Bundle unter
  `C:\Backup\kabelbereitschaft_main_2026-07-26.bundle`.
- **Locks:** Die verwaisten `.git/index.lock` und `.git/HEAD.lock` wurden nach
  `C:\Backup\Kabelbereitschaft_Lockquarantaene_2026-07-26_093108` verschoben. Git-Integrität
  anschließend bestätigt; die übrigen Altlasten blieben unangetastet.
- **Roadmap:** AP12–AP15 sind in `00-Projektsteuerung/ROADMAP_AP12_AP15_ENTWURF.md` geplant.
  Die Roadmap ist nur als Planungsgrundlage freigegeben; AP12 ist noch nicht zur Implementierung
  freigegeben.
- **Datenschutz:** V1 (Aufbewahrungsfristen für Personen-, EXIF-/GPS- und Auditdaten) bleibt offen
  und wirkt als Produktionssperre. Stage/Test bis zur Entscheidung ausschließlich mit
  synthetischen Daten.
- **Repository:** Der Umzug aus OneDrive in einen frischen lokalen Clone bleibt bis zur
  nachgewiesenen Anlage unter `C:\dev\Kabelbereitschaft` offen.
