# REVIEW_15 — Korrektur Smoke Z7 (28_hlk_bereitschaftsplan.sql)

> Verfasst vom Orchestrator/Review-Chat, 2026-08-18. Grundlage: `AUFTRAG_15.md`,
> `MELDUNG_15.md` und **eigene Messungen** in dieser Sitzung. Agentenaussagen sind hier
> nicht als Nachweis übernommen.

## Ergebnis: **grün**, mit einer Auflage (CI-Nachweis) — und einem **neuen, schwereren
> Befund außerhalb dieses Auftrags** (siehe `BEFUND_CRLF_ARBEITSBAUM.md`).

## Eigene Messwerte

| Prüfung | Kommando | Ergebnis | Exit |
| --- | --- | --- | --- |
| Umfang des Diffs | `git diff --stat -- app/supabase/test/28_hlk_bereitschaftsplan.sql` | 1 Datei, **31 insertions, 6 deletions** | 0 |
| Positivliste eingehalten | vollständiger `git diff` derselben Datei gelesen | Änderungen liegen **ausschließlich** im Z7-Kopfkommentar und im Z7-`do`-Block; Z1–Z6 und Z8 bis Z-ENDE erscheinen nicht im Diff | 0 |
| kein `42501`-Vergleich mehr in Z7 | `sed -n '378,440p' … \| grep -n 42501` | genau **ein** Treffer, und zwar im **Kommentar** (erklärende Zeile), kein Vergleich im Code | 0 |
| Unit-Tests | aus `app/`: `node --test test/*.test.mjs` | `# tests 177 / # pass 177 / # fail 0` | **0** |
| Syntaxbilanz Dollar-Quoting | `grep -c '^do \$\$'` vs. `grep -c '^\$\$;'` | **15 zu 15**, ausgeglichen | 0 |

## Fachliche Prüfung des neuen Z7 (Stichprobe im Code)

Der Block prüft jetzt vier Eigenschaften statt eines unerreichbaren SQLSTATE:

1. `v_state is not null` → jeder auftretende SQLSTATE ist ein Fehlschlag. Gut: damit bleibt
   der Test empfindlich, wenn künftig doch etwas abweist (z. B. ein entzogenes
   Tabellenrecht) — die Prüfung wird nicht einfach „weicher".
2. `get diagnostics v_deleted = row_count` und `v_deleted <> 0` → die eigentliche
   Schutzaussage. Das ist der Kern und der richtige Ersatz für die alte Erwartung.
3. Zeilenzahl vor/nach identisch (Muster aus Z6).
4. Fortbestand der Zeile — **im Administrator-Kontext gelesen**
   (`28a00000-…-000000000001`, laut Fixture Zeile 111 Rolle `admin`, aktiv), danach zurück
   auf die Monteursidentität. Das ist die inhaltlich wichtigste Verbesserung gegenüber der
   Vorfassung: hätte man den Fortbestand unter der Monteurssicht geprüft, hätte der
   Zeilenfilter der `select`-Policy das Ergebnis mitbestimmt. Ausdrücklich geprüft: die
   `select`-Policy `on_call_plan_select` lässt jeden Angemeldeten lesen, die Umschaltung ist
   also nicht zwingend — sie macht den Test aber unabhängig von einer künftigen Verschärfung
   der Lesesicht. Bewertung: sachlich richtig gelöst.
5. Der `raise notice`-Text und der Kopfkommentar benennen die Semantik jetzt korrekt und
   verweisen auf `0021`, Abschnitt 3. Damit ist die Erwartung gegen ein Zurückdrehen
   geschützt.

Der gemeldete Nebenbefund ist von mir nachgeprüft: in `28_hlk_bereitschaftsplan.sql` und in
`29_hlk_dispo_board.sql` erwartet **kein weiterer** Fall `42501` aus einem
`using`-Zeilenfilter. Z8 (kein `update`-Tabellenrecht), AA5 (kein `delete`-Tabellenrecht auf
`qualifications`) und AA9 (kein `update`-Tabellenrecht auf `technician_qualifications`)
stützen sich jeweils auf ein **fehlendes Tabellenrecht** — dort ist `42501` korrekt.
X4 in `26_hlk_kataloge.sql` prüft ausschließlich `insert`-Versuche (`with check`) — ebenfalls
korrekt. Migration `0021` ist unverändert.

## Auflage (offen, nicht durch mich erbringbar)

Der eigentliche Nachweis ist ein **grüner SQL-Lauf**. In dieser Umgebung gibt es kein
PostgreSQL; die Korrektur ist statisch geprüft, nicht ausgeführt. Der Nachweis entsteht
durch den CI-Job `database` bzw. Dennis' lokalen Lauf und ist **vor** einer Abnahme von
AUFTRAG_15 nachzutragen. Erwartung: Smoke 28 läuft bis `Z-ENDE` durch, danach erstmals
Smoke `29_hlk_dispo_board.sql`. **Smoke 29 ist bis heute nie gelaufen** — dort sind weitere
Erstbefunde möglich.

## Kein Commit, kein Push

Weder durch den Ausführungsagenten noch durch mich. `git status` zeigt die Änderung als
uncommitted im Arbeitsbaum.
