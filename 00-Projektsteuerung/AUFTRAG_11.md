# AUFTRAG 11: Farbkonzept Rot/Schwarz + Navigation (Topbar mit Icons, Burger-Menü)

> Stand: 2026-08-17. Grundlage: `01-Anforderungen/ANFORDERUNG_GUI_RUNDE_2.md`, Punkte A1/A2.
> Voraussetzung: REVIEW_10 grün. Höchste Priorität, weil es alle Seiten betrifft.

## Ziel

1. **Farbkonzept auf Rot + Schwarz** umstellen — ausschließlich über die bestehenden
   AP8-Design-Tokens in `app/src/app/globals.css` (eine Quelle, keine Farbe im Komponentencode
   hartkodieren). Anforderungen:
   - Marken-/Akzentfarbe = Rot (Vorschlag: kräftiges Rot um `#b91c1c`/`#dc2626`), Basis
     Schwarz/Anthrazit, helle Flächen bleiben hell (Light Mode bleibt lesbar).
   - **Dark Mode muss weiter funktionieren** (beide Blöcke: `[data-theme="dark"]` und
     `@media (prefers-color-scheme: dark)`).
   - **Fehler-Rot bleibt vom Marken-Rot unterscheidbar** (z. B. Marken-Rot dunkler/kühler,
     Fehler-Rot heller/wärmer oder umgekehrt) — Warnung/Erfolg unverändert erkennbar.
   - Kontraste: normaler Text mindestens 4.5:1 gegen seinen Hintergrund (kurz begründen,
     nicht messen müssen — offensichtliche Verstöße vermeiden).
   - Das shadcn-Mapping aus AUFTRAG_3 bleibt gültig (keine zweite Token-Ebene einführen).
2. **Navigation umbauen** (`AppShell`/`AppHeader` und zugehörige Nav-Datenquelle):
   - **Oben eine horizontale Leiste** mit den wichtigsten Zielen als Icon+Text:
     Dashboard, Meldungen, Neue Meldung, Bereitschaftsplan, Material/Bestand.
     Icons aus `lucide-react` (bereits vorhanden), Touchziele ≥44px.
   - **Rechts ein Burger-Menü**, das ausklappt und den Rest enthält (Stammdaten-Untermenü,
     Benutzer, Materialhistorie, Theme-Umschalter, Abmelden). Auf Mobil ist die Topbar
     kompakt (Logo/Titel + Burger), die Hauptziele wandern ins Menü oder scrollen horizontal
     — schlichteste Lösung wählen, keine neue Designidee erfinden.
   - Die bisherige feste Seitenleiste entfällt als Dauerelement. Aktiver Zustand muss
     erkennbar bleiben (aria-current), Tastaturbedienung und Fokusreihenfolge intakt,
     Menü per Escape schließbar.
   - Rollenabhängige Sichtbarkeit der Einträge bleibt **unverändert** (bestehende Logik in
     `roles.ts` weiterverwenden, nur Darstellung ändern).

## Positivliste

- `app/src/app/globals.css` (Token-Werte)
- `app/src/components/AppShell.tsx`, `app/src/components/AppHeader.tsx` (bzw. die
  tatsächlichen Chrome-Komponenten — per Grep ermitteln), ggf. neue Komponente
  `app/src/components/AppNav.tsx`
- `app/src/lib/roles.ts` **nur**, falls die Navigationsliste dort um Icon-Namen ergänzt
  werden muss (keine Rechteänderung!)
- shadcn-Komponenten dürfen **verwendet** werden (Sheet/Dialog/Collapsible o. ä.); fehlt eine
  benötigte Komponente, darf sie nach dem Muster von AUFTRAG_3 unter
  `src/components/ui/shadcn/` **ergänzt** werden (offenlegen, welche und warum)

## Negativliste

- Keine Farben in Komponenten hartkodieren, keine bestehenden Token **entfernen**
  (Werte ändern ja, Namen behalten).
- Keine Änderung an Routen, Rechten, Server-Actions, SQL, Migrationen, Tests des Bestands.
- Keine Änderung an `.claude/**`, Läufern, CI, PROJEKT_WISSEN/PROJEKTSTATUS/CHAT_STATUS.
- Kein Commit/Push. Logo-Austausch ist **nicht** Teil dieses Auftrags (Datei fehlt noch).

## DoD

- tsc Exit 0; ESLint auf allen geänderten Dateien Exit 0.
- `node --test test/*.test.mjs`: kein roter Eintrag (Baseline 162; Änderungen an
  Wächtertests, die auf alte Nav-/Farbtexte prüfen, sind erlaubt und offenzulegen).
- `npm run build`: ein Versuch (EPERM-Mount-Limit bekannt und akzeptiert).
- In der Meldung **auflisten**, welche Token-Werte alt→neu geändert wurden, und wie die
  Topbar/Burger-Struktur aufgebaut ist (damit Dennis es ohne Screenshot nachvollziehen kann).
- Playwright-@public-Tests: falls einer auf sichtbare Nav-Struktur prüft, anpassen und
  offenlegen (nicht abschalten).

## Stopppunkt

Anhalten und BLOCKER melden, wenn: die Farbumstellung ohne Hartkodierung nicht möglich ist;
die Nav-Struktur eine echte Designentscheidung erzwingt, die über „schlichteste Lösung"
hinausgeht; oder derselbe Fehler dreimal auftritt.
