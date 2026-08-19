# AUFTRAG 13 (DRINGEND): Lesbarkeit der Eingabefelder + Anmeldeseite auf Rot/Schwarz

> Stand: 2026-08-17. Grundlage: Dennis' Befund nach der lokalen Sichtung — „in den Feldern
> ist die Farbe nicht schwarz, wo Text eingegeben wird, man sieht sehr schlecht" und „der
> Anmeldescreen ist noch blau". Beides blockiert die Benutzung, daher vor dem Dispo-Board.

## Befund (vom Review-Chat vorab lokalisiert)

1. **Eingabefelder:** `.input` in `app/src/app/globals.css` (Zeile ~240) setzt
   `color: var(--foreground)` und `background: var(--surface)`. Nach der Token-Umstellung
   (AUFTRAG_11) ergibt diese Kombination zu wenig Kontrast. **Alle** Eingabearten sind
   betroffen: `input`, `textarea`, `select` — auch die shadcn-Varianten, falls sie eigene
   Farben mitbringen. Zusätzlich prüfen: Platzhaltertext (`::placeholder`), deaktivierte
   Felder, Autofill-Darstellung des Browsers (Chrome überschreibt Hintergrund/Textfarbe bei
   ausgefüllten Feldern — `-webkit-autofill` behandeln, sonst bleibt es unlesbar).
2. **Anmeldeseite:** `app/src/app/login/LoginForm.tsx` verwendet hartkodierte
   Tailwind-Blau-Klassen statt Tokens — Zeilen 66 und 83 (`focus:border-blue-500`,
   `focus:ring-1 focus:ring-blue-500`, `border-slate-300`) und Zeile 96
   (`bg-blue-900 hover:bg-blue-800`). Gleiches Muster auch in
   `app/src/app/passwort-aendern/` prüfen (dieselbe Vorlage) sowie projektweit per Grep nach
   `blue-`, `slate-`, `indigo-`, `sky-`, `#1e3a8a`, `#2563eb`, `#1d4ed8` in `src/**`.

## Ziel

- Eingabefelder haben klar lesbaren, dunklen Text auf hellem Grund (Light Mode) bzw. hellen
  Text auf dunklem Grund (Dark Mode) — Zielkontrast mindestens 7:1 für Eingabetext
  (bewusst strenger als der Mindestwert, weil hier gelesen und getippt wird).
  Platzhalter deutlich schwächer, aber noch erkennbar (mindestens 4.5:1).
- Anmelde- und Passwortseite verwenden ausschließlich Tokens/`.input`/`.btn`-Klassen des
  Designsystems; kein Blau mehr im gesamten `src`-Baum (Ausnahmen nur, wo Blau semantisch
  gemeint ist — z. B. Info-Hinweise `--info`; dann in der Meldung nennen).

## Vorgehen

- Ursache in den **Tokens** beheben, wo es an den Tokens liegt (z. B. `--foreground` für
  Eingaben zu blass, oder `--surface` zu dunkel im Light Mode) — nicht mit Einzel-Overrides
  in Komponenten flicken. Ein zusätzliches, sprechendes Token (z. B. `--field-bg`,
  `--field-fg`, `--field-placeholder`) ist ausdrücklich erlaubt und bevorzugt, wenn dadurch
  die Felder unabhängig von Flächen-/Textfarben steuerbar werden.
- `.input` in `globals.css` zentral korrigieren, damit **alle** Formulare sofort profitieren.
- Auf der Anmeldeseite die Blau-Klassen durch Token-basierte Klassen ersetzen (Fokusring über
  `--ring`, Primärknopf über `--brand`/`--brand-fg`).

## Positivliste

- `app/src/app/globals.css`
- `app/src/app/login/LoginForm.tsx`, `app/src/app/passwort-aendern/**` (nur Farb-/Klassen)
- weitere Dateien **nur**, wenn der Grep dort hartkodiertes Blau in sichtbaren Elementen
  findet — dann jeweils nur die Farbklassen ersetzen, keine Struktur ändern
- `app/src/components/ui/shadcn/input.tsx`, `textarea.tsx`, `select.tsx` nur, falls sie
  eigene Farbwerte setzen, die den Kontrast unterlaufen (offenlegen)

## Negativliste

- Keine Struktur-/Layoutänderung, keine neuen Komponenten, keine Nav-Änderung.
- Keine Routen/Rechte/SQL/Migrationen/Server-Actions, kein `.claude/**`, keine Läufer/CI,
  kein PROJEKT_WISSEN/PROJEKTSTATUS/CHAT_STATUS. Kein Commit/Push.
- Markenrot und Fehlerrot müssen unterscheidbar bleiben (Ergebnis aus AUFTRAG_11 nicht
  zurückdrehen).

## DoD

- tsc Exit 0; `node --test test/*.test.mjs` kein roter Eintrag (Baseline 162).
- ESLint/`npm run build` dürfen in der Sandbox am Zeitlimit/EPERM scheitern — so
  dokumentieren (Prüfung macht Dennis lokal).
- **In der Meldung zwingend:** (a) welche Token/Regeln geändert wurden (alt→neu), (b) die
  konkreten Farbpaare für Eingabetext/Hintergrund/Platzhalter je Modus mit geschätztem
  Kontrastverhältnis, (c) Ergebnis des projektweiten Blau-Greps (Restfundstellen mit
  Begründung, warum sie bleiben dürfen), (d) Behandlung von Autofill.

## Stopppunkt

Anhalten und BLOCKER melden, wenn: die Kontrastziele nur durch Ändern des Markenrots
erreichbar wären; oder derselbe Fehler dreimal auftritt.
