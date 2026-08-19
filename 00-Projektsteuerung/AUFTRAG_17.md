# AUFTRAG_17 — Dispo-Board: Doppelbelegungs-Hinweis, Soll-Besetzung, Markierung, Bugfix

> Erteilt vom Orchestrator/Review-Chat, 2026-08-18. Grundlage: **Entscheidungen Dennis vom
> 2026-08-18** (unten wörtlich) und der belegte Ist-Stand des Boards aus AUFTRAG_14.
> Block D aus `ANFORDERUNG_GUI_RUNDE_2.md` ist mit AUFTRAG_14 im Kern gebaut; dieser Auftrag
> ergänzt die von Dennis nachgeschobenen **Regeln** und behebt einen Bedienfehler.
> Die Mehrfach-Tageszuweisung („Dialog von–bis") ist **nicht** Teil dieses Auftrags, sondern
> Gegenstand von AUFTRAG_18.

## Entscheidungen Dennis vom 2026-08-18 (verbindlich)

Wörtlich: *„rechts die Monteure die Angelegt sind und dann per drag and drop auf die Bereiche
hinzuziehen — standart ist zwei monteure pro angelegtem Bauabschnitt und eine zeile für den
Disponenten zu planen, der kann auch unter dem Personal aufgeführt werden. es muss nur geprüft
werden, das ein monteur nicht mehrfach eingeplant ist und wenn doch einen hinweis und der
Disponent kann ja sagen und dann ist das auch OK. die Monteure können in der Liste makiert
werden müssen aber nicht verschwinden."*

Daraus abgeleitet, verbindlich:

1. **Soll-Besetzung: zwei Monteure je angelegtem Bauabschnitt und Tag.** „Standard", also ein
   **Sollwert mit Anzeige**, keine harte Grenze. Weder eine dritte Zuweisung noch eine
   Unterbesetzung wird blockiert.
2. **Doppelbelegungsprüfung:** derselbe Monteur darf am selben Kalendertag nicht unbemerkt
   mehrfach eingeplant werden (zweiter Bauabschnitt **oder** Bauabschnitt und Dispo-Zeile).
   Erkannt → **Hinweis mit Rückfrage**; bestätigt der Disponent, ist die Zuweisung
   **zulässig** und wird ausgeführt.
3. **Die Monteurliste rechts bleibt vollständig.** Bereits eingeplante Monteure werden
   **markiert**, aber **nicht entfernt, nicht ausgegraut und nicht unbedienbar**.
4. **Der Disponent wird aus derselben Personalliste geplant** wie die Bereitschaft — das ist
   im Bestand bereits so (die Dispo-Zeile nimmt eine `technician_id` aus derselben Liste) und
   bleibt unverändert.
5. **Keine Umbenennung.** Route `/bereitschaftsplan`, Menüpunkt und Seitentitel bleiben
   unverändert „Bereitschaftsplan". Dennis hat dazu keine Änderung verlangt.

## Ausgangslage (gemessen, Fundstellen)

- `app/src/components/on-call-plan/OnCallPlanClient.tsx` (582 Zeilen) trägt Wochenmatrix,
  Monatsansicht, Monteurliste, DnD und Klick-Ebene.
- Die Monteurliste (`:296–314`) filtert heute **nicht** — bereits verplante Monteure stehen
  schon jetzt weiter in der Liste. Es fehlt **nur** die Markierung. Punkt 3 ist damit zur
  Hälfte erfüllt; die bestehende Nicht-Filterung ist ausdrücklich **beizubehalten**.
- **Bug:** der „×"-Knopf in `AssignedChip` (`:137–146`) ruft `onRemove` **ohne**
  `ev.stopPropagation()`. Das Klickereignis blubbert auf das `<td onClick={…onCellClick}>`
  (`:437`). Ist gerade ein Monteur ausgewählt, entfernt ein Klick auf „×" die Zuweisung
  **und legt gleichzeitig eine neue an** (zwei `runAction`-Läufe). In der Monatsansicht ist es
  korrekt gelöst (`:547 ev.stopPropagation()`), in der Wochenmatrix fehlt es.
- Die Datenbank verhindert heute nur die exakte Dublette **je Bauabschnitt**: zwei partielle
  Unique-Indizes aus `0022_hlk_dispo_board.sql:243–254`. Derselbe Monteur in **zwei
  verschiedenen** Bauabschnitten am selben Tag ist zulässig — genau der Fall, der jetzt einen
  Hinweis bekommen soll. **Keine Migration:** die Regel muss überstimmbar sein, also gehört
  sie in die Oberfläche, nicht in einen Constraint.

## Positivliste (nur diese Pfade)

- `app/src/components/on-call-plan/OnCallPlanClient.tsx`
- `app/test/auftrag17-dispo-regeln.test.mjs` (**neu**)

Reicht das nicht aus — insbesondere falls für die Doppelbelegungsprüfung Daten fehlen, die
`app/src/lib/on-call-plan.ts` heute nicht liefert: **stoppen und melden**, nicht erweitern.

## Umzusetzen

**1. Bugfix (zuerst, unabhängig vom Rest).** In `AssignedChip` im `onClick` des „×"
`ev.stopPropagation()` aufrufen, genau wie in der Monatsansicht (`:547`). Der Testfall dazu
ist ein statischer Wächter: in `AssignedChip` muss `stopPropagation` vorkommen.

**2. Soll-Besetzung zwei je Bauabschnitt/Tag.**
- Eine benannte Konstante mit Kommentar (Herkunft: Entscheidung Dennis 2026-08-18), z. B.
  `const SOLL_BESETZUNG_BEREITSCHAFT = 2;`.
- In **jeder** Bereitschaftszelle der Wochenmatrix ist die Besetzung sichtbar, in der Form
  „1/2", „2/2", „3/2". Eine **unterbesetzte** Zelle (weniger als 2) ist erkennbar
  hervorgehoben, eine **überbesetzte** ebenfalls, aber sichtbar **anders** als ein Fehler —
  es ist keiner.
- Die **Dispo-Zeile hat keinen Sollwert** und bekommt keine Besetzungsanzeige.
- Nur Anzeige: **keine** Zuweisung wird wegen des Sollwerts verhindert.
- Umsetzung ausschließlich über die bestehenden AP8-Tokens; **keine** neuen Farbwerte, keine
  Hex-Literale, keine harten Tailwind-Farbklassen wie `bg-red-50`.

**3. Doppelbelegungs-Hinweis mit Rückfrage.**
- Vor dem Ausführen einer **Neuzuweisung** (DnD und Klick) und eines **Verschiebens** wird
  gegen die **bereits geladenen** Plandaten geprüft, ob derselbe `technician_id` am
  Zieldatum schon eingeplant ist — in einem anderen Bauabschnitt **oder** in der Dispo-Zeile.
- Trifft das zu: eine Rückfrage, die **konkret benennt**, wo die Person an diesem Tag schon
  steht (Name, Datum, betroffener Bauabschnitt bzw. „Dispo"). Kein anonymes „Wirklich?".
- Bestätigt der Nutzer → Zuweisung wird ausgeführt. Bricht er ab → **keine** Aktion, und der
  Zustand bleibt unverändert (insbesondere darf die Monteurauswahl nicht verloren gehen).
- Die Rückfrage ist bewusst eine **Hilfe, keine Garantie**: sie prüft gegen den geladenen
  Zeitraum. Steht die Person außerhalb der aktuell sichtbaren Woche bzw. des Monats oder legt
  ein zweiter Bearbeiter gleichzeitig etwas an, kann sie die Dublette nicht sehen. Diese
  Grenze ist im Quelltext als Kommentar festzuhalten und in `MELDUNG_17.md` zu benennen —
  **nicht** stillschweigend als vollständige Prüfung darstellen.
- Für die Rückfrage darf `window.confirm` verwendet werden, wenn kein Dialog-Baustein ohne
  Umbau nutzbar ist; unter `components/ui/shadcn/dialog.tsx` liegt einer — prüfen und die
  Wahl in `MELDUNG_17.md` begründen.

**4. Markierung in der Monteurliste.**
- Ein Monteur, der im **aktuell sichtbaren Zeitraum** mindestens einmal eingeplant ist, wird
  in der rechten Liste markiert: eine kleine, sachliche Kennzeichnung (z. B. Anzahl der Tage)
  zusätzlich zum Namen.
- Er bleibt **auswählbar, ziehbar und vollständig sichtbar**. Kein Ausgrauen, kein
  Herausfiltern, keine Änderung der Sortierung. Die Farbe aus der höchsten Qualifikation
  bleibt unverändert die Hintergrundfarbe.

**5. Wächtertest** `app/test/auftrag17-dispo-regeln.test.mjs` im Stil der bestehenden
`auftrag*`-Tests (Vorlage: `app/test/auftrag16-stammdaten-akkordeon.test.mjs`), statisch über
den Dateitext, mindestens:
- `AssignedChip` enthält `stopPropagation` (Regressionswächter für den Bug);
- die Soll-Konstante existiert und trägt den Wert **2**;
- die Doppelbelegungsprüfung wird in **beiden** Schreibpfaden erreicht (Neuzuweisung und
  Verschieben) und ihr Abbruchzweig führt zu **keinem** Aufruf der Server-Action;
- die Monteurliste enthält **keinen** Filter, der eingeplante Monteure entfernt (Wächter
  gegen ein späteres „verschwindet doch");
- keine harte Tailwind-Farbklasse (`bg-red-`, `text-red-`, `bg-green-`, `bg-yellow-`) in den
  **neu hinzugefügten** Stellen der Datei.

## Negativliste (ausdrücklich verboten)

- Migration oder SQL jeglicher Art, insbesondere ein Unique-Constraint gegen Doppelbelegung —
  die Regel ist ausdrücklich überstimmbar.
- `app/src/lib/on-call-plan.ts`, `on-call-plan-actions.ts`, `qualifications.ts`,
  `masterdata.ts`, `roles.ts`, `globals.css` ändern.
- Route, Menüpunkt oder Seitentitel umbenennen.
- Die Mehrfach-Tageszuweisung („von–bis"-Dialog) anfangen — AUFTRAG_18.
- Die Monatsansicht um DnD erweitern, die Tastaturbedienung der Zellen nachziehen, das
  Drag-Feedback oder den Busy-Zustand umbauen — alles AUFTRAG_18.
- Eingeplante Monteure aus der Liste filtern, ausgrauen oder umsortieren.
- Eine harte Grenze für die Besetzung einführen.
- Neue npm-Abhängigkeit, `package.json`/`package-lock.json`.
- `.claude/**`, `run-*.ps1`, `.github/workflows/**`, `app/supabase/**`.
- `git commit`, `push`, `merge`, `tag`, `release`.
- Erfundene Nachweise; `npm run build` und ESLint sind hier nicht ausführbar.

## Zeilenenden

Die neue Testdatei mit **LF** schreiben; `OnCallPlanClient.tsx` behält seine vorhandenen
Zeilenenden. Hintergrund: `BEFUND_CRLF_ARBEITSBAUM.md`.

## DoD (prüfbar)

1. Geändert/neu sind **genau** die zwei Dateien der Positivliste — nachzuweisen über
   Dateizeitstempel, **nicht** über `git status` (der Arbeitsbaum trägt 200+ fremde
   Änderungen aus AUFTRAG 11–16).
2. Aus `app/`: `npx tsc --noEmit` → **Exit 0**.
3. Aus `app/`: `node --test test/*.test.mjs` → die bisherigen **181** weiterhin grün plus die
   neuen Fälle, `fail 0`, **Exit 0**. Zahlen wörtlich melden.
4. `grep -c $'\r'` auf der neuen Testdatei → **0**.
5. `MELDUNG_17.md` nennt: die zwei Dateien, das umgesetzte Verhalten je Punkt 1–4, den
   Wortlaut des Hinweistextes der Rückfrage, die **ausdrückliche Benennung der Grenze** der
   Doppelbelegungsprüfung (nur geladener Zeitraum, keine Nebenläufigkeitsgarantie), die
   Begründung der Dialog-Wahl, die Messwerte mit Exit-Codes und die offenen Risiken.

## Stopppunkt

Anhalten und melden, wenn

- die Doppelbelegungsprüfung Daten braucht, die die geladenen Wochen-/Monatsstrukturen nicht
  enthalten (z. B. der Monteurname zu einer fremden Zuweisung fehlt);
- die Besetzungsanzeige die Wochenmatrix erkennbar sprengen würde (Zellenbreite) — dann den
  Platzbedarf melden, **nicht** das Layout umbauen;
- `tsc` nicht Exit 0 ergibt oder ein Bestandstest rot wird;
- derselbe Fehler dreimal in derselben Teilaufgabe auftritt.

## Meldeweg

`00-Projektsteuerung/MELDUNG_17.md`. Danach messt der Orchestrator/Review-Chat selbst nach und
schreibt `REVIEW_17.md`.
