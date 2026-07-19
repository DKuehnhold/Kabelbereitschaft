# Projektstatus
> Stand: 2026-07-19 · MVP V0.1

## Aktueller Stand
**Arbeitspaket 2 abgeschlossen** – Vorgangsverwaltung (Dashboards, Anlegen/Bearbeiten,
Zuweisung, Statuswechsel, Priorität, Timeline) auf Basis von AP1 umgesetzt und getestet.

## Fortschritt
| Arbeitspaket | Status |
|---|---|
| AP1 – Grundgerüst, Datenmodell, Login, Navigation | ✅ abgeschlossen |
| AP2 – Vorgangsverwaltung (Dashboard + Disposition) | ✅ abgeschlossen |
| AP3 – Material- und Lagerverwaltung | ⏳ geplant |
| AP4 – Bild-Upload/EXIF, CSV-Export | ⏳ geplant |

## Prüfungen (zuletzt, tatsächlich ausgeführt)
- `npm run lint` → 0 Fehler · `tsc --noEmit` → 0 Fehler · `next build` → erfolgreich.
- Migration 0001–0003 gegen PostgreSQL 18 fehlerfrei; RLS-/Trigger-/Bestands-/Prioritäts-Smoke-Test grün.

## Nächster Schritt
Arbeitspaket 3 – siehe `05-Umsetzung-Claude/ARBEITSPAKET_2_BERICHT.md` (Empfehlung).

## Betrieb
Lokal: `cd app` → `.env.local` aus `.env.example` → `npm install` → Migrationen in Supabase → `npm run dev`.
