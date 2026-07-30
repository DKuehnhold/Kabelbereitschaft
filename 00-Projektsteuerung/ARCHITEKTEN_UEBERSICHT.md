# Architektenübersicht – Kabelbereitschaft

> [!WARNING]
> **Aktualitätshinweis (2026-07-30): Dieses Dokument ist historisch.**
> Der unten dokumentierte Stand **2026-07-25** beschreibt den damaligen Einstieg und wird nicht
> nachgeführt. Maßgeblich für **Zielplattform und aktuellen Arbeitsstand** sind
> `00-Projektsteuerung/ADR-011-postgres-eigenplattform.md` (Status: angenommen / verbindlich),
> `PROJEKT_WISSEN.md` und `PROJEKTSTATUS.md`.
> **Alle Supabase-Aussagen in diesem Dokument beschreiben den AP1–AP13-Altbestand und sind keine
> Zielarchitektur.** Zielplattform ist PostgreSQL 18, Auth.js v5, MinIO und Containerbetrieb
> hinter dem internen Reverse-Proxy; eine Supabase-Cloud, ein selbst gehostetes Supabase, eine
> Supabase-Stage und eine Test-Supabase sind ausgeschlossen bzw. aufgehoben.

> Stand: 2026-07-25 · Adressat: Architekt · Zweck: Einstieg in den aktuellen Stand ohne
> Vorkenntnisse des Projektverlaufs.
> Alle Angaben sind aus dem Repository verifiziert (Git, Migrationen, `package.json`, Quellcode)
> oder aus der Projektdokumentation belegt. Abweichungen zwischen Dokumentation und Repository
> sind in Kapitel 10 ausdrücklich benannt.

---

## 1. Kurzfassung

Die Kabelbereitschaft-App ist eine **offlinefähige interne Web-Anwendung (PWA)** zur Erfassung und
Dokumentation von Kabel-Bereitschaftsvorgängen: Vorgänge, Rollen/Rechte, Material- und
Lagerverwaltung, Bilddokumentation mit EXIF/GPS, CSV-Export, Offline-Betrieb mit Synchronisation.

**Reifegrad:** funktional weit fortgeschritten, **noch nie gegen eine echte Umgebung abgenommen.**
Elf Arbeitspakete (AP1–AP11) sind umgesetzt und lokal verifiziert (Lint, TypeScript, Build,
SQL-Smoke-Tests). Es existiert **kein verbundenes Supabase-Projekt** — alle Browser-, Runtime-,
Offline- und Deployment-Prüfungen sind daher offen. Die Anwendung ist als **`v1.0.0-rc.1`
vorgeschlagen**, aber nicht getaggt und nicht released.

**Die drei wichtigsten Punkte für den Architekten:**

1. **Roadmap-Lücke AP12–AP14.** AP11 verweist auf ein „AP15" (Dashboard-Umstellung), AP10 auf ein
   „AP12" (Detailüberarbeitung) — für AP12, AP13 und AP14 existiert **kein einziges
   Planungsdokument**. Die Arbeitspaketfolge ist nach AP11 nicht definiert.
2. **Keine Abnahme gegen reale Infrastruktur.** Kein Supabase-Projekt, kein Deployment, keine
   Browser-E2E. Die Aussage „lokal grün" deckt Datenbanklogik und Build ab — nicht das Verhalten
   der Anwendung.
3. **Das Repository liegt in OneDrive.** Im `.git`-Verzeichnis liegen rund 15 verwaiste Sperr- und
   Trash-Dateien (`index.lock.*`, `HEAD.lock.*`, `master.removed.trash`). Das ist ein konkretes
   Korruptionsrisiko und in der Projektdokumentation selbst als zu behebend vermerkt.

---

## 2. Technischer Stack (aus `app/package.json` verifiziert)

| Bereich | Technologie | Version |
|---|---|---|
| Framework | Next.js (App Router, RSC + Server Actions) | 16.2.10 |
| UI | React / React DOM | 19.2.4 |
| Sprache | TypeScript | ^5 |
| Styling | Tailwind CSS + `@tailwindcss/postcss` | ^4 |
| Backend/BaaS | Supabase (PostgreSQL, RLS, Storage) — `@supabase/supabase-js` / `@supabase/ssr` | 2.110.7 / 0.12.3 |
| EXIF | `exifr` | ^7.1.3 |
| E2E | Playwright + `@axe-core/playwright` | ^1.61.1 / ^4.12.1 |
| CI | GitHub Actions (`.github/workflows/ci.yml`) | Node 22 |

Bewusst **nicht** eingesetzt: `next-pwa` (Service Worker ist handgeschrieben,
`app/public/sw.js`), keine externe UI-Bibliothek (eigenes Designsystem aus AP8).

---

## 3. Repository- und Auslieferungsstand (aktualisiert 2026-07-26)

| Merkmal | Wert |
|---|---|
| Remote | `https://github.com/DKuehnhold/Kabelbereitschaft.git` (privat), Branch `main` |
| Letzter funktionaler Commit auf `main` | `1b8d071` — *feat: implement operational incident list (AP11)*, 2026-07-23 13:22 |
| `origin/main` | synchron mit lokalem `main`; enthält AP11 und die nachfolgenden Dokumentations-Commits |
| **Nicht gepusht** | **keine Commits; AP9–AP11 wurden am 2026-07-26 gepusht** |
| Nicht committet | keine Dateien im neuen Arbeits-Clone |
| Tag / Release | keiner |
| ManagementOS-Verbindung | keine (eigenständiges Repository) |

**AP8.1-Branding:** Der zuvor uncommittete Stand ist inzwischen separat als Commit `04253a2`
auf `feat/ap8.1-branding` gesichert und nach GitHub gepusht. TypeScript, ESLint und
Next.js-Produktions-Build wurden im frischen Clone erfolgreich geprüft. Der Branch ist noch
nicht nach `main` gemergt; die Zusammenführung bleibt eine eigene Freigabeentscheidung.

---

## 4. Architektur in Kürze

**Grundprinzip:** Die Autorisierung liegt **in der Datenbank** (PostgreSQL Row Level Security), nicht
in der Anwendung. Der Client ist nicht vertrauenswürdig; die App nutzt ausschließlich die
Anon-/User-Session, **keine Service-Role**.

```
Browser (PWA)
  ├─ React 19 / Next 16 App Router
  │    ├─ Server Components + Server Actions   → Supabase (User-Session, RLS greift)
  │    └─ Client Components (Listen, Formulare, Offline-UI)
  ├─ Service Worker (app/public/sw.js)          → Cache-Strategien, Offline-Fallback
  └─ IndexedDB (src/lib/offline/*)              → Outbox + Upload-Queue
        │
        ▼  bei Reconnect
  /api/sync            → idempotente Übernahme (sync_actions)
  /api/images/upload   → Bild-Upload (gemeinsame Kernlogik image-upload-core)
  /api/incidents/[id]/meta, /api/health
        │
        ▼
Supabase: PostgreSQL (RLS, Trigger, Views, RPCs) + Storage (privater Bucket, signierte URLs)
```

**Zentrale Architekturentscheidungen** (aus `00-Projektsteuerung/ENTSCHEIDUNGEN.md`, 10 ADRs):

- Autorisierung primär über RLS; Rolle als Feld `profiles.role` (Enum), keine Rollentabelle.
- Bestände **nie überschreiben**: `material_stock` ist eine View über unveränderbare
  `inventory_movements`; Nicht-Negativität per SECURITY-DEFINER-Trigger erzwungen.
- Chronikereignisse (Status, Materialbewegungen) sind **unveränderbar** (nur Insert/Trigger).
- Bilder privat, Zugriff über signierte URLs; EXIF serverseitig; fehlendes EXIF/GPS ist kein Fehler;
  **HEIC wird nicht akzeptiert**.
- CSV: Semikolon + UTF-8-BOM (deutsches Excel) mit Formel-Injektionsschutz.
- Migrationen strikt **additiv und idempotent**.
- Offline-Konflikte: Erkennung über `updated_at`, **keine stille Überschreibung**; Auflösung
  kontrolliert (Serverstand übernehmen / erneut anwenden / verwerfen).
- Idempotenz der Synchronisation: `sync_actions` mit `unique(actor, client_action_id)`.

Vertiefende Dokumente: `03-Architektur/` (SYSTEMARCHITEKTUR, ARCHITEKTUR, DATENMODELL, OFFLINE,
SYNCHRONISATION, KONFLIKTBEHANDLUNG, STORAGE, PWA, SICHERHEIT, DEPLOYMENT).

---

## 5. Datenmodell (aus den Migrationen verifiziert)

**9 Migrationen**, `0001_init.sql` bis `0009_ap11_incident_list_view.sql`, additiv und idempotent.

**25 Tabellen**, gruppiert:

| Gruppe | Tabellen |
|---|---|
| Identität/Rollen | `profiles` |
| Vorgänge | `incidents`, `incident_assignments`, `incident_status_history`, `incident_notes`, `incident_images`, `incident_location_corrections`, `incident_cable_positions` |
| Material/Lager | `materials`, `storage_locations`, `inventory_movements` |
| Stammdaten (AP9) | `customers`, `vzg_lines`, `contacts`, `contact_phone_numbers`, `construction_stages`, `construction_stage_contacts`, `technicians`, `teams`, `team_members`, `cable_types`, `on_call_numbers`, `app_settings` |
| Technisch | `audit_events`, `sync_actions` |

**Views:** `material_stock` (Bestand aus Bewegungen) · `incident_list_view` (`security_invoker`;
serverseitige Suche/Filter/Sortierung/Pagination inkl. Aggregaten, `search_text`,
`created_date_local`).

**RPCs:** `create_incident_ap10` / `update_incident_ap10` (transaktionale Vorgangsanlage/-änderung,
SECURITY INVOKER).

**Sicherheits-/Trigger-Funktionen:** `current_user_role()`, `is_admin()`, `is_staff()`
(admin+disponent), `is_assigned_to_incident()`, `tg_audit()` (feldgenau, **eine** Auditlösung),
`tg_touch_updated()`, `tg_incident_status_history()`, `tg_incident_guard()`, `tg_protect_profile()`,
`check_inventory_nonnegative()`, `handle_new_user()`, `tg_incident_image_event()`.

**Fachliches Löschen** erfolgt durchgehend über `is_active` bzw. Soft-Delete — nicht durch `DELETE`.

---

## 6. Umsetzungsstand je Arbeitspaket

| AP | Inhalt | Stand | Migration |
|---|---|---|---|
| AP1 | Grundgerüst, Datenmodell (RLS/Trigger), Login, rollenbasierte Navigation | abgeschlossen | 0001, 0002 |
| AP2 | Vorgangsverwaltung (Dashboards, Anlegen/Bearbeiten, Zuweisung, Statuswechsel, Priorität, Timeline) | abgeschlossen | 0003 |
| AP3 | Material-/Lagerverwaltung (Bestände, Bewegungen, Entnahme/Rückgabe/Verbrauch, Historie) | abgeschlossen | 0004 |
| AP4 | Bilddokumentation (privater Upload, EXIF/GPS, Galerie, Soft-Delete) + CSV-Export | abgeschlossen | 0005 |
| AP5 | Offlinefähigkeit/PWA, Synchronisation (Manifest, SW, IndexedDB, `/api/sync`) | abgeschlossen | — |
| AP6 | E2E-Struktur (Playwright), Idempotenz/Dedup, Konfliktauflösung, CI | abgeschlossen | 0006 |
| AP7 | Release Readiness: Security-Review, Sicherheitsheader, Health-Check, a11y, Betriebsdoku | abgeschlossen | — |
| AP8 | GUI/UX-Finalisierung: Designsystem (Tokens/Primitive), Dark Mode, Skeletons, a11y | abgeschlossen | — |
| AP9 | Stammdaten & Einstellungen (8 CRUD-Seiten, Monteur-CSV-Import) | abgeschlossen | 0007 |
| AP10 | Vorgangserfassung auf Stammdatenbasis (abhängige Dropdowns, Kabelpositionen, RPCs) | abgeschlossen | 0008 |
| AP11 | Operative Vorgangsliste `/vorgaenge` (serverseitig, URL als Zustandsquelle, CSV) | abgeschlossen | 0009 |
| AP12–AP14 | **nicht definiert** | **offen — keine Planung vorhanden** | — |
| AP15 | Dashboard-Umstellung auf die neue Liste (nur als Verweis erwähnt) | offen | — |

**Anwendungsumfang im Code:** 22 Seiten unter `app/src/app/`, 8 Stammdaten-Clients,
5 API-Routen, `src/lib/` mit ~25 Modulen (Reads, Server-Actions, Offline, Supabase-Clients).

---

## 7. Verifikationsstand — was geprüft ist und was nicht

**Ausgeführt und grün (lokal, ohne Browser und ohne echtes Supabase):**

- `npm run lint` (0), `tsc --noEmit` (0), `next build` (PASS) — je AP wiederholt.
- Migrationen 0001–0009 gegen PostgreSQL, auf leerer DB **und** auf Bestandsdaten, idempotent.
- 7 SQL-Smoke-Suiten (`app/supabase/test/`): 10 (Basis), 11 (AP3, 16), 12 (AP4, 20),
  13 (Idempotenz, 5), 14 (AP9, 26), 15 (AP10, 12), 16 (AP11, 8) — alle grün.
- CSV-Logik 12/12 bzw. 14/14; Service-Worker-Syntaxprüfung.
- Performance-Stichprobe AP11: 600 Vorgänge → Seitenabfrage (50) ~97 ms, Count ~15 ms.
- RLS-Wirksamkeit im Smoke-Test: Admin sieht 2, zugewiesener Monteur 1, fremder Monteur 0.
- `npm audit`: 2 moderate (postcss, build-time, via Next), 0 hoch — dokumentiert akzeptiert.

**Nicht geprüft (Infrastruktur fehlt):**

- Verhalten gegen ein echtes Supabase-Projekt: Upload/Vorschau/signierte URLs, CSV-Download,
  Login/Rollenwechsel im Browser.
- Vollständige Browser-E2E: 5 Specs / ~26 Tests vorhanden, in der Sandbox nur die
  request-basierten `@public`-Tests lauffähig (Chromium-Systembibliotheken fehlen; `@app`-Tests
  brauchen eine Test-Supabase-Instanz).
- Offline-Runtime: Installation, Cache, Reconnect, SW-Update, Konflikt-UI.
- a11y-Browserlauf (axe), Screenreader-Abnahme, visuelle Feinabnahme/Screenshots.
- Deployment, Backup/Recovery, Monitoring, Lastverhalten in der Zielumgebung.

**Bewertung:** Die Datenbank- und Buildschicht ist belastbar geprüft. Die **Interaktionsschicht ist
unbewiesen**. Das ist derzeit das größte inhaltliche Risiko der Freigabe.

---

## 8. Offene Entscheidungen für den Architekten

Diese Punkte sind im Projekt dokumentiert offen und liegen fachlich/architektonisch an:

| # | Thema | Konkrete Frage |
|---|---|---|
| 1 | **Roadmap** | Wie lauten AP12, AP13, AP14? AP11 setzt „AP15 = Dashboard-Umstellung" voraus, AP10 nennt „AP12 = Detailüberarbeitung" — die Kette ist nicht geschlossen |
| 2 | **Aufgabenmodell** | „Offene Hinweise" in der Liste sind derzeit **abgeleitet**. Soll ein echtes Aufgaben-/Hinweismodell (Tabelle, Zuständigkeit, Fälligkeit) eingeführt werden? |
| 3 | **Massenaktionen** | „Status ändern" / „Monteur zuweisen" sind in der Liste vorbereitet, aber deaktiviert. Design der Bulk-Server-Actions inkl. Audit- und Konfliktverhalten fehlt |
| 4 | **Offline-Scope** | Offline-**Neuanlage** vollständiger Vorgänge und eine Offline-**Liste** sind bewusst nicht umgesetzt. Gehören sie zum Zielbild? |
| 5 | **`middleware` → `proxy`** | Next 16 meldet `middleware` als deprecated. Migration ist bewusst nicht spekulativ erfolgt (braucht volle E2E). Wann und in welchem AP? |
| 6 | **CSP** | Content-Security-Policy läuft **Report-Only**. Umstellung auf durchsetzend erfordert Browser-Verifikation und einen Report-Endpunkt — Zeitpunkt festlegen |
| 7 | **Rate Limiting** | Bewusst nicht in der App gelöst; Ebene (Plattform/Proxy/Edge) ist zu bestimmen |
| 8 | **Aufbewahrungsfristen** | Für Soft-Delete und `audit_events` fachlich/juristisch nicht festgelegt. **Relevant, weil GPS-Daten aus EXIF gespeichert werden** (DSGVO) |
| 9 | **`contacts` ↔ Vorgänge** | AP9-Ansprechpartner sind noch nicht mit Vorgängen verknüpft; im Vorgang steht weiter ein Freitext-Snapshot |
| 10 | **`technicians` ↔ `profiles`** | Kopplung Monteur ↔ Benutzerkonto ist über `profile_id` nur vorbereitet; SSO/Login-Kopplung offen |
| 11 | **Kabelpositionen** | Mehrere Positionen sowie Menge/Zustand je Position sind auf später verschoben — Zielmodell klären |
| 12 | **Bereitschaftsnummern** | Für `on_call_numbers` existiert **keine Pflegeoberfläche**, nur Auswahl. Bewusste Lücke aus AP9 |
| 13 | **Repository-Ort** | Neu entschieden: ausschließliche Arbeit im Kabelbereitschaft-Vault; OneDrive-Risiko bekannt und akzeptiert |
| 14 | **Release** | Tag/Release `v1.0.0-rc.1` ist vorbereitet, erfolgt aber nur nach ausdrücklicher Freigabe |

---

## 9. Risiken und technische Schulden

| Risiko | Bewertung | Hinweis |
|---|---|---|
| Keine Abnahme gegen echte Umgebung | **hoch** | Blockiert eine belastbare Freigabe; braucht Supabase-Projekt + Testbenutzer |
| Git-Repository in OneDrive, ~15 verwaiste Lock-/Trash-Dateien in `.git` | **aktiv, bewusst akzeptiert** | Entscheidung Dennis 2026-07-26: Der Kabelbereitschaft-Vault in OneDrive ist der **einzige** Projekt- und Arbeitsort; die frühere Festlegung auf `C:\dev\Kabelbereitschaft` ist aufgehoben. Schutzmaßnahmen: verifizierte Vollsicherung, Git-Bundle, GitHub-Remote als autoritative Quelle, Lockprüfung vor Git-Arbeit, keine eigenmächtigen Ersatzpfade, Zugriffsmeldung statt Ordnerverlagerung. **Kein erneuter Umzug wird vorgeschlagen**, solange Dennis die Entscheidung nicht ändert |
| AP9–AP11 nur lokal vorhanden | **erledigt** | Am 2026-07-26 nach GitHub gepusht; zusätzlich vollständiges Git-Bundle außerhalb OneDrive verifiziert |
| Uncommittete Branding-Änderungen über mehrere APs | **erledigt** | Separater Branch `feat/ap8.1-branding`, Commit `04253a2`, TypeScript/Lint/Produktions-Build grün und nach GitHub gepusht |
| CSP nur Report-Only | **mittel** | Schutzwirkung derzeit nicht aktiv |
| `middleware`-Deprecation (Next 16) | **mittel** | Funktioniert, aber auf Zeit; betrifft die Auth-Session-Weitergabe |
| postcss-Schwachstelle (moderate, build-time) | **gering** | Nur Build; Behebung mit Next-Update |
| Fehlende Aufbewahrungsfristen bei GPS-/Auditdaten | **offen/rechtlich** | Nicht technisch lösbar, Entscheidung erforderlich |
| Doppelte/veraltete Steuerungsdokumente | **gering, aber irreführend** | Siehe Kapitel 10 |

---

## 10. Belegte Abweichungen zwischen Dokumentation und Repository

Diese Punkte sollte der Architekt kennen, weil die Projektdokumentation an mehreren Stellen einen
älteren Stand beschreibt:

1. **Push-Stand wurde korrigiert.** Der am 2026-07-25 festgestellte Dokumentationsstand
   (`origin/main = 8d83371` bzw. `1cac409`) ist überholt. AP9–AP11 wurden am 2026-07-26
   gepusht; der funktionale AP11-Stand ist `1b8d071`, danach folgten Dokumentations-Commits.
2. **Zwei `PROJEKTSTATUS.md`.** Die Fassung im Wurzelverzeichnis ist aktuell (bis AP8, mit AP9–AP11
   in `PROJEKT_WISSEN.md`); `00-Projektsteuerung/PROJEKTSTATUS.md` endet bei **AP2** und führt AP3/AP4
   noch als „geplant". Für einen Neueinsteiger ist das die irreführendste Datei im Projekt.
3. **Zwei `CHANGELOG.md`.** Wurzel (aktuell, bis AP7 detailliert) und `00-Projektsteuerung/CHANGELOG.md`
   (versioniert 0.1.0/0.2.0, endet früher).
4. **`ARBEITSPAKET_8_BERICHT.md` fehlt.** Vorhanden sind AP1–AP7, AP9, AP10, AP11. AP8 ist nur über
   `PROJEKTSTATUS.md`, `PROJEKT_WISSEN.md` und `04-UI-UX/` dokumentiert.
5. **Doppelte Betriebsdokumente.** `07-Betrieb/BACKUP.md` und `07-Betrieb/BACKUP_UND_RECOVERY.md`
   bestehen parallel — führendes Dokument ist zu bestimmen.
6. **`README.md` unvollständig.** Nennt „Migrationen (0001–0004)"; tatsächlich existieren 0001–0009.
7. **Restdatei** `_sandbox_write_test` (0 Bytes) im Wurzelverzeichnis.

---

## 11. Empfohlene nächste Schritte

Vorschlag zur Priorisierung — die Entscheidung liegt beim Architekten bzw. bei der Projektleitung:

**Repository-Stabilisierung abgeschlossen:**

1. Verwaiste `.git`-Sperrdateien wiederherstellbar quarantänisiert und Integrität geprüft.
2. AP9–AP11 gepusht; Branding separat versioniert, geprüft und als Branch veröffentlicht.
3. Führende Steuerungsdokumente gekennzeichnet. Der am 2026-07-26 eingerichtete Clone
   `C:\dev\Kabelbereitschaft` war ein **vorübergehender technischer Clone**; die
   Standortentscheidung wurde von Dennis am 2026-07-26 aufgehoben. **Einziger Projekt- und
   Arbeitsort ist der Kabelbereitschaft-Vault**
   `C:\Users\DennisKühnhold\OneDrive - W & S Technik GmbH\Kabelbereitschaft-App\Kabelbereitschaft-App`;
   der Dev-Clone wurde nach abgeschlossener Rückführung über den Windows-Papierkorb entfernt
   (`C:\dev` blieb bestehen). Fehlender Werkzeugzugriff führt nicht zu einem Ersatzordner,
   sondern zu einer Zugriffsmeldung an Dennis.

**Voraussetzung für jede weitere belastbare Aussage:**

4. V1-Aufbewahrungsfristen fachlich/rechtlich entscheiden; bis dahin keine produktiven
   Personen-, EXIF-/GPS- oder Auditdaten.
5. Supabase-Projekt bereitstellen (URL + Anon-Key), Migrationen 0001–0009 einspielen, ersten
   Administrator anlegen, reale Baustufen und Bereitschaftsnummern liefern.
5. Test-Supabase + Testbenutzer für die `@app`-E2E; Chromium in der CI installieren; danach
   Browser-, Offline- und a11y-Abnahme nachholen.

**Architekturarbeit:**

6. Roadmap AP12–AP15 definieren und die offenen Punkte aus Kapitel 8 den Arbeitspaketen zuordnen —
   insbesondere Aufgabenmodell (#2), Massenaktionen (#3) und Offline-Scope (#4), da diese drei den
   Datenmodell- und Interaktionsentwurf am stärksten beeinflussen.
7. Aufbewahrungsfristen für GPS-/Auditdaten klären (rechtlich), bevor produktive Daten entstehen.

---

## Quellen (im Repository)

- `PROJEKTSTATUS.md`, `PROJEKT_WISSEN.md`, `CHANGELOG.md`, `README.md`
- `00-Projektsteuerung/`: `PROJEKTSTATUS.md`, `OFFENE_PUNKTE.md`, `ENTSCHEIDUNGEN.md`,
  `CHANGELOG.md`, `RELEASEPROZESS.md`, `RELEASE_CHECKLISTE.md`, `RELEASE_NOTES_RC1.md`
- `05-Umsetzung-Claude/ARBEITSPAKET_1…11_BERICHT.md` (ohne AP8), `PROJEKTSTRUKTUR.md`, `SETUP_LOKAL.md`
- `03-Architektur/` (10 Dokumente), `01-Anforderungen/` (5), `02-Fachkonzept/` (6),
  `04-UI-UX/` (8), `06-Tests/` (4), `07-Betrieb/` (7)
- `app/package.json`, `app/supabase/migrations/0001…0009`, `app/supabase/test/00…16`,
  `.github/workflows/ci.yml`
- Git: `git log`, `git status -sb`, `git rev-parse origin/main` (Stand 2026-07-25)

---

## Änderungshistorie

| Version | Datum | Änderung | Bearbeiter |
|---|---|---|---|
| 1.0 | 2026-07-25 | Erstanlage der Architektenübersicht (Stand, Stack, Architektur, Datenmodell, AP-Stand, Verifikationsstand, offene Entscheidungen, Risiken, Doku-Abweichungen, nächste Schritte) | Claude (KI) |
