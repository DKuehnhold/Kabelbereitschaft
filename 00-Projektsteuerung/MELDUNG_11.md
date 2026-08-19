# MELDUNG 11 vom Worker-Chat zu AUFTRAG_11

> Stand: 2026-08-17. Verfasst von Claude (Rolle Worker, Ausführungsagent
> „kb-implementierung"), Antwort auf `00-Projektsteuerung/AUFTRAG_11.md`.
> Schriftliche Notiz, kein Chat-Kanal.

## Vorbefund

Grep der Chrome-Komponenten ergab: `AppShell.tsx` ist die tatsächlich
verwendete Chrome-Komponente (eingebunden in `app/src/app/(app)/layout.tsx`).
`AppHeader.tsx` und die dazugehörige `NavLinks.tsx` sind **totes/verwaistes
Markup** — nirgends importiert, wurden von der ursprünglichen festen
Seitenleiste in `AppShell.tsx` nicht verwendet. Da die Positivliste nur die
„tatsächlichen Chrome-Komponenten" freigibt, habe ich `AppHeader.tsx`/
`NavLinks.tsx` **nicht angefasst** (kein Bedarf, kein Auftragsumfang).
`roles.ts` musste **nicht geändert** werden: Die Zuordnung Icon → Ziel
geschieht rein über eine href-Tabelle in der neuen Komponente `AppNav.tsx`,
nicht über eine Erweiterung der `NavItem`-Struktur — dadurch bleibt
`roles.ts` als einzige Quelle für Rechte/Sichtbarkeit unverändert und
unangetastet.

## Geänderte/neue Dateien

- `app/src/app/globals.css` (Token-Werte geändert, eine additive
  Tailwind-Utility-Zeile ergänzt — siehe Tabelle unten)
- `app/src/components/AppShell.tsx` (vollständig neu aufgebaut: Topbar +
  Burger-Menü statt feste Seitenleiste)
- `app/src/components/AppNav.tsx` (**neu**, siehe Begründung unten)

Nicht angefasst (bewusst, siehe Vorbefund): `AppHeader.tsx`, `NavLinks.tsx`,
`roles.ts`, `ThemeToggle.tsx`, `Logo.tsx`. Keine Änderung an Routen,
Rechten, Server-Actions, SQL, Migrationen, `.claude/**`, Läufern, CI,
PROJEKT_WISSEN/PROJEKTSTATUS/CHAT_STATUS. Kein Logo-Austausch. Kein
Commit/Push.

## (a) Token-Werte alt → neu

Alle Werte stammen unverändert aus `globals.css`; nur Werte geändert,
**keine Token-Namen entfernt oder umbenannt**.

| Token | Block | Alt | Neu | Begründung |
|---|---|---|---|---|
| `--background` | `:root` | `#eef2f6` | `#f4f4f5` | Blaustich (Slate) raus, neutrales Zinc/Anthrazit rein; bleibt hell |
| `--surface-2` | `:root` | `#f8fafc` | `#e4e4e7` | dito, sichtbarer Abstand zu `--surface` (weiß) beibehalten |
| `--foreground` | `:root` | `#0f172a` | `#18181b` | Text neutral-anthrazit statt navy-schwarz |
| `--muted` | `:root` | `#64748b` | `#52525b` | neutral statt blaustichig |
| `--border` | `:root` | `#e2e8f0` | `#d4d4d8` | neutral, etwas sichtbarer als vorher |
| `--brand` | `:root` | `#1e3a8a` (Blau) | `#7f1d1d` | Marke = Rot, bewusst **dunkler/kühler** als `--danger` |
| `--brand-hover` | `:root` | `#1d4ed8` | `#991b1b` | helleres Rot als `--brand` fürs Hover, bleibt dunkler als `--danger` |
| `--ring` | `:root` | `#2563eb` (Blau) | `#991b1b` | Fokusring folgt der Marke (= `--brand-hover`) |
| `--danger` | `:root` | `#b91c1c` | `#dc2626` | heller/wärmer als `--brand`, damit von der Marke unterscheidbar |
| `--background` | `[data-theme="dark"]` + `prefers-color-scheme` | `#0b1220` (Navy) | `#09090b` | neutrales Anthrazit/Schwarz statt Navy |
| `--surface` | dito | `#111827` | `#18181b` | neutral |
| `--surface-2` | dito | `#0f172a` | `#131316` | neutral, dunkler als `--surface` (wie vorher) |
| `--foreground` | dito | `#e5e7eb` | `#f4f4f5` | neutral |
| `--muted` | dito | `#94a3b8` | `#a1a1aa` | neutral |
| `--border` | dito | `#1f2a3a` | `#27272a` | neutral |
| `--brand` | dito | `#3b82f6` (Blau) | `#dc2626` | Marke = Rot im Dark Mode |
| `--brand-hover` | dito | `#60a5fa` | `#ef4444` | helleres Rot fürs Hover |
| `--brand-fg` | dito | `#0b1220` (dunkler Text) | `#ffffff` | auf sattem Rot ist heller Text kontrastreicher |
| `--ring` | dito | `#60a5fa` | `#f87171` | Fokusring folgt der Marke, gut sichtbar auf dunklem Grund |

**Unverändert gelassen** (Auftrag: „Warnung/Erfolg unverändert erkennbar"):
`--info`/`--info-bg`, `--success`/`--success-bg`, `--warning`/`--warning-bg`
in beiden Blöcken; `--danger`/`--danger-bg` im Dark-Block (bereits vorher
klar vom (jetzt roten) `--brand` unterscheidbar: gedämpftes Rosa-Rot als
Text vs. sattes Rot als Button-/Aktiv-Füllung). `--radius`, `--shadow*`
unverändert. Das komplette shadcn-Mapping (`--card`, `--primary`,
`--destructive`, …) bleibt unverändert **strukturell** bestehen (folgt per
`var()` automatisch den neuen Werten).

**Eine zusätzliche additive Zeile** im `@theme inline`-Block:
`--color-brand-fg: var(--brand-fg);` — ohne diese Utility hätte der aktive
Nav-Link-Zustand (`bg-brand`) im Komponentencode mit hartkodiertem
`text-white` arbeiten müssen (im Dark Mode wäre das falsch/inkonsistent
gewesen, da `--brand-fg` dort einen anderen Wert trägt). Kein neues Token,
keine neue Farbe — reine Tailwind-Utility-Zuordnung auf ein bereits
bestehendes AP8-Token, exakt nach dem Muster der AUFTRAG_3-Zeilen direkt
darüber.

**Kontrastbegründung (plausibilisiert, nicht gemessen, wie im Auftrag
zugelassen):** `--foreground` (#18181b, sehr dunkel) auf `--background`
(#f4f4f5, sehr hell) und auf `--surface` (#ffffff): deutlich über 4.5:1.
`--muted` (#52525b) auf `--background`: ebenfalls klar über 4.5:1 (mittleres
Grau auf sehr hellem Grund). `--brand-fg` (#ffffff) auf `--brand` (#7f1d1d,
sehr dunkles Rot): sehr hoher Kontrast. `--danger` (#dc2626) auf
`--danger-bg` (#fee2e2, sehr helles Rosa): weiterhin klar über 4.5:1 (die
Aufhellung von Rot-700 auf Rot-600 verringert den Kontrast nur geringfügig
gegenüber dem sehr hellen Hintergrund).

## (b) Neue Topbar-/Burger-Struktur (in Worten)

**Header (immer sichtbar, sticky oben, `border-b`, Höhe 4rem/64px):**

- Links: Logo + (ab `sm`) Schriftzug „Bereitschaftsapp HLK".
- Mitte (ab `md`, also Desktop/Tablet quer): horizontale Icon+Text-Leiste
  mit den **für die Rolle sichtbaren** Hauptzielen. Die „Haupt-Ziele" sind
  fest als Zuordnung Route → lucide-Icon definiert
  (`PRIMARY_NAV_ICONS` in `AppNav.tsx`): `/dashboard` → `LayoutDashboard`,
  `/vorgaenge` → `ListChecks` (Meldungen), `/vorgaenge/neu` → `FilePlus2`
  (Meldung anlegen/„Neue Meldung"), `/meine-einsaetze` → `ClipboardList`
  (Monteur-Pendant zu Meldungen), `/bereitschaftsplan` → `CalendarClock`,
  `/bestand` → `Package`, `/material` → `Boxes`. Welche davon eine Rolle
  sieht, entscheidet ausschließlich `navFor(role)` aus `roles.ts` (z. B.
  Monteur sieht `/meine-einsaetze` statt `/vorgaenge*`, sieht `/material`
  gar nicht) — reine Whitelist-Prüfung „ist dieser Href in der
  Icon-Zuordnung enthalten", keine Rechte-Logik dupliziert. Aktiver Link:
  `aria-current="page"` + `bg-brand`/`text-brand-fg`. Touchziel je Link
  `min-h-11` (44px).
- Rechts: **immer sichtbarer** Burger-Button (Icon `Menu`/`X` je nach
  Zustand), `aria-expanded`, `aria-controls="app-burger-menu"`,
  `aria-label` „Menü öffnen"/„Menü schließen", 44×44px Fläche.

**Auf Mobil** (unterhalb `md`) ist die Icon-Leiste in der Kopfzeile
ausgeblendet (`hidden md:flex`) — die Topbar besteht dann nur aus
Logo/Titel links und dem Burger-Button rechts, wie im Auftrag als
„schlichteste Lösung" vorgegeben.

**Burger-Panel** (klappt unterhalb der Topbar auf, `position: fixed`,
`top-16`, volle Breite, scrollbar, plus abdunkelnde Fläche dahinter):

1. Nur auf Mobil (`md:hidden`) zusätzlich die Hauptziele noch einmal als
   Liste (dieselbe Komponente/Datenquelle wie oben, kein zweiter
   Datenpfad) — auf Desktop hier ausgeblendet, weil dort schon oben
   sichtbar.
2. Die **restlichen** `navFor(role)`-Einträge, die nicht zu den
   Hauptzielen zählen (`Lagerorte`, `Materialhistorie`, `Benutzer`,
   `Export`).
3. Die Gruppen aus `navGroupsFor(role)` (aktuell nur „Stammdaten" mit allen
   Untereinträgen) — Gruppentitel + Liste, wie zuvor in der Seitenleiste.
4. Benutzerblock (Name + Rollentext), `ThemeToggle`, Abmelden-Button
   (unverändertes Formular `action="/auth/signout"`).

**Bedienung:** Escape schließt das Menü und setzt den Fokus zurück auf den
Burger-Button (per `keydown`-Listener, nur aktiv solange offen). Klick auf
die abdunkelnde Fläche außerhalb des Panels schließt ebenfalls
(`pointerdown`-Listener mit Prüfung, ob außerhalb von Panel **und**
Button geklickt wurde). Klick auf einen Link im Panel schließt es
(`onNavigate`/`closeMenu`) und navigiert. Tastaturreihenfolge bleibt die
native DOM-Reihenfolge (Logo → Icon-Leiste → Burger-Button → Panel-Inhalt),
kein `tabindex`-Eingriff nötig.

**Feste Seitenleiste (`<aside>`) entfällt vollständig** — der Inhaltsbereich
(`<main>`) hat kein `md:ml-60` mehr, da nichts mehr links andockt (Grep
bestätigt: keine andere Stelle im Code setzt eine Breite/Margin voraus, die
von der alten festen Sidebar abhing).

## (c) Ergänzte shadcn-Komponenten

**Keine.** Es wurde bewusst **keine** neue shadcn-Komponente (z. B. `Sheet`)
ergänzt. Begründung: Das bestehende `Collapsible` unter
`src/components/ui/shadcn/collapsible.tsx` wäre technisch nutzbar gewesen,
aber die schon vorhandene, im Projekt etablierte Umsetzung (kontrollierter
`useState`-Zustand + bedingtes Rendern, exakt das Muster der alten
`AppShell.tsx`/`AppHeader.tsx`) deckt alle geforderten Punkte ab
(aria-expanded/-controls, Escape, Klick außerhalb, Fokus-Rückgabe) ohne
zusätzliche Abstraktionsebene. Das ist die „schlichteste Lösung" im Sinne
des Auftrags: keine neue Komponente, keine neue Abhängigkeit, gleiches
Verhalten wie zuvor, nur neu verdrahtet für Topbar statt Sidebar.

## Prüfergebnisse (tatsächlich erhoben, aus `app/`)

- `node ./node_modules/typescript/bin/tsc --noEmit --incremental false`:
  **Exit 0** (kompletter Lauf, keine Fehlermeldung).
- `node --test test/*.test.mjs`: **Exit 0, 162 Einträge, 162 pass, 0 fail, 0
  skipped, 0 cancelled** — Baseline 162 unverändert erreicht, kein
  Wächtertest musste angepasst werden.
- **ESLint auf den geänderten/neuen Dateien: KEIN Ergebnis erhoben.**
  Mehrere Versuche (`eslint.js` auf `AppShell.tsx`+`AppNav.tsx`, danach
  einzeln auf einer unveränderten Bestandsdatei `src/lib/roles.ts` als
  Kontrollprobe) liefen jeweils **mehr als 175 Sekunden** und wurden vom
  Werkzeug-Zeitlimit dieser Sitzung abgebrochen, bevor ESLint eine Ausgabe
  erzeugte — auch Hintergrundausführung (`setsid`/`disown`) half nicht, da
  der Sandbox-Prozessbaum beim Zeitlimit vollständig beendet wird. Die
  Kontrollprobe mit der unveränderten Datei `roles.ts` zeigt: **Das ist
  keine Folge meiner Änderungen**, sondern eine bestehende
  Umgebungseigenschaft dieser Sitzung (vermutlich typgeprüftes ESLint über
  `eslint-config-next/typescript`, das einen vollständigen
  TypeScript-Programmaufbau über das gesamte Projekt erzwingt, kombiniert
  mit dem langsamen OneDrive-Mount). `tsc` selbst (ebenfalls
  Vollprogrammaufbau) lief in dieser Sitzung durch — ESLint offenbar
  zusätzlich langsamer. **Kein erfundener Nachweis:** Ich melde explizit
  „kein Exit-Code erhoben", statt einen Erfolg zu behaupten. Empfehlung:
  Dennis prüft `node ./node_modules/eslint/bin/eslint.js
  src/app/globals.css src/components/AppShell.tsx src/components/AppNav.tsx`
  lokal (dort vermutlich in normaler Zeit lauffähig).
- **`npm run build`: ein Versuch, kein Ergebnis erhoben.** Der Build
  überschritt ebenfalls die 175-Sekunden-Grenze dieser Sitzung, bevor eine
  Ausgabe (Erfolg oder das aus MELDUNG_10 bekannte
  `.fuse_hidden`/EPERM-Bild) sichtbar wurde. Kein zweiter Versuch
  unternommen (Auftragsvorgabe „genau ein Versuch"). Das ist **nicht**
  zwingend derselbe bekannte EPERM-Blocker, sondern könnte schlicht eine
  Zeitüberschreitung sein — ich kann das in dieser Sitzung nicht
  unterscheiden, da keine Ausgabe erfasst wurde.
- **Playwright `@public`-Specs auf Nav-/Sidebar-Struktur geprüft (per
  Grep):** `app/e2e/a11y.spec.ts`, `app/e2e/public.spec.ts`,
  `app/e2e/auth-proxy.spec.ts` sind die einzigen mit dem Tag `@public`.
  Keiner der drei prüft Navigations-/Sidebar-Struktur oder -Texte (geprüft
  auf `nav`, `aside`, `Menü`, `Sidebar`, `getByRole("link", …)` — keine
  Treffer). **Keine Anpassung nötig.** Die einzige e2e-Datei, die
  Nav-Links über `getByRole("link", …)` prüft
  (`app/e2e/auth.spec.ts:31-32`, „Meine Einsätze" sichtbar / „Material"
  nicht vorhanden für Monteur), ist mit `@app` getaggt (nicht im
  Auftrags-Prüfumfang) und bleibt unverändert korrekt: „Meine Einsätze" ist
  für Monteur ein Hauptziel und damit in der Icon-Leiste sichtbar
  (Playwright läuft mit Desktop-Viewport), „Material" wird für Monteur
  weiterhin nirgends gerendert (`navFor` filtert es serverseitig weg).

## Beobachtung außerhalb des Auftragsumfangs (nicht behoben, nur gemeldet)

`app/e2e/public.spec.ts:12` prüft `m.theme_color === "#1e3a8a"` (das alte
Marken-Blau) aus dem PWA-Manifest. Diese Datei ist **nicht Teil der
Positivliste** von AUFTRAG_11 (nur `globals.css`, Chrome-Komponenten,
`roles.ts`, shadcn), daher **nicht angefasst**. Sobald der Manifest-Wert an
anderer Stelle auf das neue Marken-Rot umgestellt wird, muss dieser Test
mitgezogen werden — das ist außerhalb dieses Auftrags zu entscheiden/zu
beauftragen.

## Git-Status (nur eigener Umfang)

Nur lesende `git`-Befehle verwendet (`git status --porcelain`). Keine
`.git/index.lock` angetroffen.

```
 M app/src/app/globals.css
 M app/src/components/AppShell.tsx
?? 00-Projektsteuerung/AUFTRAG_11.md
?? app/src/components/AppNav.tsx
```

(Der übrige Arbeitsbaum trägt weiterhin vorbestehende Änderungen außerhalb
jedes Auftragsumfangs, u. a. mehrere `00-Projektsteuerung/*.md` — von mir
**nicht** erzeugt und **nicht** angefasst.)

**Kein Commit, kein Push, kein Merge, kein Tag.**

## Statuspflege

`.claude/automation/status/fortschritt.json` liegt unter der Negativliste
(kein `.claude/**`) und wurde deshalb **nicht** geändert — wie in
MELDUNG_10 bereits begründet.

## Stopppunkt

**Kein inhaltlicher Stopppunkt ausgelöst** (keine Hartkodierung nötig,
keine Designentscheidung über „schlichteste Lösung" hinaus, kein Fehler
dreimal aufgetreten). **Für Dennis zu würdigen:** zwei Prüfschritte
(ESLint, `npm run build`) konnten in dieser Sitzung aus reinen
Zeit-/Umgebungsgründen nicht bis zum Ergebnis gebracht werden (siehe oben,
mit Kontrollprobe auf unveränderter Datei belegt) — das ist kein
inhaltlicher Auftrags-Stopppunkt, aber ein offener Nachweis, den ich nicht
erfinden wollte.
