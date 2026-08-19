# AUFTRAG_19 — Korrektur zum Stopppunkt von AUFTRAG_18: Wächterzähler selbsttragend machen

> Erteilt vom Orchestrator/Review-Chat, 2026-08-18. Grundlage: der in `MELDUNG_18.md`
> gemeldete **Stopppunkt**. Der Ausführungsagent von AUFTRAG_18 hat korrekt angehalten, statt
> eine fremde Testdatei anzufassen oder den Prüfpfad künstlich anders zu formulieren.

## Befund (selbst nachgemessen)

`node --test test/*.test.mjs` ergibt **204 Fälle, 203 grün, 1 rot**. Der rote ist

```
not ok 133 - on-call-plan-actions.ts: assignOnCall/removeOnCall/assignDispo/moveOnCallEntry
             pruefen ueber dieselbe benannte Staff-Allowlist
  error: STAFF_ALLOWED_ROLES.includes(session.role) wird 5x statt 4x verwendet
  5 !== 4
```

Fundstelle: `app/test/auftrag10-bereitschaftsplan.test.mjs:172`. Der Wächter zählt die
Verwendungen der Rollen-Allowlist gegen eine **fest eingetragene Zahl**. Diese Zahl wurde in
AUFTRAG_10 auf 2 gesetzt und in AUFTRAG_14 auf 4 angehoben (Kommentar ab Zeile 194). AUFTRAG_18
hat mit `assignOnCallRange()` eine **fünfte** schreibende Server-Action ergänzt, die
auftragsgemäß **denselben** Prüfpfad verwendet — damit muss der alte Zähler zwangsläufig rot
werden.

**Das ist kein Fehler im Produktivcode.** Der Wächter selbst ist zu starr: seine Absicht ist
„**jede** schreibende Action prüft über die benannte Allowlist", ausgedrückt hat er sie aber als
Momentaufnahme einer Anzahl. Jede weitere Action wird ihn erneut rot machen — und der bequeme
Ausweg (Zahl hochzählen) verschiebt das Problem nur.

## Ziel

Der Wächter prüft künftig die **Absicht** statt einer Zahl: die Anzahl der Allowlist-Prüfungen
in `on-call-plan-actions.ts` muss der Anzahl der **exportierten schreibenden Server-Actions**
derselben Datei entsprechen. Damit ist er selbsttragend — eine neue Action ohne Prüfung wird
rot, eine neue Action **mit** Prüfung bleibt grün, ohne dass jemand eine Zahl pflegen muss.

## Positivliste (nur diese Datei)

- `app/test/auftrag10-bereitschaftsplan.test.mjs`

## Umzusetzen

Im Testfall ab Zeile 172:

1. Die harte Zahl **4** entfernen. Stattdessen aus dem Quelltext von
   `app/src/lib/on-call-plan-actions.ts` beide Mengen zählen:
   - die Vorkommen von `STAFF_ALLOWED_ROLES.includes(session.role)`,
   - die exportierten Server-Actions (`export async function …`).
   Beide Zahlen müssen **gleich** sein; die Fehlermeldung nennt beide Werte und die Namen der
   gefundenen Actions, damit man bei Rot sofort sieht, welche Action die Prüfung vermisst.
2. Zusätzlich, damit der Wächter nicht durch eine Umformulierung ausgehebelt werden kann:
   sicherstellen, dass die Zahl **mindestens 5** ist. Das ist keine Momentaufnahme, sondern
   eine untere Schranke gegen ein versehentliches Entfernen bestehender Prüfungen — sie muss
   als solche kommentiert sein.
3. Den Kommentarblock über dem Testfall auf den neuen, selbsttragenden Ansatz umschreiben und
   die Herkunft nennen (AUFTRAG_19, Stopppunkt aus AUFTRAG_18). Der Hinweis „ausdrücklich ein
   statischer Wächter und kein Verhaltensnachweis" bleibt erhalten.

Der Testname darf angepasst werden, wenn er sonst die Actions falsch aufzählt; er soll nicht
länger vier Namen fest nennen.

## Negativliste (ausdrücklich verboten)

- Jede Änderung an Produktivcode, insbesondere `app/src/lib/on-call-plan-actions.ts` und
  `OnCallPlanClient.tsx`.
- Jede Änderung an einer anderen Testdatei.
- Den Wächter abschwächen, überspringen (`skip`, `todo`), auskommentieren oder auf eine reine
  Existenzprüfung reduzieren.
- Die Prüfung auf `const STAFF_ALLOWED_ROLES: readonly UserRole[] = ["admin", "disponent"];`
  und die Negativlisten-Prüfung (`role === "monteur"` nur als Kommentar) entfernen oder
  lockern — beide bleiben unverändert.
- `git commit`, `push`, `merge`, `tag`, `release`.

## DoD (prüfbar)

1. Geändert ist **genau** `app/test/auftrag10-bereitschaftsplan.test.mjs` (Nachweis über
   Dateizeitstempel).
2. Aus `app/`: `node --test test/*.test.mjs` → **204 Fälle, 204 grün, fail 0, Exit 0**.
   Zahlen wörtlich melden.
3. Aus `app/`: `npx tsc --noEmit` → **Exit 0** (Gegenprobe, dass nichts anderes berührt wurde).
4. **Gegenprobe der Wirksamkeit, zwingend:** einmal nachweisen, dass der neue Wächter
   tatsächlich greift — dazu **vorübergehend** eine Allowlist-Prüfung in
   `on-call-plan-actions.ts` entfernen, den Einzeltest laufen lassen (Erwartung: **rot** mit
   der neuen, sprechenden Meldung), die Änderung **vollständig zurücknehmen** und danach
   erneut grün messen. Beide Läufe mit Ergebnis in `MELDUNG_19.md` belegen und ausdrücklich
   bestätigen, dass `on-call-plan-actions.ts` am Ende **unverändert** ist
   (`git diff --stat` dieser einen Datei vor und nach der Gegenprobe vergleichen und die
   Gleichheit melden).
5. `MELDUNG_19.md` nennt: die geänderte Datei, den neuen Prüfansatz, das Ergebnis der
   Gegenprobe aus Punkt 4, die Messwerte mit Exit-Codes und offene Risiken.

## Stopppunkt

Anhalten und melden, wenn

- die exportierten Actions im Quelltext nicht zuverlässig zählbar sind (z. B. weil eine Action
  anders exportiert wird als `export async function`);
- die Gegenprobe aus DoD 4 sich nicht rückstandsfrei zurücknehmen lässt;
- der Gesamtlauf nach der Änderung nicht 204/204 ergibt.

## Meldeweg

`00-Projektsteuerung/MELDUNG_19.md`. Danach messt der Orchestrator/Review-Chat selbst nach.
