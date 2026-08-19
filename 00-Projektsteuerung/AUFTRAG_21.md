# AUFTRAG_21 — Logo im Dark Mode weiß, sonst schwarz (Ursache: kaputte `dark:`-Variante)

> Erteilt vom Orchestrator/Review-Chat, 2026-08-18. Grundlage: **Anforderung Dennis vom
> 2026-08-18**: *„noch bitte das Logo invertieren in weis — wenn dunkel dann weißes Logo, sonst
> schwarzes Logo."*

## Befund (selbst nachgemessen — die Absicht ist da, die Umsetzung greift nur halb)

`app/src/components/Logo.tsx:25` trägt bereits `dark:invert`, mit passendem Kommentar
(AUFTRAG_12). Gewollt ist also genau, was Dennis verlangt. Es wirkt aber **nur in einem von
zwei Dunkelfällen**:

`app/src/app/globals.css:9` definiert die Tailwind-Dunkelvariante neu:

```css
@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));
```

Damit greift `dark:…` **ausschließlich**, wenn das Attribut `data-theme="dark"` gesetzt ist —
also nur, wenn im Umschalter ausdrücklich „Dunkel" gewählt wurde. Der zweite Dunkelfall der App
läuft anders: bei Themewahl **„System"** und dunklem Betriebssystem setzt niemand
`data-theme`; die Farben kommen dann aus dem Block

```css
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { … } }
```

(`globals.css:169–171`). In diesem Fall wird die Oberfläche dunkel, die Variante `dark:` bleibt
aber **inaktiv** — das Logo bleibt schwarz auf dunklem Grund. Dasselbe Muster hatte AUFTRAG_13
schon einmal an anderer Stelle getroffen (fehlendes `color-scheme`).

**Blastradius, gezählt:** in `app/src/` gibt es insgesamt **20** `dark:`-Utilities in **8**
Dateien — zweimal `dark:invert` (Logo) und 18 weitere, überwiegend Ring-/Feldfarben in den
shadcn-Copy-ins (`dark:ring-destructive/40`, `dark:bg-input/30`, …). Alle 18 sind heute unter
„System = dunkel" ebenfalls unwirksam. Die Reparatur der Variante behebt also nicht nur das
Logo, sondern richtet auch diese 18 Stellen ein — was gewollt ist, aber unter „System = dunkel"
eine sichtbare Veränderung bedeutet. **Das ist bei der Sichtprüfung zu beachten.**

## Ziel

Das Logo ist in **allen** dunklen Zuständen weiß und in allen hellen schwarz:

| Themewahl | Betriebssystem | Erwartung |
| --- | --- | --- |
| Dunkel | beliebig | weißes Logo |
| System | dunkel | **weißes Logo** (heute schwarz — der Fehler) |
| System | hell | schwarzes Logo |
| Hell | beliebig | schwarzes Logo (auch bei dunklem Betriebssystem) |

## Positivliste (nur diese Pfade)

- `app/src/app/globals.css` — **ausschließlich** die `@custom-variant dark`-Definition in
  Zeile 9 samt zugehörigem Kommentar. **Kein** Tokenwert, **keine** Farbe, **keine** andere
  Regel dieser Datei wird angefasst.
- `app/src/components/Logo.tsx` — nur, falls der Kommentar nachzuziehen ist. Die Klasse
  `dark:invert` bleibt.
- `app/test/auftrag21-dark-variante.test.mjs` (**neu**)

## Umzusetzen

1. Die Variante so erweitern, dass sie **beide** Dunkelfälle abdeckt: das ausdrückliche
   `[data-theme="dark"]` **und** `prefers-color-scheme: dark` in Verbindung mit
   `:root:not([data-theme="light"])`. Der Ausschluss von `[data-theme="light"]` ist zwingend —
   sonst würde eine ausdrücklich helle Seite auf einem dunklen Betriebssystem ein weißes Logo
   auf weißem Grund zeigen (Zeile 4 der Tabelle oben). Die Selektoren müssen zu den beiden
   bereits bestehenden Token-Blöcken (`globals.css:116` und `:169–171`) **deckungsgleich**
   sein; sie sind die Referenz, nicht eine neue Erfindung.
2. Tailwind v4 erlaubt für `@custom-variant` die Blockform mit `@slot`. Die gewählte
   Formulierung ist im Kommentar zu begründen, mit Verweis auf die beiden Token-Blöcke und auf
   die Herkunft (AUFTRAG_21, Anforderung Dennis 2026-08-18).
3. Ein Wächtertest `app/test/auftrag21-dark-variante.test.mjs` prüft statisch über den Text von
   `globals.css`:
   - die `dark`-Variante nennt `[data-theme="dark"]` **und** `prefers-color-scheme: dark`;
   - sie enthält den Ausschluss `:not([data-theme="light"])`;
   - `Logo.tsx` trägt weiterhin `dark:invert`;
   - die drei bestehenden Farb-Blöcke sind unverändert vorhanden (Wächter dagegen, dass beim
     Nachziehen der Variante versehentlich ein Tokenblock verändert wird): `:root`,
     `[data-theme="dark"]` und der `@media (prefers-color-scheme: dark)`-Block existieren
     weiterhin je genau einmal.

## Negativliste (ausdrücklich verboten)

- Jeden **Tokenwert** in `globals.css` ändern, ergänzen oder entfernen; jede andere Regel dieser
  Datei anfassen. Der Eingriff beschränkt sich auf die Variantendefinition.
- Eine zweite Logodatei anlegen, die SVG-Datei unter `app/public/branding/` ändern oder dem
  Logo eine Farbe/`fill` verpassen.
- Die 18 übrigen `dark:`-Utilities in den shadcn-Copy-ins anpassen, „aufräumen" oder ihre
  Wirkung vorwegnehmen — sie sollen durch die Reparatur einfach wirksam werden.
- `color-scheme` aus AUFTRAG_13 anfassen.
- Eine neue npm-Abhängigkeit, `package.json`/`package-lock.json`.
- `.claude/**`, `run-*.ps1`, `app/supabase/**`, jede andere Testdatei.
- `git commit`, `push`, `merge`, `tag`, `release`.
- Erfundene Nachweise: `npm run build` läuft hier nicht, ein Browser steht nicht zur Verfügung.
  **Die tatsächliche Darstellung ist in dieser Umgebung nicht prüfbar** — das ist in
  `MELDUNG_21.md` ausdrücklich zu sagen.

## Zeilenenden

Neue Testdatei mit **LF**. `globals.css` behält seine Zeilenenden (siehe
`BEFUND_CRLF_ARBEITSBAUM.md` — die Datei ist dort bereits als CRLF-betroffen gelistet, das ist
**nicht** hier zu reparieren).

## DoD (prüfbar)

1. Geändert/neu sind **genau** die Dateien der Positivliste (Nachweis über Dateizeitstempel).
2. `git diff -- app/src/app/globals.css` zeigt Änderungen **nur** an der Variantendefinition und
   ihrem Kommentar — die Ausgabe ist in `MELDUNG_21.md` wörtlich einzufügen, damit nachprüfbar
   ist, dass kein Tokenwert berührt wurde. Achtung: die Datei trägt bereits fremde,
   uncommittete Änderungen aus AUFTRAG 11–17; der Diff gegen HEAD ist deshalb **kein**
   Umfangsnachweis. Verwende stattdessen einen Vergleich gegen eine vor der Änderung erstellte
   Kopie im **Temp-Verzeichnis außerhalb des Vaults** (`/tmp`), nicht im Projektordner.
3. Aus `app/`: `npx tsc --noEmit` → **Exit 0**.
4. Aus `app/`: `node --test test/*.test.mjs` → die bisherigen **204** weiterhin grün plus die
   neuen Fälle, `fail 0`, **Exit 0**.
5. `grep -c $'\r'` auf der neuen Testdatei → **0**.
6. `MELDUNG_21.md` nennt: die Dateien, die alte und die neue Variantendefinition wörtlich, den
   Diff aus Punkt 2, die Messwerte mit Exit-Codes, den ausdrücklichen Hinweis auf die
   **nicht** prüfbare Darstellung und den erwarteten Nebeneffekt auf die 18 weiteren
   `dark:`-Utilities.

## Stopppunkt

Anhalten und melden, wenn

- die Blockform von `@custom-variant` in der installierten Tailwind-Fassung nicht verfügbar ist
  (dann die Tailwind-Version aus `package.json` melden, **keine** Abhängigkeit ändern);
- die Reparatur ohne Änderung an einem Tokenblock nicht möglich wäre;
- `tsc` nicht Exit 0 ergibt oder ein Bestandstest rot wird;
- derselbe Fehler dreimal in derselben Teilaufgabe auftritt.

## Meldeweg

`00-Projektsteuerung/MELDUNG_21.md`.
