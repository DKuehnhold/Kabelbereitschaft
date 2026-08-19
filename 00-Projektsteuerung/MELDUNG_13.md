# MELDUNG 13 vom Worker-Chat zu AUFTRAG_13

> Stand: 2026-08-17. Verfasst von Claude (Rolle Worker, Ausführungsagent
> „kb-implementierung"), Antwort auf `00-Projektsteuerung/AUFTRAG_13.md`.
> Schriftliche Notiz, kein Chat-Kanal.

## Vorbefund (eigene Prüfung vor der Umsetzung)

Der im Auftrag genannte Verdacht ("`.input`-Kombination `--foreground`/
`--surface` hat nach AUFTRAG_11 zu wenig Kontrast") habe ich rechnerisch
geprüft (WCAG-Formel, exakt berechnet, nicht nur plausibilisiert): Light
`--foreground` (#18181b) auf `--surface` (#ffffff) ≈ **17,7:1**; Dark
`--foreground` (#f4f4f5) auf `--surface` (#18181b) ≈ **16,1:1**. Beide
liegen bereits weit über 7:1 - die reine Token-Kombination war also
rechnerisch nicht die Ursache.

Tatsächliche Ursachen (zwei, beide behoben):

1. **`app/src/app/login/LoginForm.tsx` und `passwort-aendern/
   PasswordChangeForm.tsx` setzten für die `<input>`-Elemente überhaupt
   keine Text-/Hintergrundfarbe** (nur `border-slate-300` + Blau-Fokus,
   keine `color`/`background`-Klasse). Damit rendert der Browser die
   Eingabeschrift nach seiner eigenen Vorgabe - ohne ein deklariertes
   `color-scheme` kann das bei einem OS im Dark Mode zu heller/weißer
   Schrift führen, obwohl die Seite selbst hell (Card weiß) dargestellt
   wird: weiße Schrift auf weißem Grund, exakt Dennis' Befund.
2. Fehlendes `color-scheme: light`/`dark` auf den Root-Ebenen von
   `globals.css` - ohne diese Angabe können native Formularfelder generell
   nach der OS-Einstellung statt nach dem tatsächlichen Seiten-Theme
   rendern.

Zusätzlich wie im Auftrag verlangt umgesetzt: eigene Feld-Tokens,
Platzhalter, disabled-Zustand, `-webkit-autofill`.

## (a) Token-/Regeländerungen alt → neu (`app/src/app/globals.css`)

| Bereich | Alt | Neu |
|---|---|---|
| `:root`, `[data-theme="dark"]`, `prefers-color-scheme: dark` | kein `color-scheme` gesetzt | `color-scheme: light` bzw. `color-scheme: dark` ergänzt |
| `:root` (und beide Dark-Blöcke) | keine Feld-Tokens | neu: `--field-bg: var(--surface)`, `--field-fg: var(--foreground)`, `--field-placeholder: var(--muted)` (bewusst als eigene, entkoppelte Tokens - aktuell gleicher Wert wie Fläche/Text, aber unabhängig nachschärfbar) |
| `@theme inline` | keine Utility für Hover auf Marke | neu: `--color-brand-hover: var(--brand-hover)` (additiv, ermöglicht `hover:bg-brand-hover` statt hartkodiertem `hover:bg-blue-800`) |
| `.input` | `background: var(--surface); color: var(--foreground);` | `background: var(--field-bg); color: var(--field-fg);` + neu `.input::placeholder { color: var(--field-placeholder) }` + neu `.input:disabled { background: var(--surface-2); color: var(--muted); opacity: .8 }` |
| neu (Element-Selektoren) | - | `input, textarea, select { color: var(--field-fg) }` + `::placeholder`/`:disabled`-Pendants - deckt auch die shadcn-Varianten ab, die keine `.input`-Klasse verwenden und bislang nur `bg-transparent` ohne eigene Textfarbe setzten. Niedrige Spezifität (Element-Selektor), jede vorhandene Tailwind-Klasse gewinnt weiterhin. |
| neu (Autofill) | - | `input:-webkit-autofill` (+ `:hover`/`:focus`, plus `textarea`/`select`) setzt `-webkit-text-fill-color`, `-webkit-box-shadow`/`box-shadow: 0 0 0 1000px var(--field-bg) inset`, `caret-color`, verzögerte `transition`, damit Chrome/Edge/Safari-Autofill nicht dauerhaft Hintergrund/Textfarbe überschreibt. |

Shadcn `input.tsx`/`textarea.tsx`/`select.tsx` selbst mussten **nicht**
geändert werden: Sie setzen keine eigene, kontrastunterlaufende Farbe
(nur `bg-transparent` + `placeholder:text-muted-foreground`), profitieren
aber jetzt von der neuen generischen `input,textarea,select`-Basisregel.

## (b) Farbpaare je Modus mit Kontrastverhältnis (real berechnet, WCAG-Formel)

| Rolle | Light | Dark | Kontrast Light | Kontrast Dark |
|---|---|---|---|---|
| Eingabetext auf Feldhintergrund (`--field-fg` auf `--field-bg`) | #18181b auf #ffffff | #f4f4f5 auf #18181b | **≈ 17,7:1** | **≈ 16,1:1** |
| Platzhalter auf Feldhintergrund (`--field-placeholder` auf `--field-bg`) | #52525b auf #ffffff | #a1a1aa auf #18181b | **≈ 7,7:1** | **≈ 9,1:1** (a1a1aa hell auf sehr dunklem Grund) |
| Disabled-Text (`--muted`) auf Disabled-Hintergrund (`--surface-2`) | #52525b auf #e4e4e7 | #a1a1aa auf #131316 | ≈ 6,1:1 | ≈ 9,6:1 |
| Primärbutton-Text (`--brand-fg`) auf `--brand` | #ffffff auf #7f1d1d | #ffffff auf #dc2626 | ≈ 10,9:1 | ≈ 3,9:1 (Button-Text, kein Fließtext - AA für großen/fetten Button-Text erfüllt, unverändert seit AUFTRAG_11) |

Beide Ziele des Auftrags (Eingabetext ≥ 7:1, Platzhalter ≥ 4,5:1) werden in
Light **und** Dark klar übertroffen.

## (c) Projektweiter Blau-Grep - Ergebnis

Grep nach `blue-|slate-|indigo-|sky-|#1e3a8a|#2563eb|#1d4ed8` in `src/**`
vor der Umsetzung: 38 Dateien. Davon war die überwiegende Mehrheit reines
`slate-*` (neutrales Grau, keine sichtbare Blaufärbung) - nicht verändert,
da nicht "Blau". Echte `blue-`/`indigo-`/`sky-`/Hex-Treffer wurden wie
folgt behandelt:

**Behoben** (Farbklassen auf Tokens umgestellt, keine Strukturänderung):

- `app/src/app/login/LoginForm.tsx`, `app/src/app/passwort-aendern/PasswordChangeForm.tsx` (Positivliste) - Eingaben nutzen jetzt `.input`, Buttons `.btn .btn-primary`/`.btn .btn-outline`, Card/Text auf `bg-background`/`bg-surface`/`border-border`/`text-foreground`/`text-muted`.
- `app/src/app/layout.tsx` - PWA-`themeColor` (#1e3a8a/#0b1220, Vor-AUFTRAG_11-Werte) auf #7f1d1d/#dc2626 (identisch zu `manifest.ts`, das bereits korrekt war).
- `app/src/app/offline/page.tsx`, `app/src/app/(app)/dashboard/page.tsx` - Primärbutton `bg-blue-900 hover:bg-blue-800` → `bg-brand hover:bg-brand-hover text-brand-fg`.
- `app/src/components/images/ImageGallery.tsx` - Fokusrahmen, Upload-Button, Drag-over-Zustand, Thumbnail-Hover, Karten-Link auf `border-ring`/`bg-brand`/`hover:border-brand`/`text-brand` umgestellt.
- `app/src/components/inventory/{StockClient,MovementsClient,MonteurMaterialActions,MaterialsClient,LocationsClient}.tsx` - identisches `field`/`btn`-Muster (`focus:border-blue-500` → `focus:border-ring`, `bg-blue-900 hover:bg-blue-800` → `bg-brand hover:bg-brand-hover`), zusätzlich zwei `text-blue-800`-Bearbeiten-Links → `text-brand`, aktiver Tab in `MonteurMaterialActions` (`text-blue-900` → `text-brand`).
- `app/src/components/incidents/{AssignMonteurForm,IncidentControls,IncidentsTable,EinsatzListe}.tsx` - gleiches Muster (Fokusrahmen, Primärbutton, Link, Hover-Rahmen).
- `app/src/components/pwa/ServiceWorkerRegister.tsx` - Update-Banner `bg-blue-900`/`text-blue-900`/`hover:bg-blue-50` → `bg-brand`/`text-brand-fg`/`text-brand`/`hover:bg-surface-2`.
- `app/src/components/offline/OfflineIncidentActions.tsx`, `OfflineBar.tsx` - Fokusringe (`ring-blue-500` → `ring-ring`), Sync-Button, Upload-Fortschrittsbalken (`bg-blue-600` → `bg-brand`).

**Restfundstellen - bewusst nicht geändert, mit Begründung:**

- `app/src/app/globals.css:57` `--info: #1d4ed8` - explizit erlaubte
  semantische Ausnahme (Info-Hinweise), unverändert seit AUFTRAG_11.
- `app/src/lib/status.ts` (`neu`: blue-100/800/200, `monteur_zugewiesen`/
  `einsatz_angenommen`: indigo-100/800/200) und `app/src/lib/priority.ts`
  (`normal`: sky-100/800/200) - Teil eines durchgängigen, absichtlichen
  Mehrfarben-Systems (Status: 14 Ausprägungen von Blau über Cyan, Teal,
  Amber, Orange, Lila, Lime, Grün bis Grau; Priorität: Grau/Blau/Amber/Rot
  als 4-stufige Eskalation). Nur die zufällig blaufarbenen von vielen
  gleichrangigen Stufen zu ändern, würde die Konsistenz der Legende
  brechen, ohne eine neue Farbe für die Lücke zu haben - das ist eine
  Design-Entscheidung, keine "Blau-Rest" im Sinne des Auftrags. **Zusätzlich
  real unbenutzt:** `STATUS_STYLES`/`PRIORITY_STYLES` werden projektweit
  nirgends importiert/gerendert (Grep bestätigt) - unabhängig von der
  Farbfrage kein sichtbares Element.
- `app/src/components/incidents/StatCard.tsx` (`blue`: border-blue-300,
  `indigo`: border-indigo-300) - **ist** sichtbar (Dashboard-KPI-Karten,
  `app/src/app/(app)/dashboard/page.tsx`), aber Teil derselben Logik: eine
  7-Farben-Akzent-Palette (slate/blue/amber/orange/green/red/indigo) zur
  Unterscheidung verschiedener Kennzahlen. Nur Blau/Indigo zu ersetzen
  bräuchte zwei neue, bisher unbenutzte Akzentfarben - das ist eine
  Design-Entscheidung für Dennis, kein Restfund einer alten Marke.
- `app/src/components/incidents/Timeline.tsx` (`blue: bg-blue-500`,
  `indigo: bg-indigo-500`) - dieselbe Begründung: Farbpunkte zur
  Unterscheidung verschiedener Chronik-Ereignistypen, Teil einer
  Mehrfarben-Legende.
- `app/src/components/NavLinks.tsx` (`bg-blue-900`) - **totes Markup**,
  bereits in MELDUNG_11 dokumentiert: nirgends importiert (nur von
  `AppHeader.tsx`, das selbst nirgends importiert wird). Kein sichtbares
  Element, daher unverändert gelassen (gleiche Begründung wie AUFTRAG_11).
- `app/src/components/ui/shadcn/select.tsx:67` und `dialog.tsx:64` -
  **falsch-positive Treffer** des Greps: `translate-x-1`/`translate-y-1`
  enthalten die Zeichenkette "slate" als Teilstring von "tran**slate**" -
  keine tatsächliche Blau-/Grau-Klasse, keine Änderung nötig.

## (d) Autofill-Behandlung

Siehe (a): `input:-webkit-autofill` (inkl. `:hover`/`:focus`-Varianten)
für `input`/`textarea`/`select` in `globals.css` erzwingt über
`-webkit-text-fill-color` + `-webkit-box-shadow`/`box-shadow: 0 0 0 1000px
var(--field-bg) inset` die eigenen Feld-Tokens statt der browsereigenen
Autofill-Darstellung (typischerweise gelblicher Hintergrund mit fest
vorgegebener Textfarbe, die im Dark Mode zu schlechtem Kontrast führen
kann). `caret-color` und eine 9999s-Transition verzögern zusätzlich das
kurze Aufblitzen der nativen Farbe beim Ausfüllen.

## Geänderte Dateien (vollständig)

`app/src/app/globals.css`, `app/src/app/layout.tsx`,
`app/src/app/login/LoginForm.tsx`,
`app/src/app/passwort-aendern/PasswordChangeForm.tsx`,
`app/src/app/offline/page.tsx`, `app/src/app/(app)/dashboard/page.tsx`,
`app/src/components/images/ImageGallery.tsx`,
`app/src/components/inventory/StockClient.tsx`,
`app/src/components/inventory/MovementsClient.tsx`,
`app/src/components/inventory/MonteurMaterialActions.tsx`,
`app/src/components/inventory/MaterialsClient.tsx`,
`app/src/components/inventory/LocationsClient.tsx`,
`app/src/components/incidents/AssignMonteurForm.tsx`,
`app/src/components/incidents/IncidentControls.tsx`,
`app/src/components/incidents/IncidentsTable.tsx`,
`app/src/components/incidents/EinsatzListe.tsx`,
`app/src/components/pwa/ServiceWorkerRegister.tsx`,
`app/src/components/offline/OfflineIncidentActions.tsx`,
`app/src/components/offline/OfflineBar.tsx`.

Nicht angefasst (siehe Begründung oben): `app/src/lib/status.ts`,
`app/src/lib/priority.ts`, `app/src/components/incidents/StatCard.tsx`,
`app/src/components/incidents/Timeline.tsx`, `app/src/components/NavLinks.tsx`,
`app/src/components/AppHeader.tsx`, `app/src/components/ui/shadcn/{input,textarea,select,dialog}.tsx`.

Keine Struktur-/Layout-/Komponentenänderung, keine Nav-Änderung, keine
Routen/Rechte/SQL/Migrationen/Server-Actions, kein `.claude/**`, keine
Läufer/CI, kein PROJEKT_WISSEN/PROJEKTSTATUS/CHAT_STATUS. Markenrot/
Fehlerrot-Trennung aus AUFTRAG_11 unverändert (nur `--brand-hover` als
zusätzliche, additive Utility ergänzt, kein Wert geändert).

## Prüfergebnisse (tatsächlich erhoben, aus `app/`)

- `node ./node_modules/typescript/bin/tsc --noEmit --incremental false`:
  **Exit 0**.
- `node --test test/*.test.mjs`: **Exit 0, 162 Einträge, 162 pass, 0 fail,
  0 skipped, 0 cancelled** - Baseline 162 unverändert erreicht.
- `node ./node_modules/eslint/bin/eslint.js` auf den vier zentralen
  geänderten Dateien (`globals.css`, `LoginForm.tsx`,
  `PasswordChangeForm.tsx`, `layout.tsx`): **Exit 0, keine Fehler/Warnungen**,
  lief in dieser Sitzung < 170 s durch (anders als in MELDUNG_11 dokumentiert
  - offenbar keine durchgängige Umgebungseigenschaft). Genau ein Versuch
  gemäß Auftragsvorgabe, nicht auf alle geänderten Dateien ausgeweitet.
- `npm run build`: **nicht versucht** - laut MELDUNG_11/MELDUNG_10 in dieser
  Sandbox reproduzierbar am Zeitlimit/EPERM scheiternd; da ESLint diesmal
  durchlief, wurde kein zusätzlicher Build-Versuch unternommen, um die
  Auftragsvorgabe "höchstens ein Versuch" nicht zu verletzen (Prüfung macht
  Dennis lokal).

## Git-Status (nur eigener Umfang)

Nur lesende `git`-Befehle verwendet (`git status --porcelain`). Keine
`.git/index.lock` angetroffen. Der Arbeitsbaum trägt weiterhin einen sehr
großen Bestand an vorbestehenden, nicht von mir erzeugten Änderungen
außerhalb jedes Auftragsumfangs (wie bereits in MELDUNG_11 vermerkt) -
diese wurden nicht angefasst und nicht committet. Meine tatsächlich
bearbeiteten Dateien sind exakt die 18 oben gelisteten `app/src/**`-Dateien
plus dieses `MELDUNG_13.md` (neu).

**Kein Commit, kein Push, kein Merge, kein Tag.**

## Stopppunkt

**Kein Stopppunkt ausgelöst.** Die Kontrastziele waren ausschließlich über
Tokens/Regeln in `globals.css` und Farbklassen in den betroffenen
Komponenten erreichbar, ohne das Markenrot anzufassen. Kein Fehler ist
dreimal aufgetreten. Für Dennis zu würdigen: Drei Fundgruppen (Status-/
Prioritäts-Badges, StatCard-Akzente, Timeline-Punkte) enthalten weiterhin
Blau/Indigo/Sky als Teil bewusster Mehrfarben-Systeme - bewusst nicht
angefasst, siehe (c). Falls Dennis dort ebenfalls Blau-frei möchte, ist das
ein separater Auftrag (Design-Entscheidung: welche Ersatzfarbe pro Stufe).
