# MELDUNG 20 vom Worker-Chat zu AUFTRAG_20

> Stand: 2026-08-18. Verfasst von Claude (Rolle Worker, Ausführungsagent),
> Antwort auf `00-Projektsteuerung/AUFTRAG_20.md`. Schriftliche Notiz, kein
> Chat-Kanal.

## Ergebnis in Kürze

Die 92-Tage-Grenze im „von–bis"-Dialog wirkt jetzt **vor** dem Aufbau der
Tagesliste. `handleAssignRange()` bestimmt die Anzahl zuerst mit einer neuen,
früh abbrechenden Zählfunktion `countDaysInRange()` (exaktes Muster von
`countDaysInclusive()` in `on-call-plan-actions.ts`, nur lesend als Vorlage
verwendet). Erst wenn diese Prüfung besteht, läuft `isoDatesInRange()` für
die anschließende Doppelbelegungsprüfung. Zusätzlich trägt `isoDatesInRange()`
jetzt ein Sicherheitsnetz: eine harte Obergrenze von `MAX_RANGE_DAYS + 1`
Einträgen, falls ein künftiger Aufrufer Punkt 1 vergisst.

`tsc --noEmit` ist Exit 0. Von 204 Bestandstests sind 203 grün — **ein
vorhandener, außerhalb der Positivliste liegender Test wird rot**, siehe
„Stopppunkt/Befund" unten. Das ist exakt der in AUFTRAG_20 Punkt 5 erwartete
Fall („reicht der Wächtertest nicht aus... als Lücke melden, nicht
eigenmächtig nachrüsten") — ich habe den Test **nicht** angefasst.

## Geänderte Datei (Positivliste — genau eine)

- `app/src/components/on-call-plan/OnCallPlanClient.tsx`

**Nachweis über Dateizeitstempel:** `find . -newer src/lib/on-call-plan-actions.ts
-type f` (ausgeführt aus `app/`, node_modules/.next ausgeschlossen) liefert
ausschließlich `./src/components/on-call-plan/OnCallPlanClient.tsx` und
`./tsconfig.tsbuildinfo` (Build-Cache von `tsc`, kein Quelltext). Keine andere
Datei aus dem Arbeitsbaum ist neuer als der unveränderte Referenzstand.

## Neue Prüfreihenfolge in `handleAssignRange()`

1. „Bis vor Von" (unverändert, Wortlaut zeichengleich: *„Das Bis-Datum darf
   nicht vor dem Von-Datum liegen."*).
2. **Neu:** `countDaysInRange(fromIso, rangeToIso, MAX_RANGE_DAYS) >
   MAX_RANGE_DAYS` — bricht selbst ab, sobald `MAX_RANGE_DAYS` überschritten
   ist, ohne die vollständige Tagesliste zu bauen. Bei Verstoß dieselbe
   Meldung wie bisher (Wortlaut zeichengleich: *„Der Zeitraum darf höchstens
   92 Tage umfassen (Schutz gegen einen Tippfehler im Jahr)."*), kein
   Schreibvorgang.
3. Erst danach `isoDatesInRange(fromIso, rangeToIso)` — jetzt zusätzlich mit
   eigenem Sicherheitsnetz (bricht spätestens bei `MAX_RANGE_DAYS + 1`
   Einträgen ab, kommentiert im Quelltext).
4. Doppelbelegungs-Rückfrage über alle Tage (unverändert, Wortlaut
   zeichengleich).
5. Serveraufruf `assignOnCallRange()` über `runRangeAction()` (unverändert).

Die Reihenfolge „Bis vor Von" → Obergrenze → Rückfrage → Serveraufruf bleibt
wie gefordert erhalten; nur der interne Aufbau der Obergrenzenprüfung wurde
getauscht (Zähler statt Liste zuerst).

## Rechnerischer Nachweis der Wirkung (Punkt 4)

Die neue Zählfunktion `countDaysInRange()` ist eine lokale Closure innerhalb
der Komponente und daher nicht direkt aus einem eigenständigen Node-Prozess
importierbar. Ich habe sie deshalb 1:1 (identischer Algorithmus, identisches
`addDaysToIsoDate`-Verhalten für ISO-Kalendertage) in einem
Wegwerf-Node-Skript **außerhalb des Vaults** unter `/tmp/nachweis_auftrag20.mjs`
nachgebaut und mit `fromIso = "2026-08-24"`, `toIso = "2926-08-24"`
(Tippfehler im Jahr) sowie `limit = MAX_RANGE_DAYS = 92` aufgerufen. Ausgabe
auf stdout:

```
fromIso: 2026-08-24 toIso: 2926-08-24 limit: 92
Ergebnis count: 93 Schleifenschritte (steps): 92
Erwartung: steps <= MAX_RANGE_DAYS (= 92 ), da Abbruch bei count > limit
Bestanden: JA
Laufzeit (ms): 0.5276
```

Die Schleife läuft **genau 92 Schritte** (nicht die ca. 330.000, die
`addDaysToIsoDate` von `2026-08-24` bis `2926-08-24` sonst bräuchte) und
bricht ab, sobald `count` (93) den Grenzwert (92) um genau einen Schritt
überschreitet — exakt die in Punkt 1 des Auftrags verlangte Schranke
(„darf `MAX_RANGE_DAYS` um höchstens einen Schritt überschreiten"). Laufzeit
unter 1 ms statt eines eingefrorenen Tabs.

Ergänzend der wörtliche Auszug der Schranke aus dem tatsächlich geänderten
Quelltext (`OnCallPlanClient.tsx`), als zusätzlicher **statischer Nachweis**
für den in `handleAssignRange()` tatsächlich verwendeten Code:

```ts
const countDaysInRange = (fromIso: string, toIso: string, limit: number): number => {
  let count = 1;
  let cursor = fromIso;
  while (cursor < toIso) {
    cursor = addDaysToIsoDate(cursor, 1);
    count += 1;
    if (count > limit) return count;
  }
  return count;
};
```

sowie die Sicherheitsnetz-Schranke in `isoDatesInRange()`:

```ts
const isoDatesInRange = (fromIso: string, toIso: string): string[] => {
  const days: string[] = [];
  let cursor = fromIso;
  for (;;) {
    days.push(cursor);
    if (cursor === toIso) break;
    // Sicherheitsnetz (AUFTRAG_20 Punkt 3): harte Obergrenze unabhaengig
    // von der vorgelagerten Pruefung in handleAssignRange().
    if (days.length > MAX_RANGE_DAYS) break;
    cursor = addDaysToIsoDate(cursor, 1);
  }
  return days;
};
```

## Messwerte

| Prüfung | Befehl (aus `app/`) | Ergebnis |
|---|---|---|
| Typprüfung | `npx tsc --noEmit` | Exit 0 |
| Unit-Tests | `node --test test/*.test.mjs` | 204 Tests, **203 pass, 1 fail**, Exit 1 |
| Rechnerischer Nachweis | `node /tmp/nachweis_auftrag20.mjs` | 92 Schleifenschritte, `count=93`, s. oben |
| Zeilenenden neuer Dateien | entfällt (keine neue Datei in diesem Auftrag) | — |

## Stopppunkt / Befund: bestehender Wächtertest wird rot

`app/test/auftrag18-dispo-zeitraum.test.mjs` (Positivliste verbietet
Änderung, Punkt 5 des Auftrags — **nicht angefasst**), Test Nr. 10
„Bis vor Von und die 92-Tage-Obergrenze werden im Dialog VOR jedem
Schreibvorgang geprüft":

```
error: 'Prüfung der 92-Tage-Obergrenze nicht gefunden'
expected: -1
actual: -1
operator: 'notStrictEqual'
```

Ursache: der Test sucht **wörtlich** nach dem String
`"days.length > MAX_RANGE_DAYS"` innerhalb des Textkörpers von
`handleAssignRange()` (`body.indexOf("days.length > MAX_RANGE_DAYS")`). Genau
dieser String stand dort im AUFTRAG_18-Stand und wurde durch den Auftrag
20 bewusst ersetzt: die Obergrenzenprüfung in `handleAssignRange()` lautet
jetzt `countDaysInRange(fromIso, rangeToIso, MAX_RANGE_DAYS) >
MAX_RANGE_DAYS` — fachlich dieselbe Prüfung, aber ohne vorherigen Aufbau der
Liste, wie es AUFTRAG_20 Punkt 1 ausdrücklich verlangt. Der String
`"days.length > MAX_RANGE_DAYS"` existiert im geänderten Quelltext weiterhin
(als Sicherheitsnetz-Schranke in `isoDatesInRange()`), aber **vor**
`handleAssignRange()` im Dateitext und damit außerhalb des vom Test
geschnittenen Funktionskörpers.

Das ist exakt die von AUFTRAG_20 Punkt 5 antizipierte Lücke: „Reicht er
nicht aus, um die neue Reihenfolge festzuhalten, ist das … als Lücke zu
melden — nicht eigenmächtig nachzurüsten." Ich habe den Test nicht geändert
und auch nicht versucht, den alten String künstlich in
`handleAssignRange()` zu erhalten, um den Test grün zu färben — das wäre
eine verdeckte Anpassung an einen veralteten Prüfpfad gewesen statt der
sachlich saubereren Lösung. Alle 11 übrigen Fälle in dieser Datei bleiben
grün, insbesondere Test 9 (Doppelbelegungsprüfung über alle Tage) und Test
7/8 (getrennte Pfade, kein Schreiben beim Abbrechen).

**Offenes Risiko:** der Wächtertest aus AUFTRAG_18 prüft die Reihenfolge der
beiden Grenzprüfungen derzeit über exakte Teilstrings statt über
Verhalten (z. B. Spionage/Mock-Aufrufreihenfolge). Er müsste in einem
künftigen, eigenen Auftrag an die neue Implementierung angepasst werden,
damit er die Absicherung aus AUFTRAG_20 (früh abbrechender Zähler vor
Listenaufbau) wieder verlässlich abdeckt. Bis dahin belegt nur der
rechnerische Nachweis oben, dass die Korrektur wirkt.

## Negativliste eingehalten

Keine Änderung an `on-call-plan-actions.ts`, `date-local.ts`, `on-call-plan.ts`,
`globals.css`, Testdateien, `app/supabase/**`, `.claude/**`. `MAX_RANGE_DAYS`
unverändert (weiterhin einzige Quelle in `on-call-plan-actions.ts`, per
Import verwendet). Keine Meldungstexte umformuliert. Bedienmängel aus
REVIEW_17 nicht angefasst. Kein `git commit`/`push`/`merge`/`tag`/`release`.
