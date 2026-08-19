# MELDUNG 21 vom Worker-Chat zu AUFTRAG_21

> Stand: 2026-08-18. Verfasst von Claude (Rolle Worker, Ausführungsagent),
> Antwort auf `00-Projektsteuerung/AUFTRAG_21.md`. Schriftliche Notiz, kein
> Chat-Kanal.

## Ergebnis in Kürze

Die `dark:`-Variante in `globals.css` deckt jetzt **beide** Dunkelfälle ab:
das explizite Theme (`[data-theme="dark"]`, unverändert) und die
Systempräferenz (`prefers-color-scheme: dark` mit `:root:not([data-theme=
"light"])`, neu, deckungsgleich zum bestehenden Tokenblock Zeile ~169-171).
`Logo.tsx` behält `dark:invert` unverändert; nur der Kommentar wurde
nachgezogen. Ein neuer statischer Wächtertest
`app/test/auftrag21-dark-variante.test.mjs` (4 Fälle) prüft Vorhandensein und
Struktur der Selektoren sowie, dass kein Tokenblock angefasst wurde.

`tsc --noEmit`: Exit 0. Testlauf: 208 Tests (204 Bestand + 4 neu), **207
grün, 1 rot** — der rote Fall ist der bereits in `MELDUNG_20.md` gemeldete,
dort begründete und akzeptierte Bestandstest-Befund aus AUFTRAG_20
(`auftrag18-dispo-zeitraum.test.mjs`, Test „Bis vor Von und die 92-Tage-
Obergrenze…"); er hat mit AUFTRAG_21 nichts zu tun und ist hier unverändert.
Alle 4 neuen AUFTRAG_21-Fälle sind grün, keiner der übrigen 203
Bestandsfälle wurde durch AUFTRAG_21 rot.

**Die tatsächliche Darstellung des Logos ist in dieser Umgebung NICHT
prüfbar** — kein Browser, `npm run build` läuft wegen des OneDrive-/
FUSE-Mounts nicht. Als Ersatznachweis habe ich die neue Variantendefinition
mit dem tatsächlich installierten Tailwind-Compiler (v4.3.3, über
PostCSS, isoliert in `/tmp` aufgerufen, dabei **keine** Datei im
Projektordner geschrieben) kompiliert und die erzeugten CSS-Selektoren
geprüft (Abschnitt „Kompilier-Nachweis" unten) — das ist kein
Rendernachweis, aber ein Beleg, dass die Syntax gültig ist und exakt die
beiden erwarteten Selektoren erzeugt.

## Geänderte/neue Dateien (Positivliste — genau drei)

**Geändert (2):**
- `app/src/app/globals.css` — ausschließlich die `@custom-variant dark`-
  Definition (Zeile 9 alt) samt Kommentar. Kein Tokenwert berührt.
- `app/src/components/Logo.tsx` — nur der Kommentar ergänzt (ein Absatz),
  die Klasse `dark:invert` unverändert.

**Neu (1):**
- `app/test/auftrag21-dark-variante.test.mjs`

**Nachweis über Dateizeitstempel:** `find . -newer src/lib/on-call-plan-
actions.ts -type f` (aus `app/`, node_modules/.next ausgeschlossen) liefert
genau:
```
./src/app/globals.css
./src/components/Logo.tsx
./src/components/on-call-plan/OnCallPlanClient.tsx
./test/auftrag21-dark-variante.test.mjs
./tsconfig.tsbuildinfo
```
`OnCallPlanClient.tsx` und `tsconfig.tsbuildinfo` stammen aus dem
vorangegangenen AUFTRAG_20 (Referenzzeitpunkt der Zeitstempelprüfung) bzw.
sind Build-Cache — keine AUFTRAG_21-Datei. Keine weitere Datei im
Arbeitsbaum ist neuer.

## Alte und neue Variantendefinition (wörtlich)

**Alt** (vor der Änderung, Stand Kopie `/tmp/globals.css.vorher`):
```css
/* Dark-Mode-Variante an data-theme koppeln (zusätzlich zu prefers-color-scheme).
   Damit funktionieren künftige `dark:`-Utilities auch bei explizitem Theme. */
@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));
```

**Neu:**
```css
/* Dark-Mode-Variante an data-theme koppeln (zusätzlich zu prefers-color-scheme).
   Damit funktionieren künftige `dark:`-Utilities auch bei explizitem Theme.
   AUFTRAG_21 (Anforderung Dennis 2026-08-18, "Logo im Dark Mode weiß, sonst
   schwarz"): die Variante deckte bislang NUR das erste Zeilenpaar der
   Tabelle unten ab - das explizite Theme [data-theme="dark"] (Tokenblock
   Zeile ~116). Der zweite Dunkelfall "Themewahl System + dunkles
   Betriebssystem" lief ausschließlich über
   @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {…} }
   (Tokenblock Zeile ~169-171): dort greifen die Tokens (Fläche wird dunkel),
   aber `dark:`-Utilities feuerten dort nicht - das Logo blieb schwarz auf
   dunklem Grund. Der zweite Zweig unten bildet DIESEN Tokenblock
   deckungsgleich nach (identischer Selektor :root:not([data-theme="light"])
   innerhalb derselben @media-Bedingung): der Ausschluss von
   [data-theme="light"] ist zwingend, sonst würde ein ausdrücklich helles
   Theme auf einem dunklen Betriebssystem ein weißes Logo auf weißem Grund
   zeigen. Blockform mit @slot (Tailwind v4, package.json: "tailwindcss":
   "^4"), weil zwei getrennte Bedingungszweige (einer davon in einer
   @media-Klammer) kombiniert werden müssen - das ist mit der bisherigen
   einzeiligen Selektorliste nicht abbildbar. */
@custom-variant dark {
  &:where([data-theme="dark"], [data-theme="dark"] *) {
    @slot;
  }
  @media (prefers-color-scheme: dark) {
    &:where(:root:not([data-theme="light"]), :root:not([data-theme="light"]) *) {
      @slot;
    }
  }
}
```

## Diff gegen die Kopie in `/tmp` (Punkt 2 der DoD, wörtlich)

Kopie erstellt **vor** der Änderung unter `/tmp/globals.css.vorher`
(außerhalb des Vaults), Vergleich danach mit `diff -u`:

```diff
--- /tmp/globals.css.vorher	2026-08-18 12:52:38.171650517 +0200
+++ app/src/app/globals.css	2026-08-18 12:52:51.276399000 +0200
@@ -5,8 +5,34 @@
 @import "tw-animate-css";

 /* Dark-Mode-Variante an data-theme koppeln (zusätzlich zu prefers-color-scheme).
-   Damit funktionieren künftige `dark:`-Utilities auch bei explizitem Theme. */
-@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));
+   Damit funktionieren künftige `dark:`-Utilities auch bei explizitem Theme.
+   AUFTRAG_21 (Anforderung Dennis 2026-08-18, "Logo im Dark Mode weiß, sonst
+   schwarz"): die Variante deckte bislang NUR das erste Zeilenpaar der
+   Tabelle unten ab - das explizite Theme [data-theme="dark"] (Tokenblock
+   Zeile ~116). Der zweite Dunkelfall "Themewahl System + dunkles
+   Betriebssystem" lief ausschließlich über
+   @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {…} }
+   (Tokenblock Zeile ~169-171): dort greifen die Tokens (Fläche wird dunkel),
+   aber `dark:`-Utilities feuerten dort nicht - das Logo blieb schwarz auf
+   dunklem Grund. Der zweite Zweig unten bildet DIESEN Tokenblock
+   deckungsgleich nach (identischer Selektor :root:not([data-theme="light"])
+   innerhalb derselben @media-Bedingung): der Ausschluss von
+   [data-theme="light"] ist zwingend, sonst würde ein ausdrücklich helles
+   Theme auf einem dunklen Betriebssystem ein weißes Logo auf weißem Grund
+   zeigen. Blockform mit @slot (Tailwind v4, package.json: "tailwindcss":
+   "^4"), weil zwei getrennte Bedingungszweige (einer davon in einer
+   @media-Klammer) kombiniert werden müssen - das ist mit der bisherigen
+   einzeiligen Selektorliste nicht abbildbar. */
+@custom-variant dark {
+  &:where([data-theme="dark"], [data-theme="dark"] *) {
+    @slot;
+  }
+  @media (prefers-color-scheme: dark) {
+    &:where(:root:not([data-theme="light"]), :root:not([data-theme="light"]) *) {
+      @slot;
+    }
+  }
+}

 /* =====================================================================
    Designsystem – Tokens (AP8). Ein zentraler Satz für die gesamte App.
```

Der Diff zeigt ausschließlich die Variantendefinition samt Kommentar. Kein
Tokenwert (`--background`, `--surface`, `--brand`, `color-scheme`, `--qual-*`
usw.) ist Teil dieser Änderung. Der Diff gegen `HEAD`/`git diff` wäre hier
**kein** brauchbarer Umfangsnachweis, weil `globals.css` bereits fremde,
uncommittete Änderungen aus AUFTRAG 11–17 trägt (wie im Auftrag angemerkt) —
deshalb der Vergleich gegen die vor der Änderung erstellte `/tmp`-Kopie.

## Kompilier-Nachweis (Ersatz für den nicht möglichen Rendernachweis)

`npm run build` und ein Browser stehen hier nicht zur Verfügung. Um
wenigstens zu belegen, dass die neue `@custom-variant`-Syntax vom
tatsächlich installierten Tailwind (Version 4.3.3 laut
`node_modules/tailwindcss/package.json`, `package.json`: `"tailwindcss":
"^4"`) akzeptiert wird und die erwarteten Selektoren erzeugt, habe ich sie
mit dem echten PostCSS-Plugin `@tailwindcss/postcss` aus einem
Wegwerf-Skript unter `/tmp` kompiliert (keine Datei im Projektordner
geschrieben; `from`-Pfad zeigte auf einen fiktiven, nicht existierenden
Dateinamen innerhalb von `app/src/app/`, nur damit die Modulauflösung
`node_modules` findet). Eingabe: die neue Variante plus eine Testklasse
`.x { @apply dark:invert; }`. Ausgabe (Auszug):

```css
.x:where([data-theme="dark"], [data-theme="dark"] *) {
  --tw-invert: invert(100%);
  filter: var(--tw-blur,) var(--tw-brightness,) var(--tw-contrast,) var(--tw-grayscale,) var(--tw-hue-rotate,) var(--tw-invert,) var(--tw-saturate,) var(--tw-sepia,) var(--tw-drop-shadow,);
}
@media (prefers-color-scheme: dark) {
  .x:where(:root:not([data-theme="light"]), :root:not([data-theme="light"]) *) {
    --tw-invert: invert(100%);
    filter: var(--tw-blur,) var(--tw-brightness,) var(--tw-contrast,) var(--tw-grayscale,) var(--tw-hue-rotate,) var(--tw-invert,) var(--tw-saturate,) var(--tw-sepia,) var(--tw-drop-shadow,);
  }
}
```

Das ist genau das erwartete Ergebnis: zwei getrennte Regeln, eine für das
explizite Theme, eine (in der richtigen `@media`-Klammer) für die
Systempräferenz mit dem geforderten `:not([data-theme="light"])`-Ausschluss.
**Das ist ein Kompilier-, kein Darstellungsnachweis** — ob ein Browser den
`invert(100%)`-Filter tatsächlich weiß auf dem Logo zeichnet, ist damit
nicht belegt, nur dass die CSS-Regel mit korrektem Selektor entsteht.

## Messwerte

| Prüfung | Befehl (aus `app/`) | Ergebnis |
|---|---|---|
| Typprüfung | `npx tsc --noEmit` | Exit 0 |
| Unit-Tests (gesamt) | `node --test test/*.test.mjs` | 208 Tests (204 Bestand + 4 neu), **207 pass, 1 fail**, Exit 1 |
| Unit-Tests (nur neu) | `node --test test/auftrag21-dark-variante.test.mjs` | 4/4 pass, Exit 0 |
| Zeilenenden neue Testdatei | `grep -c $'\r' test/auftrag21-dark-variante.test.mjs` | 0 |
| Kompilier-Nachweis | `node` + `@tailwindcss/postcss` (isoliert, `/tmp`) | zwei erwartete Selektoren erzeugt, kein Fehler |

Der eine rote Test im Gesamtlauf ist **nicht** durch AUFTRAG_21 verursacht;
es ist der in `MELDUNG_20.md` bereits ausführlich dokumentierte,
vor-bestehende Befund aus AUFTRAG_20 (`auftrag18-dispo-zeitraum.test.mjs`,
Test „Bis vor Von und die 92-Tage-Obergrenze…", sucht wörtlich nach einem
inzwischen ersetzten String). Isoliert für AUFTRAG_21 ausgeführt
(`node --test test/auftrag21-dark-variante.test.mjs`) sind alle 4 neuen
Fälle grün, Exit 0.

## Ausdrücklicher Hinweis: Darstellung nicht prüfbar

Diese Umgebung hat **keinen Browser** und `npm run build` läuft wegen des
OneDrive-/FUSE-Mounts nicht. Ob das Logo in den vier Tabellenzeilen aus dem
Auftrag (Dunkel/beliebig, System/dunkel, System/hell, Hell/beliebig)
tatsächlich weiß bzw. schwarz erscheint, ist hier **nicht** geprüft und
**nicht** geprüft worden — nur die CSS-Syntax und -Struktur (statischer
Wächtertest plus Kompilier-Nachweis oben). Eine Sichtprüfung im Browser
steht noch aus.

## Erwarteter Nebeneffekt auf die 18 übrigen `dark:`-Utilities

Wie im Auftrag selbst vorweggenommen: die Reparatur der Variante wirkt nicht
nur auf die zwei `dark:invert`-Stellen (Logo), sondern auch auf die
restlichen 18 `dark:`-Utilities in den shadcn-Copy-ins (überwiegend Ring-/
Feldfarben, z. B. `dark:ring-destructive/40`, `dark:bg-input/30`). Diese
waren bislang unter „System = dunkel" ebenfalls unwirksam und werden durch
diese Änderung zusätzlich aktiv — das ist laut Auftrag gewollt, aber bei
einer künftigen Sichtprüfung unter „System = dunkel" als sichtbare
Veränderung zu erwarten (nicht nur am Logo). Ich habe diese 18 Stellen
selbst **nicht** angefasst (Negativliste).

## Negativliste eingehalten

Kein Tokenwert in `globals.css` geändert/ergänzt/entfernt (siehe Diff oben).
Keine zweite Logodatei, keine SVG-Änderung, kein `fill` am Logo. Die 18
übrigen `dark:`-Utilities unangetastet. `color-scheme` aus AUFTRAG_13
unverändert. Keine neue npm-Abhängigkeit, `package.json`/
`package-lock.json` unverändert. Keine anderen Testdateien geändert.
Kein `git commit`/`push`/`merge`/`tag`/`release`. Kein erfundener
Darstellungsnachweis — siehe Abschnitt oben.
