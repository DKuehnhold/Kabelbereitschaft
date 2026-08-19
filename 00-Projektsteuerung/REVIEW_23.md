# REVIEW_23 — Dispo-Board: Rückmeldung und Robustheit (Bedienmängel, Teil 1)

> Verfasst vom Orchestrator/Review-Chat, 2026-08-18. Grundlage: `AUFTRAG_23.md`,
> `MELDUNG_23.md` und **eigene Messungen**. Agentenaussagen sind nicht als Nachweis übernommen.

## Ergebnis: **grün**, mit einer Auflage (Sichtprüfung) und einem offen benannten Kompromiss

## Eigene Messwerte

| Prüfung | Ergebnis | Exit |
| --- | --- | --- |
| Umfang (Dateizeitstempel, letzte 25 min unter `app/`) | genau `OnCallPlanClient.tsx` und `test/auftrag23-dispo-bedienung.test.mjs` (+ gitignoriertes `tsconfig.tsbuildinfo`) | 0 |
| `npx tsc --noEmit` | keine Ausgabe | **0** |
| `node --test test/*.test.mjs` | `# tests 226 / # pass 226 / # fail 0` (Baseline 208 + 18 neue) | **0** |
| `grep -nE "bg-red-\|text-red-\|border-red-\|bg-green-\|bg-yellow-"` auf der Komponente | **keine Treffer** | 1 |
| `grep -c $'\r'` neue Testdatei | 0 (LF) | — |

## Fachliche Prüfung (Stichproben im Code)

**M1/M2 — Erfolg und Fehler getrennt, Farben auf Tokens.** Aus `error: string \| null` wurde
`feedback: { kind: "success" \| "error"; message }`. Die Zeitraum-Anlage meldet nur bei
`createdCount > 0` Erfolg; der „0 Tage"-Sonderfall aus AUFTRAG_18 behält seinen **Wortlaut**,
erscheint jetzt aber als Fehler — das trifft die Vorgabe „darf nicht wie ein Erfolg aussehen"
genau. Die harten Farbklassen sind restlos verschwunden (eigener Grep über die **ganze** Datei,
keine Treffer). Beide „×"-Knöpfe nutzen jetzt `hover:text-destructive`.

**Token-Existenz selbst nachgeprüft** — das ist der Punkt, an dem eine Umstellung auf Tokens
still danebengehen kann: `--color-destructive` (2 Treffer), `--color-surface-2`,
`--color-border` und `--ring` (5 Treffer) sind in `globals.css` vorhanden;
`text-destructive`/`bg-destructive` wird bereits in `button.tsx` verwendet. Die Klassen greifen
also, es sind keine ins Leere laufenden Namen. `globals.css` wurde **nicht** angefasst.

**M3 — Drag-Feedback.** `onDragEnter`/`onDragLeave` an den Zellen der Wochenmatrix und an den
beiden vorhandenen Ablageflächen der Monteurliste; die Hervorhebung wird auch im `drop`-Pfad
zurückgesetzt (sonst bliebe eine Zelle nach dem Ablegen markiert). Kein neues Drop-Ziel.

**M4 — Sperrzustand, der eigentliche Robustheitsgewinn.** `busy` steht jetzt als **erste**
Bedingung in `onCellDrop` (Zeile 535 ff.), `onCellClick` (Zeile 559), der Entfernen-Ablagefläche
und dem Tagesklick der Monatsansicht. Vorher deaktivierte `busy` nur Schaltflächen, während
Zellklicks weiterliefen — ein Doppelklick erzeugte zwei Aktionen oder eine
Unique-Fehlermeldung. Zusätzlich `aria-busy` und reduzierte Deckkraft. Der Wächtertest prüft die
**Reihenfolge** im Funktionskörper, nicht nur das Vorkommen.

**M5 — Leerzustände.** Der „—"-Platzhalter ist von `canEdit` entkoppelt; die Monatsansicht hat
einen eigenen Leerzustand, sachlich getrennt für Monteure (ohne Bedienaufforderung, sie dürfen
ohnehin nicht) und Staff. „Keine aktiven Bauabschnitte." unverändert.

**M6 — Chiphöhe.** `minHeight: "44px"` ist aus `AssignedChip` entfernt; die Trefferfläche
entsteht jetzt über `px-2 py-4 -mx-2 -my-4` — Innenabstand plus exakt gegenläufiger negativer
Rand. Das ist das übliche Mittel: auf einem Inline-Element vergrößert vertikaler Innenabstand
die Trefferfläche, **ohne** die Zeilenhöhe zu bestimmen, und der negative Rand nimmt die
Auswirkung auf den Fluss zurück. Die Matrix wird dadurch nicht mehr von jeder Zuweisung auf
≥44 px aufgezogen. `touchStyle` bleibt für die Schaltflächen unverändert.

**Der Regressionswächter aus AUFTRAG_17 ist erhalten**: `ev.stopPropagation()` steht weiterhin
im „×"-Klickpfad (selbst nachgelesen). Genau das war die Gefahr bei einem Umbau dieses Chips.

**Wächtertest absichtsprüfend gebaut** — die Projektlehre aus AUFTRAG_19/22 ist angekommen: die
schärfste Prüfung (keine harte Farbklasse **in der ganzen Datei**) ist zugleich die stabilste,
und der `busy`-Abbruch wird über die Reihenfolge geprüft. Der Agent ist dabei einmal über die
eigene Prüfung gestolpert, weil sein Kommentar die verbotenen Klassennamen wörtlich zitierte —
er hat den Kommentar umformuliert statt die Prüfung aufzuweichen. Richtig entschieden.

## Auflage (offen)

**Sichtprüfung durch Dennis.** Weder Browser noch `npm run build` noch ESLint stehen hier zur
Verfügung; Struktur und Typen sind belegt, die **Darstellung nicht**. Zwei Stellen verdienen
dabei besondere Aufmerksamkeit, weil sie nur als Absicht im Quelltext belegt sind:

1. Die Ring-Hervorhebung beim Ziehen sitzt auf Tabellenzellen mit `border-collapse` — Ringe
   werden dort je nach Browser beschnitten dargestellt.
2. Die vergrößerte Trefferfläche des „×" ragt unsichtbar über den Chip hinaus und **kann** sich
   mit benachbarten Chips überlappen. Der Agent hat das offen benannt statt es zu verschweigen.
   Falls beim Ausprobieren ein Klick den falschen Chip trifft, ist das die Ursache.

## Kein Commit, kein Push

Weder durch den Ausführungsagenten noch durch mich.
