# REVIEW_17 — Dispo-Board: Doppelbelegungs-Hinweis, Soll-Besetzung, Markierung, Bugfix

> Verfasst vom Orchestrator/Review-Chat, 2026-08-18. Grundlage: `AUFTRAG_17.md`,
> `MELDUNG_17.md` und **eigene Messungen**. Agentenaussagen sind nicht als Nachweis
> übernommen.

## Ergebnis: **grün**, mit einer Auflage und einem Punkt, den Dennis bei der Sichtprüfung
> entscheiden sollte

## Eigene Messwerte

| Prüfung | Ergebnis | Exit |
| --- | --- | --- |
| Umfang (Dateizeitstempel, letzte 25 min unter `app/`) | genau `components/on-call-plan/OnCallPlanClient.tsx` und `test/auftrag17-dispo-regeln.test.mjs`, dazu das gitignorierte `tsconfig.tsbuildinfo` | 0 |
| TypeScript: `npx tsc --noEmit` | keine Ausgabe | **0** |
| Unit-Tests: `node --test test/*.test.mjs` | `# tests 192 / # pass 192 / # fail 0` (Baseline 181 + 11 neue) | **0** |
| Zeilenenden neue Testdatei | 0 CR (LF) | 0 |
| Badge-Utilities vorhanden | `.badge-success`, `.badge-warning`, `.badge-info`, `.badge-danger` je 1× in `globals.css` — die verwendeten Klassen existieren, es sind keine erfundenen | 0 |

Der Umfang wurde über Zeitstempel geprüft, nicht über `git diff`: weil AUFTRAG_14 uncommitted
ist, enthält der Diff dieser Datei gegen HEAD den kompletten AUFTRAG_14-Umbau und wäre als
Umfangsnachweis dieses Auftrags unbrauchbar. `on-call-plan.ts`, `on-call-plan-actions.ts`,
`qualifications.ts`, `globals.css` und `roles.ts` sind in diesem Lauf **nicht** angefasst.

## Fachliche Prüfung (Stichproben im Code)

**Bugfix (Punkt 1) — behoben.** `AssignedChip`, Zeile 187: `ev.stopPropagation()` vor
`onRemove`, mit Kommentar auf die Ursache. Damit kann ein Klick auf „×" nicht länger
gleichzeitig eine neue Zuweisung auslösen. Der Wächtertest hält die Stelle fest.

**Soll-Besetzung (Punkt 2) — sachlich richtig gelöst.** `SOLL_BESETZUNG_BEREITSCHAFT = 2`
(Zeile 63) mit Herkunftsvermerk auf Dennis' Wortlaut. Anzeige `entries.length/2` je
Bereitschaftszelle (Zeile 582–585) über `occupancyBadgeClass()`: `badge-success` bei genau 2,
`badge-warning` bei Unterbesetzung, **`badge-info`** bei Überbesetzung. Die Wahl von `info`
statt `warning`/`danger` für die Überbesetzung ist begründet und trifft die Vorgabe „sichtbar
anders als ein Fehler — es ist keiner" genau. Der `title` benennt ausdrücklich „Anzeige, keine
Grenze". Nachgeprüft: **keine** Stelle verhindert eine dritte Zuweisung. Die Dispo-Zeile hat
keine Besetzungsanzeige — auftragskonform.

**Doppelbelegungsprüfung (Punkt 3) — besser gelöst als beauftragt.** Statt zweier
Prüfstellen gibt es **einen** gemeinsamen Prüfpunkt `handleDropOrClickAssign()` (Zeile 290),
durch den nachgemessen **alle drei** Schreibeinstiege laufen: Drop (Zeile 332), Klick in der
Wochenmatrix (Zeile 340) und der Klickpfad der **Monatsansicht** (Zeile 424). Damit ist kein
Weg an der Prüfung vorbei — das war das eigentliche Risiko. `findConflictingEntry()` nimmt
beim Verschieben den bewegten Eintrag selbst aus (`excludeEntryId`) und ignoriert die
identische Zielzelle (`!isSameTarget`), die weiterhin der Unique-Index aus `0022` abfängt.
Bricht der Nutzer ab, kehrt die Funktion **vor** jedem `runAction` zurück (Zeile 308) — die
Monteurauswahl bleibt erhalten, wie verlangt.

Hinweistext, wörtlich:

> `<Name> ist am <TT.MM.JJJJ> bereits eingeplant (<Ort>). Trotzdem zusätzlich hier einplanen?`

`<Ort>` kommt aus `describeLocation()`: „Dispo", `Code – Name` des Bauabschnitts oder als
Rückfall „einem anderen Bauabschnitt". Damit ist die Rückfrage konkret und nicht das
verlangte-nicht anonyme „Wirklich?".

**Grenze der Prüfung — korrekt offengelegt.** Geprüft wird gegen die **geladenen** Einträge
des sichtbaren Zeitraums (Zeile 285). Eine Doppelbelegung außerhalb der angezeigten Woche bzw.
des Monats und ein gleichzeitig arbeitender zweiter Bearbeiter werden **nicht** erkannt. Das
steht als Kommentar über `findConflictingEntry` und in `MELDUNG_17.md`. Das ist die ehrliche
Darstellung: es ist eine Bedienhilfe, keine Zusicherung. Eine echte Zusicherung wäre nur mit
einer Serverprüfung oder einem Constraint möglich — und ein Constraint ist durch Dennis'
Entscheidung („der Disponent kann ja sagen") ausdrücklich ausgeschlossen.

**`window.confirm` statt Radix-Dialog** — die Begründung trägt: die drei Aufrufstellen sind
synchron, ein kontrollierter Dialog hätte die Aufrufkette auf einen asynchronen
Bestätigungszustand umbauen müssen, und Umbauten waren durch die Negativliste ausgeschlossen.
Als Merkposten: sollte die Rückfrage später zum Alltagsfall werden, gehört sie in den
vorhandenen `dialog.tsx` (eigene Scheibe).

**Markierung (Punkt 4) — auftragskonform.** `assignedDaysCount` je Chip aus einem
`Set` je Monteur, angezeigt als `badge-info` „3 Tage" (Zeile 151–152), zusätzlich im
`aria-label` ausgeschrieben (Zeile 147); das Badge selbst ist `aria-hidden`, also keine
Doppelvorlesung. Nachgemessen: die Liste enthält **keinen** Filter, der eingeplante Monteure
entfernt (die einzigen `filter(`-Vorkommen, Zeilen 551/552, trennen Dispo- von
Bereitschaftseinträgen der Matrix). Kein Ausgrauen, Reihenfolge unverändert, Farbe aus der
höchsten Qualifikation unverändert.

## Auflage (offen)

**Sichtprüfung durch Dennis** — sichtbare Oberfläche, in dieser Umgebung nicht darstellbar.
`npm run build` und ESLint bleiben ebenfalls lokal.

## Punkt für die Sichtprüfung (Gestaltungsfrage, bewusst nicht entschieden)

Eine leere Bereitschaftszelle zeigt „0/2" in **`badge-warning`**. In einer Woche mit mehreren
Bauabschnitten heißt das: jede noch nicht geplante Zelle leuchtet gelb — bei einem frisch
geöffneten künftigen Monat also die ganze Matrix. Das ist regelkonform („weniger als Soll"),
kann aber als Lärm wirken. Denkbare Varianten, falls es dich beim Ansehen stört:
„0/2" neutral darstellen und nur `1/2` warnen; oder erst ab einem Datum in der Nähe warnen.
**Das ist eine Gestaltungsentscheidung und liegt bei dir** — ich habe hier bewusst nichts
vorweggenommen.

## Was von Block D danach noch offen ist (→ AUFTRAG_18)

1. **Mehrere Tage auf einmal über den Dialog „von–bis"** (deine Entscheidung vom 2026-08-18).
2. **Verschieben ohne Maus** — heute nur DnG in der Wochenmatrix; in der Monatsansicht muss
   man entfernen und neu zuweisen.
3. **Drag-Feedback**: die Zielzelle wird beim Ziehen nicht hervorgehoben.
4. **Sperrzustand während einer Aktion**: `busy` deaktiviert nur Knöpfe, Zellklicks und Drops
   laufen weiter — ein Doppelklick erzeugt zwei Aktionen.
5. **Tastaturbedienung der Zellen**: die Monteur-Chips sind bedienbar, die Zielzellen nicht.
6. **Leerzustände und Fehlerbox**: die Monatsansicht hat keinen Leerzustand, der Platzhalter
   „—" erscheint nur für Bearbeiter, und die Fehlerbox nutzt harte Farben (`bg-red-50`,
   `text-red-700`) statt der AP8-Tokens — im Dark Mode vermutlich unschön (nicht gerendert
   geprüft).

## Kein Commit, kein Push

Weder durch den Ausführungsagenten noch durch mich.
