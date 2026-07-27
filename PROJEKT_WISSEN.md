# Projektwissen – Kabelbereitschaft
> Stand: 2026-07-27 · Nur bestätigte Ergebnisse. Nicht ausgeführte Prüfungen sind als offen markiert.

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
- **Git:** AP9–AP11 wurden nach `origin/main` gepusht; funktionaler AP11-Stand ist `1b8d071`.
  `main` und `origin/main` sind synchron und enthalten zusätzlich die nachfolgenden
  Dokumentations-Commits.
- **Sicherung:** Vollständige, hashidentisch verifizierte Dateisystemkopie unter
  `C:\Backup\Kabelbereitschaft_2026-07-25_191847`; vollständiges Git-Bundle unter
  `C:\Backup\kabelbereitschaft_main_2026-07-26.bundle`.
- **Locks:** Die verwaisten `.git/index.lock` und `.git/HEAD.lock` wurden nach
  `C:\Backup\Kabelbereitschaft_Lockquarantaene_2026-07-26_093108` verschoben. Git-Integrität
  anschließend bestätigt; die übrigen Altlasten blieben unangetastet.
- **Roadmap:** AP12–AP15 sind in `00-Projektsteuerung/ROADMAP_AP12_AP15_ENTWURF.md` geplant.
  Dennis hat AP12 am 2026-07-27 mit „Mach jetzt weiter“ ausdrücklich zur Implementierung
  freigegeben.
- **Datenschutz:** V1 (Aufbewahrungsfristen für Personen-, EXIF-/GPS- und Auditdaten) bleibt offen
  und wirkt als Produktionssperre. Stage/Test bis zur Entscheidung ausschließlich mit
  synthetischen Daten.
- **Repository:** Am 2026-07-26 wurde vorübergehend ein frischer GitHub-Clone unter
  `C:\dev\Kabelbereitschaft` angelegt und kurzzeitig als führender Arbeitsort geführt.
  **Diese Festlegung hat Dennis am 2026-07-26 ausdrücklich aufgehoben** (siehe folgender
  Abschnitt).
- **Branding:** AP8.1 getrennt als Commit `04253a2` auf Branch
  `feat/ap8.1-branding` gesichert und nach GitHub gepusht. TypeScript, ESLint und
  Next.js-Produktions-Build im frischen Clone erfolgreich.
- **Lokale Laufzeit:** Der unqualifizierte Windows-Befehl `node` wird auf diesem Rechner
  derzeit fälschlich als `C:\Windows\System32\Node.js` über Visual Studio geöffnet.
  Die belastbaren Prüfungen wurden deshalb mit
  `C:\Program Files\nodejs\node.exe` ausgeführt. Diese Windows-Zuordnung ist vor dem
  regulären Entwicklerbetrieb separat zu korrigieren.

## Verbindlicher Arbeitsort (Entscheidung Dennis, 2026-07-26)

Diese Festlegungen gelten dauerhaft und ersetzen alle früheren Standortaussagen.

- **Diese Datei ist die zentrale und für alle Projektchats verbindliche Projektübersicht.**
  Neue Entscheidungen und Statusinformationen werden hier konsolidiert; zusätzliche parallele
  Übersichts- oder Statusdokumente werden nicht angelegt.
- **Einziger Projekt- und Arbeitsort** ist der Kabelbereitschaft-Vault
  `C:\Users\DennisKühnhold\OneDrive - W & S Technik GmbH\Kabelbereitschaft-App\Kabelbereitschaft-App`.
- `C:\dev\Kabelbereitschaft` war ein **vorübergehender technischer Clone** und wurde am
  2026-07-26 nach vollständiger Kontrolle in den Windows-Papierkorb verschoben;
  `C:\dev` selbst blieb bestehen.
- Nach dem geprüften Inventar vom 2026-07-26 enthält der Dev-Ordner **keine einzigartige
  relevante Projektdatei**: 226 verglichene Dateien, keine ausschließlich dort vorhanden;
  alle Abweichungen waren durch den Commit `455c71d`, den ausgecheckten Branch oder
  generierte Artefakte erklärbar.
- **Fehlender Werkzeug- oder Ordnerzugriff darf niemals zur eigenständigen Anlage eines
  Ersatzordners führen.** Kein Ausweichen auf Sitzungs-, Ausgabe- oder temporäre Ordner, keine
  zusätzliche Repository-Kopie, keine eigenmächtige Verlagerung des Projekts.
- Bei fehlendem Zugriff **halten Claude bzw. Codex an**, nennen den exakten Blocker (Pfad oder
  Dienst) und bitten Dennis um Zugang. Ein Arbeitsschritt darf nicht in einer Sandbox simuliert
  und als erledigt gemeldet werden.
- **Neue dauerhafte Projektdateien und Arbeitsergebnisse entstehen ausschließlich im Vault.**
- Die Sicherungen unter `C:\Backup` (Vollsicherung, Git-Bundle, Lock-Quarantäne) bleiben
  unverändert und sind **keine Arbeitsorte**.
- Das **Risiko von Git-Schreiboperationen in OneDrive bleibt bekannt und bewusst akzeptiert**.
  Es wird transparent dokumentiert und durch Vollsicherung, Git-Bundle, GitHub-Remote und
  Lockprüfung abgesichert. Ein erneuter Umzug aus OneDrive wird nicht vorgeschlagen, solange
  Dennis diese Entscheidung nicht ausdrücklich ändert.
- **Branding** bleibt auf `feat/ap8.1-branding` (`04253a2`, auf GitHub gesichert) und ist
  **nicht** nach `main` gemergt.
- **AP12 ist seit 2026-07-27 ausdrücklich freigegeben und technisch abgeschlossen.** Implementiert sind
  Migration `0010_ap12_incident_details.sql`, die neuen AP12-RPCs, Mehrfach-Kabelpositionen
  mit Menge/Einheit/Zustand, Kontakt-FK und historischer Snapshot, minimierte
  Monteur-Kontaktprojektion, die erweiterte Vorgangsdetail-/Bearbeitungsoberfläche sowie die
  Pflege der Bereitschaftsnummern. TypeScript, ESLint und Next.js-Produktions-Build sind
  erfolgreich. Der lokale PostgreSQL-18-Lauf mit Migrationen 0001–0010 und den AP10–AP12-
  Smoke-Tests ist ebenfalls vollständig erfolgreich; die temporäre Testdatenbank wurde
  anschließend entfernt. Der Teststarter behandelt PostgreSQL-NOTICE-Ausgaben korrekt über
  den Prozess-Exitcode, und die AP11-Zähltests sind gegen vorangehende Fixture-Daten isoliert.
- **V1** (Aufbewahrungsfristen) bleibt offen und wirkt als **Produktionssperre**; Stage und Test
  ausschließlich mit synthetischen Daten.
