# Kabelbereitschaft

Interne Web-Anwendung zur Dokumentation und Steuerung der Kabel-Bereitschaft
(Vorgänge, Rollen/Rechte, Material- und Lagerverwaltung). Dieses Repository enthält
sowohl die Projektdokumentation (Obsidian-Vault, Ordner `00`–`07`) als auch die
Anwendung (`app/`). Technische Grundlage ist die interne Eigenplattform:
Next.js 16, PostgreSQL 18 mit RLS, Auth.js v5, MinIO als Objektspeicher und
Containerbetrieb hinter dem internen Reverse-Proxy
(siehe `00-Projektsteuerung/ADR-011-postgres-eigenplattform.md`).

## Repository
- Repository: **Kabelbereitschaft**
- Remote (origin): `https://github.com/DKuehnhold/Kabelbereitschaft.git`
- Branch: **main**
- ManagementOS-Verbindung: **keine** (eigenständiges Repository)

## Struktur
- `00-Projektsteuerung` … `07-Betrieb` – Fachdokumentation (Vault)
- `app/` – Next.js-Anwendung (Details siehe `app/README.md`)
- `app/supabase/` – Datenbankschema, Migrationen (0001–0017), Bootstrap, Seed, Tests.
  Der Verzeichnisname `supabase/` ist ein **historischer Pfadname** aus AP1–AP13;
  Supabase ist kein Ziel mehr. Der Ordner wird nicht umbenannt, damit Git-Historie
  und bestehende Verweise gültig bleiben.

## Weiterführende Dokumente
- `app/README.md` – Anwendung, lokale Ausführung, Skripte
- `07-Betrieb/BETRIEB.md` – belegte lokale und CI-Wege im Betrieb
- `00-Projektsteuerung/ADR-011-postgres-eigenplattform.md` – Zielplattform

## Stand der Umsetzung
Führend sind `PROJEKTSTATUS.md` (Repository-Wurzel) und `00-Projektsteuerung/CHANGELOG.md`.
Die gleichnamigen Dateien `00-Projektsteuerung/PROJEKTSTATUS.md` und `CHANGELOG.md`
(Repository-Wurzel) sind als historische Dubletten markiert und nicht führend.

> Stand dieser Übersicht: 2026-08-03 (Plattformrichtigstellung, AP15).
