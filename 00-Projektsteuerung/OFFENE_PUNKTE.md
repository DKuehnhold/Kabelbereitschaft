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
