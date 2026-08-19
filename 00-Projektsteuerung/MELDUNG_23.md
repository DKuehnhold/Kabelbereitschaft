# MELDUNG 23 vom Worker-Chat zu AUFTRAG_23

> Stand: 2026-08-18. Verfasst von Claude (Rolle Worker, Ausführungsagent),
> Antwort auf `00-Projektsteuerung/AUFTRAG_23.md`. Schriftliche Notiz, kein
> Chat-Kanal.

## Ergebnis in Kürze

Alle sechs verbindlichen Punkte (M1–M6, Erfolg/Fehler-Trennung, Token statt
hartem Rot, Drag-Feedback, Sperrzustand, Leerzustände, Chiphöhe) sind in
`OnCallPlanClient.tsx` umgesetzt. Kein Umbau der Tastaturbedienung der
Zielzellen, kein Verschieben in der Monatsansicht (beides AUFTRAG_24), keine
fachliche Regel aus AUFTRAG_17/18 verändert. Statischer Wächtertest mit 18
Fällen geschrieben. `tsc` Exit 0, alle Tests grün (226/226). Kein Stopppunkt
ausgelöst.

## Geänderte/neue Dateien (Positivliste, vollständig — genau zwei)

**Geändert (1):**

- `app/src/components/on-call-plan/OnCallPlanClient.tsx`

**Neu (1):**

- `app/test/auftrag23-dispo-bedienung.test.mjs`

Nachweis über Dateizeitstempel (nicht `git status`, wie vom Auftrag
verlangt):

```
$ find . -newer test/auftrag17-dispo-regeln.test.mjs -type f \
    -not -path "./node_modules/*" -not -path "./.next/*"
```

Von den ca. 100 zurückgemeldeten Pfaden gehören genau zwei zu meiner
Positivliste: `src/components/on-call-plan/OnCallPlanClient.tsx` und
`test/auftrag23-dispo-bedienung.test.mjs`. Die übrigen (u. a. `package.json`,
`src/lib/db/**`, `supabase/migrations/**`, weitere `test/*.test.mjs`) sind
fremde, bereits vor meiner Sitzung uncommittete Änderungen aus AUFTRAG 11–22
— von mir nicht angefasst, wie im Auftrag ausdrücklich vorgegeben ("Beurteile
deinen Umfang NUR über Dateizeitstempel", nicht über eine vollständige
Diff-Liste). Zusätzlich als reiner Compiler-Nebeneffekt: `tsconfig.tsbuildinfo`
(von `npx tsc --noEmit --incremental` automatisch aktualisiert, kein
selbstgeschriebener Inhalt).

`globals.css`, `primitives.tsx`, `on-call-plan-actions.ts`, `on-call-plan.ts`,
`qualifications.ts`, `roles.ts` wurden ausschließlich gelesen — keine
Änderung.

## Umgesetztes Verhalten je Auftragspunkt

### 1. Erfolg und Fehler getrennt (M1/M2)

- Der State `error: string | null` wurde durch
  `feedback: { kind: "success" | "error"; message: string } | null` ersetzt.
- `runAction` (Einzeltag-Zuweisung, Verschieben, Entfernen): jeder
  Fehlerpfad setzt weiterhin `kind: "error"` — unverändertes Verhalten,
  nur neu typisiert. Ein Erfolg dieser Aktionen zeigt weiterhin **keine**
  Meldung (wie vorher — dieser Auftrag fügt hier keine neue Erfolgsmeldung
  hinzu, das war nicht verlangt).
- `runRangeAction` (Zeitraum-Anlage, AUFTRAG_18): ein echter Erfolg
  (`createdCount > 0`) setzt jetzt `kind: "success"`; der Sonderfall „0 Tage
  eingeplant" (`createdCount === 0`) bleibt **inhaltlich unverändert**
  (derselbe Wortlaut wie in AUFTRAG_18), bekommt aber jetzt `kind: "error"`
  — er sieht also ausdrücklich **nicht** wie ein Erfolg aus, wie im Auftrag
  verlangt.
- Darstellung ausschließlich über vorhandene AP8-Utilities: eine
  `card`-Fläche mit einem `badge badge-success`- bzw. `badge
  badge-danger`-Chip davor (Wort „Erfolg"/„Fehler") und dem Meldungstext
  danach. Keine neue Farbe, kein Hex, kein `bg-red-*`/`text-red-*`/
  `bg-green-*` — geprüft durch Wächtertest 1 (datei-weit) sowie 2–5
  (Struktur/Reihenfolge in `runAction`/`runRangeAction`).
- Der `rangeDialogError`-Hinweis **innerhalb** des „von-bis"-Dialogs (AUFTRAG_18)
  nutzte bereits `badge badge-warning` und wurde nicht angefasst — er lag
  nicht in der Fundstellenliste des Auftrags.

### 2. `hover:text-red-600` → Token

Beide Fundstellen (`AssignedChip`-„×" und der „×" der Monatsansicht) nutzen
jetzt `hover:text-destructive`. `--destructive` ist ein bereits bestehender
AP8-Token (`globals.css`: `--destructive: var(--danger);`, in `@theme inline`
als `--color-destructive` für Tailwind-Utilities verfügbar gemacht, AUFTRAG_3)
und wird bereits in den shadcn-Copy-ins (`button.tsx`, `input.tsx`,
`select.tsx`, `textarea.tsx`, `toggle.tsx`) verwendet — keine neue Utility,
keine Änderung an `globals.css`. Reine Farbänderung, keine Funktionsänderung.
Wächtertest 18 zählt exakt zwei Vorkommen und schließt `hover:text-red-600`
datei-weit aus.

### 3. Drag-Feedback (M3)

- **Wochenmatrix:** jede Zielzelle (`renderCell` in `WeekMatrix`) trägt jetzt
  zusätzlich zum bestehenden `onDragOver` auch `onDragEnter` (setzt einen
  lokalen State `dragOverKey` auf den Zellenschlüssel) und `onDragLeave`
  (setzt ihn nur zurück, wenn er noch derselben Zelle entspricht — verhindert
  Race-Bugs beim Überfahren mehrerer Zellen). Die aktive Zelle bekommt
  `bg-surface-2 ring-2 ring-[var(--ring)]` — beides bestehende Tokens
  (`--surface-2`, `--ring`), keine neue Farbe. Der `onDrop`-Handler setzt
  `dragOverKey` **zuerst** auf `null`, bevor er den eigentlichen
  Drop-Handler (`onCellDrop(target)(e)`) aufruft — Rücksetzen ist also auch
  im Drop-Pfad garantiert, nicht nur bei `onDragLeave`.
- **Die beiden vorhandenen Ablegeflächen der Monteurliste** (die Chip-Liste
  selbst und der gestrichelte „Hierher ziehen zum Entfernen"-Bereich)
  bekamen ebenfalls `onDragEnter`/`onDragLeave` (State `dragOverZone: "list"
  | "trash" | null`) mit derselben Hervorhebung; `onRemoveZoneDrop` setzt
  `dragOverZone` beim Drop ebenfalls zurück.
- Kein neues Drop-Ziel eingeführt — exakt dieselben drei Ablageflächen wie
  vorher (Wochenmatrix-Zellen, Chip-Liste, Entfernen-Bereich), jetzt nur mit
  sichtbarem Zwischenzustand. Geprüft durch Wächtertest 10–12.
- **Monatsansicht:** kein Drag & Drop dort (unverändert seit AUFTRAG_14 — sie
  hat laut Kopfkommentar der Datei kein eindeutiges Drop-Ziel), also auch
  kein Drag-Feedback dort nötig oder verlangt.

### 4. Sperrzustand (M4)

- `onCellDrop` (Wochenmatrix): `if (!canEdit || busy) return;` steht jetzt
  als **erste** Zeile im Funktionskörper — vor jedem Auslesen der
  Drag-Nutzlast (`e.dataTransfer.getData(...)`). Fail-closed: während `busy`
  löst ein Drop keine Aktion mehr aus.
- `onCellClick` (Wochenmatrix): `if (!canEdit || busy || !selectedTechnician)
  return;` — ebenfalls vor dem Öffnen des Zuweisungsdialogs.
- `onRemoveZoneDrop`: dieselbe Regel (`if (!canEdit || busy) return;`) vor
  `handleRemove(...)`.
- `MonthGrid`-Tagesklick: dieselbe Bedingung ergänzt
  (`if (!canEdit || busy || !selectedTechnician) return;`), damit der
  Sperrzustand nicht nur in der Wochenmatrix gilt.
- Alle vier Stellen geprüft durch Wächtertest 6–9 (Reihenfolge: busy-Prüfung
  vor der jeweiligen Aktion, nicht nur ihr Vorkommen irgendwo im Funktionskörper).
- **Sichtbare Rückmeldung während busy** (zusätzlich zur harten Sperre, wie
  im Auftrag als Beispiel genannt): die Wochenmatrix-Tabelle bekommt
  `aria-busy` und `opacity: 0.6` auf dem `<table>`-Element sowie auf dem
  äußeren `overflow-x-auto`-Container; jede Zielzelle zeigt zusätzlich
  `cursor: not-allowed` statt `copy`, solange `busy` gilt. Die Monatsansicht
  bekommt `aria-busy` auf dem äußeren Container sowie dieselbe
  Opazitäts-/Cursor-Logik je Tageszelle. Diese CSS-Rückmeldung ist rein
  visuell und **nicht** Teil der eigentlichen fail-closed-Sperre (die sitzt
  im JS-Code, s. o.) — sie ist in dieser Sandbox ohne Browser nicht
  überprüfbar (siehe „Nicht prüfbare Darstellung" unten).
- Die Tabellenstruktur selbst (Spalten/Zeilen) ändert sich durch `busy`
  nicht — nur `opacity`/`cursor`, kein Umbruch.
- Die „×"-Buttons hatten bereits vor diesem Auftrag `disabled={busy}` (M4
  nennt das ausdrücklich als bereits ausreichend für Schaltflächen) — dort
  keine Änderung nötig.

### 5. Leerzustände (M5)

- Der Platzhalter „—" in leeren Wochenmatrix-Zellen ist jetzt an
  `entries.length === 0` gebunden, **ohne** das zusätzliche `&& canEdit` —
  erscheint also für Monteure (canEdit = false) genauso wie für Staff.
  Wächtertest 13 prüft explizit, dass die alte, an `canEdit` gebundene Form
  nicht mehr vorkommt.
- Die bestehende Zeile „Keine aktiven Bauabschnitte." (Woche, wenn
  `week.stages.length === 0`) ist **unverändert** — Wächtertest 14.
- Neu: `monthIsEmpty = month.entries.length === 0` in `MonthGrid` — zeigt,
  wenn im **gesamten** sichtbaren Monat keine einzige Zuweisung existiert,
  einen sachlichen Satz **oberhalb** des Kalenderrasters:
  - für Monteure (`canEdit === false`): „Für diesen Monat ist noch keine
    Bereitschaft eingeplant." (ohne Bedienaufforderung),
  - für Staff (`canEdit === true`): derselbe Satz plus ein kurzer
    Bedienhinweis („Monteur rechts auswählen, dann einen Tag antippen.").
  Reine Textzeile (`<p className="text-sm text-muted">`), keine neue
  Farbklasse. Wächtertest 15 prüft strukturell (nicht wortlautgebunden),
  dass zwei **unterschiedliche** Sätze abhängig von `canEdit` existieren.

### 6. Chiphöhe (M6)

**Gewählte Lösung:** Die feste `style={touchStyle}` (= `minHeight: "44px"`)
am „×"-Knopf in `AssignedChip` entfällt ersatzlos. Stattdessen trägt der
Knopf jetzt `px-2 py-4 -mx-2 -my-4` (Tailwind-Spacing-Utilities, keine neue
Farbe/kein neuer Token):

- **Innenabstand** `py-4`/`px-2` (16px oben/unten, 8px links/rechts)
  vergrößert die eigentliche Klick-/Tippfläche des `<button>`-Elements auf
  rechnerisch ca. 46 px Höhe (Textzeile `text-sm leading-none` ≈ 14 px +
  2×16 px Padding) — **über** der bisherigen 44-px-Marke, wie vom Auftrag
  verlangt ("darf nicht unter die bisherige Größe fallen").
- **Negativer Rand** `-my-4`/`-mx-2` in exakt derselben Größe hebt diesen
  zusätzlichen Platzbedarf im Fließlayout wieder auf: der Button nimmt im
  umgebenden `inline-flex`-Chip wieder nur so viel Raum ein wie vorher (der
  reine Textinhalt „×"), sodass die Zeilenhöhe der Matrix **nicht** mehr vom
  Button bestimmt wird.
- **Bewusster Kompromiss (nicht im Browser prüfbar, siehe unten):** die
  vergrößerte Trefferfläche ist durch den negativen Rand größer als ihr
  eigener sichtbarer Platz im Fließlayout — sie kann sich dadurch optisch
  mit benachbarten Elementen überlappen (z. B. mit einem in derselben Zelle
  darunter/danach umgebrochenen weiteren `AssignedChip`, da die Zelle
  mehrere Zuweisungen per `flex flex-wrap` nebeneinander/untereinander
  zeigt). Das ist die inhärente Eigenschaft dieser Technik (unsichtbare
  Trefferflächen-Erweiterung durch Padding + Gegen-Margin) und in der
  Literatur der übliche Weg, ein Touch-Ziel zu vergrößern, ohne die
  Fließlayout-Größe zu verändern — ohne Browser kann ich nicht verifizieren,
  ob die Überlappung in der dichten Matrix tatsächlich störend ausfällt.
  Das ist unten als offenes Risiko benannt.
- `touchStyle` selbst bleibt als Konstante **unverändert** in Gebrauch für
  die Schaltflächen (Buttons im `ViewSwitcher`, im „von-bis"-Dialog usw.) —
  Wächtertest 17 prüft, dass die Konstante weiterhin existiert und an
  mindestens einer Stelle verwendet wird.
- Der „×"-Knopf der Monatsansicht (Zeile ~999 vorher) hatte nie ein
  `minHeight`, ist von M6 also nicht betroffen — nur die Hover-Farbe wurde
  dort geändert (Punkt 2).

### Wächtertest (`app/test/auftrag23-dispo-bedienung.test.mjs`, 18 Fälle)

1. Keine harte Tailwind-Farbklasse (`bg-red-`/`text-red-`/`border-red-`/
   `bg-green-`/`bg-yellow-`) in der gesamten Datei.
2. Die Rückmeldung ist mit `"success" | "error"` typisiert.
3. `runAction` setzt im Fehlerfall `kind: "error"`, nirgends `kind: "success"`.
4. `runRangeAction`: der 0-Tage-Sonderfall führt zu `kind: "error"`, ein
   echter Erfolg zu `kind: "success"` — in dieser Reihenfolge im Quelltext.
5. `runRangeAction`: auch der `!result.ok`-Zweig setzt `kind: "error"`.
6. `onCellDrop`: busy-Sperre vor dem Auslesen der Drag-Nutzlast.
7. `onCellClick`: busy-Sperre vor `openAssignDialog`.
8. `onRemoveZoneDrop`: busy-Sperre vor `handleRemove`.
9. `MonthGrid`-Tagesklick prüft ebenfalls `busy`.
10. `WeekMatrix`-Zellen tragen `onDragEnter`/`onDragLeave` zusätzlich zu
    `onDragOver`.
11. Der Hervorhebungszustand wird im `onDrop`-Pfad zurückgesetzt.
12. Die beiden Ablageflächen der Monteurliste tragen ebenfalls
    `onDragEnter`/`onDragLeave`.
13. Der Leerzustand-Platzhalter der Wochenmatrix hängt nicht mehr von
    `canEdit` ab.
14. „Keine aktiven Bauabschnitte." bleibt unverändert.
15. Der Monats-Leerzustand unterscheidet strukturell zwischen Monteur und
    Staff (zwei unterschiedliche Sätze).
16. `AssignedChip` enthält kein `minHeight: "44px"`/`style={touchStyle}`
    mehr, aber weiterhin `stopPropagation`.
17. `touchStyle` bleibt als Konstante in Gebrauch.
18. Beide „×"-Knöpfe nutzen `hover:text-destructive`, `hover:text-red-600`
    kommt nicht mehr vor.

Ausdrücklich ein statischer Wächter (Textprüfung/Strukturprüfung des
Dateiinhalts über Indizes/Regex, keine wörtliche Zeichenkettenprüfung von
Auftragswortlaut), kein Verhaltensnachweis — kein Render/JSDOM in dieser
Sandbox vorgesehen, analog zu `auftrag17-dispo-regeln.test.mjs`.

## Prüfergebnisse (tatsächlich erhoben, aus `app/`)

- `npx tsc --noEmit`: **Exit 0**, keine Diagnosezeilen (zweimal geprüft: vor
  und nach dem Anlegen des Wächtertests).
- `node --test test/*.test.mjs`: **Exit 0, 226 Einträge, 226 pass, 0 fail, 0
  skipped, 0 cancelled.** Baseline **208** → neu **226** (+18, alle 18 in
  `auftrag23-dispo-bedienung.test.mjs`; kein bestehender Testfall verändert,
  entfernt oder rot geworden).
- `grep -c $'\r'` auf der neuen Testdatei `auftrag23-dispo-bedienung.test.mjs`:
  **0**.
- `grep -nE "bg-red-|text-red-|border-red-|bg-green-|bg-yellow-"` auf
  `OnCallPlanClient.tsx`: **keine Treffer** (Exit-Code des grep-Aufrufs: 1 =
  kein Match, wie erwartet). Ein erster Lauf des Wächtertests fand noch
  einen Treffer — in einem **eigenen Kommentar**, der die verbotenen
  Klassennamen zur Erklärung wörtlich zitierte (nicht im tatsächlichen
  Markup). Kommentar umformuliert, danach 0 Treffer — kein Produktivcode
  betroffen, siehe „Geprüfte Stopppunkt-Kriterien" unten.
- `npm run build`, ESLint, ein Browser: **nicht ausgeführt** (laut Auftrag in
  dieser Umgebung nicht verfügbar) — keine Behauptung dazu.

## Nicht prüfbare Darstellung (ausdrücklich offen)

Diese Sandbox hat keinen Browser und keinen `npm run build`/ESLint-Zugriff.
Folgende Punkte sind **nicht** visuell verifiziert und daher nur als
Quelltext-Absicht, nicht als bestätigtes Rendering zu verstehen:

- Ob die Drag-Hervorhebung (`bg-surface-2 ring-2 ring-[var(--ring)]`) auf
  `<td>`-Elementen in einer `border-collapse`-Tabelle tatsächlich wie
  erwartet als Ring erscheint (Box-Shadow-Ringe können an Tabellenzellen mit
  `border-collapse` browserabhängig abweichend gerendert werden).
- Ob die vergrößerte, aber durch negativen Rand "unsichtbar" gemachte
  Trefferfläche des „×"-Knopfs (Punkt 6) in der dichten Wochenmatrix
  tatsächlich mit benachbarten Chips/Zellen überlappt und ob das in der
  Praxis störend auffällt.
- Ob `opacity`/`cursor: not-allowed` während `busy` im Zusammenspiel mit dem
  bestehenden `fade-in`/Übergangs-CSS (`globals.css`, AUFTRAG-übergreifend)
  ruckelfrei wirkt.
- Kontrast/Lesbarkeit von `badge-success`/`badge-danger` im neuen
  Feedback-Kasten in beiden Farbschemata (hell/dunkel) — die Tokens sind
  dieselben wie bereits in AUFTRAG_17 für die Besetzungsanzeige verwendet
  und dort unbeanstandet, aber nicht erneut visuell nachgeprüft.

## Geprüfte Stopppunkt-Kriterien (alle unauffällig, kein Stopp ausgelöst)

- **Eine der sechs Änderungen ohne Eingriff in `globals.css`/eine
  Copy-in-Komponente nicht möglich:** Für Punkt 2 (Hover-Token) wurde
  geprüft, ob ein passendes Token bereits existiert, **bevor** eine neue
  Utility gefordert worden wäre — `--destructive`/`--color-destructive` war
  bereits vorhanden und wird bereits in den shadcn-Copy-ins verwendet, also
  **kein Stopp** nötig. Für Punkt 3 (Drag-Feedback) und Punkt 6
  (Trefferfläche) reichten bestehende Tokens (`--surface-2`, `--ring`) bzw.
  Standard-Tailwind-Spacing-Utilities — ebenfalls **kein Stopp**.
- **Bestandswächter rot geworden:** Nein — alle 208 vorherigen Tests bleiben
  grün (siehe Prüfergebnisse).
- **`tsc` nicht Exit 0:** Trat nicht auf — beide Läufe Exit 0.
- **Derselbe Fehler dreimal in derselben Teilaufgabe:** Ein einziger
  Wächtertest-Fehlschlag trat auf (Testlauf 1: mein eigener erklärender
  Kommentar zitierte die verbotenen Klassennamen wörtlich und ließ
  Wächtertest 1 fehlschlagen). Nach Umformulierung des Kommentars (kein
  Produktivverhalten geändert) lief der zweite Testlauf durch. Kein Fehler
  trat dreimal auf — **kein Stopp**.

## Offene Risiken

1. **Überlappungsrisiko der vergrößerten „×"-Trefferfläche (Punkt 6),
   optisch nicht verifiziert** — siehe Abschnitt „Nicht prüfbare
   Darstellung" oben. Sollte sich in der Praxis eine störende Überlappung
   zeigen, wäre die Padding-/Margin-Größe (aktuell `py-4`/`-my-4`, 16 px) der
   naheliegende Stellhebel, ggf. auf ein kleineres Maß mit noch
   ausreichender Trefferfläche (≥ 44 px) zu justieren.
2. **`box-shadow`/`ring`-Hervorhebung auf `<td>` in einer
   `border-collapse`-Tabelle** ist browserabhängig nicht immer identisch mit
   der Darstellung auf gewöhnlichen Block-Elementen — nicht geprüft.
3. **Kein Erfolgsfeedback für Einzeltag-Zuweisung/Verschieben/Entfernen.**
   Punkt 1 des Auftrags verlangte ausdrücklich nur, dass die **Zeitraum-Anlage**
   ihren Erfolg von einem Fehler unterscheidbar zeigt — für die übrigen
   `runAction`-Pfade wurde bewusst **keine** neue Erfolgsmeldung ergänzt
   (das wäre über den Auftrag hinausgegangen und hätte das Verhalten
   verändert, das AUFTRAG_17 bereits festgelegt hat: dort erfolgt bei Erfolg
   nur ein stiller `router.refresh()`).
4. **Vorbestehender, weit gestreuter uncommitteter Arbeitsbaum** (AUFTRAG
   11–22, u. a. `package.json`, `supabase/migrations/**`) — wie in
   `MELDUNG_17.md`/`MELDUNG_18.md` bereits dokumentiert, unverändert
   vorhanden, von mir nicht angefasst und nicht Teil meiner Positivliste.
5. **`tsconfig.tsbuildinfo`** wurde vom `tsc`-Lauf automatisch aktualisiert
   (Standard-Nebeneffekt von `--incremental`, kein selbstgeschriebener
   Inhalt, nicht Teil der Positivliste).

## Statuspflege

`.claude/automation/status/fortschritt.json` liegt unter der Negativliste
(kein `.claude/**`) und wurde deshalb **nicht** geändert — dieselbe Abwägung
wie in `MELDUNG_17.md`.

## Stopppunkt

**Kein Stopppunkt ausgelöst.** Im Einzelnen begründet siehe Abschnitt
„Geprüfte Stopppunkt-Kriterien" oben.

**Kein `git commit`, `push`, `merge`, `tag`, `rebase`, `reset`, `stash`.**
Nur lesende `git`-Befehle wären zulässig gewesen; für diese Meldung wurden
ausschließlich Dateizeitstempel (`find -newer`) als Umfangsnachweis
verwendet, wie vom Auftrag verlangt.
