# MELDUNG_26 — Smoke 29: Sollzahl-Fehler korrigiert, Rechenprobe aller Zählprüfungen

> Ausführungsagent, 2026-08-19, zu AUFTRAG_26.md.

## Geänderte Datei

`app/supabase/test/29_hlk_dispo_board.sql` — **einzige** geänderte Datei (per
Dateizeitstempel gegen `find . -newer 00-Projektsteuerung/AUFTRAG_26.md` geprüft; außer der
Zieldatei war nur `00-Projektsteuerung/CHAT_STATUS.md` und `.obsidian/workspace.json` jünger,
beide unverändert von mir und außerhalb der Positivliste).

## Korrektur 5 → 6 (Zeilen 108–110)

Vorher:
```sql
if v_stammdaten <> 5 then
  raise exception 'SMOKE AA-FIXTURES FAIL % statt 5 Stammdatenzeilen vorhanden', v_stammdaten;
end if;
```

Nachher:
```sql
if v_stammdaten <> 6 then
  raise exception 'SMOKE AA-FIXTURES FAIL % statt 6 Stammdatenzeilen vorhanden (drei Profile + ein Bauabschnitt + zwei Techniker)', v_stammdaten;
end if;
```

**Herleitung:** Der Zählausdruck (Zeilen 102–106, unverändert) summiert
`count(profiles mit Präfix 29a00000-)` + `count(construction_stages …00a1)` +
`count(technicians mit Präfix 29a00000-)`. Die Datei legt unmittelbar davor an: drei Profile
(`…0001` Admin, `…0002` Disponent, `…0003` Monteur, Zeilen 79–84), einen Bauabschnitt
(`…00a1`, Zeilen 86–88) und zwei Techniker (`…00a2` Techniker A, `…00a3` Techniker B/
FK-Gegenprobe, Zeilen 90–96). 3 + 1 + 2 = **6**. Die Erfolgsmeldung im selben Block
(„drei Identitaeten, ein Bauabschnitt und zwei Techniker“, Zeile 112, unverändert) bestätigt
das bereits selbst. Der zweite Techniker `…00a3` wurde für die spätere FK-Gegenprobe
(AA10, Zeile 422) ergänzt, ohne die Sollzahl der Fixture-Prüfung mitzuziehen — daher die
Abweichung 5 statt 6. Kein Datenproblem, kein Produktcodefehler; die Fixture-Zeilen bleiben
unverändert, nur die Sollzahl wurde an die tatsächliche Anlage angepasst.

## Rechenprobe — alle Zählstellen der Datei

Vollständige Liste aus `grep -n '(<>|is distinct from)'` über die ganze Datei (22 Treffer),
gruppiert nach Art:

| Zeile | Ausdruck | Sollzahl/Vergleich | Herleitung | Urteil |
|---|---|---|---|---|
| 108 | `v_stammdaten <> 5` | 5 | 3 Profile + 1 Bauabschnitt + 2 Techniker = 6, nicht 5 (Zeilen 74–96) | **korrigiert → 6** |
| 160 | `v_qual_rows <> current_setting(...)::integer` | dynamisch (Vorher/Nachher-Vergleich) | Kein fester Literalwert, sondern Idempotenz-Vergleich gegen zuvor gespeicherten Zustand (Zeilen 135–139) | stimmt (kein Literal zu prüfen) |
| 163 | `v_tq_rows <> current_setting(...)::integer` | dynamisch | wie oben, für `technician_qualifications` | stimmt |
| 166 | `v_ocp_rows <> current_setting(...)::integer` | dynamisch | wie oben, für `on_call_plan` | stimmt |
| 169 | `v_qual_policies <> 2` | 2 | Migration 0022 legt für `public.qualifications` genau 2 Policies an (`qualifications_select`, `qualifications_write`, Zeilen 115–130 der Migration); keine andere Migration fügt weitere Policies auf dieser (in 0022 neu angelegten) Tabelle hinzu; Migration 0022 selbst prüft dies bereits mit derselben Sollzahl (Migration Zeile 350f.) | stimmt |
| 172 | `v_tq_policies <> 3` | 3 | Migration 0022 legt für `public.technician_qualifications` genau 3 Policies an (`technician_qualifications_select`, `_insert`, `_delete`, Zeilen 168–190 der Migration); Migration prüft dieselbe Sollzahl selbst (Migration Zeile 362f.) | stimmt |
| 233 | `v_state is distinct from '23514'` | SQLSTATE 23514 = check_violation | Standard-PostgreSQL-Fehlercode für Check-Constraint-Verletzung (`qualifications_color_chk`) | stimmt |
| 253 | `v_count <> 2` | 2 | AA2 (Zeilen 193–213) legt genau 2 Qualifikationen an (`…b1`, `…b2`); AA3 (Zeilen 218–240) scheitert am Check-Constraint und legt keine dritte Zeile an; zum Zeitpunkt von AA4 (Zeile 253) sind es weiterhin 2 mit Präfix `29a00000-` | stimmt |
| 264 | `v_state is distinct from '42501'` | SQLSTATE 42501 = insufficient_privilege | fehlendes Tabellenrecht für Monteur-Insert; app_user besitzt für `qualifications` nur select/insert/update, RLS-Policy `qualifications_write` verlangt `is_staff()` | stimmt |
| 290 | `v_state is distinct from '42501'` | 42501 | wie oben, kein delete-Tabellenrecht auf `qualifications` (Migration vergibt nur select/insert/update, Zeile 268 der Migration) | stimmt |
| 343 | `v_state is distinct from '23505'` | SQLSTATE 23505 = unique_violation | `technician_qualifications_uq` (unique technician_id, qualification_id) aus Migration Zeile 147 verhindert die doppelte Zuordnung aus AA6 | stimmt |
| 361 | `v_count <> 2` | 2 | AA6 (Zeilen 303–323) ordnet Techniker A genau 2 Qualifikationen zu (`…b1`, `…b2`); AA7 (Zeilen 329–349) scheitert an der Unique-Bedingung und legt keine dritte Zeile an; zum Zeitpunkt von AA8 (Zeile 361) bleiben es 2 Zeilen für `…a2` | stimmt |
| 373 | `v_state is distinct from '42501'` | 42501 | kein insert-Tabellenrecht für Monteur auf `technician_qualifications` (RLS-Policy `_insert` verlangt `is_staff()`) | stimmt |
| 400 | `v_state is distinct from '42501'` | 42501 | kein update-Tabellenrecht auf `technician_qualifications` für app_user überhaupt (Migration vergibt nur select/insert/delete, Zeile 269) | stimmt |
| 427 | `v_state is distinct from '23503'` | SQLSTATE 23503 = foreign_key_violation | `technician_qualifications.technician_id` referenziert `technicians(id)` ohne `on delete`-Klausel (Migration Zeile 143, non-kaskadierend) | stimmt |
| 439 | `v_state is distinct from '23503'` | 23503 | analog für `qualification_id` → `qualifications(id)`, ebenfalls ohne `on delete` (Migration Zeile 144) | stimmt |
| 469 | `v_state is distinct from '23514'` | 23514 | `on_call_plan_stage_kind_chk` (Migration Zeilen 224–235) weist dispo MIT construction_stage_id ab | stimmt |
| 482 | `v_state is distinct from '23514'` | 23514 | derselbe Constraint weist bereitschaft OHNE construction_stage_id ab | stimmt |
| 526 | `v_state is distinct from '23505'` | 23505 | partieller Unique-Index `on_call_plan_dispo_uq` (Migration Zeile 252) verhindert zweite dispo-Zeile derselben Person/Tag | stimmt |
| 552 | `v_top_label/-color is distinct from 'AA29 Fachkraft'/'blau'` | Werteprobe, kein reiner Zähler | Techniker A trägt Basis (rank 10) und Fachkraft (rank 20, Farbe blau) aus AA2/AA6; `order by rank desc limit 1` liefert die Fachkraft-Zeile | stimmt |
| 587 | `v_rest <> 0` | 0 | Summe aller Zeilen mit Präfix `29a00000-` über alle sieben Tabellen NACH dem `rollback;` (Zeile 566); da die gesamte Wirkungsphase in einer Transaktion mit abschließendem Rollback läuft, muss die Summe strukturell 0 sein | stimmt |
| 596 | `v_jetzt <> v_start` | dynamisch | Funktionszahl in `pg_proc`/`public` vor und nach dem Lauf; kein fester Literalwert, sondern Vorher-Nachher-Vergleich (Zeilen 57–65 vs. 592–595) | stimmt (kein Literal zu prüfen) |

**Ergebnis der Rechenprobe:** Von 22 gefundenen Vergleichsstellen sind 5 dynamische
Vorher/Nachher-Vergleiche (keine festen Literale, strukturell korrekt), 16 feste Sollzahlen/
SQLSTATE-Werte, die sich vollständig aus der Datei selbst und aus Migration 0022 nachrechnen
lassen und **stimmen**, sowie **eine** Stelle mit falscher Sollzahl (Zeile 108), die
**korrigiert** wurde. Es gibt **keine** Stelle, die als „nicht herleitbar“ gemeldet werden
müsste — alle Sollzahlen dieser Datei hängen ausschließlich von den eigenen vorherigen
Anweisungen der Datei und von Migration 0022 ab, nicht vom Zustand eines früheren Smokes
(Präfix `29a00000-` ist smoke-eigen, siehe Kopfkommentar Zeilen 40–41: kein Rest aus Smoke 28).

**Damit ist genau 1 Zählstelle korrigiert — deutlich unter dem Stopppunkt von 5.**

## Kein Datenbanklauf möglich

In dieser Umgebung ist **kein PostgreSQL** verfügbar. Die Korrektur und die Rechenprobe beruhen
ausschließlich auf dem Lesen der Datei `29_hlk_dispo_board.sql`, der Migrationen
`0021_hlk_bereitschaftsplan.sql` und `0022_hlk_dispo_board.sql` sowie der Vergleichsmuster
`26_hlk_kataloge.sql` und `28_hlk_bereitschaftsplan.sql`. **Es wurde kein SQL- oder
Datenbanklauf durchgeführt** — ob der Smoke mit der korrigierten Sollzahl tatsächlich grün
läuft, entscheidet Dennis' nächster Datenbanklauf.

## Gegenproben (DoD)

- **$$-Bilanz:** `grep -c '^do \$\$'` → 16, `grep -c '^\$\$;'` → 16. Ausgeglichen.
- **Node-Testsuite** (`app/`, `node --test test/*.test.mjs`): **227/227 bestanden, 0 fehlgeschlagen,
  Exit-Code 0**. Keine andere Datei wurde durch die Änderung berührt.
- **Umfangsprüfung über Dateizeitstempel:** einzige Änderung innerhalb der Positivliste ist
  `app/supabase/test/29_hlk_dispo_board.sql`.

## Stopppunkte

Keiner der drei Stopppunkte aus AUFTRAG_26.md ist eingetreten:
- Es waren nicht mehr als fünf Zählstellen zu korrigieren (genau eine).
- Keine Korrektur berührt eine Migration oder eine andere Datei.
- Kein Bestandstest der Node-Suite wurde rot.
