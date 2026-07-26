# Projektstatus

> **HISTORISCH / ABGELÖST — nicht mehr pflegen.** Kennzeichnung vom 2026-07-26 gemäß Auflage
> vor AP12 (`00-Projektsteuerung/ROADMAP_AP12_AP15_ENTWURF.md`, B.1/B.8).
> Führendes Dokument für den Projektstatus: `PROJEKTSTATUS.md (Repository-Wurzel)`.
> Dieses Dokument bleibt zu Nachweiszwecken erhalten und wird erst in AP15 kontrolliert
> archiviert. Inhalt ist auf dem Stand AP2 (2026-07-19) und damit veraltet.
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
