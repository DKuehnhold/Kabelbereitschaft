# Entscheidungen (ADR-kompakt)
> Stand: 2026-07-28 · MVP V0.1

| # | Entscheidung | Begründung |
|---|---|---|
| 1 | App-Code im Unterordner `app/` des Vaults | Trennung von Obsidian-Doku und Code; node_modules verschmutzen den Vault nicht (Abstimmung mit Auftraggeber) |
| 2 | Stack Next.js 16 / React 19 / TS / Tailwind 4 / Supabase | Vorgabe Zielstack; aktuelle stabile Versionen via create-next-app |
| 3 | Autorisierung primär via PostgreSQL RLS | Sicherheit unabhängig vom Client, Vorgabe „Row Level Security" |
| 4 | Rolle als Feld `profiles.role` (Enum) statt separater Rollentabelle | einfacher für 3 feste Rollen; Brief lässt „rollenbezogene Profilfelder" zu |
| 5 | Bestand als View `material_stock` aus unveränderbaren Bewegungen | Vorgabe „Bestände nie überschreiben"; Nachvollziehbarkeit |
| 6 | Nicht-negativer Bestand per SECURITY-DEFINER-Trigger erzwungen | autoritativ über alle Bewegungen, unabhängig von RLS |
| 7 | Status-Chronik & Materialbewegungen unveränderbar (nur Insert/Trigger) | Vorgabe „unveränderbare Chronikereignisse" |
| 8 | Branding als klar markierter Platzhalter unter `app/public/branding/logo.svg` | kein Fantasielogo; einfacher Austausch |
| 9 | Supabase-Projekt wird später angelegt; Entwicklung gegen `.env.example` + Migrationen | Vorgabe Auftraggeber; keine Secrets im Repo |
| 10 | EXIF serverseitig via `exifr`; fehlende EXIF/GPS kein Fehler | Vorgabe Bild-/EXIF-Logik |
| 11 | **Zielarchitektur ohne Supabase: ausschließlich PostgreSQL, Auth.js v5 mit Widerrufstabelle, MinIO für Bilder; RLS bleibt Autorisierungsträger** — Details in [[ADR-011-postgres-eigenplattform]] (**Status: Entwurf**) | Zielentscheidung Dennis 2026-07-28: kein Cloud-BaaS, Stage/Produktion selbst betrieben. Ersetzt den Supabase-Anteil von 2, den Durchsetzungsweg von 3 und 9; die Nummern 2, 3, 9 bleiben als historische Ist-Architektur von AP1–AP13 gültig |
