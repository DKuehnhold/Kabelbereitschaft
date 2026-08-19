# AUFTRAG_25 — Smoke 28/Z12: `max(detail)` auf einer `jsonb`-Spalte, plus Vorabdurchsicht 26–29

> Erteilt vom Orchestrator/Review-Chat, 2026-08-19, aus **Dennis' lokalem Datenbanklauf**
> (`run_ap14b_local.ps1 -TemporaryCluster`). Der Lauf ist der erste, der überhaupt bis in die
> hinteren Fälle von Smoke 28 kommt.

## Zwei Nachrichten aus diesem Lauf

**Die gute:** der Fix aus AUFTRAG_15 wirkt — **Z7 ist durch**. Der Lauf scheitert erst in
**Z12**, also rund 200 Zeilen später. Migrationen 0001–0022 und die Fälle Z1–Z11 sind
gelaufen; die Aufräumbilanz ist sauber (`port_lauscht_nicht_mehr=ja`,
`clusterverzeichnis_entfernt=ja`, `arbeitsverzeichnis_entfernt=ja`).

**Die schlechte:** Z12 kann so nie funktionieren.

```
TIP:  No function matches the given name and argument types.
      You might need to add explicit type casts.
ANFRAGE:  select count(*), max(detail) from public.audit_events
KONTEXT:  PL/pgSQL function inline_code_block line 9 at SQL statement
```

Fundstelle `app/supabase/test/28_hlk_bereitschaftsplan.sql:595`:

```sql
select count(*), max(detail) into v_count, v_detail
from public.audit_events
where entity = 'on_call_plan' and entity_id = v_id and action = 'DELETE';
```

`public.audit_events.detail` ist **`jsonb`** (`0001_init.sql:367`). PostgreSQL kennt für `jsonb`
**keine** Aggregatfunktion `max()` — es gibt keine Ordnungsoperatorklasse dafür. Die Anweisung
ist also nicht „unter bestimmten Daten falsch", sondern **grundsätzlich** ungültig; sie
scheitert bereits bei der Funktionsauflösung.

**Kein Produktcodefehler.** Der Auditsatz selbst wird durch `tg_audit` erzeugt; geprüft wird nur
seine Existenz und sein Inhalt. Der Fehler steht ausschließlich im Prüfcode und stammt aus
AUFTRAG_10 — er ist bisher nie aufgefallen, weil Smoke 28 in der CI erstmals am 2026-08-17 lief
und dort schon in Z7 abbrach.

**Vorabdurchsicht bereits erledigt (vom Review-Chat):** eine Suche nach demselben Muster über
`26_hlk_kataloge.sql`, `27_hlk_anrufdaten.sql`, `28_hlk_bereitschaftsplan.sql` und
`29_hlk_dispo_board.sql` findet **genau diesen einen** Treffer. Weitere `max(`/`min(`-Aufrufe
über `jsonb`-Spalten gibt es in den vier Dateien nicht.

## Ziel

Z12 prüft dieselbe Aussage wie bisher — **genau ein** Auditsatz zum `DELETE`, und dieser trägt
die gelöschte Zeile unter `detail.old` mit passender `id` — nur mit gültigem SQL. Zusätzlich
soll der nächste Datenbanklauf nicht an einer weiteren, bisher nie ausgeführten Zeile scheitern.

## Positivliste (nur diese Pfade)

- `app/supabase/test/28_hlk_bereitschaftsplan.sql`
- `app/supabase/test/29_hlk_dispo_board.sql` — **nur**, falls die Durchsicht (siehe unten) dort
  einen Fehler derselben Art findet: eine Anweisung, die unabhängig von den Daten **nicht
  ausführbar** ist. Jede solche Änderung ist in `MELDUNG_25.md` **einzeln** mit Fundstelle und
  Begründung aufzuführen.

## Umzusetzen

**1. Z12 korrigieren.** Die Aussage bleibt unverändert, nur die Abfrage wird gültig. Naheliegend
und ausreichend, weil der Fall ohnehin auf **genau einen** Satz prüft: erst die Anzahl
ermitteln und den Wert prüfen, danach das `detail` der einen Zeile lesen (zwei Anweisungen statt
einer). Ein Umweg über `detail::text` oder `order by … limit 1` ist zulässig, aber nur, wenn er
begründet wird — die einfachste tragfähige Form ist vorzuziehen. Die drei bestehenden
Fehlermeldungen (falsche Anzahl, fehlendes `detail.old`, abweichende `id`) bleiben inhaltlich
erhalten.

**2. Durchsicht 26–29 auf weitere „läuft nie"-Stellen.** Die vier Smokes sind bis heute
**nie vollständig** gelaufen: 26 und 27 waren in Dennis' Lauf grün, 28 bricht in Z12 ab, **29
ist noch überhaupt nicht gelaufen**. Lies deshalb `29_hlk_dispo_board.sql` **vollständig** und
den Rest von `28` ab Z12 und suche gezielt nach Anweisungen, die unabhängig von den Daten
scheitern müssen, insbesondere:

- Aggregatfunktionen über `jsonb`- oder andere nicht ordnungsfähige Typen (`max`, `min`,
  `sum`, `order by` auf `jsonb`, `distinct` auf `jsonb`);
- Verweise auf Spalten, Tabellen, Views, Funktionen, Policies oder Indizes, die es nach den
  Migrationen `0001`–`0022` **nicht** gibt (Schreibfehler in Namen);
- Vergleiche ohne passenden Operator (z. B. `jsonb = text`), fehlende Typumwandlungen;
- `into`-Ziele, deren Typ nicht zum Ausdruck passt.

Jeder Fund wird in `MELDUNG_25.md` mit Datei, Zeile, Anweisung und Begründung berichtet.
**Behoben** wird nur, was **nachweislich nicht ausführbar** ist. Alles, was lediglich
**inhaltlich** fragwürdig erscheint (eine Erwartung, die vielleicht nicht zutrifft), wird
**gemeldet und nicht angefasst** — dafür ist der Datenbanklauf da, nicht eine Vermutung.

**3. Kein Erraten von Laufzeitverhalten.** In dieser Umgebung gibt es **kein PostgreSQL**; die
Korrektur ist statisch. Das ist in `MELDUNG_25.md` ausdrücklich zu sagen: der Nachweis ist
Dennis' nächster Lauf.

## Negativliste (ausdrücklich verboten)

- Jede Migration, jede Datei unter `app/src`, `app/test`, `.github/workflows`, `.claude`.
- Die Smokes `26_hlk_kataloge.sql` und `27_hlk_anrufdaten.sql` ändern — sie sind in Dennis' Lauf
  **grün** durchgelaufen.
- Z12 abschwächen: die Prüfung auf genau einen Satz, auf `detail.old` und auf die `id` bleibt.
- Einen Fall überspringen, auskommentieren oder in eine reine Existenzprüfung verwandeln.
- Eine inhaltliche Erwartung „passend machen", weil sie vielleicht scheitern könnte.
- `git commit`, `push`, `merge`, `tag`, `release`.
- Behaupten, ein SQL- oder Datenbanklauf sei erfolgt.

## DoD (prüfbar)

1. Geändert sind **nur** Dateien der Positivliste (Nachweis über Dateizeitstempel).
2. `grep -n "max(detail\|min(detail\|sum(detail"` über die vier Smokes 26–29 → **keine
   Treffer** mehr. Ausgabe wörtlich melden.
3. Die Klammer- und `$$`-Bilanz der geänderten Dateien ist ausgeglichen
   (`grep -c '^do \$\$'` gegen `grep -c '^\$\$;'`) — Zahlen melden.
4. Aus `app/`: `node --test test/*.test.mjs` → **227/227, fail 0, Exit 0** (die SQL-Smokes sind
   nicht Teil dieser Suite; der Lauf belegt nur, dass nichts anderes angefasst wurde).
5. `MELDUNG_25.md` nennt: die geänderten Dateien, den neuen Wortlaut des Z12-Blocks, **alle**
   Funde der Durchsicht (behoben wie unbehoben, mit Datei:Zeile), die Messwerte und den
   ausdrücklichen Hinweis, dass kein Datenbanklauf möglich war.

## Stopppunkt

Anhalten und melden, wenn

- die Durchsicht in `29_hlk_dispo_board.sql` mehr als **drei** nicht ausführbare Stellen findet
  — dann ist der Smoke insgesamt zu prüfen und nicht stückweise zu flicken;
- eine Korrektur eine Migration nötig machen würde;
- ein Bestandstest der Node-Suite rot wird.

## Meldeweg

`00-Projektsteuerung/MELDUNG_25.md`.
