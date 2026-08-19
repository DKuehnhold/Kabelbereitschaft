# MELDUNG_24 — Build-Blocker `MAX_RANGE_DAYS` behoben

## Umsetzung

`MAX_RANGE_DAYS` ist aus `app/src/lib/on-call-plan-actions.ts` (trägt `"use server"`) in ein
neues, seiteneffektfreies Modul **`app/src/lib/on-call-plan-limits.ts`** (ohne `"use server"`,
ohne Import) verlagert. Beide bisherigen Konsumenten importieren jetzt aus diesem einen Modul —
es gibt weiterhin nur **eine** Quelle des Werts 92, kein zweites Zahlenliteral:

- `app/src/lib/on-call-plan-actions.ts` — Export `MAX_RANGE_DAYS` entfernt, stattdessen
  `import { MAX_RANGE_DAYS } from "@/lib/on-call-plan-limits";`. Serverseitige Grenzprüfungen in
  `assignOnCallRange()` inhaltlich unverändert.
- `app/src/components/on-call-plan/OnCallPlanClient.tsx` — importiert `MAX_RANGE_DAYS` jetzt aus
  `@/lib/on-call-plan-limits` statt aus `on-call-plan-actions`. Die übrigen Importe (Actions,
  Typen) unverändert.
- `app/test/auftrag18-dispo-zeitraum.test.mjs` — die zwei betroffenen Fälle auf das neue Modul
  umgestellt, plus **neuer Wächterfall**: prüft über alle Dateien unter `app/src`, die
  `"use server"` tragen, dass jeder Export entweder `export async function` oder ein Typ-Export
  ist (und bestätigt zusätzlich, dass es genau neun solcher Dateien gibt).

Geändert/neu sind **genau** die vier Dateien der Positivliste (per Zeitstempel geprüft, siehe
unten). Keine weitere Produktiv- oder Testdatei angefasst, keine neue npm-Abhängigkeit, kein
`git commit`/`push`/etc.

## Messwerte

**Unit-Tests** (`app/`: `node --test test/*.test.mjs`):
```
1..227
# tests 227
# suites 0
# pass 227
# fail 0
# cancelled 0
# skipped 0
# todo 0
```
→ **Exit 0**. Die bisherigen 226 sind weiterhin grün, plus der neue Wächterfall (227. Test) —
insgesamt 227/227.

**TypeScript** (`app/`: `npx tsc --noEmit`):
→ keine Ausgabe, **Exit 0**.

## Nachweis: `grep -n "92"`

```
--- on-call-plan-limits.ts ---
1:// Obergrenze eines Zeitraums: 92 Tage (ein Quartal - das laengste
2:// Kalenderquartal, z. B. Juli-September, hat 92 Tage). Schutz gegen einen
20:export const MAX_RANGE_DAYS = 92;
--- on-call-plan-actions.ts ---
268:// MAX_RANGE_DAYS (92 Tage, ein Quartal) liegt seit AUFTRAG_24 in
309: * Die Oberflaeche prueft "Bis vor Von" und die 92-Tage-Grenze bereits selbst
348:  // Punkt 4: Obergrenze 92 Tage - ebenfalls serverseitig wiederholt.
--- OnCallPlanClient.tsx ---
450:    // Punkt 4: Obergrenze 92 Tage (ein Quartal), harter Fehler - Anzahl ZUERST
```
Einordnung: die einzige **Code-Zuweisung** `= 92` (der eigentliche Zahlenwert) steht genau
einmal, in `on-call-plan-limits.ts` Zeile 20. Die übrigen Treffer sind Kommentare, die den Wert
92 Tage nur beschreiben (unverändert bzw. aus dem verlagerten Kommentar übernommen) — es gibt
keinen zweiten `export const`/`const … = 92`.

## Nachweis: Exporte in `on-call-plan-actions.ts`

Befehl:
```
grep -n "^export " src/lib/on-call-plan-actions.ts | grep -vE "^[0-9]+:export (async function|type)"
```
Ausgabe: **leer** (Exit 1 von grep = kein Treffer = keine Verstöße). Zur Vollständigkeit alle
Export-Zeilen:
```
41:export type OnCallPlanActionResult = { ok: boolean; error: string | null };
63:export async function assignOnCall(
104:export async function removeOnCall(entryId: string): Promise<OnCallPlanActionResult> {
140:export async function assignDispo(
173:export type OnCallMoveTarget =
188:export async function moveOnCallEntry(
253:export type OnCallRangeTarget =
263:export type OnCallPlanRangeResult = OnCallPlanActionResult & {
327:export async function assignOnCallRange(
```
→ jeder Export ist entweder `export async function` oder `export type`. Bestätigt.

## Nachweis: alle neun `"use server"`-Dateien

Befehl (Direktive in den ersten 5 Zeilen, nicht bloße Textnennung):
```
for f in $(find src -type f \( -name "*.ts" -o -name "*.tsx" \)); do
  head -5 "$f" | grep -qE '^\s*"use server";?\s*$' && echo "$f"
done
```
Ausgabe (genau neun Dateien, deckungsgleich mit dem Auftrag):
```
src/app/login/actions.ts
src/app/passwort-aendern/actions.ts
src/lib/image-actions.ts
src/lib/incident-actions.ts
src/lib/incident-list-actions.ts
src/lib/inventory-actions.ts
src/lib/masterdata-actions.ts
src/lib/on-call-plan-actions.ts
src/lib/task-actions.ts
```
Export-Prüfung über jede dieser neun Dateien (`grep -n "^export " <datei> | grep -vE
"^[0-9]+:export (async function|type|interface)"`): **für alle neun Dateien leer** — keine
weiteren Verstöße gefunden. Der neue Wächterfall in `auftrag18-dispo-zeitraum.test.mjs` bildet
genau diese Prüfung automatisiert ab und ist Teil der 227 grünen Tests.

**Stopppunkt nicht ausgelöst**: kein weiterer Verstoß in den acht übrigen `"use server"`-Dateien
gefunden — der Auftrag betraf ausschließlich Zeile 275 in `on-call-plan-actions.ts`, wie im
Befund vorab bestätigt.

## Nachbesserung 2026-08-18 (untere Schranke statt fester Anzahl)

**Befund**: Der in AUFTRAG_24 ergänzte Wächterfall in
`app/test/auftrag18-dispo-zeitraum.test.mjs` prüfte die Anzahl der `"use server"`-Dateien mit
`assert.equal(useServerFiles.length, 9, ...)` — exakte Gleichheit auf eine Momentaufnahme. Genau
diese Bruchstelle hatte schon zweimal einen Korrekturauftrag ausgelöst (AUFTRAG_19: fest
eingetragene Anzahl 4; AUFTRAG_22: wörtliche Zeichenkette) und steht als Projektlehre in
PROJEKT_WISSEN.md: ein statischer Wächter darf keine Momentaufnahme festschreiben, sondern muss
die Absicht prüfen. Eine künftige, legitime neue Server-Actions-Datei hätte den Test zwangsläufig
rot gemacht.

**Geänderte Stelle**: ausschließlich `app/test/auftrag18-dispo-zeitraum.test.mjs`, der eine
Wächterfall aus AUFTRAG_24 (Zeilen um die Prüfung der `"use server"`-Dateien).
- `assert.equal(useServerFiles.length, 9, ...)` ersetzt durch
  `assert.ok(useServerFiles.length >= 9, ...)` mit einer Fehlermeldung, die erklärt, dass die
  Schranke davor schützt, dass der Dateiscan ins Leere läuft (ein Scan mit 0 Treffern wäre sonst
  stillschweigend grün).
- Testkopf-Kommentar ergänzt: begründet die untere Schranke statt fester Zahl mit Verweis auf die
  Projektlehre aus AUFTRAG_19/22.
- Die eigentliche Prüfung (jeder Export in einer `"use server"`-Datei ist `export async function`
  oder ein Typ-Export) ist **unverändert** und unverändert scharf geblieben.

**Messwerte**:
- `app/`: `node --test test/*.test.mjs` → `1..227`, `# pass 227`, `# fail 0`, **Exit 0**.
- `app/`: `npx tsc --noEmit` → keine Ausgabe, **Exit 0**.

**Gegenprobe der Wirksamkeit**: temporär `app/src/lib/__auftrag24-wegwerf-test.ts` angelegt mit
```
"use server";

export const WEGWERF_WERT = 42;
```
Einzeltest ausgeführt (`node --test --test-name-pattern="Jede .use server..Datei"
test/auftrag18-dispo-zeitraum.test.mjs`):
```
not ok 1 - Jede "use server"-Datei unter src exportiert ausschließlich async function oder Typen (Turbopack-Regel, AUFTRAG_24)
error: "use server"-Dateien mit einem Export, der weder async function noch Typ ist (Turbopack verwirft dort ALLE Exporte): .../src/lib/__auftrag24-wegwerf-test.ts: export const WEGWERF_WERT = 42;
```
→ **ROT**, mit sprechender Meldung — die inhaltliche Prüfung greift weiterhin, ausgelöst durch
den Wert-Export, nicht durch die Anzahl-Schranke (9 vs. 10 wäre mit `>=` ohnehin grün geblieben).

Wegwerfdatei restlos entfernt (`rm`), per `ls` bestätigt:
```
ls: cannot access '.../app/src/lib/__auftrag24-wegwerf-test.ts': No such file or directory
```
Einzeltest danach erneut ausgeführt: **grün** (`ok 1 - ...`, `# pass 1`, `# fail 0`).

Abschließend Gesamtsuite und `tsc` erneut bestätigt: 227/227 Tests grün, Exit 0; `tsc --noEmit`
Exit 0. Keine weitere Datei angefasst, kein `git commit`/`push`/etc., keine Hilfsdatei im Vault
verblieben.

## Ausdrücklicher Hinweis

`npm run build` ist in dieser Sandbox (OneDrive-/FUSE-Mount) **nicht ausführbar** und wurde
nicht versucht. Der endgültige Nachweis, dass der Produktions-Build wieder durchläuft, bleibt
**Dennis' lokaler Build**.

## Stopppunkte

Keiner der drei Stopppunkte ist eingetreten:
- Der Client bezieht `MAX_RANGE_DAYS` problemlos ohne weiteren Import aus dem neuen Modul.
- `tsc` ergibt Exit 0, kein Bestandstest ist rot geworden (227/227 grün).
- Der neue Wächterfall hat in keiner der acht übrigen `"use server"`-Dateien einen weiteren
  Verstoß gefunden.
