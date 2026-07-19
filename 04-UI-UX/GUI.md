# GUI-/UX-Finalisierung (AP8)
> Stand: 2026-07-19 · Finalisierung der Oberfläche ohne neue Fachfunktionen.

## Zielbild
Moderne, professionelle Oberfläche für den täglichen Bereitschaftsdienst (Administrator,
Disposition, Bauleiter, Monteur, Bereitschaft). Einfache Bedienung unter Zeitdruck, Mobile First,
konsistentes Erscheinungsbild über ein zentrales Designsystem (siehe DESIGNSYSTEM.md).

## Umgesetzt (additiv, ohne Funktionsänderung)
- **Zentrales Designsystem** (Tokens/Farben/Typografie/Abstände/Statusfarben/Elevation) in `globals.css`.
- **Dark Mode vorbereitet**: Light/Dark/System via `data-theme` + `prefers-color-scheme`, Umschalter
  in der Seitenleiste, No-FOUC-Init, kein funktionaler Themebezug.
- **App-Chrome (AppShell)** theme-fähig (Flächen/Rahmen/Text über Tokens), aktive Navigation
  hervorgehoben, `aria-current`, `aria-expanded`, größere Touch-Ziele, **Safe-Area-Insets**,
  sticky Mobile-Topbar.
- **Ladezustände**: Route-Skeleton (`(app)/loading.tsx`) statt leerer Zwischenzustände.
- **Accessibility**: konsistenter sichtbarer Fokus, aria-Beschriftungen, Touch-Ziele ≥ 40 px,
  `prefers-reduced-motion` respektiert.
- **UI-Primitive** (`components/ui/`) für konsistente Karten/Buttons/Badges/Skeletons.

## Vorbereitet (Scaffolding, ohne Fachlogik)
Dark-Mode-Umschalter (aktiv), `dark:`-Variante an `data-theme` gekoppelt; Token-Grundlage für
künftige KPI-/Karten-/Tabellen-Überarbeitung. Kartenbereich/Wetter/Tastaturkürzel/Mehrfachauswahl
sind als Folgeausbau vorgesehen (Token-/Layout-Basis vorhanden).

## Bewusste Grenzen (ehrlich)
- **Screenshots (Desktop/Tablet/Smartphone) konnten in dieser Build-Umgebung nicht erzeugt werden**:
  kein lauffähiger Browser (Chromium-Systembibliotheken fehlen) und keine Test-Supabase für die
  angemeldeten Seiten. Die visuelle Feinabnahme (Pixel/Reflow/Screenreader) ist daher als **offen**
  markiert und über die manuelle Abnahmecheckliste (`00-Projektsteuerung/RELEASE_CHECKLISTE.md`)
  durchzuführen.
- Vollständige `dark:`-Ausgestaltung aller Altscreens ist ein schrittweiser Folgeausbau; die
  Grundlage (Tokens, Umschalter, Chrome) ist vorhanden.

## Verifikation (ausgeführt)
`npm run lint` (0), `npx tsc --noEmit` (0), `npm run build` (PASS). Designsystem-Klassen und
Token-Utilities sind im erzeugten CSS enthalten. Keine Fachfunktion geändert; AP1–AP7-Regression
(Migration/Smokes/CSV/SW) unverändert grün.
