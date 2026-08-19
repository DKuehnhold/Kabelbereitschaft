# REVIEW_25 — Smoke 28/Z12: `max(detail)` auf `jsonb`

> Verfasst vom Orchestrator/Review-Chat, 2026-08-19. Grundlage: `AUFTRAG_25.md`,
> `MELDUNG_25.md`, **Dennis' Datenbanklauf** und eigene Messungen.

## Ergebnis: **grün**, Nachweis ist Dennis' nächster Datenbanklauf

## Was der Lauf gezeigt hat

**Der Fix aus AUFTRAG_15 wirkt.** Z7 — der Fall, an dem die CI am 2026-08-17 abbrach — ist
durchgelaufen. Der Lauf kommt jetzt rund 200 Zeilen weiter und scheitert erst in **Z12**.
Migrationen 0001–0022 und Z1–Z11 sind damit erstmals gegen eine echte PostgreSQL-18-Instanz
gelaufen; die Aufräumbilanz war sauber (Port frei, Clusterverzeichnis und Arbeitsverzeichnis
entfernt).

**Der neue Abbruch war ein zweiter, unabhängiger Testdefekt** aus AUFTRAG_10:

```sql
select count(*), max(detail) into v_count, v_detail from public.audit_events …
```

`audit_events.detail` ist `jsonb` (`0001_init.sql:367`), und für `jsonb` gibt es keine
Aggregatfunktion `max()` — es existiert keine Ordnungsoperatorklasse dafür. Die Anweisung
scheitert an der **Funktionsauflösung**, unabhängig von den Daten; sie hätte nie laufen können.
Auch das ist **kein Produktcodefehler**: der Auditsatz entsteht durch `tg_audit`, geprüft wurde
nur sein Vorhandensein.

## Behebung (selbst nachgelesen)

Z12 stellt jetzt zwei Anweisungen hintereinander: erst `count(*)` prüfen, dann — da damit genau
ein Satz feststeht — `select detail into v_detail` mit derselben Bedingung. Die geprüfte Aussage
und alle drei Fehlermeldungen sind **wörtlich erhalten**: genau ein Auditsatz zum `DELETE`, ein
vorhandenes `detail.old`, und die `id` darin stimmt mit der gelöschten Kennung überein. Die
Prüfung ist damit weder abgeschwächt noch umgedeutet — nur gültig formuliert.

| Prüfung | Ergebnis | Exit |
| --- | --- | --- |
| `max(detail)`/`min(detail)`/`sum(detail)` in den Smokes 26–29 | **keine Treffer** | 1 |
| `$$`-Bilanz in `28_hlk_bereitschaftsplan.sql` | **15 zu 15**, ausgeglichen | 0 |
| Umfang (Dateizeitstempel) | nur `28_hlk_bereitschaftsplan.sql` geändert; `29_hlk_dispo_board.sql` **unberührt** | 0 |
| `node --test test/*.test.mjs` | 227/227, fail 0 | 0 |

## Vorabdurchsicht 26–29 — bewusst beauftragt, damit nicht jeder Lauf einen neuen Stolperstein findet

Der Agent hat `29_hlk_dispo_board.sql` **vollständig** gelesen (612 Zeilen) und den Rest von 28
ab Z12, und die verwendeten Namen gegen die Migrationen abgeglichen — Constraints
(`qualifications_color_chk`, `technician_qualifications_uq`, `on_call_plan_stage_kind_chk`),
die beiden partiellen Indizes und die erwarteten Policy-Zahlen. **Kein weiterer nicht
ausführbarer Fund.** Ausdrücklich geprüft und für unproblematisch befunden: `order by q.rank
desc limit 1` in AA14 — `rank` ist `integer`, also ordnungsfähig, anders als `jsonb`.

Das ist der Punkt, auf den es mir ankam: **die Smokes 26–29 sind nie vollständig gelaufen.** 26
und 27 waren in Dennis' Lauf grün, 28 bricht jetzt nicht mehr an dieser Stelle ab, und **29 ist
weiterhin ungelaufen**. Eine statische Durchsicht ersetzt keinen Lauf — sie senkt nur die
Wahrscheinlichkeit, dass der nächste Zehn-Minuten-Lauf an einer trivialen Zeile stirbt.

## Auflage (offen, zwingend)

**Dennis lässt `run_ap14b_local.ps1 -TemporaryCluster` erneut laufen.** Es gibt hier kein
PostgreSQL; die Korrektur ist statisch geprüft, nicht ausgeführt. Erwartung: Smoke 28 läuft bis
`Z-ENDE`, danach läuft **Smoke 29 zum ersten Mal überhaupt** — dort sind weitere Erstbefunde
möglich, und zwar auch inhaltliche (eine Erwartung, die nicht zutrifft), nicht nur syntaktische.

## Muster, das sich hier zum dritten Mal zeigt

Erst Z7 (falsche SQLSTATE-Erwartung), dann zwei zu starre Node-Wächter, jetzt `max(detail)`:
**ungelaufener Prüfcode ist kein Nachweis, sondern eine Vermutung.** Die Migrationen 0019–0022
waren längst gegen eine echte Datenbank eingespielt, die zugehörigen Smokes aber nie — und genau
dort steckten die Fehler. Für kommende Scheiben heißt das: ein neu geschriebener Smoke gilt erst
als Nachweis, wenn er **einmal gelaufen** ist; bis dahin gehört er in jede Meldung als „geschrieben,
nicht ausgeführt". Nachgetragen in `PROJEKT_WISSEN.md`.
