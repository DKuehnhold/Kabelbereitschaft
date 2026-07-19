# Projektstatus
> Stand: 2026-07-19 · MVP V0.1

## Aktueller Stand
**Arbeitspaket 1 abgeschlossen** – Grundgerüst, Dokumentation, Datenmodell, Login und
rollenbasierte Navigation stehen und sind getestet.

## Ampel je Bereich
| Bereich | Status |
|---|---|
| Vault-Dokumentation (00–07) | ✅ vorhanden |
| Next.js/TS/Tailwind-Grundgerüst | ✅ gebaut |
| Supabase-Integration (Clients, Middleware, .env.example) | ✅ vorbereitet |
| Datenbankschema als Migration (+ Storage) | ✅ vorliegend, gegen PostgreSQL 18 geprüft |
| RLS + Trigger (Audit, Chronik, Bestandsschutz) | ✅ umgesetzt + Smoke-Test grün |
| Loginseite + Branding-Platzhalter | ✅ vorhanden |
| Rollenbasierte Grundnavigation | ✅ vorhanden |
| Lint / Typecheck / Produktions-Build | ✅ alle erfolgreich |
| Fachfunktionen (Vorgänge/Bild/Material/Export) | ⏳ folgende Arbeitspakete |

## Prüfungen (tatsächlich ausgeführt)
- `npm run lint` → 0 Fehler
- `tsc --noEmit` → 0 Fehler
- `next build` → erfolgreich (alle Routen erzeugt)
- DB-Smoke-Test (PostgreSQL 18): Bestand 10→7, Monteur-Sichtbarkeit, Negativbestand blockiert,
  Fremdanlage blockiert, Monteur-Statusschutz greift, Chronik unveränderbar (2 Einträge), Audit befüllt.

## Nächster Schritt
Arbeitspaket 2 – siehe `05-Umsetzung-Claude/ARBEITSPAKET_1_BERICHT.md` (Empfehlung).
