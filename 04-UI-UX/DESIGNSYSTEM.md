# Designsystem (AP8)
> Stand: 2026-07-19 · Zentrale UI-Grundlage in `app/src/app/globals.css` + Primitive in `app/src/components/ui/`.

## Prinzipien
Professionell, ruhig, hoher Kontrast für den Einsatz unter Zeitdruck. Ein zentraler Token-Satz statt
Einzellösungen. Mobile First, Accessibility erhalten, Performance nicht verschlechtern.

## Tokens (CSS-Variablen, theme-fähig)
- **Flächen/Text:** `--background`, `--surface`, `--surface-2`, `--foreground`, `--muted`, `--border`.
- **Marke/Interaktion:** `--brand`, `--brand-hover`, `--brand-fg`, `--ring`.
- **Status:** `--info/-bg`, `--success/-bg`, `--warning/-bg`, `--danger/-bg`.
- **Form/Elevation:** `--radius`, `--shadow-sm`, `--shadow`.
Als Tailwind-Utilities verfügbar (`bg-surface`, `text-muted`, `border-border`, `bg-brand`,
`text-foreground`, `bg-background`) über `@theme inline`.

## Theme (Light/Dark/System)
- **System** (Default): folgt `prefers-color-scheme`.
- **Explizit**: `data-theme="light"|"dark"` am `<html>` (Umschalter `ThemeToggle`, persistiert in
  `localStorage`). No-FOUC-Init im Root-Layout setzt das Theme vor dem ersten Paint.
- **Regel:** Keine Funktion hängt vom Theme ab. Künftige `dark:`-Utilities greifen via
  `@custom-variant dark` auch bei explizitem Theme.

## Komponentenklassen (additiv)
`.card`, `.btn`/`.btn-primary`/`.btn-outline` (Touch-Ziel ≥ 40 px), `.input`, `.badge`
(`-info/-success/-warning/-danger`), `.skeleton`. Alle nutzen Tokens → automatisch theme-fähig.

## Primitive (`components/ui/`)
`Card`, `PageHeader`, `Badge`, `Button`, `Skeleton` (presentational), `ThemeToggle` (Client).
Bewusst **additiv** – bestehende Komponenten bleiben funktional unverändert und migrieren schrittweise.

## Accessibility & Motion
Sichtbarer `:focus-visible`-Ring app-weit; `prefers-reduced-motion` reduziert Animationen; dezente
Übergänge (≤ 180 ms); Skeleton-Ladezustände; Touch-Ziele ≥ 40 px; Safe-Area-Insets (`.safe-x/-t/-b`).

## Typografie
System-/Geist-Schrift; Titel `text-2xl font-semibold`, Fließtext `text-sm`, Sekundärtext `text-muted`.
