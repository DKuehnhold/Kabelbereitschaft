# Arbeitspaket 1 – Umsetzungsbericht
> Stand: 2026-07-19 · MVP V0.1

## 1. Geprüfter Ausgangsbestand
Leerer Obsidian-Vault: `Willkommen.md` + `.obsidian/`-Konfiguration. Kein Code, kein Git.
`Willkommen.md` wurde nicht verändert.

## 2. Angelegte Ordner und Dateien
- Doku-Struktur `00`–`07`, `99` mit allen in Abschnitt 13 geforderten Dokumenten.
- `app/` – Next.js-Anwendung (Grundgerüst, Auth, Navigation, Login).
- `app/supabase/` – Migrationen `0001_init.sql`, `0002_storage.sql`, `seed.sql`, Testskripte.
- `app/.env.example`, `.gitignore`, Branding-Platzhalter unter `app/public/branding/`.

## 3. Implementierte Funktionen (AP1)
- Login (E-Mail/Passwort, Supabase Auth), Abmeldung, Session-Schutz per Middleware.
- Rollen Administrator/Disponent/Monteur; serverseitige Rollenprüfung; rollenbasierte Navigation.
- Responsive UI mit Firmenlogo auf Login und im Header (Desktop + mobil).
- Datenmodell komplett als Migration inkl. RLS, Trigger (Audit, unveränderbare Status-Chronik,
  Bestandsschutz) und Bestands-View.
- Serverseitige EXIF-Hilfsfunktion vorbereitet.
- Platzhalterseiten für die Fachfunktionen (mit Rollenschutz), als Folge-Arbeitspakete markiert.

## 4. Ausgeführte Tests und Ergebnis
| Prüfung | Ergebnis |
|---|---|
| `npm run lint` | ✅ 0 Fehler |
| `tsc --noEmit` | ✅ 0 Fehler |
| `next build` (Produktion) | ✅ erfolgreich, alle Routen erzeugt |
| DB-Migration gegen PostgreSQL 18 | ✅ 0001 + 0002 fehlerfrei angewendet |
| DB-Smoke-Test (RLS/Trigger/Bestand) | ✅ alle Prüfungen grün |

Smoke-Test-Details: Bestand nach Wareneingang 10, nach Entnahme 7; Monteur sieht nur
zugewiesene Vorgänge; negativer Bestand blockiert; Anlage durch Monteur blockiert (RLS);
Monteur-Statusschutz greift; Status-Chronik unveränderbar (2 Einträge); Audit-Ereignisse befüllt.

## 5. Noch benötigte externe Ressourcen
- Supabase-Projekt (URL + Anon-Key), Ausführung der Migrationen.
- Erster Administrator-Account.
- Offizielles Firmenlogo.
- Reale Baustufen/Bereitschaftsnummern.

## 6. Offene Punkte
Siehe `00-Projektsteuerung/OFFENE_PUNKTE.md` (Fachfunktionen, Upload-Härtung,
`middleware`→`proxy`-Modernisierung).

## 7. Empfehlung für Arbeitspaket 2
1. Supabase-Projekt gemeinsam anlegen, Migrationen einspielen, ersten Admin einrichten.
2. Vorgangs-Workflow der Disposition: „Vorgang anlegen" (inkl. Standort-Pflichtfelder,
   Bereitschaftsdaten), Vorgangsübersicht mit Filtern, Detailansicht mit Chronik.
3. Monteurzuweisung + Monteuransicht „Meine Einsätze" mit Statuswechsel und Zustandsbewertung.
4. Anschließend AP3 (Material/Lager/Bewegungen) und AP4 (Bild-Upload/EXIF, CSV-Export).
