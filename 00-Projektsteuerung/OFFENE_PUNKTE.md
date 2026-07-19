# Offene Punkte
> Stand: 2026-07-19 · MVP V0.1

## Extern benötigt (Auftraggeber)
- [ ] Supabase-Projekt anlegen; URL + Anon-Key liefern (für `.env.local`).
- [ ] Migrationen `0001_init.sql` und `0002_storage.sql` im Projekt ausführen (siehe `app/supabase/README.md`).
- [ ] Ersten Administrator anlegen (Supabase Auth) und Rolle setzen.
- [ ] Offizielles Firmenlogo (SVG bevorzugt) als `app/public/branding/logo.svg` bereitstellen.
- [ ] Reale Baustufen und Bereitschaftsnummern liefern (Seed enthält nur Beispiele).

## Technische Folgepunkte (Umsetzung)
- [ ] Fachfunktionen implementieren: Vorgang anlegen/Detail/Chronik, Statuswechsel-UI, Zustandsbewertung.
- [ ] Bild-Upload + serverseitige EXIF-Auswertung (Utility `src/lib/exif.ts` ist vorbereitet).
- [ ] Material-/Lager-UI inkl. Bewegungen und Bestandsanzeige.
- [ ] CSV-Export der Vorgangsübersicht (UTF-8).
- [ ] Filter (Status, Baustufe, Monteur, Zeitraum).
- [ ] Benutzerverwaltung-UI (vorerst über Supabase Auth-Dashboard).
- [ ] Modernisierung: Next 16 meldet `middleware` als deprecated → später zu `proxy`-Konvention migrieren
      (aktuell funktionsfähig, als „Proxy" erkannt).
- [ ] Upload-Härtung: Datei-Typ-/Größen-Whitelist, Hash, Virencheck-Option.

## Hinweise
- `app/supabase/test/*` nur für lokale Prüfung – NICHT in Supabase ausführen.

## Git-Hinweis (einmalig)
Das Repository wurde in einer OneDrive-synchronisierten Umgebung angelegt; dabei sind
verwaiste Sperrdateien verblieben. Vor der ersten eigenen Git-Aktion bitte löschen:

```powershell
del ".git\index.lock" ".git\HEAD.lock" ".git\objects\maintenance.lock"
```

Danach ist das Repo normal nutzbar (`git status`, `git add`, `git commit`).
Hinweis: Git in einem OneDrive-Ordner kann zu Sync-Konflikten führen; ggf. Repo später
in einen lokalen Pfad außerhalb von OneDrive verschieben.

## Aktualisierung nach AP2 (2026-07-19)
Erledigt in AP2: Dashboards (Disponent/Monteur), Vorgang anlegen/bearbeiten, Monteurzuweisung,
Statuswechsel (rollenabhängig), Priorität, Timeline/Chronik, responsive Sidebar/Navigation.

Weiterhin offen / als Nächstes:
- [ ] AP3: Material-/Lager-UI (Bestände, Bewegungen, Monteur-Entnahme/Rückgabe) auf bestehendem Datenmodell.
- [ ] AP4: Bild-Upload + serverseitige EXIF-Auswertung (Util vorhanden), CSV-Export der Vorgangsübersicht.
- [ ] Benutzerverwaltungs-UI (aktuell über Supabase Auth-Dashboard + `profiles.role`).
- [ ] Timeline: Material-/Bildereignisse ergänzen (Platzhalter bereits vorgesehen).
- [ ] Laufzeittest der Oberfläche gegen ein verbundenes Supabase-Projekt (in AP1/AP2 nur Build/DB geprüft).
- [ ] Modernisierung `middleware` → `proxy` (Next 16).

## Aktualisierung nach AP3 (2026-07-19)
Umgesetzt (Code im Vault): Materialstammdaten, Lagerorte, Bestandsübersicht, Materialbewegungen,
Entnahme/Rückgabe/Verbrauch, Materialhistorie, Material im Vorgang, Karte „Material unter
Mindestbestand" (additive Migration 0004 für Monteur-Verbrauch).

Offen / als Nächstes:
- [x] **AP3-Verifikation ausgeführt (2026-07-19):** `npm run lint`, `npx tsc --noEmit`,
  `next build`, Migration 0001–0004 (inkl. Idempotenz 0003/0004) sowie Smoke-Tests
  `10_smoke_test.sql` und neu `11_ap3_smoke.sql` (11 Szenarien) – **alle PASS**.
  Details siehe `05-Umsetzung-Claude/ARBEITSPAKET_3_BERICHT.md`. AP3 committet.
- [ ] Manuelle UI-Abnahme gegen verbundenes Supabase-Projekt (Stammdaten-CRUD, Bewegungen,
  Monteur-Entnahme/Rückgabe/Verbrauch, Historie-Filter, Low-Stock-Karte).
- [x] AP4: Bild-Upload + serverseitige EXIF-Auswertung; CSV-Export der Vorgangsübersicht (erledigt).
- [ ] Benutzerverwaltungs-UI.
- [x] Timeline um Bildereignisse erweitert (Upload/Kategorie/Beschreibung/Soft-Delete via Chronik).

## Aktualisierung nach AP4 (2026-07-19)
Umgesetzt und verifiziert (alle Prüfungen PASS – siehe `ARBEITSPAKET_4_BERICHT.md`):
Privater Mehrfach-Bildupload, EXIF/GPS-Auswertung, Galerie + Großansicht, Kategorie-/
Beschreibungsänderung, Soft-Delete, Timeline-/Audit-Integration, Dashboard-Kennzahl
„Heute hochgeladene Bilder", gefilterter CSV-Export mit Formel-Injektionsschutz.
Migration `0005_ap4_images.sql` (additiv, idempotent, auf leerer und AP3-DB geprüft).

Offen / als Nächstes:
- [ ] Manuelle UI-Abnahme gegen verbundenes Supabase-Projekt (Upload/Vorschau/signierte URLs im Browser).
- [ ] Granularer Upload-Fortschritt/Abbruch je Datei (aktuell Sammelanzeige; ggf. Direkt-Upload).
- [ ] Administrativer Bereinigungsprozess für soft-gelöschte Storage-Objekte (AP5).
- [ ] Optionale Kartenansicht der GPS-Standorte (Datenstruktur vorbereitet).
- [ ] Modernisierung `middleware` → `proxy` (Next 16).
