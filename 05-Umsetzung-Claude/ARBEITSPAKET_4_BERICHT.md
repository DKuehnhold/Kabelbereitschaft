# Arbeitspaket 4 – Umsetzungsbericht
> Stand: 2026-07-19 · MVP V0.1 · Bilddokumentation, EXIF/GPS, Soft-Delete, CSV-Export

## Bestandsanalyse (AP1–AP3 wiederverwendet)
- **Tabelle `incident_images`** existierte bereits (0001) mit den meisten Feldern.
  Fehlend und additiv ergänzt: `width`, `height`, `deleted_at`, `deleted_by`.
- **Enum `image_category`** hatte die 9 AP1-Kategorien. AP4 ergänzt additiv 6 Werte
  (`schaden, detail, reparatur, abschluss, material, sonstiges`) → 15 gesamt.
- **Privater Bucket `incident-images`** (0002) inkl. Storage-RLS existierte bereits und ist
  mit dem Pfad `incidents/{incident_id}/…` kompatibel → keine neue Bucket-/Policy-Anlage nötig,
  nur additive Härtung (Größe/MIME) in 0005.
- **Tabellen-RLS** für `incident_images` (select/insert/update/delete) wird wiederverwendet;
  Soft-Delete läuft über die bestehende UPDATE-Policy (Staff oder Uploader).
- **Audit** ist bereits durch den bestehenden Trigger `trg_audit_images` automatisch abgedeckt.
- **Chronik/Timeline** wird aus `incident_notes` zusammengesetzt → wiederverwendet
  (additive Spalte `image_id` + Trigger `trg_incident_image_event`), **keine** neue Ereignistabelle.
- **`src/lib/exif.ts`** vorhanden → additiv um Breite/Höhe und GPS-/Ausrichtungsvalidierung erweitert.
- **CSV/Export**: `/export` war Platzhalter; Filter liegen clientseitig in der Vorgangsübersicht.

Abweichungen vom AP4-Ziel: **HEIC wird nicht akzeptiert** (nur JPG/JPEG/PNG). Grund: keine
zuverlässige Browser-Vorschau/Verarbeitung in der aktuellen Laufzeit; HEIC nur formal zu
akzeptieren würde bei Vorschau/Metadaten fehlschlagen. Physisches Löschen des Storage-Objekts
ist bewusst nicht Teil von AP4 (nur Soft-Delete; administrativer Bereinigungsprozess vorbereitet).

## Erledigte Funktionen
- Privater Mehrfach-Upload (Drag-and-drop + Dateiauswahl), sofortige Anzeige nach Upload,
  verständliche Fehlermeldungen; Upload-Status als Sammelanzeige (server-action-basiert –
  granularer Fortschritt/Abbruch nicht sinnvoll umsetzbar, siehe Grenzen).
- Formate JPG/JPEG/PNG; zentrale Größenkonfiguration `NEXT_PUBLIC_MAX_IMAGE_MB` (Std. 15 MB);
  Prüfung client (Führung) + server (Magic Bytes) + Storage (Bucket-Limit/MIME, maßgeblich).
- Private Speicherung im Bucket `incident-images`, Pfad `incidents/{incident_id}/{image_id}/{datei}`,
  Dateinamen bereinigt; Zugriff ausschließlich über **signierte URLs** (TTL 1 h), keine Public URLs.
- Serverseitige EXIF-Auswertung: Aufnahmedatum, Kamera, GPS (mit Wertebereichsprüfung),
  Ausrichtung (1–8), Breite/Höhe. Fehlende/ungültige EXIF brechen den Upload nicht ab.
- GPS-Anzeige mit Google-Maps-Link (keine Kartenbibliothek); Datenstruktur für spätere Karte geeignet.
- Kategorie (Pflicht) + Beschreibung (optional) beim Upload; nachträgliche Änderung durch
  Berechtigte – validiert, auditiert, in der Chronik dokumentiert.
- Galerie (responsives Raster/Karten) + Großansicht (vor/zurück, Metadaten, GPS-Link).
- Soft-Delete (deleted_at/deleted_by, Chronik + Audit, Ausblenden in der Standardgalerie).
- Timeline-Integration (Upload/Kategorie/Beschreibung/Löschung) über bestehende Chronik.
- Dashboard-Kennzahl „Heute hochgeladene Bilder" (nur nicht gelöschte) für Disposition/Admin.
- Gefilterter CSV-Export der Vorgangsübersicht (UTF-8+BOM, Semikolon, Formel-Injektionsschutz).

## Bildkategorien und Migrationsentscheidung
Bestehende 9 (unverändert): Übersicht, Zugang, Schadstelle, Zustand vor Arbeit, Zustand nach
Arbeit, Arbeitsausführung, Materialeinsatz, Restmangel, Sonstige Dokumentation.
Additiv ergänzt (6): Schaden, Detail, Reparatur, Abschluss, Material, Sonstiges.
Fachlich getrennt bleiben Schadstelle/Schaden, Arbeitsausführung/Reparatur,
Materialeinsatz/Material, Sonstige/Sonstiges. „Übersicht" nicht doppelt.
Migration: `ALTER TYPE image_category ADD VALUE IF NOT EXISTS …` (rein additiv, migrationssicher,
keine destruktiven Enum-Umbauten). Kategorielabel-Funktion nimmt `text` entgegen, damit neue
Werte nicht in derselben Transaktion referenziert werden.

## CSV-Entscheidung Trennzeichen
**Semikolon** gewählt: Deutsche Excel-Installationen erwarten „;" als Listentrenner (Komma ist
Dezimalzeichen). Zusätzlich UTF-8 **mit BOM** (Umlaute) und deutsches Dezimalkomma für km-Werte.
Sicherheit: Zellen, die mit `=`, `+`, `-`, `@`, Tab oder CR beginnen, werden mit einem
vorangestellten Apostroph neutralisiert (OWASP); Trennzeichen/Anführungszeichen/Zeilenumbrüche
werden korrekt maskiert. Der Export nutzt die **aktuell gefilterte** Liste (RLS greift serverseitig).

## Geänderte/neue Dateien
- Migration (neu): `app/supabase/migrations/0005_ap4_images.sql`
- Test (neu): `app/supabase/test/12_ap4_smoke.sql`; Stub erweitert: `test/00_stub_auth_storage.sql`
- Libs (neu): `src/lib/images.ts`, `src/lib/images-server.ts`, `src/lib/image-actions.ts`, `src/lib/csv.ts`
- Libs (geändert): `src/lib/exif.ts`, `src/lib/status.ts`, `src/lib/database.types.ts`, `src/lib/incidents.ts`
- Komponenten (neu): `components/images/ImageGallery.tsx`, `components/images/IncidentImages.tsx`
- Komponenten (geändert): `components/incidents/Timeline.tsx`, `components/incidents/IncidentsTable.tsx`
- Seiten (geändert): `vorgaenge/[id]/page.tsx`, `dashboard/page.tsx`, `export/page.tsx`
- Doku: DATENMODELL, BILDDOKUMENTATION (neu), STORAGE (neu), TESTPLAN, TESTFAELLE,
  OFFENE_PUNKTE, CHANGELOG, PROJEKTSTATUS.

## Tatsächlich ausgeführte Prüfungen (2026-07-19, Node v22 / PostgreSQL 16)
- `npm ci` → OK · `npm run lint` → **PASS (0)** · `npx tsc --noEmit` → **PASS (0)** · `npm run build` → **PASS**
  (alle Routen inkl. `/export`, `/vorgaenge/[id]`, `/dashboard`; nicht-blockierende
  `middleware`→`proxy`-Deprecation-Warnung aus AP1).
- Migration `0001–0005` auf **leerer** DB → OK; auf **AP3-Datenbestand** → OK (Bild + Kategorie
  erhalten, 4 neue Spalten, 15 Enum-Werte); additive Migrationen **idempotent** (Re-Run OK).
- **AP4-Smoke** `12_ap4_smoke.sql` → **20/20 OK** (Upload berechtigt/unberechtigt, ohne Vorgang,
  EXIF/ohne EXIF, GPS gültig/ungültig, Kategorie-/Beschreibungsänderung → Chronik, Soft-Delete +
  Ausblenden + Chronik, Audit INSERT=4/UPDATE=3, RLS Admin/Monteur/fremd, Storage-RLS, Bucket-Härtung).
- **Regression**: AP1/AP2-Smoke `10` OK, **AP3-Smoke `11` 16/16 OK** (0001–0005).
- **CSV-Test** (Node) → **12/12 OK** (Formel-Injektion `= + - @`/Tab neutralisiert, Maskierung, BOM).

## Gefundene und behobene Fehler
- Lint: neue React-Regel `react-hooks/set-state-in-effect` + unescaptes Zeichen → behoben
  (überflüssigen Effekt entfernt, Effekt per Ref abgesichert, Text umformuliert). Danach Lint 0.
- Testartefakt `12_ap4_smoke.sql`: Audit-Prüfung lief zunächst im Monteur-Kontext (audit_events ist
  per RLS admin-only) → in Service-Kontext verlagert (A8b). Kein Code-Defekt.
- Keine Defekte in Implementierung, Migration oder RLS.

## Storage- und RLS-Ergebnis
Privater Bucket, signierte URLs, Storage-RLS (Fremdupload blockiert, berechtigter Upload erlaubt),
Tabellen-RLS für Admin/Disposition/Monteur bestätigt; negative GPS per Constraint verworfen;
Upload ohne Vorgang blockiert. Alle geprüft (siehe Smoke-Ergebnis).

## Offene Punkte / Grenzen
- Granularer Upload-Fortschritt/Abbruch je Datei: mit Server-Action-Upload nicht sinnvoll; als
  Sammelanzeige umgesetzt. Bei Bedarf später Direkt-Upload mit signierten Upload-URLs.
- Physische Storage-Bereinigung gelöschter Objekte als späterer Admin-Prozess (nicht AP4).
- Manuelle UI-Abnahme gegen ein verbundenes Supabase-Projekt steht aus (Laufzeit-/Browsertest).

## Empfehlung für Arbeitspaket 5
1. Administrativer Bereinigungsjob für soft-gelöschte Bilder (Storage-Objekte entfernen, Aufbewahrungsfrist).
2. Kartenansicht der GPS-Standorte (Datenstruktur ist vorbereitet).
3. Benutzerverwaltungs-UI (aktuell über Supabase-Auth-Dashboard + `profiles.role`).
4. E2E-/Laufzeittests gegen ein echtes Supabase-Projekt (Upload, signierte URLs, RLS im Browser).
