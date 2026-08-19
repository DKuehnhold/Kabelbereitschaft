# MELDUNG 17 vom Worker-Chat zu AUFTRAG_17

> Stand: 2026-08-18. Verfasst von Claude (Rolle Worker, Ausführungsagent),
> Antwort auf `00-Projektsteuerung/AUFTRAG_17.md`. Schriftliche Notiz, kein
> Chat-Kanal.

## Ergebnis in Kürze

Alle vier Regeln aus Dennis' Entscheidungen vom 2026-08-18 sind in
`OnCallPlanClient.tsx` umgesetzt, dazu der Bugfix im „×"-Knopf der
Wochenmatrix. Kein Umbau der Monatsansicht, kein DnD dort, keine
Mehrfach-Tageszuweisung, keine Migration, keine harte Grenze — wie in der
Negativliste gefordert. Statischer Wächtertest mit 11 Fällen geschrieben.
`tsc` und alle Unit-Tests laufen grün (192/192). Kein Stopppunkt ausgelöst.

## Geänderte/neue Dateien (Positivliste, vollständig — genau zwei)

**Geändert (1):**

- `app/src/components/on-call-plan/OnCallPlanClient.tsx`

**Neu (1):**

- `app/test/auftrag17-dispo-regeln.test.mjs`

Nachweis über `git status --porcelain`, beschränkt auf diese zwei Pfade:

```
 M app/src/components/on-call-plan/OnCallPlanClient.tsx
?? app/test/auftrag17-dispo-regeln.test.mjs
```

Keine weitere Datei wurde von mir erzeugt oder geändert. `app/src/lib/on-call-plan.ts`,
`on-call-plan-actions.ts`, `qualifications.ts`, `masterdata.ts`, `roles.ts`,
`globals.css` erscheinen **nicht** in meinem Diff — laut Auftrag ausschließlich
gelesen, nicht angefasst. Der Arbeitsbaum trägt daneben 200+ fremde
Änderungen aus AUFTRAG 11–16 (u. a. `.claude/**`, `app/supabase/**`), die ich
nicht erzeugt und nicht angefasst habe; mein eigener Umfang wird ausschließlich
über die zwei oben genannten Dateien beurteilt (Dateizeitstempel via
`find . -newer <Referenzdatei>`, siehe unten).

## Umgesetztes Verhalten je Auftragspunkt

### 1. Bugfix (zuerst, unabhängig vom Rest)

In `AssignedChip` (Wochenmatrix) ruft der „×"-Knopf jetzt
`ev.stopPropagation()` **vor** `onRemove(entry.id)` auf — exakt wie in
`MonthGrid` (Zeile ~694, unverändert). Ohne den Fix blubberte der Klick auf
das umschließende `<td onClick={onCellClick}>` hoch: war gerade ein Monteur
ausgewählt, entfernte „×" die Zuweisung **und** legte im selben Klick eine
neue an (zwei `runAction`-Läufe). Wächtertest 1 sichert `stopPropagation`
innerhalb der Funktionsgrenzen von `AssignedChip` als Regressionswächter.

### 2. Soll-Besetzung zwei je Bauabschnitt/Tag

- Neue benannte Konstante `const SOLL_BESETZUNG_BEREITSCHAFT = 2;` mit
  Kommentar (Herkunft: Entscheidung Dennis 2026-08-18, wörtliches Zitat im
  Quelltext).
- Jede Bereitschaftszelle der Wochenmatrix (nicht die Dispo-Zeile) zeigt
  jetzt `{entries.length}/{SOLL_BESETZUNG_BEREITSCHAFT}` als Badge, z. B.
  „1/2", „2/2", „3/2".
- Farbliche Hervorhebung ausschließlich über die bestehenden AP8-Badge-
  Utilities aus `globals.css` (`.badge`, `.badge-success`, `.badge-warning`,
  `.badge-info` — alle drei bereits vorhanden, nutzen `--success`/`--warning`/
  `--info`-Tokens): genau `2` → `badge-success`; weniger als `2`
  (Unterbesetzung) → `badge-warning`; mehr als `2` (Überbesetzung) →
  bewusst `badge-info` statt `badge-warning`/`badge-danger`, damit sie
  sichtbar **anders** aussieht als ein Fehler (kein Rot, keine
  Warnfarbe) — sie ist ja laut Auftrag ausdrücklich kein Fehler.
- Reine Anzeige: keine Zuweisung wird durch den Sollwert verhindert (weder
  eine dritte Zuweisung noch eine Unterbesetzung blockiert das Speichern).
- Keine neuen Farbwerte, kein Hex, keine harte Tailwind-Farbklasse — geprüft
  durch Wächtertest 11.

### 3. Doppelbelegungs-Hinweis mit Rückfrage

- Vor **jeder** Neuzuweisung (DnD-Drop, Klick-Ebene Woche, Klick-Ebene
  Monat) **und** jedem Verschieben prüft `findConflictingEntry(...)` gegen
  die bereits geladenen Plandaten (`week.entries` bzw. `month.entries`, je
  nach aktiver Ansicht), ob derselbe `technician_id` am Zieldatum bereits in
  einem **anderen** Bauabschnitt oder in der **Dispo-Zeile** eingeplant ist.
  Der Prüfpunkt sitzt an einer einzigen Stelle in
  `handleDropOrClickAssign` — **vor** der Verzweigung in die zwei
  Schreibpfade (`moveOnCallEntry` bzw. `assignOnCall`/`assignDispo`), sodass
  beide Pfade erreicht werden.
- Trifft ein Konflikt zu, erscheint eine Rückfrage per `window.confirm` mit
  **wörtlich**:

  > `"<Name des Monteurs> ist am <TT.MM.JJJJ> bereits eingeplant (<Ort>). Trotzdem zusätzlich hier einplanen?"`

  `<Ort>` ist entweder der Bauabschnittsname (`code – name`, oder nur `name`
  ohne Code) oder das Wort „Dispo" — konkret benannt, kein anonymes
  „Wirklich?".
- Bestätigt der Disponent → die Zuweisung/Verschiebung wird ausgeführt.
  Bricht er ab → `if (!confirmed) return;` verlässt die Funktion, **bevor**
  einer der beiden `runAction(...)`-Aufrufe erreicht wird — keine Aktion,
  kein Serveraufruf, die Monteurauswahl (`selectedTechnician`) bleibt
  unverändert (sie wird nur in `runAction` bei Erfolg gelöscht).
- **Grenze der Prüfung (ausdrücklich, wie im Auftrag verlangt):** Die Prüfung
  arbeitet ausschließlich mit den bereits geladenen Daten der sichtbaren
  Woche bzw. des sichtbaren Monats. Steht die Person an einem Tag
  **außerhalb** des aktuell sichtbaren Zeitraums bereits im Plan, sieht die
  Prüfung das nicht. Legt ein **zweiter Bearbeiter gleichzeitig** in einer
  anderen Sitzung etwas an, sieht diese Prüfung die neue Fremdzuweisung
  ebenfalls nicht — es gibt kein Locking, keinen Realtime-Abgleich. Das ist
  eine **Hilfe, keine Garantie**, im Quelltext direkt oberhalb von
  `findConflictingEntry` als Kommentar festgehalten. Der Datenbank-Unique-
  Index aus `0022_hlk_dispo_board.sql` verhindert weiterhin nur die exakte
  Dublette je Bauabschnitt — unverändert, keine Migration angefasst.
- **Dialog-Wahl begründet:** `window.confirm` statt des vorhandenen
  Radix-Dialogs (`components/ui/shadcn/dialog.tsx`). Der Dialog-Baustein ist
  ein **kontrolliertes** Overlay (offen/geschlossen als State, Bestätigung
  über einen Button-Klick, also asynchron/mehrstufig). Die drei Aufrufstellen
  von `handleDropOrClickAssign` — DnD-Drop (`onCellDrop`), Klick-Ebene Woche
  (`onCellClick`) und die Bestätigung im Monats-Prompt
  (`onConfirmPrompt`) — sind heute durchgehend **synchrone** Handler, die in
  derselben Funktion sofort zu Ende laufen. Ein Radix-Dialog hätte bedeutet,
  jeden dieser drei Call-Sites in einen zweistufigen Zustand (ausstehende
  Zuweisung merken, Dialog öffnen, bei Bestätigung fortsetzen) umzubauen —
  das betrifft laut Negativliste ausdrücklich als „Umbau" markierte Bereiche
  (u. a. den Monats-Prompt-Ablauf) und wäre kein reines Ergänzen ohne Umbau.
  `window.confirm` liefert stattdessen synchron einen Boolean, passt ohne
  Strukturänderung in alle drei bestehenden synchronen Handler und bleibt
  auf die Positivliste beschränkt (eine Datei). Nachteil (bewusst in Kauf
  genommen): kein AP8-Styling der Rückfrage selbst — das native
  Browser-Fenster ist optisch nicht anpassbar. Das ist der einzige optische
  Kompromiss dieses Auftrags.

### 4. Markierung in der Monteurliste

- Jeder Monteur, der im aktuell sichtbaren Zeitraum (Woche bzw. Monat)
  mindestens einen Kalendertag eingeplant ist, bekommt neben dem Namen ein
  kleines Badge mit der Anzahl der Tage (`daysByTechnician`, zählt
  **verschiedene** `plan_date`-Werte je Monteur — Dispo und Bereitschaft am
  selben Tag zählen als ein Tag, nicht doppelt).
- Die Liste `technicians.map(...)` selbst ist **unverändert** — kein
  `.filter(...)`, kein Ausgrauen, keine Änderung der Sortierung, keine
  Änderung der Erreichbarkeit (weiterhin `draggable`, `onClick`,
  `onKeyDown`). Die Hintergrundfarbe aus der höchsten Qualifikation
  (`qualificationColorVars`) bleibt unverändert die einzige
  Hintergrundfarbe des Chips; das Markierungs-Badge ist ein zusätzliches
  Element daneben, keine Farbänderung des Chips selbst.
- Wächtertest 9 sichert explizit, dass kein `technicians.filter(...)`
  existiert (Regressionswächter gegen ein späteres „verschwindet doch").

### 5. Wächtertest (`app/test/auftrag17-dispo-regeln.test.mjs`, 11 Fälle)

1. `AssignedChip` enthält `stopPropagation`.
2. `SOLL_BESETZUNG_BEREITSCHAFT` existiert mit Wert `2`.
3. Besetzungsanzeige `n/Soll` ist an `target.kind === "bereitschaft"`
   gebunden (Dispo-Zeile bekommt keine Anzeige).
4. Doppelbelegungsprüfung wird in beiden Schreibpfaden erreicht — Reihenfolge
   Prüfung → Rückfrage → Abbruchzweig → **danach erst** die Verzweigung in
   Verschieben/Neuzuweisung.
5. Der Abbruchzweig (`if (!confirmed) return;`) führt zu keinem
   `runAction`-Aufruf im `if (conflict)`-Block.
6. Die Rückfrage referenziert Name, Datum und Ort im Quelltext.
7. `describeLocation` liefert „Dispo" für `assignment_kind === "dispo"`.
8. Die Grenze der Prüfung („GELADENEN Plandaten", „Hilfe, KEINE Garantie")
   steht als Kommentar im Quelltext.
9. Kein `technicians.filter(...)` vorhanden.
10. `assignedDaysCount` wird korrekt an `TechnicianChip` durchgereicht.
11. Keine harte Tailwind-Farbklasse (`bg-red-`, `text-red-`, `bg-green-`,
    `bg-yellow-`) in `occupancyBadgeClass` und im Markierungs-Badge.

Ausdrücklich ein statischer Wächter (Textprüfung des Dateiinhalts), kein
Verhaltensnachweis (kein Render/JSDOM in dieser Sandbox vorgesehen — analog
zu `auftrag16-stammdaten-akkordeon.test.mjs`).

## Prüfergebnisse (tatsächlich erhoben, aus `app/`)

- `npx tsc --noEmit`: **Exit 0**, keine Diagnosezeilen.
- `node --test test/*.test.mjs`: **Exit 0, 192 Einträge, 192 pass, 0 fail, 0
  skipped, 0 cancelled.** Baseline **181** → neu **192** (+11, alle elf in
  `auftrag17-dispo-regeln.test.mjs`; kein bestehender Testfall verändert
  oder entfernt).
- `grep -c $'\r'` auf der neuen Testdatei `auftrag17-dispo-regeln.test.mjs`:
  **0**.
- `npm run build` und ESLint: **nicht ausgeführt** (laut Auftrag in dieser
  Umgebung nicht möglich, OneDrive-/FUSE-Mount) — keine Behauptung dazu.
- Kein PostgreSQL verfügbar — keine Datenbanknachweise erhoben oder behauptet
  (dieser Auftrag ändert ohnehin keine SQL/Migrationen, siehe Negativliste).

## Geprüfte Stopppunkt-Kriterien (alle unauffällig, kein Stopp ausgelöst)

- **Fehlende Daten für die Doppelbelegungsprüfung:** geprüft gegen
  `app/src/lib/on-call-plan.ts` (nur gelesen). `OnCallPlanEntry` trägt
  bereits `technician_id`, `technician_name`, `plan_date`,
  `construction_stage_id`, `assignment_kind` — alles, was für Name, Datum
  und Ort der Konfliktzeile gebraucht wird. Keine Erweiterung von
  `on-call-plan.ts` nötig, also **kein Stopp**.
- **Besetzungsanzeige sprengt die Zellenbreite:** geprüft — ein Badge in der
  Form „1/2" ist wenige Zeichen breit und steht (per `flex-wrap`) neben den
  vorhandenen `AssignedChip`s in derselben Zeile bzw. bricht bei Bedarf um
  (`flex flex-wrap`, bereits vorhandenes Verhalten der Zelle). Kein
  erkennbarer Platzbedarf, der das Layout sprengt — **kein Stopp**.
- **`tsc`/Bestandstests:** `tsc --noEmit` Exit 0, alle 181 Bestandstests
  weiterhin grün (siehe Prüfergebnisse oben).
- **Wiederholter Fehler:** Zwei Testfälle (Nr. 3 und 4 im Wächtertest)
  scheiterten je einmal an zu kurzen Distanz-Limits in den eigenen
  Regex-Prüfungen bzw. einer zu unspezifischen Suche nach
  `payload.kind === "move"` (traf zuerst die frühere Kommentarzeile bzw. die
  `excludeEntryId`-Zeile statt der eigentlichen Verzweigung) — beides waren
  **Fehler im Testcode selbst**, nicht im Produktivcode, und wurden beim
  ersten bzw. zweiten Lauf behoben. Kein Fehler trat dreimal identisch auf —
  **kein Stopp**.

## Offene Risiken

1. **`window.confirm` ist optisch nicht anpassbar.** Siehe Begründung der
   Dialog-Wahl oben — bewusster Kompromiss, um keine der drei bestehenden
   synchronen Aufrufstellen umzubauen. Eine spätere Umstellung auf den
   Radix-Dialog (`dialog.tsx`) wäre ein eigener, größerer Auftrag mit
   State-Umbau an allen drei Stellen.
2. **Grenze der Doppelbelegungsprüfung ist real, nicht nur theoretisch.**
   Wechselt der Disponent z. B. in die Wochenansicht einer anderen Woche
   und plant dort jemanden ein, der in der zuvor betrachteten Woche schon
   stand, sieht die Prüfung das nicht (andere `week.entries`). Ebenso bei
   zwei gleichzeitigen Browser-Sitzungen. Das ist laut Auftrag ausdrücklich
   akzeptiert („Hilfe, keine Garantie") und im Quelltext dokumentiert.
3. **Vorbestehende Umgebungsdatei `app/testout.log`.** Beim Nachmessen
   gefunden: eine bereits **vor** meiner Sitzung entstandene, 0 Byte große
   Datei `app/testout.log` (Zeitstempel 11:04, vor meinen Änderungen um
   11:41) liegt weiterhin im Arbeitsbaum. Ich habe zu keinem Zeitpunkt
   `> testout.log` o. ä. verwendet (alle Testläufe ausschließlich auf
   stdout). Ein Löschversuch (`rm -f`) schlug mit `Operation not permitted`
   fehl — dieselbe OneDrive-/FUSE-Beschränkung, die laut Auftrag auch
   `npm run build`/ESLint verhindert. Die Datei gehört **nicht** zu meiner
   Positivliste und wurde von mir **nicht neu erzeugt**, konnte aber auch
   nicht entfernt werden. Bitte außerhalb dieser Sandbox (Windows-Explorer)
   manuell löschen, falls noch nicht geschehen.
4. **`app/tsconfig.tsbuildinfo`** wurde vom `tsc`-Lauf automatisch
   aktualisiert (Standardverhalten des TypeScript-Compilers, kein
   selbst geschriebener Inhalt, keine Hilfsdatei im Sinne der
   Auftragsvorgabe). Nicht Teil der Positivliste, aber ein normaler,
   unvermeidbarer Nebeneffekt von `npx tsc --noEmit` mit `incremental`-Option
   im bestehenden `tsconfig.json`.

## Dateizeitstempel-Nachweis (statt `git status`, wie vom Auftrag verlangt)

```
$ find . -newer test/auftrag16-stammdaten-akkordeon.test.mjs -type f \
    -not -path "./node_modules/*" -not -path "./.next/*"
./src/components/on-call-plan/OnCallPlanClient.tsx
./test/auftrag17-dispo-regeln.test.mjs
./testout.log            (vorbestehend, siehe „Offene Risiken" Punkt 3)
./tsconfig.tsbuildinfo    (Compiler-Artefakt, siehe „Offene Risiken" Punkt 4)
```

Genau die zwei Dateien der Positivliste tragen inhaltliche Änderungen von
mir; die zwei zusätzlich aufgeführten Dateien sind Umgebungsnebeneffekte
ohne meinen Eingriff (siehe „Offene Risiken").

**Kein Commit, kein Push, kein Merge, kein Tag, kein Rebase, kein Reset,
kein Stash.** Nur lesende `git`-Befehle (`git status --porcelain`) wurden
verwendet.

## Statuspflege

`.claude/automation/status/fortschritt.json` liegt unter der Negativliste
(kein `.claude/**`) und wurde deshalb **nicht** geändert — dieselbe Abwägung
wie in MELDUNG_14.md/MELDUNG_16.md.

## Stopppunkt

**Kein Stopppunkt ausgelöst.** Im Einzelnen begründet siehe Abschnitt
„Geprüfte Stopppunkt-Kriterien" oben.
