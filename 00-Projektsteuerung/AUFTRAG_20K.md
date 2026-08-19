# AUFTRAG_20K — GEGENSTANDSLOS (2026-08-18): identisch durch AUFTRAG_22 erledigt

> **NICHT AUSFÜHREN.** Diese Datei stammt aus einem Lauf des noch aktiven scheduled task
> `kb-review-zyklus` und ist am 2026-08-18 parallel zu `AUFTRAG_22.md` entstanden — beide
> beschreiben **dieselbe** Korrektur an **derselben** Datei
> (`app/test/auftrag18-dispo-zeitraum.test.mjs`). Umgesetzt und nachgemessen wurde
> **AUFTRAG_22**: der Wächter prüft jetzt `/>\s*MAX_RANGE_DAYS/` statt einer wörtlichen
> Zeichenkette und verlangt zusätzlich, dass der Vergleich **vor** `isoDatesInRange(` steht;
> die Wirksamkeit ist über eine zurückgenommene Gegenprobe mit Hashvergleich belegt.
> Gesamtlauf danach **208/208, Exit 0**. Der Inhalt unten bleibt als Historie stehen; das Ziel
> deckt sich sachlich mit AUFTRAG_22.
> Der scheduled task wurde am 2026-08-18 deaktiviert — siehe
> `BEFUND_SCHEDULED_TASK_DOPPELSCHREIBER.md`.

## Historie (ursprünglicher Text)

# AUFTRAG_20K — Korrektur zu AUFTRAG_20: Wächtertest 10 an die neue Prüfreihenfolge anpassen

> Erteilt vom Orchestrator/Review-Chat, 2026-08-18. Grundlage: die in `MELDUNG_20.md`
> korrekt gemeldete Lücke (Wächtertest aus AUFTRAG_18 sucht einen Teilstring, den
> AUFTRAG_20 auftragsgemäß ersetzt hat) und `REVIEW_18_19_20.md`. Der Produktivcode
> ist richtig — angepasst wird ausschließlich der Test.
>
> **Reihenfolge:** Falls AUFTRAG_21 noch in Arbeit ist, zuerst AUFTRAG_21 abschließen
> und melden, dann diesen Auftrag. Nicht parallel.

## Befund (vom Review selbst nachgemessen)

`node --test test/*.test.mjs` → 1 fail: `auftrag18-dispo-zeitraum.test.mjs`, Fall 10
(„Bis vor Von und die 92-Tage-Obergrenze werden im Dialog VOR jedem Schreibvorgang
geprüft"), Meldung „Prüfung der 92-Tage-Obergrenze nicht gefunden". Der Test schneidet
den Funktionskörper von `handleAssignRange()` aus und sucht dort wörtlich
`days.length > MAX_RANGE_DAYS`. Seit AUFTRAG_20 lautet die Obergrenzenprüfung dort
`countDaysInRange(fromIso, rangeToIso, MAX_RANGE_DAYS) > MAX_RANGE_DAYS`; der alte
String existiert nur noch als Sicherheitsnetz in `isoDatesInRange()` — außerhalb des
geschnittenen Körpers.

## Ziel

Der Wächter hält die **neue, gewollte** Reihenfolge fest: in `handleAssignRange()`
kommt (a) die „Bis vor Von"-Prüfung, (b) die Obergrenzenprüfung über den früh
abbrechenden Zähler `countDaysInRange(…) > MAX_RANGE_DAYS`, und **erst danach**
(c) der Aufruf von `isoDatesInRange(…)` und (d) `runRangeAction`. Zusätzlich sichert
er das Sicherheitsnetz aus AUFTRAG_20 Punkt 3 ab.

## Positivliste (nur diese Datei)

- `app/test/auftrag18-dispo-zeitraum.test.mjs` — nur Fall 10 samt zugehörigem
  Kommentarblock.

## Umzusetzen

In Fall 10:

1. Statt `days.length > MAX_RANGE_DAYS` im Körper von `handleAssignRange()` prüfen:
   - `toIso < fromIso`-/„Bis vor Von"-Prüfung vorhanden (bestehende Prüfung behalten);
   - `countDaysInRange(` mit `MAX_RANGE_DAYS` als Grenzwert vorhanden;
   - Positionsvergleich per `indexOf`: „Bis vor Von" **vor** der Zählerprüfung, die
     Zählerprüfung **vor** dem ersten Vorkommen von `isoDatesInRange(` und **vor**
     `runRangeAction` im Funktionskörper.
2. Neu absichern: der Text von `isoDatesInRange()` enthält die
   Sicherheitsnetz-Schranke `days.length > MAX_RANGE_DAYS` (Wächter dagegen, dass das
   Netz später stillschweigend entfernt wird).
3. Kommentarblock des Falls: Herkunft ergänzen (AUFTRAG_18 → AUFTRAG_20 →
   AUFTRAG_20K), Hinweis „statischer Wächter, kein Verhaltensnachweis" beibehalten.
4. Der Testname darf angepasst werden, solange er die Absicht (Grenzprüfungen vor
   jedem Schreibvorgang) weiter benennt.

## Negativliste (ausdrücklich verboten)

- Jede Änderung an `OnCallPlanClient.tsx`, `on-call-plan-actions.ts` oder einer
  anderen Quell-/Testdatei.
- Die übrigen 11 Fälle der Testdatei umformulieren oder löschen.
- `.claude/**`, `run-*.ps1`, `app/supabase/**`, `package.json`/`package-lock.json`.
- `git commit`, `push`, `merge`, `tag`, `release`.
- Erfundene Nachweise (`npm run build`/ESLint laufen hier nicht — dazu keine
  Behauptung).

## Zeilenenden

Die Datei behält LF (aktuell 0 CR, gemessen).

## DoD (prüfbar)

1. Geändert ist **genau** `app/test/auftrag18-dispo-zeitraum.test.mjs` (Nachweis über
   Dateizeitstempel, wie in MELDUNG_18/20).
2. Aus `app/`: `node --test test/*.test.mjs` → **fail 0** (Gesamtzahl offen
   deklarieren; zum Review-Zeitpunkt 208 inkl. der 4 AUFTRAG_21-Fälle).
3. Gegenprobe der Wirksamkeit (analog AUFTRAG_19/DoD 4): in einer **temporären**
   Kopie-Manipulation die Zählerprüfung in `handleAssignRange()` entfernen oder
   hinter `isoDatesInRange(` verschieben → Einzeltest wird rot mit benennender
   Meldung; danach byte-identische Wiederherstellung (SHA-256 vorher/nachher in der
   Meldung nennen). Änderung nur vorübergehend, außerhalb des Vaults sichern.
4. `grep -c $'\r'` auf der Testdatei → **0**.
5. `npx tsc --noEmit` → Exit 0 (Regression ausgeschlossen).
6. `MELDUNG_20K.md` nennt Dateien, neuen Prüftext des Falls 10 wörtlich, Messwerte
   mit Exit-Codes und die Gegenprobe.

## Stopppunkt

Anhalten und melden, wenn ein anderer Bestandstest rot wird, `tsc` nicht Exit 0
ergibt oder derselbe Fehler dreimal in derselben Teilaufgabe auftritt.

## Meldeweg

`00-Projektsteuerung/MELDUNG_20K.md`.
