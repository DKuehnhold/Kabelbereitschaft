# AUFTRAG_23 — Dispo-Board: Rückmeldung und Robustheit (Bedienmängel, Teil 1)

> Erteilt vom Orchestrator/Review-Chat, 2026-08-18. Grundlage: die in `REVIEW_17.md` und
> `REVIEW_18_bis_22.md` gesammelten Bedienmängel; Dennis hat sie ausdrücklich auf die Scheibe
> **nach** dem „von–bis"-Dialog gelegt („die Bedienmängel machen wir danach").
> **Teil 2 (AUFTRAG_24, nicht dieser Auftrag):** Tastaturbedienung der Zielzellen und
> Verschieben in der Monatsansicht — beides strukturell, deshalb getrennt.

## Ausgangslage (Fundstellen, alle in `OnCallPlanClient.tsx`)

| # | Mangel | Fundstelle |
| --- | --- | --- |
| M1 | Erfolg und Fehler teilen sich **eine** rote Fläche — eine gelungene Zeitraum-Anlage („5 Tage eingeplant") sieht aus wie ein Fehler | Zeile 571 |
| M2 | Diese Fläche nutzt **harte Tailwind-Farben** `border-red-300 bg-red-50 text-red-700` statt der AP8-Tokens; im Dark Mode voraussichtlich unbrauchbar | Zeile 571 |
| M3 | Kein **Drag-Feedback**: `onDragOver` ruft nur `preventDefault()`, die Zielzelle wird nicht hervorgehoben — beim Ziehen ist nicht erkennbar, wo man landet | Zeilen 624, 641, 786 |
| M4 | **Kein Sperrzustand für Zellen**: `busy` deaktiviert nur Schaltflächen; Zellklicks und Drops laufen weiter → ein Doppelklick erzeugt zwei Aktionen bzw. eine Unique-Fehlermeldung | Zeilen 786 ff., 804 |
| M5 | **Leerzustände**: der Platzhalter „—" in leeren Zellen erscheint nur für Bearbeiter; die **Monatsansicht** hat gar keinen Leerzustand — ein Monteur sieht eine leere Tabelle ohne Erklärung | Wochenmatrix bzw. Monatsraster |
| M6 | Der „×"-Knopf trägt `minHeight: 44px` **innerhalb** eines Inline-Chips und treibt damit jede Zuweisung auf ≥44 px Höhe — in der dichten Matrix wirkt das wie ein Layoutfehler | `AssignedChip`, Zeilen 185–190 |

## Verbindliches Verhalten

**1. Erfolg und Fehler trennen (M1/M2).** Die Komponente bekommt eine Rückmeldung mit **Art**
(Erfolg oder Fehler) statt nur eines Textes. Erfolgsmeldungen der Zeitraum-Anlage laufen als
Erfolg, alle Fehlerpfade weiterhin als Fehler. Die Darstellung nutzt **ausschließlich**
vorhandene AP8-Utilities — dieselbe Familie, die AUFTRAG_17 für die Besetzungsanzeige benutzt
(`badge`/`badge-success`/`badge-warning`/`badge-danger`) bzw. die vorhandenen `card`- und
Token-Klassen. **Keine** neue Farbe, **kein** Hex, **keine** `bg-red-*`/`text-red-*`/`bg-green-*`.
Der Sonderfall „0 Tage eingeplant" aus AUFTRAG_18 bleibt inhaltlich unverändert, wird aber
**nicht** als Erfolg dargestellt.

**2. Auch `hover:text-red-600` an den beiden „×"-Knöpfen** (Zeilen 187 und 907) auf ein
vorhandenes Token umstellen. Keine Funktionsänderung.

**3. Drag-Feedback (M3).** Beim Ziehen über eine gültige Zielzelle wird diese sichtbar
hervorgehoben (`onDragEnter`/`onDragLeave`, Rücksetzen auch bei `drop`), umgesetzt über
vorhandene Token-/Utility-Klassen. Gilt für die Wochenmatrix **und** die beiden vorhandenen
Ablegeflächen der Monteurliste (Entfernen). Es wird **kein** neues Drop-Ziel eingeführt.

**4. Sperrzustand (M4).** Solange `busy` gilt, führen Zellklick und Drop **keine** Aktion mehr
aus (fail-closed am Anfang der jeweiligen Behandlung), und die Zellen zeigen erkennbar, dass
gerade gespeichert wird (z. B. verringerte Deckkraft und `aria-busy`). Der Cursor-/Zustand darf
die Tabelle nicht umbrechen. Ein zweiter Klick während einer laufenden Aktion erzeugt damit
keine zweite Zuweisung mehr.

**5. Leerzustände (M5).** Der Platzhalter für leere Zellen erscheint **unabhängig** von
`canEdit`. Die Monatsansicht bekommt einen Leerzustand, wenn im gesamten Monat keine Zuweisung
existiert — ein sachlicher Satz, für Monteure ohne Aufforderung zum Bedienen, für Staff mit
kurzem Hinweis auf die Bedienung. Die vorhandene Zeile „Keine aktiven Bauabschnitte." bleibt
unverändert.

**6. Chiphöhe (M6).** Die feste `minHeight: 44px` am „×" entfällt; die Trefferfläche wird
stattdessen über Innenabstand/negativen Rand so gelöst, dass sie berührungstauglich bleibt,
**ohne** die Zeilenhöhe der Matrix zu bestimmen. Die Mindestgröße der Trefferfläche darf dabei
nicht unter die bisherige Größe fallen — die Lösung ist in `MELDUNG_23.md` zu beschreiben. Die
`touchStyle`-Konstante bleibt für die **Schaltflächen** unverändert in Gebrauch.

## Positivliste (nur diese Pfade)

- `app/src/components/on-call-plan/OnCallPlanClient.tsx`
- `app/test/auftrag23-dispo-bedienung.test.mjs` (**neu**)

## Umzusetzen — Tests

Wächtertest im Stil von `auftrag17-dispo-regeln.test.mjs`, **absichtsprüfend, nicht
zeichenkettenprüfend** (Review-Lehre aus AUFTRAG_19/22 — steht in `PROJEKT_WISSEN.md`):

- in der **gesamten** Datei kommt keine der Klassen `bg-red-`, `text-red-`, `border-red-`,
  `bg-green-`, `bg-yellow-` mehr vor (das ist die schärfste und zugleich stabilste Form);
- die Rückmeldung trägt eine **Art** (Erfolg/Fehler), und der Erfolgsfall der Zeitraum-Anlage
  setzt sie auf Erfolg, die Fehlerpfade auf Fehler;
- Zellklick **und** Drop brechen bei `busy` ab, **bevor** eine Aktion ausgelöst wird
  (Reihenfolge im Funktionskörper prüfen, nicht nur das Vorkommen);
- `onDragEnter` und `onDragLeave` sind an den Zielzellen gesetzt und der Hervorhebungszustand
  wird auch im `drop`-Pfad zurückgesetzt;
- `AssignedChip` enthält kein `minHeight: "44px"` mehr, `stopPropagation` aber weiterhin
  (Regressionswächter aus AUFTRAG_17 darf nicht verlorengehen).

## Negativliste (ausdrücklich verboten)

- Tastaturbedienung der Zielzellen und Verschieben in der Monatsansicht — **AUFTRAG_24**.
- Die fachlichen Regeln aus AUFTRAG_17/18 ändern: Soll-Besetzung, Doppelbelegungs-Rückfrage,
  Markierung in der Monteurliste, „von–bis"-Dialog, `MAX_RANGE_DAYS`, die Wortlaute der
  Rückfragen und der Ergebnismeldung.
- `on-call-plan-actions.ts`, `on-call-plan.ts`, `globals.css`, `qualifications.ts`,
  `roles.ts`, `primitives.tsx`, die shadcn-Copy-ins, `app/supabase/**`, `.claude/**`,
  `.github/workflows/**`, `run-*.ps1`.
- Eine neue Farbe, ein Hex-Literal oder eine neue Utility in `globals.css` einführen.
- Neue npm-Abhängigkeit; `package.json`/`package-lock.json`.
- Bestehende Testdateien ändern. Wird ein Bestandswächter durch diese Arbeit rot, ist das ein
  **Stopppunkt** mit Meldung — nicht eigenmächtig zu reparieren.
- `git commit`, `push`, `merge`, `tag`, `release`.
- Erfundene Nachweise: `npm run build`, ESLint und ein Browser stehen hier nicht zur Verfügung.
  Die tatsächliche Darstellung ist **nicht** prüfbar und in `MELDUNG_23.md` als offen zu
  benennen.

## Zeilenenden

Neue Testdatei mit **LF**. Der Arbeitsbaum ist inzwischen weitgehend auf LF bereinigt — es darf
**kein** neuer CRLF-Eintrag entstehen.

## DoD (prüfbar)

1. Geändert/neu sind **genau** die zwei Dateien der Positivliste (Nachweis über
   Dateizeitstempel, nicht über `git status`).
2. Aus `app/`: `npx tsc --noEmit` → **Exit 0**.
3. Aus `app/`: `node --test test/*.test.mjs` → die bisherigen **208** weiterhin grün plus die
   neuen Fälle, `fail 0`, **Exit 0**. Zahlen wörtlich melden.
4. `grep -c $'\r'` auf der neuen Testdatei → **0**.
5. `grep -nE "bg-red-|text-red-|border-red-|bg-green-|bg-yellow-"` auf
   `OnCallPlanClient.tsx` → **keine Treffer**; Ausgabe wörtlich melden.
6. `MELDUNG_23.md` nennt: die zwei Dateien, das Verhalten je Punkt 1–6, die gewählte Lösung für
   die Trefferfläche aus Punkt 6, die Messwerte mit Exit-Codes, den Hinweis auf die nicht
   prüfbare Darstellung und offene Risiken.

## Stopppunkt

Anhalten und melden, wenn

- eine der sechs Änderungen ohne Eingriff in `globals.css` oder in eine Copy-in-Komponente nicht
  möglich ist (dann die fehlende Utility benennen, **nicht** anlegen);
- ein Bestandswächter rot wird;
- `tsc` nicht Exit 0 ergibt;
- derselbe Fehler dreimal in derselben Teilaufgabe auftritt.

## Meldeweg

`00-Projektsteuerung/MELDUNG_23.md`. Danach messt der Orchestrator/Review-Chat selbst nach und
schreibt `REVIEW_23.md`.
