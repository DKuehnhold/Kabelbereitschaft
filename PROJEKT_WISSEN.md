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
