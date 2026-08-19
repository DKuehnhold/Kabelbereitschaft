# AUFTRAG_20 — Korrektur zu AUFTRAG_18: unbegrenzte Tagesliste im „von–bis"-Dialog

> Erteilt vom Orchestrator/Review-Chat, 2026-08-18, aus der eigenen Nachmessung zu AUFTRAG_18.
> **Kein Befund des Ausführungsagenten** — er hat AUFTRAG_18 sonst auftragsgemäß umgesetzt.

## Befund (Fundstelle)

`app/src/components/on-call-plan/OnCallPlanClient.tsx`, `isoDatesInRange()` (ab Zeile 346)
baut die Tagesliste in einer **unbegrenzten** Schleife auf:

```ts
const isoDatesInRange = (fromIso: string, toIso: string): string[] => {
  const days: string[] = [];
  let cursor = fromIso;
  for (;;) {
    days.push(cursor);
    if (cursor === toIso) break;
    cursor = addDaysToIsoDate(cursor, 1);
  }
  return days;
};
```

Aufgerufen wird sie in `handleAssignRange()` Zeile 394 — **vor** der Grenzprüfung in Zeile 396
(`days.length > MAX_RANGE_DAYS`). Die 92-Tage-Grenze greift also erst, **nachdem** die Liste
vollständig gebaut ist.

**Wirkung:** ein Tippfehler im Jahr im „Bis"-Feld (etwa `2926-08-24` statt `2026-08-24` — ein
`<input type="date">` nimmt das an) erzeugt rund **330.000** Schleifendurchläufe und
Zeichenketten, bevor die Prüfung überhaupt erreicht wird. Der Browser-Tab friert ein. Genau
dieser Tippfehler ist der Fall, gegen den die Grenze laut AUFTRAG_18 Punkt 4 schützen soll —
sie ist an dieser Stelle also wirkungslos.

**Der Serverpfad ist korrekt** und ausdrücklich nicht betroffen: `countDaysInclusive()` in
`on-call-plan-actions.ts` bricht früh ab (`if (count > limit) return count;`). Die Datenbank ist
nicht gefährdet, es geht allein um die Oberfläche.

## Ziel

Die Grenze wirkt **vor** dem Aufbau der Liste. Ein unplausibles „Bis" führt zu derselben
sachlichen Meldung im Dialog wie heute, ohne dass die Oberfläche vorher rechnet.

## Positivliste (nur diese Datei)

- `app/src/components/on-call-plan/OnCallPlanClient.tsx`

## Umzusetzen

1. Die Tagesanzahl **zuerst** mit einem früh abbrechenden Zähler bestimmen — dasselbe Muster
   wie `countDaysInclusive()` im Serverpfad. Der Zähler darf `MAX_RANGE_DAYS` um höchstens
   einen Schritt überschreiten, bevor er abbricht.
2. Überschreitet die Anzahl `MAX_RANGE_DAYS`, wird die bestehende Meldung gesetzt und
   zurückgekehrt — **ohne** dass `isoDatesInRange()` gelaufen ist.
3. `isoDatesInRange()` erhält zusätzlich eine **harte Obergrenze** als Sicherheitsnetz: die
   Funktion darf unter keinen Umständen mehr als `MAX_RANGE_DAYS + 1` Einträge erzeugen, auch
   wenn ein künftiger Aufrufer die Prüfung aus Punkt 1 vergisst. Diese Schranke ist als solche
   zu kommentieren.
4. Die Reihenfolge der übrigen Prüfungen in `handleAssignRange()` bleibt: „Bis vor Von" zuerst,
   dann die Obergrenze, dann die Doppelbelegungs-Rückfrage, dann der Serveraufruf. Wortlaute der
   Meldungen und der Rückfrage bleiben **zeichengleich**.
5. Der bestehende Wächtertest `app/test/auftrag18-dispo-zeitraum.test.mjs` darf **nicht**
   geändert werden; er muss weiterhin grün sein. Reicht er nicht aus, um die neue Reihenfolge
   festzuhalten, ist das in `MELDUNG_20.md` als Lücke zu melden — **nicht** eigenmächtig
   nachzurüsten (die Datei steht nicht auf der Positivliste).

## Negativliste (ausdrücklich verboten)

- `on-call-plan-actions.ts` ändern (der Serverpfad ist korrekt), ebenso `date-local.ts`,
  `on-call-plan.ts`, `globals.css`, jede Testdatei, `app/supabase/**`, `.claude/**`.
- `MAX_RANGE_DAYS` ändern oder eine zweite Zahlenquelle einführen.
- Meldungstexte umformulieren.
- Die Bedienmängel aus REVIEW_17 anfassen (Drag-Feedback, Sperrzustand, Tastaturbedienung,
  Leerzustände, Fehlerbox) — eigene Scheibe.
- `git commit`, `push`, `merge`, `tag`, `release`.

## DoD (prüfbar)

1. Geändert ist **genau** `app/src/components/on-call-plan/OnCallPlanClient.tsx` (Nachweis über
   Dateizeitstempel).
2. Aus `app/`: `npx tsc --noEmit` → **Exit 0**.
3. Aus `app/`: `node --test test/*.test.mjs` → **204/204, fail 0, Exit 0** (unveränderte
   Fallzahl, es kommt kein Test hinzu).
4. **Rechnerischer Nachweis der Wirkung**, ohne Browser: die neue Zählfunktion in einem
   Wegwerf-Node-Aufruf (nur auf stdout, **keine** Datei im Vault) mit `fromIso = "2026-08-24"`
   und `toIso = "2926-08-24"` aufrufen und belegen, dass sie nach höchstens
   `MAX_RANGE_DAYS + 1` Schritten abbricht. Vorgehen und Ergebnis in `MELDUNG_20.md`; falls die
   Funktion nicht isoliert aufrufbar ist, stattdessen die Schleifenschranke im Quelltext
   wörtlich zitieren und das offen als „statischer Nachweis" kennzeichnen.
5. `MELDUNG_20.md` nennt: die Datei, die neue Prüfreihenfolge, den Nachweis aus Punkt 4, die
   Messwerte mit Exit-Codes und offene Risiken.

## Stopppunkt

Anhalten und melden, wenn die Korrektur eine Änderung außerhalb der Positivliste nötig machen
würde, `tsc` nicht Exit 0 ergibt oder ein Bestandstest rot wird.

## Meldeweg

`00-Projektsteuerung/MELDUNG_20.md`.
