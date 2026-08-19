# AUFTRAG_26 — Smoke 29: falsche Sollzahl in der Fixture-Prüfung, plus Rechenprobe aller Zählprüfungen

> Erteilt vom Orchestrator/Review-Chat, 2026-08-19, aus **Dennis' zweitem Datenbanklauf**.
> Erster Lauf von `29_hlk_dispo_board.sql` überhaupt.

## Fortschritt zuerst

**Smoke 28 läuft jetzt vollständig durch** — Z7 (AUFTRAG_15) und Z12 (AUFTRAG_25) sind beide
erledigt, der Lauf erreicht erstmals `29_hlk_dispo_board.sql`. Migrationen 0001–0022 und die
Smokes 15–28 sind damit gegen echtes PostgreSQL 18 belegt. Aufräumbilanz erneut sauber.

## Befund

```
29_hlk_dispo_board.sql:114: ERROR:  SMOKE AA-FIXTURES FAIL 6 statt 5 Stammdatenzeilen vorhanden
```

Fundstelle: der Fixture-Block ab Zeile 99. Gezählt wird

```sql
  (select count(*) from public.profiles where id::text like '29a00000-%')            -- 3
+ (select count(*) from public.construction_stages where id in ('29a00000-…a1'))     -- 1
+ (select count(*) from public.technicians where id::text like '29a00000-%')         -- 2
```

Die Datei legt unmittelbar davor **drei** Profile (`…0001`, `…0002`, `…0003`), **einen**
Bauabschnitt (`…00a1`) und **zwei** Techniker (`…00a2`, `…00a3`) an. Die Summe ist **6**.

**Die Sollzahl 5 ist ein Rechenfehler des Autors, kein Datenproblem** — die Erfolgsmeldung
desselben Blocks sagt es selbst:

> `SMOKE AA-FIXTURES OK drei Identitaeten, ein Bauabschnitt und zwei Techniker stehen bereit`

3 + 1 + 2 = 6. Der zweite Techniker `…00a3` („FK-Gegenprobe") wurde ergänzt, ohne die Sollzahl
mitzuziehen. Es ist **kein Produktcodefehler** und **kein Rest aus Smoke 28** (dessen
Wirkungsphase endet mit `rollback`, und sein Präfix ist `28a00000-`).

## Ziel

Die Fixture-Prüfung erwartet die tatsächlich angelegte Zahl. Zusätzlich soll der nächste Lauf
nicht an der **nächsten** falsch gerechneten Sollzahl scheitern — das ist jetzt die
wahrscheinlichste verbleibende Fehlerklasse in dieser Datei.

## Positivliste (nur diese Datei)

- `app/supabase/test/29_hlk_dispo_board.sql`

## Umzusetzen

**1. Sollzahl korrigieren:** `5` → **6**. Der Zählausdruck selbst bleibt unverändert, die
Fehler- und die Erfolgsmeldung bleiben inhaltlich erhalten. Ergänze in der Fehlermeldung oder
als Kommentar die Herleitung (3 Profile + 1 Bauabschnitt + 2 Techniker), damit die Zahl beim
nächsten Fixture-Zuwachs nicht wieder auseinanderläuft.

**2. Rechenprobe über **alle** Zählprüfungen der Datei.** Lies `29_hlk_dispo_board.sql`
vollständig und prüfe **jede** Stelle, die eine Anzahl gegen einen festen Wert vergleicht
(`<> N`, `= N`, `is distinct from N`, `count(*)`-Vergleiche, erwartete Policy-, Index- oder
Spaltenzahlen). Rechne jeweils **aus den Anweisungen der Datei selbst** nach, wie viele Zeilen
bzw. Objekte an dieser Stelle tatsächlich vorliegen müssen — unter Berücksichtigung von:

- allem, was die Datei vorher selbst eingefügt oder gelöscht hat;
- dem Seed-Zustand aus den Migrationen (`0019` legt Kataloge an, `0022` die Qualifikationen —
  lies dort nach, **was** und **wie viel** gesetzt wird);
- Zeilen, die durch einen vorherigen Fall der Datei entstanden sind.

Jede Abweichung zwischen Sollzahl und nachgerechnetem Wert wird **korrigiert** und in
`MELDUNG_26.md` einzeln aufgeführt: Zeile, alte Zahl, neue Zahl, **Herleitung**. Wo die Zahl
stimmt, genügt die Angabe, dass sie geprüft wurde.

**3. Grenze der Nachrechnung offenlegen.** Wo sich eine Sollzahl **nicht** allein aus der Datei
und den Migrationen herleiten lässt (etwa weil sie vom Zustand nach einem früheren Smoke
abhängt), wird sie **nicht** geändert, sondern als unsicher gemeldet. Raten ist ausdrücklich
unerwünscht — der Datenbanklauf entscheidet.

## Negativliste (ausdrücklich verboten)

- Jede Migration, jede andere Testdatei, `app/src`, `app/test`, `.github/workflows`, `.claude`.
- Die Smokes 26, 27 und 28 anfassen — sie sind in Dennis' Lauf **grün** durchgelaufen.
- Eine Prüfung abschwächen, überspringen, auskommentieren oder eine feste Sollzahl durch eine
  Toleranz („mindestens", „ungefähr") ersetzen, um sie „sicher grün" zu machen. Die Zahlen sind
  der Inhalt dieser Prüfungen.
- Fixture-Zeilen hinzufügen oder entfernen, um eine Sollzahl passend zu machen — korrigiert wird
  **die Zahl**, nicht die Datenlage.
- `git commit`, `push`, `merge`, `tag`, `release`.
- Behaupten, ein SQL- oder Datenbanklauf sei erfolgt. Es gibt hier **kein** PostgreSQL.

## DoD (prüfbar)

1. Geändert ist **genau** `app/supabase/test/29_hlk_dispo_board.sql` (Dateizeitstempel).
2. Die `$$`-Bilanz der Datei ist ausgeglichen (`grep -c '^do \$\$'` gegen `grep -c '^\$\$;'`) —
   Zahlen melden.
3. Aus `app/`: `node --test test/*.test.mjs` → **227/227, fail 0, Exit 0** (Gegenprobe, dass
   nichts anderes angefasst wurde).
4. `MELDUNG_26.md` nennt: die geänderte Datei, die Korrektur 5 → 6 mit Herleitung, **eine
   Liste aller** geprüften Zählstellen mit Zeile, Sollzahl und Urteil (stimmt / korrigiert /
   nicht herleitbar), sowie den ausdrücklichen Hinweis, dass kein Datenbanklauf möglich war.

## Stopppunkt

Anhalten und melden, wenn

- mehr als **fünf** Zählstellen korrigiert werden müssten — dann stimmt etwas Grundsätzliches
  an der Datei nicht, und sie gehört als Ganzes überarbeitet statt stückweise geflickt;
- eine Korrektur eine Migration oder eine andere Datei berühren würde;
- ein Bestandstest der Node-Suite rot wird.

## Meldeweg

`00-Projektsteuerung/MELDUNG_26.md`.
