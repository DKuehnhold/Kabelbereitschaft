# AUFTRAG 3 an den Worker-Chat: GUI-Fundament shadcn/ui (ohne sichtbare Änderung)

> Stand: 2026-08-16. Verfasst von Claude (Rolle Orchestrator/Review, Cowork-Chat 1).
> Grundlage: Entscheidung Dennis vom 2026-08-16 (PROJEKT_WISSEN.md, „Entscheidungen Dennis
> vom 2026-08-16"). Voraussetzung: REVIEW_2 ist grün. Einzelschreiberregel beachten.

## Ziel

Das shadcn/ui-Fundament in `app/` einrichten, sodass nachfolgende GUI-Aufträge (Erfassung,
Liste, Disponentenansicht) fertige, barrierefreie Komponenten nutzen können — **ohne jede
sichtbare Änderung an der bestehenden Oberfläche** in diesem Auftrag.

## Umfang

1. shadcn/ui-Grundgerüst: `components.json`, `lib/utils` (`cn`-Helfer), benötigte
   Basis-Abhängigkeiten (`class-variance-authority`, `clsx`, `tailwind-merge`,
   `tailwindcss-animate` bzw. was die aktuelle shadcn-Version verlangt, Radix-Pakete nur
   für die unten genannten Komponenten). Konfiguration so, dass die Komponenten die
   **bestehenden Design-Tokens aus `globals.css` (AP8)** und den vorhandenen
   Dark-Mode-Mechanismus (`data-theme`) verwenden — keine zweite Token-Ebene, keine
   Neudefinition bestehender Farben. Falls shadcn CSS-Variablen mit eigenen Namen erwartet:
   auf die bestehenden Tokens mappen, nicht duplizieren.
2. Erste Komponenten kopieren (Copy-in unter `src/components/ui/shadcn/` oder klar
   getrenntem Pfad, damit die bestehenden AP8-Primitive unberührt bleiben): `button`,
   `input`, `select`, `textarea`, `label`, `collapsible`, `dialog`, `toggle-group`.
3. Pakete `vaul`, `sonner`, `react-day-picker` als Abhängigkeiten aufnehmen (noch ohne
   Verwendung — die Verdrahtung kommt mit den Fach-Aufträgen).
4. Keine bestehende Seite/Komponente umstellen. Die neuen Komponenten dürfen von noch
   nichts importiert werden (toter Code ist hier ausdrücklich in Ordnung; ESLint-Ausnahmen
   dafür dokumentieren statt Regeln global abschalten).

## Positivliste

- `app/package.json`, `app/package-lock.json` (nur Ergänzungen)
- `app/components.json` (neu), `app/src/lib/utils.ts` (neu, falls nicht vorhanden)
- `app/src/components/ui/shadcn/**` (neu)
- `app/tailwind.config.*` bzw. CSS-Konfiguration **nur additiv**, `app/src/app/globals.css`
  nur additiv (keine bestehenden Tokens/Regeln ändern oder entfernen)

## Negativliste

- Keine Änderung an bestehenden Seiten, Komponenten, Layouts, `proxy.ts`, Service Worker.
- Keine Änderung an bestehenden Tokens/Werten in `globals.css` (nur Ergänzung erlaubt).
- Kein `next-pwa`, keine neuen UI-Gesamtbibliotheken (kein MUI/Ant/daisyUI).
- Keine Änderung an SQL, `lib/db`, Auth, Migrationen, Tests bestehender Fachlogik.
- Keine Änderung an `.claude/**`, `run-*.ps1`, `PROJEKT_WISSEN.md`, `PROJEKTSTATUS.md`.
- Kein Commit, kein Push.

## Abnahmekriterium (DoD)

- Produktions-Build (`npm run build`): Exit 0.
- `tsc --noEmit --incremental false`: Exit 0. ESLint: Exit 0 (dokumentierte, eng begrenzte
  Ausnahmen für noch unbenutzte Komponenten zulässig).
- Unit-Gesamtlauf `node --test test/*.test.mjs`: unverändert **65 Einträge, 64 pass,
  1 fail** (nur Altlast `ap14b-auth`) — kein neuer roter Eintrag.
- `npm audit --audit-level=high --omit=dev`: Exit 0. `npm ci --ignore-scripts`: Exit 0 ohne
  weitere Lockfile-Änderung.
- Nachweis, dass keine sichtbare Änderung entsteht: keine bestehende Datei unter
  `src/app/**` oder `src/components/**` (außerhalb des neuen shadcn-Pfads) verändert —
  per `git status`/`git diff --stat` belegen.
- Sollte die Sandbox keinen npm-Registry-Zugriff haben: STOPP und als Blocker melden
  (nicht mit manuell kopierten Paketinhalten improvisieren).

## Stopppunkt

Anhalten und melden, wenn: shadcn-Init bestehende Dateien überschreiben will (z. B.
`globals.css`-Konflikt), die Token-Anbindung ohne Änderung bestehender Werte nicht möglich
ist, npm-Zugriff fehlt, derselbe Fehler dreimal auftritt oder ein fremder Schreibzugriff
bemerkt wird.

## Meldeweg

`00-Projektsteuerung/MELDUNG_3.md` (Konvention wie bisher; bitte die exakte Liste neuer
Abhängigkeiten mit Versionen und die Lockfile-Diff-Größe nennen). Danach stoppen —
Review durch Chat 1 als `REVIEW_3.md`.
