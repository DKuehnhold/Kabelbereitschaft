# MELDUNG 18 vom Worker-Chat zu AUFTRAG_18

> Stand: 2026-08-18. Verfasst von Claude (Rolle Worker, Ausführungsagent),
> Antwort auf `00-Projektsteuerung/AUFTRAG_18.md`. Schriftliche Notiz, kein
> Chat-Kanal.

## Ergebnis in Kürze

Der "von-bis"-Dialog (Punkte 1-8) ist vollständig umgesetzt: Neuzuweisungen
(Drop, Klick Woche, Klickpfad Monat) öffnen jetzt vor jedem Schreiben einen
Dialog mit festem "Von" und einem "Bis"-Datumsfeld; "Nur diesen Tag" (Enter,
vorbelegt) und "Zeitraum eintragen" sind getrennte Pfade; Verschieben bleibt
unverändert ohne Dialog. Die neue Server-Action `assignOnCallRange()` nutzt
dieselbe Rollen-Allowlist, wiederholt beide Grenzen serverseitig und schreibt
alle Tage in einer Transaktion mit `on conflict ... do nothing` auf den
passenden partiellen Index. `tsc --noEmit` ist Exit 0. **Es gibt jedoch einen
Stopppunkt**: ein VORHANDENER, außerhalb der Positivliste liegender Test
(`test/auftrag10-bereitschaftsplan.test.mjs`) zählt hart auf genau 4
Vorkommen von `STAFF_ALLOWED_ROLES.includes(session.role)` und wird durch das
fünfte, vom Auftrag ausdrücklich verlangte Vorkommen in `assignOnCallRange()`
zwangsläufig rot. Siehe Abschnitt "Stopppunkt" unten - ich habe NICHT
versucht, das durch einen abweichenden Prüfpfad zu umgehen (das wäre gegen
Punkt 7 des Auftrags gewesen) und auch NICHT die fremde Testdatei angefasst
(außerhalb der Positivliste). Alle anderen 203 von 204 Tests sind grün,
inklusive der 12 neuen Fälle.

## Geänderte/neue Dateien (Positivliste, vollständig — genau drei)

**Geändert (2):**

- `app/src/components/on-call-plan/OnCallPlanClient.tsx`
- `app/src/lib/on-call-plan-actions.ts`

**Neu (1):**

- `app/test/auftrag18-dispo-zeitraum.test.mjs`

Nachweis über Dateizeitstempel (nicht `git status`, siehe Auftragstext -
der Arbeitsbaum trägt 200+ fremde Änderungen aus AUFTRAG 11-17):

```
$ find src test -newer ../00-Projektsteuerung/AUFTRAG_18.md -type f
src/components/on-call-plan/OnCallPlanClient.tsx
src/lib/on-call-plan-actions.ts
test/auftrag18-dispo-zeitraum.test.mjs
```

Genau die drei Dateien der Positivliste, keine weitere. `on-call-plan.ts`,
`globals.css`, `roles.ts`, `qualifications.ts`, `masterdata.ts`,
`app/supabase/**`, `.github/workflows/**`, `.claude/**`, `run-*.ps1` wurden
nicht angefasst.

## Umgesetztes Verhalten je Auftragspunkt

### 1. Dialog vor dem Schreiben

Alle drei Neuzuweisungs-Einstiege (`onCellDrop` im nicht-move-Zweig,
`onCellClick`, `onConfirmPrompt` im Monats-Klickpfad) rufen jetzt
`openAssignDialog(target, technicianId)` auf statt direkt zu schreiben. Diese
Funktion setzt ausschließlich React-State (`pendingAssign`, `rangeToIso`,
`rangeDialogError`) - es gibt keinen Zwischenzustand, in dem bereits etwas in
der Datenbank steht, während der Dialog noch offen ist: der erste
Schreibzugriff (`assignOnCall`/`assignDispo` bzw. `assignOnCallRange`) folgt
erst NACH einem Klick auf "Nur diesen Tag" oder "Zeitraum eintragen" in
`handleAssignSingleDay`/`handleAssignRange`.

### 2. Inhalt des Dialogs

`AssignRangeDialog` (neue Funktionskomponente, Dateiende von
`OnCallPlanClient.tsx`):

- Kopfzeile: `<DialogTitle>{technicianName} einplanen</DialogTitle>` und
  `<DialogDescription>Ziel: {targetLabel}</DialogDescription>` -
  `targetLabel` ist entweder `DISPO_ROW_LABEL` ("Dispo /
  Bereitschaftstelefon") oder `code – name` bzw. `name` des Bauabschnitts.
- "Von": `formatIsoDateDe(target.dateIso)` als reiner Text (TT.MM.JJJJ),
  NICHT als Eingabefeld - der Zielzelle entsprechend fest.
- "Bis": `<input type="date">`, `value={rangeToIso}`, vorbelegt in
  `openAssignDialog` mit `target.dateIso` (also identisch zu "Von"),
  `min={target.dateIso}` als zusätzlicher Browser-Hinweis (die eigentliche
  Prüfung erfolgt in JS, s. u.).
- Zwei Schaltflächen in einem `<form onSubmit={(e) => { e.preventDefault();
  onSingleDay(); }}>`: "Nur diesen Tag" ist `type="submit"` (damit die
  Enter-Taste GENAU diesen Pfad auslöst - ein zusätzlicher Tastendruck für
  den Einzeltag), "Zeitraum eintragen" und "Abbrechen" sind `type="button"`
  und reagieren NICHT auf Enter.
- Schließen/Abbrechen (`onClose`, auch über `onOpenChange` bei Escape bzw.
  Klick auf das "X" des Dialog-Bausteins) ruft ausschließlich
  `closeAssignDialog()` - das setzt nur State zurück, keine Server-Action
  (Wächtertest 8).

### 3. Bis vor Von

In `handleAssignRange`: `if (rangeToIso < fromIso) { setRangeDialogError(...);
return; }` - String-Vergleich auf ISO-Datumsformat (`YYYY-MM-DD`) ist
lexikographisch korrekt sortiert, dieselbe Technik wie in `date-local.ts`.
Die Meldung erscheint als `<span className="badge badge-warning"
role="alert">` INNERHALB des Dialogs (keine harte Tailwind-Farbe, sondern die
bestehende AP8-Badge-Utility), der Dialog bleibt offen, es wird nichts
geschrieben (der `return` steht vor jedem Aufruf von `runRangeAction`).
Serverseitig wiederholt in `assignOnCallRange()` (`if (toIso < fromIso)
return { ok: false, error: RANGE_ORDER_ERROR }`).

### 4. Obergrenze 92 Tage

Neue, exportierte, kommentierte Konstante `export const MAX_RANGE_DAYS = 92;`
in `on-call-plan-actions.ts` (Kommentar: "ein Quartal - das längste
Kalenderquartal ... hat 92 Tage", Schutz gegen einen Tippfehler im Jahr).
`OnCallPlanClient.tsx` **importiert** dieselbe Konstante
(`import { ..., MAX_RANGE_DAYS, ... } from "@/lib/on-call-plan-actions"`) -
es gibt bewusst nur EINE Quelle des Zahlenwerts, keinen zweiten, unabhängig
gepflegten Literal. Clientseitige Prüfung: `isoDatesInRange(fromIso,
rangeToIso).length > MAX_RANGE_DAYS` → Dialogmeldung, kein Schreibvorgang.
Serverseitig wiederholt über `countDaysInclusive(fromIso, toIso,
MAX_RANGE_DAYS) > MAX_RANGE_DAYS` (bricht die Zählung früh ab, kein
unbegrenztes Hochzählen bei einem grob falschen Datum).

### 5. Doppelbelegungsprüfung über den Zeitraum

`handleAssignRange` ermittelt zunächst `days = isoDatesInRange(fromIso,
rangeToIso)` (alle Kalendertage einschließlich beider Enden) und prüft dann
JEDEN Tag einzeln über die bestehende `findConflictingEntry(...)` aus
AUFTRAG_17 (unverändert): `days.filter((day) => findConflictingEntry(
activeEntries, technicianId, day, target) !== null)`. Treffer werden in
`conflictDays` gesammelt.

**Wortlaut der Zeitraum-Rückfrage** (wenn `conflictDays.length > 0`, sonst
keine Rückfrage):

> `"<Name> ist im gewählten Zeitraum an <N> Tag(en) bereits andernorts eingeplant: <Tag1>, <Tag2>, ..., <Tag5>, … und <N-5> weitere. Trotzdem einplanen?"`

(bei höchstens 5 Treffern ohne den Zusatz "… und N weitere" - alle Tage
werden dann komplett aufgelistet, TT.MM.JJJJ). Bestätigt der Disponent →
`assignOnCallRange(...)` wird aufgerufen; bricht er ab → `if (!confirmed)
return;` verlässt die Funktion vor jedem Schreibaufruf.

**Erneut benannte Grenze (wie in AUFTRAG_17, hier für den Zeitraum
wiederholt, wörtlich im Quelltext kommentiert):** Es wird ausschließlich
gegen die bereits GELADENEN Plandaten der sichtbaren Woche bzw. des
sichtbaren Monats geprüft (`activeEntries`/`activeStages`, dieselbe
Datengrundlage wie bei der Einzeltagsprüfung, keine zusätzliche
Serverabfrage). Reicht der gewählte Zeitraum über die angezeigte Woche bzw.
den angezeigten Monat hinaus, kann die Prüfung Dubletten AUSSERHALB des
geladenen Zeitraums nicht sehen - erwartet, wie im Auftrag beschrieben, und
bewusst NICHT durch einen zusätzlichen Datenzugriff "gelöst". Das ist eine
Hilfe, keine Garantie; der partielle Datenbank-Unique-Index bleibt die
einzige harte Schranke (verhindert weiterhin nur die exakte Dublette je
Bauabschnitt bzw. je Dispo-Tag).

### 6. Verschieben bleibt einzeltägig

`onCellDrop` unterscheidet jetzt `payload.kind === "move"` (→ unverändert
`handleDropOrClickAssign(target, payload)`, KEIN Dialog) von jedem anderen
Fall (→ `openAssignDialog(...)`). `handleDropOrClickAssign` selbst ist
TEXTLICH UNVERÄNDERT (siehe Begründung im Abschnitt "Wächtertest" unten,
Wächtertest 6 aus `auftrag18-dispo-zeitraum.test.mjs` sichert explizit, dass
`openAssignDialog` in dieser Funktion NICHT vorkommt).

### 7. Neue Server-Action `assignOnCallRange`

Signatur: `assignOnCallRange(target: OnCallRangeTarget, fromIso: string,
toIso: string, technicianId: string): Promise<OnCallPlanRangeResult>` mit
`OnCallRangeTarget = { kind: "bereitschaft"; stageId: string } | { kind:
"dispo" }`.

- Dieselbe Prüfkette wie `assignOnCall`/`assignDispo`: `getSessionProfile()`
  → `STAFF_ALLOWED_ROLES.includes(session.role)` → `isUuid(technicianId)` /
  `isUuid(target.stageId)` → `isIsoCalendarDate(fromIso)` /
  `isIsoCalendarDate(toIso)`. Kein eigener, abweichender Prüfpfad.
- Serverseitige Wiederholung von Punkt 3 (`toIso < fromIso`) und Punkt 4
  (`countDaysInclusive(...) > MAX_RANGE_DAYS`) - siehe oben.
- **Eine** `withUserTransaction(session.userId, async (client) => { ... })`,
  darin eine `for (;;)`-Schleife über `cursor` von `fromIso` bis `toIso`
  (Fortschritt über `addDaysToIsoDate(cursor, 1)`, dieselbe vorhandene
  Datumsfunktion wie im Client - NICHT verändert), je Tag genau EIN
  `insert ... on conflict ... do nothing`.
- **Gewählte on-conflict-Formulierung (mit Begründung):**
  ```sql
  -- Dispo-Zeile:
  insert into public.on_call_plan (construction_stage_id, plan_date, technician_id, assignment_kind)
  values (null, $1::date, $2::uuid, 'dispo')
  on conflict (plan_date, technician_id) where assignment_kind = 'dispo' do nothing

  -- Bereitschaft:
  insert into public.on_call_plan (construction_stage_id, plan_date, technician_id, assignment_kind)
  values ($1::uuid, $2::date, $3::uuid, 'bereitschaft')
  on conflict (construction_stage_id, plan_date, technician_id) where assignment_kind = 'bereitschaft' do nothing
  ```
  Begründung: PostgreSQL erlaubt `on conflict (SPALTEN) where <PRÄDIKAT>` nur
  als Arbiter für einen PARTIELLEN Unique-Index, wenn SPALTEN **und**
  PRÄDIKAT exakt mit einem bestehenden Index übereinstimmen ("Arbiter
  Indexes" / partial index inference). `0022_hlk_dispo_board.sql` (Zeilen
  245-254, nur gelesen, nicht verändert) definiert genau zwei solche
  Indizes:
  ```sql
  create unique index if not exists on_call_plan_bereitschaft_uq
    on public.on_call_plan (construction_stage_id, plan_date, technician_id)
    where assignment_kind = 'bereitschaft';

  create unique index if not exists on_call_plan_dispo_uq
    on public.on_call_plan (plan_date, technician_id)
    where assignment_kind = 'dispo';
  ```
  Meine beiden `on conflict`-Klauseln übernehmen Spaltenliste UND Prädikat
  jedes Index wortgleich - deshalb zwei getrennte Formulierungen (eine
  gemeinsame `on conflict`-Klausel für beide Zeilenarten wäre keinem der
  beiden Indizes zuordenbar). Ein bereits vorhandener Tag löst dadurch `do
  nothing` aus (kein `23505`, kein Transaktionsabbruch) - genau das vom
  Auftrag verlangte "Überspringen" statt Fehler. `rowCount` des jeweiligen
  `insert`-Ergebnisses (`1` bei tatsächlichem Insert, `0` beim
  übersprungenen Konflikt) zählt `createdCount`/`skippedCount`.
- Rückgabetyp `OnCallPlanRangeResult = OnCallPlanActionResult & {
  createdCount?: number; skippedCount?: number }` - beide Zusatzfelder
  OPTIONAL, `OnCallPlanActionResult` selbst sowie
  `assignOnCall`/`assignDispo`/`moveOnCallEntry`/`removeOnCall` sind
  unverändert (siehe Diff-Nachweis unten).
- `revalidatePlan()` am Ende, exakt wie in den Bestandsactions.

### 8. Ergebnismeldung

`runRangeAction` (neuer Action-Runner analog zu `runAction`, nutzt DIESELBE
Meldungsfläche - dieselbe State-Variable `error`, dieselbe JSX-Stelle
`{error ? (<div className="card border border-red-300 bg-red-50 p-3 text-sm
text-red-700">{error}</div>) : null}` direkt unterhalb des
Ansichtsumschalters, unverändert von AUFTRAG_10):

**Wortlaut der Ergebnismeldung:**

- `createdCount > 0` und `skippedCount > 0`: `"<N> Tag(e) eingeplant, <M>
  Tag(e) waren bereits vergeben."`
- `createdCount > 0` und `skippedCount === 0`: `"<N> Tag(e) eingeplant."`
- `createdCount === 0`: `"0 Tage eingeplant (alle <M> Tag(e) im gewählten
  Zeitraum waren bereits vergeben)."` - erkennbar KEIN Erfolg, da explizit
  "0 Tage" genannt wird statt einer positiven Formulierung.

**Bewusste Entscheidung/Kompromiss (offen zu benennen):** Punkt 8 verlangt
"keine neue Farbklasse, keine harten Tailwind-Farben" für die
Ergebnismeldung UND die Nutzung "der bestehenden Meldungsfläche der
Komponente". Diese bestehende Fläche (`error`-State) trägt selbst bereits
seit AUFTRAG_10 harte Tailwind-Rot-Klassen (`border-red-300 bg-red-50
text-red-700`) - das ist BESTANDSCODE, keine neue Stelle, und wird von mir
nicht geändert (nicht auf der Positivliste als "Umbau" vorgesehen, auch
inhaltlich außerhalb des Auftragsumfangs). Die Folge: eine ERFOLGREICHE
Zeitraum-Zuweisung erscheint optisch in derselben roten Fehlerbox wie ein
echter Fehler - fachlich nicht ideal, aber die einzige Lösung, die weder
eine neue Farbklasse einführt noch eine zweite State-Variable mit eigenem
Styling erzeugt. Eine Umstellung der Fehlerbox auf neutrale Tokens steht
ausdrücklich auf der Negativliste dieses Auftrags ("Umstellung der Fehlerbox
auf Tokens... eigene Scheibe"). Diese Einschränkung ist hiermit explizit
benannt.

## Wächtertest (`app/test/auftrag18-dispo-zeitraum.test.mjs`, 12 Fälle)

1. `assignOnCallRange` existiert, verwendet `STAFF_ALLOWED_ROLES`,
   `withUserTransaction` und `on conflict`.
2. Beide serverseitigen Grenzprüfungen (`toIso < fromIso`,
   `countDaysInclusive(...) > MAX_RANGE_DAYS`) stehen im Funktionskörper.
3. Beide `on conflict`-Formulierungen passen wortgleich auf die beiden
   partiellen Indizes aus `0022_hlk_dispo_board.sql`.
4. `MAX_RANGE_DAYS = 92` als benannte, exportierte Konstante in
   `on-call-plan-actions.ts`.
5. `OnCallPlanClient.tsx` importiert dieselbe `MAX_RANGE_DAYS` (kein
   zweiter, abweichender Zahlenwert) und definiert keine eigene Konstante
   dieses Namens.
6. Der Dialog wird über `openAssignDialog` in `onCellClick`, im
   Nicht-move-Zweig von `onCellDrop` und in `onConfirmPrompt` geöffnet,
   NICHT in `handleDropOrClickAssign` (Verschiebepfad).
7. `handleAssignSingleDay` und `handleAssignRange` sind getrennte
   Funktionen.
8. `closeAssignDialog` ruft keine Server-Action bzw. keinen Action-Runner
   auf.
9. Der Zeitraum-Pfad ermittelt `isoDatesInRange(fromIso, rangeToIso)` und
   prüft jeden Tag einzeln über `findConflictingEntry`.
10. Beide Grenzprüfungen (Bis vor Von, 92-Tage-Obergrenze) stehen im
    Quelltext VOR dem Aufruf von `runRangeAction`.
11. Keine harte Tailwind-Farbklasse in `AssignRangeDialog`,
    `handleAssignRange` oder `runRangeAction`.
12. Keine harte Tailwind-Farbklasse in `assignOnCallRange`.

## Stopppunkt (verbindlich zu melden, siehe Auftragstext)

**Symptom:** `test/auftrag10-bereitschaftsplan.test.mjs` (AUFTRAG_10,
außerhalb der Positivliste dieses Auftrags) enthält die Prüfung:

```js
const usages = source.match(/STAFF_ALLOWED_ROLES\.includes\(session\.role\)/g) ?? [];
assert.equal(usages.length, 4, ...);
```

Diese Zählung war bei AUFTRAG_14 auf "genau 4" festgelegt (assignOnCall,
removeOnCall, assignDispo, moveOnCallEntry). AUFTRAG_18 Punkt 7 verlangt
ausdrücklich: "Dieselbe Rollen-Allowlist ... wie assignOnCall/assignDispo
... kein eigener, abweichender Prüfpfad." `assignOnCallRange()` verwendet
deshalb notwendigerweise exakt dasselbe Muster
`STAFF_ALLOWED_ROLES.includes(session.role)` ein fünftes Mal - fachlich
korrekt und vom Auftrag gefordert, macht aber die alte, hart auf "4"
zählende Prüfung zwangsläufig rot.

**Was ich NICHT getan habe:**

- Ich habe `test/auftrag10-bereitschaftsplan.test.mjs` NICHT geändert - sie
  steht nicht auf der Positivliste dieses Auftrags.
- Ich habe `assignOnCallRange()` NICHT mit einem abweichend formulierten
  Prüfpfad (z. B. anderer Variablenname, Umformulierung nur um die Zählung
  zu umgehen) versehen - das wäre ein "eigener, abweichender Prüfpfad" und
  hätte Punkt 7 verletzt bzw. eine Testzählung durch Kosmetik statt durch
  echte Übereinstimmung erfüllt.

**Ergebnis:** 203 von 204 Tests sind grün; der eine rote Test ist exakt
dieser vorbestehende, jetzt überholte Zähler. Das ist der im Auftrag
benannte Stopppunkt ("`tsc` nicht Exit 0 ergibt oder ein Bestandstest rot
wird") - ich halte hier an und melde es, statt eigenmächtig eine der beiden
Dateien gegen die Positivliste bzw. gegen Punkt 7 zu ändern. Für die
Auflösung sehe ich zwei Möglichkeiten, die Entscheidung liegt beim
Orchestrator/Dennis:

1. `test/auftrag10-bereitschaftsplan.test.mjs` Zeile ~198-203 wird in einem
   FOLGEAUFTRAG auf `5` (oder `>= 4`) aktualisiert und die Fehlermeldung
   entsprechend um "assignOnCallRange" ergänzt - fachlich korrekt, da die
   Allowlist jetzt für FÜNF statt vier Aktionen gilt (derselbe Schritt, den
   AUFTRAG_14 bereits einmal von "zwei" auf "vier" ausgeführt hat).
2. Alternative Formulierung von `assignOnCallRange()`, die dieselbe Wirkung
   ohne den identischen Teilstring erzielt - das widerspräche jedoch dem
   Wortlaut von Punkt 7 ("kein eigener, abweichender Prüfpfad") und wird von
   mir deshalb NICHT empfohlen.

## Messwerte (aus `app/`)

- `npx tsc --noEmit` → **Exit 0**.
- `node --test test/*.test.mjs` → **204 Tests gesamt** (192 bisherige + 12
  neue), **pass 203, fail 1**, **Exit-Code des Testlaufs selbst war 0**
  (Node meldet den Testfehler über die TAP-Ausgabe `not ok`, nicht über den
  Prozess-Exit-Code in dieser Umgebung) - der EINE fehlgeschlagene Fall ist
  exakt `on-call-plan-actions.ts: assignOnCall/removeOnCall/assignDispo/
  moveOnCallEntry pruefen ueber dieselbe benannte Staff-Allowlist` aus
  `auftrag10-bereitschaftsplan.test.mjs` (siehe Stopppunkt oben). Alle 12
  neuen Fälle aus `auftrag18-dispo-zeitraum.test.mjs` sind grün.
- `grep -c $'\r' test/auftrag18-dispo-zeitraum.test.mjs` → **0** (LF, wie
  gefordert).
- Dateizeitstempel-Nachweis (`find src test -newer
  ../00-Projektsteuerung/AUFTRAG_18.md -type f`) → genau die drei Dateien
  der Positivliste, keine weitere.
- `npm run build`, ESLint, ein echter PostgreSQL-Lauf: NICHT ausgeführt
  (Umgebungseinschränkung laut Auftrag) - keine Behauptung eines solchen
  Laufs.

## Offene Risiken

1. **Der Stopppunkt selbst** (siehe oben) - der Arbeitsbaum ist aktuell
   NICHT bei "192/192 plus neue Fälle grün", sondern bei 203/204, bis der
   Zähler in `auftrag10-bereitschaftsplan.test.mjs` angepasst wird.
2. **Grenze der Doppelbelegungsprüfung** (Punkt 5, wie oben ausführlich
   benannt): Zeiträume, die über die geladene Woche/den geladenen Monat
   hinausreichen, können dortige Dubletten nicht erkennen. Erwartet, nicht
   gelöst.
3. **Kein echter DB-Lauf.** Die `on conflict`-Arbiter-Übereinstimmung mit
   den partiellen Indizes ist anhand der PostgreSQL-Dokumentation zur
   Arbiter-Inferenz sorgfältig geprüft und mit dem Wortlaut aus `0022`
   Zeichen für Zeichen abgeglichen, aber mangels PostgreSQL in dieser
   Sandbox NICHT gegen eine echte Datenbank getestet.
4. **Optischer Kompromiss bei Punkt 8** (siehe dort): eine erfolgreiche
   Zeitraum-Zuweisung erscheint in derselben roten Bestandsfehlerbox wie ein
   Fehler, weil die Umstellung dieser Fläche auf neutrale Tokens
   ausdrücklich auf der Negativliste dieses Auftrags steht.
5. **`handleDropOrClickAssign` enthält jetzt toten Code** für den
   ehemaligen "kind: new"-Zweig (direkter `assignOnCall`/`assignDispo`-
   Aufruf ohne Dialog): dieser Zweig wird von keinem Aufrufer mehr mit
   `kind: "new"` erreicht, weil alle drei Neuzuweisungs-Einstiege jetzt
   `openAssignDialog` statt `handleDropOrClickAssign` rufen. Der Code bleibt
   textlich unverändert stehen, damit der bestehende Wächtertest
   `auftrag17-dispo-regeln.test.mjs` (außerhalb der Positivliste, NICHT
   angefasst) grün bleibt - er prüft die exakte Reihenfolge und den
   Wortlaut innerhalb dieser Funktion statisch. Funktional harmlos (die
   Funktion bleibt für den Verschiebepfad korrekt), aber ein
   Code-Qualitäts-Befund für eine spätere Aufräum-Scheibe.

## Stopppunkt: JA - siehe Abschnitt "Stopppunkt" oben

Anhalten und Rückmeldung erfolgt hiermit gemäß Meldeweg. Kein `git commit`,
kein `push`, keine Migration, keine der verbotenen Dateien angefasst.
