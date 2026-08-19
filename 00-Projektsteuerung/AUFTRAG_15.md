# AUFTRAG_15 — Korrektur des SQL-Smokes Z7 (roter CI-Job `database`)

> Erteilt vom Orchestrator/Review-Chat, 2026-08-18. Grundlage: CI-Protokoll des Jobs
> `database` (Lauf vom 2026-08-17, temporäre Testdatenbank
> `kabelbereitschaft_test_20260817_142941_3237`), von Dennis geliefert.

## Befund (Ausgangslage)

Der CI-Job `database` bricht ab in `app/supabase/test/28_hlk_bereitschaftsplan.sql`, Fall **Z7**:

```
psql:.../28_hlk_bereitschaftsplan.sql:412: ERROR:  SMOKE Z7 FAIL SQLSTATE kein Fehler
  - der Monteur hat die Zuweisung entfernt statt 42501 beim Loeschversuch des Monteurs
SQL-Lauf fehlgeschlagen
Error: Process completed with exit code 1.
```

Alle vorangehenden Smokes (15–28 bis einschließlich Z6) sind grün; Z8 ff. und der Smoke
`29_hlk_dispo_board.sql` sind wegen des Abbruchs **nie gelaufen**.

**Ursache: fehlerhafte Erwartung im Testfall, kein Defekt in Migration 0021.**
Z7 erwartet, dass ein Monteur beim `delete` auf `public.on_call_plan` SQLSTATE `42501`
erhält. Das kann PostgreSQL an dieser Stelle nicht liefern:

- `42501` entsteht aus einem **fehlenden Tabellenrecht** oder aus einer verletzten
  `with check`-Bedingung einer RLS-Policy bei `insert`/`update`.
- Bei `delete` (und beim Zeilenfilter eines `update`) wirkt die `using`-Bedingung einer
  RLS-Policy **filternd, nicht abweisend**: nicht sichtbare bzw. nicht freigegebene Zeilen
  werden aus der Treffermenge entfernt. Das Kommando endet erfolgreich mit 0 betroffenen
  Zeilen.
- `app_user` **besitzt** `delete` auf `public.on_call_plan`
  (`0021_hlk_bereitschaftsplan.sql`, Abschnitt 3 — bewusst und dort begründet), die Policy
  `on_call_plan_delete` trägt `using (public.is_staff())`. Ein Monteur löscht damit
  **0 Zeilen ohne Fehler**.

Das erklärt konsistent, warum Z6 (`insert`, `with check`) grün ist und Z7 (`delete`,
`using`) rot: dieselbe Erwartung `42501` ist nur im `insert`-Fall zutreffend. Zum Vergleich:
X4 in `26_hlk_kataloge.sql` prüft ausschließlich `insert`-Versuche, Z8 und AA5/AA9 prüfen
Fälle mit **fehlendem Tabellenrecht** — alle drei Muster bleiben unverändert korrekt.

**Die abgesicherte Schutzwirkung bleibt bestehen:** der Monteur entfernt keine Planzeile.
Zu prüfen ist deshalb nicht ein Fehlercode, sondern die **Wirkung**: 0 betroffene Zeilen
und die Zeile besteht unverändert weiter.

**Einschränkung dieses Befundes:** die Diagnose ist aus dem CI-Protokoll, dem
Migrationsquelltext und der dokumentierten PostgreSQL-Semantik abgeleitet, **nicht** in
dieser Sitzung gegen eine Datenbank gemessen (kein PostgreSQL in der Sandbox). Der Nachweis
entsteht durch den nächsten CI-Lauf bzw. Dennis' lokalen Lauf.

## Ziel

`28_hlk_bereitschaftsplan.sql`/Z7 prüft die tatsächliche Schutzwirkung statt eines
unerreichbaren SQLSTATE, sodass der Smoke 28 vollständig durchläuft und der CI-Job
`database` erstmals bis Smoke 29 kommt. Die Aussagekraft des Tests darf dabei **nicht**
sinken — er muss weiterhin scheitern, wenn ein Monteur eine Planzeile entfernen könnte.

## Positivliste (nur diese Datei)

- `app/supabase/test/28_hlk_bereitschaftsplan.sql`

## Umzusetzen

Fall Z7 (etwa Zeilen 378–411) so umbauen, dass er **alle vier** Punkte prüft:

1. Das `delete` des Monteurs läuft **ohne Ausnahme** durch (jeder auftretende SQLSTATE ist
   ein Fehlschlag mit sprechender Meldung — auch das ist eine Regression, weil dann etwas
   anderes als der Zeilenfilter greift).
2. Die Zahl der betroffenen Zeilen ist **genau 0** (`get diagnostics ... = row_count`).
3. Die Zeile mit der gemerkten `id` besteht **nach** dem Versuch unverändert weiter
   (bestehende Prüfung erhalten, aber gegen die Administrator-/Staff-Sicht gelesen, damit
   nicht der Zeilenfilter des Monteurs selbst das Ergebnis erzeugt).
4. Die Gesamtzahl der Zeilen in `public.on_call_plan` ist vor und nach dem Versuch gleich
   (Muster wie in Z6).

Der `raise notice`-Text von Z7 ist entsprechend richtigzustellen: nicht „mit 42501
abgewiesen", sondern „der Zeilenfilter der Policy `on_call_plan_delete` (`using
is_staff()`) entfernt die Zeile aus der Treffermenge — 0 betroffene Zeilen, kein Fehler,
die Zuweisung bleibt bestehen".

Im Kopfkommentar von Z7 ist die Semantik in zwei bis vier Zeilen festzuhalten
(`using` filtert bei `delete`, `42501` nur bei fehlendem Tabellenrecht oder verletzter
`with check`) mit Verweis auf `0021_hlk_bereitschaftsplan.sql`, Abschnitt 3, damit der
nächste Bearbeiter die Erwartung nicht zurückdreht.

Fällt beim Lesen der Datei ein **weiterer** Fall auf, der von `delete` oder vom
`using`-Zeilenfilter eines `update` einen `42501` erwartet, obwohl das Tabellenrecht
vorhanden ist: **nicht** eigenmächtig ändern, sondern in `MELDUNG_15.md` als Befund melden.

## Negativliste (ausdrücklich verboten)

- Jede andere Datei, insbesondere `app/supabase/migrations/**` (0021 ist **nicht** zu
  ändern), `app/src/**`, `app/test/**`, `.github/workflows/**`, `.claude/**`, `run-*.ps1`.
- Policies, Grants oder Tabellenrechte anfassen, um den Test „passend" zu machen — die
  Rechtelage aus 0021 ist entschieden und begründet.
- Z7 abschwächen, überspringen, auskommentieren oder in eine reine Sichtprüfung verwandeln.
- Andere Fälle in derselben Datei umbauen (Z1–Z6, Z8 ff. bleiben zeichengleich).
- `git commit`, `push`, `merge`, `tag`, `release` — ausschließlich Dennis.
- Erfundene Nachweise. Kein PostgreSQL in der Sandbox: **keine** Behauptung eines
  DB-/Smoke-Laufs.

## DoD (prüfbar)

1. `git diff --stat` nennt **genau eine** geänderte Datei:
   `app/supabase/test/28_hlk_bereitschaftsplan.sql`.
2. Im Diff kommt in Z7 kein Vergleich gegen `'42501'` mehr vor; stattdessen sind
   `get diagnostics`/`row_count`, die Fortbestandsprüfung und die Gesamtzahlprüfung
   enthalten.
3. Die Fälle Z1–Z6 und Z8 bis Z-ENDE sind im Diff **unverändert** (keine Trefferzeilen
   außerhalb des Z7-Blocks und seines Kopfkommentars).
4. Aus `app/`: `node --test test/*.test.mjs` — Ergebnis und Exit-Code wörtlich melden.
   Erwartung: unverändert **177/177**, Exit 0 (SQL-Smokes sind nicht Teil dieser Suite;
   der Lauf belegt nur, dass nichts anderes angefasst wurde).
5. `MELDUNG_15.md` nennt den vollständigen neuen Z7-Block wörtlich, die vier
   DoD-Messwerte und ausdrücklich, dass kein DB-Lauf möglich war.

## Stopppunkt

Anhalten und melden, wenn

- die Korrektur Änderungen außerhalb der Positivliste nötig machen würde,
- die gemerkte `id` (`kb28a.plan_a2`) im Testablauf nicht sicher gesetzt ist und Z7 deshalb
  auf `NULL` löschen würde (dann ist zusätzlich die Herkunft der Kennung zu melden, aber
  **nicht** eigenmächtig umzubauen),
- der Unit-Test-Lauf nicht 177/177 ergibt,
- derselbe Fehler dreimal in derselben Teilaufgabe auftritt.

## Meldeweg

`00-Projektsteuerung/MELDUNG_15.md`. Danach übernimmt der Orchestrator/Review-Chat, messt
selbst nach und schreibt `REVIEW_15.md`.
