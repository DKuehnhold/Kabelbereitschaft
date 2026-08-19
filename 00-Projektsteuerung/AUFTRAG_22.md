# AUFTRAG_22 — Korrektur zum Stopppunkt von AUFTRAG_20: Wächter prüft Zeichenkette statt Absicht

> Erteilt vom Orchestrator/Review-Chat, 2026-08-18. Grundlage: der in `MELDUNG_20.md` gemeldete
> **Stopppunkt**. Der Ausführungsagent hat richtig gehandelt: er hat die fremde Testdatei nicht
> angefasst und die Lücke gemeldet, statt sie eigenmächtig zu schließen.

## Befund (selbst nachgemessen)

`node --test test/*.test.mjs` ergibt **208 Fälle, 207 grün, 1 rot**:

```
not ok 174 - Bis vor Von und die 92-Tage-Obergrenze werden im Dialog VOR jedem
             Schreibvorgang geprüft (kein Schreiben bei Verstoß)
  error: 'Prüfung der 92-Tage-Obergrenze nicht gefunden'
```

Fundstelle: `app/test/auftrag18-dispo-zeitraum.test.mjs:189`

```js
const maxCheckIndex = body.indexOf("days.length > MAX_RANGE_DAYS");
```

Der Wächter sucht die Grenzprüfung als **wörtliche Zeichenkette**. AUFTRAG_20 hat genau diese
Formulierung ersetzen müssen — die Prüfung läuft jetzt über den früh abbrechenden Zähler
`countDaysInRange(...) > MAX_RANGE_DAYS`, **bevor** die Tagesliste gebaut wird. Die Absicht des
Wächters („beide Grenzprüfungen stehen vor dem Schreibvorgang") ist damit **erfüllt**; nur seine
Formulierung passt nicht mehr.

**Kein Fehler im Produktivcode.** Das ist dasselbe Muster wie der Stopppunkt aus AUFTRAG_18
(dort: fest eingetragene Anzahl, behoben mit AUFTRAG_19): ein statischer Wächter, der eine
Momentaufnahme des Quelltextes festschreibt statt der Regel, die er sichern soll.

## Ziel

Der Wächter prüft die **Absicht**: gegen `MAX_RANGE_DAYS` wird verglichen, und dieser Vergleich
steht **vor** dem Aufbau der Tagesliste **und** vor dem Schreibvorgang. Er soll unabhängig davon
grün bleiben, wie der Vergleich formuliert ist — und rot werden, wenn die Reihenfolge kippt.

## Positivliste (nur diese Datei)

- `app/test/auftrag18-dispo-zeitraum.test.mjs`

## Umzusetzen

Im Testfall ab Zeile 184:

1. Die wörtliche Suche nach `"days.length > MAX_RANGE_DAYS"` durch eine Suche nach einem
   **Vergleich gegen `MAX_RANGE_DAYS`** ersetzen (z. B. ein Muster wie `/>\s*MAX_RANGE_DAYS/`),
   so dass sowohl die alte als auch die neue Formulierung erkannt wird.
2. Die Prüfung **verschärfen** — das ist die eigentliche Regel aus AUFTRAG_20 und heute
   nirgends festgehalten: der Vergleich gegen `MAX_RANGE_DAYS` muss **vor** dem Aufruf von
   `isoDatesInRange(` stehen. Kippt die Reihenfolge zurück, wird der Wächter rot. Die
   Fehlermeldung soll sagen, worum es geht (Grenze greift erst nach dem Aufbau der Liste →
   Browser friert bei einem Tippfehler im Jahr ein).
3. Zusätzlich festhalten, dass `isoDatesInRange` ein **Sicherheitsnetz** trägt: in ihrem Rumpf
   kommt `MAX_RANGE_DAYS` vor. Damit ist auch Punkt 3 aus AUFTRAG_20 abgesichert.
4. Die bestehenden Prüfungen des Falls („Bis vor Von" vorhanden, beide Prüfungen vor
   `runRangeAction(`) bleiben **unverändert** erhalten.
5. Kommentar über dem Testfall auf den neuen Ansatz nachziehen, mit Herkunft (AUFTRAG_22,
   Stopppunkt aus AUFTRAG_20) und der Begründung, warum nicht auf Zeichenketten geprüft wird.

## Negativliste (ausdrücklich verboten)

- Jede Änderung an Produktivcode, insbesondere `OnCallPlanClient.tsx` und
  `on-call-plan-actions.ts`.
- Jede andere Testdatei.
- Den Wächter abschwächen, überspringen (`skip`, `todo`), auskommentieren oder auf eine reine
  Existenzprüfung ohne Reihenfolge reduzieren.
- Die übrigen Fälle derselben Datei anfassen.
- `git commit`, `push`, `merge`, `tag`, `release`.

## DoD (prüfbar)

1. Geändert ist **genau** `app/test/auftrag18-dispo-zeitraum.test.mjs` (Nachweis über
   Dateizeitstempel).
2. Aus `app/`: `node --test test/*.test.mjs` → **208 Fälle, 208 grün, fail 0, Exit 0**. Der
   Lauf braucht 60–90 s; großzügiges Zeitlimit setzen, nicht vorzeitig abbrechen.
3. Aus `app/`: `npx tsc --noEmit` → **Exit 0**.
4. **Gegenprobe der Wirksamkeit, zwingend** (Muster aus AUFTRAG_19): in
   `OnCallPlanClient.tsx` die Reihenfolge **vorübergehend** zurückdrehen, so dass die
   Grenzprüfung erst nach `isoDatesInRange(` steht; Einzeltest laufen lassen (Erwartung: **rot**
   mit der neuen, sprechenden Meldung); Änderung **vollständig zurücknehmen**; erneut grün
   messen. Beide Ergebnisse in `MELDUNG_22.md` belegen und über einen Hashvergleich
   (`sha256sum`) **vor** und **nach** der Gegenprobe bestätigen, dass
   `OnCallPlanClient.tsx` am Ende unverändert ist.
5. `MELDUNG_22.md` nennt: die geänderte Datei, den neuen Prüfansatz, das Ergebnis der
   Gegenprobe samt Hashvergleich, die Messwerte mit Exit-Codes und offene Risiken.

## Stopppunkt

Anhalten und melden, wenn die Gegenprobe sich nicht rückstandsfrei zurücknehmen lässt, der
Gesamtlauf nicht 208/208 ergibt oder `tsc` nicht Exit 0 liefert.

## Meldeweg

`00-Projektsteuerung/MELDUNG_22.md`.
