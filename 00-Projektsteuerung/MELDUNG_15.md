# MELDUNG 15 vom Worker-Chat zu AUFTRAG_15

> Stand: 2026-08-18. Verfasst von Claude (Rolle Worker, Ausführungsagent),
> Antwort auf `00-Projektsteuerung/AUFTRAG_15.md`. Schriftliche Notiz, kein
> Chat-Kanal.

## Ergebnis in Kürze

Fall Z7 in `app/supabase/test/28_hlk_bereitschaftsplan.sql` umgebaut: die
fehlerhafte Erwartung `SQLSTATE '42501'` beim `delete`-Versuch des Monteurs
wurde durch eine Wirkungsprüfung ersetzt (kein Fehler beim Versuch selbst,
`get diagnostics ... = row_count` genau 0, Fortbestand der Zeile im
Staff-/Administrator-Kontext gelesen, Gesamtzeilenzahl vor/nach unverändert
nach dem Muster von Z6). Kopfkommentar von Z7 hält die Semantik fest (`using`
filtert bei `delete`, `42501` nur bei fehlendem Tabellenrecht oder verletzter
`with check`) mit Verweis auf `0021_hlk_bereitschaftsplan.sql`, Abschnitt 3.
Genau eine Datei geändert, wie von der Positivliste vorgegeben. Unit-Tests
177/177, Exit 0. Kein Stopppunkt ausgelöst, kein weiterer Befund. Kein
DB-Lauf möglich (kein PostgreSQL in dieser Sandbox) — kein Commit, kein
Push.

## Geänderte Dateien

- `app/supabase/test/28_hlk_bereitschaftsplan.sql` (ausschließlich der
  Z7-Block: Kopfkommentar + `do $$ ... $$;`-Rumpf; Z1–Z6 und Z8 bis
  Z-ENDE bleiben zeichengleich, siehe Diff-Nachweis unten).

Keine weitere Datei angefasst — insbesondere `app/supabase/migrations/0021_hlk_bereitschaftsplan.sql`
NICHT geändert (nur gelesen, Abschnitt 3 als Begründungsquelle bestätigt).

## Neuer Z7-Block (wörtlich)

```sql
-- ---------------------------------------------------------------------
-- Z7: MONTEUR NEGATIV - kein delete, auch nicht auf eine bestehende, fuer ihn
-- sichtbare Zeile.
--
-- Semantik (siehe 0021_hlk_bereitschaftsplan.sql, Abschnitt 3): `using`
-- filtert bei delete die Treffermenge, es weist sie nicht ab - 42501 entsteht
-- nur bei fehlendem Tabellenrecht oder einer verletzten `with check` (insert/
-- update). app_user besitzt delete auf public.on_call_plan, die Policy
-- on_call_plan_delete traegt `using (public.is_staff())`; der Monteur loescht
-- daher 0 Zeilen ohne Fehler. Geprueft wird die Wirkung, nicht ein SQLSTATE.
-- ---------------------------------------------------------------------
do $$
declare
  v_state text;
  v_id uuid;
  v_deleted integer;
  v_exists boolean;
  v_count_vorher integer;
  v_count_nachher integer;
begin
  perform set_config('app.user_id', '28a00000-0000-0000-0000-000000000003', true);
  v_id := nullif(current_setting('kb28a.plan_a2', true), '')::uuid;

  select count(*) into v_count_vorher from public.on_call_plan;

  v_state := null;
  v_deleted := null;
  begin
    delete from public.on_call_plan where id = v_id;
    get diagnostics v_deleted = row_count;
  exception
    when others then v_state := sqlstate;
  end;

  if v_state is not null then
    raise exception
      'SMOKE Z7 FAIL SQLSTATE % beim Loeschversuch des Monteurs - der Zeilenfilter der Policy on_call_plan_delete darf keinen Fehler auswerfen',
      v_state;
  end if;

  if v_deleted <> 0 then
    raise exception 'SMOKE Z7 FAIL der Monteur hat % Zeile(n) statt 0 geloescht', v_deleted;
  end if;

  select count(*) into v_count_nachher from public.on_call_plan;
  if v_count_nachher <> v_count_vorher then
    raise exception 'SMOKE Z7 FAIL die Zeilenzahl hat sich trotz 0 betroffener Zeilen veraendert (% -> %)',
      v_count_vorher, v_count_nachher;
  end if;

  perform set_config('app.user_id', '28a00000-0000-0000-0000-000000000001', true);
  select exists(select 1 from public.on_call_plan where id = v_id) into v_exists;
  perform set_config('app.user_id', '28a00000-0000-0000-0000-000000000003', true);
  if not v_exists then
    raise exception 'SMOKE Z7 FAIL die Zuweisung besteht nach dem Loeschversuch des Monteurs nicht mehr';
  end if;

  raise notice 'SMOKE Z7 OK der Zeilenfilter der Policy on_call_plan_delete (using is_staff()) entfernt die Zeile aus der Treffermenge - 0 betroffene Zeilen, kein Fehler, die Zuweisung bleibt bestehen';
end
$$;
```

Erläuterung der vier Prüfpunkte im Block:

1. `v_state` bleibt `null`, solange der `delete`-Versuch ohne Ausnahme
   durchläuft; jeder auftretende SQLSTATE (nicht nur `insufficient_privilege`)
   löst ein `FAIL` aus.
2. `get diagnostics v_deleted = row_count` unmittelbar nach dem `delete`;
   geprüft wird `v_deleted <> 0`.
3. Fortbestand der Zeile: `app.user_id` wird auf den Administrator
   (`...0001`) umgestellt (Muster wie Z9), erst dann `select exists(...)`
   gelesen, danach zurück auf den Monteur (`...0003`) — damit prüft nicht der
   eigene (ohnehin offene) `select`-Kontext des Monteurs, sondern die
   Staff-Sicht.
4. `v_count_vorher`/`v_count_nachher` auf der gesamten Tabelle
   `public.on_call_plan`, exakt das Muster aus Z6.

## DoD — die vier Messwerte

**1) `git diff --stat` — genau eine Datei:**

```
$ git diff --stat -- app/supabase/test/28_hlk_bereitschaftsplan.sql
 app/supabase/test/28_hlk_bereitschaftsplan.sql | 37 +++++++++++++++++++++-----
 1 file changed, 31 insertions(+), 6 deletions(-)
```

`git status --porcelain` zeigt für den Auftragsumfang ausschließlich diese
eine Zeile: `M app/supabase/test/28_hlk_bereitschaftsplan.sql` (Exit 0).

**2) Kein `'42501'`-Vergleich mehr in Z7; stattdessen `get diagnostics`/
`row_count`, Fortbestandsprüfung, Gesamtzahlprüfung:** bestätigt durch den
Diff und den wörtlichen Block oben — `grep -n "42501"` auf der Datei findet
danach nur noch Z6 (Zeile ~362/364/374) und Z8 (Zeile ~434/436/440), beide
unverändert und fachlich weiterhin zutreffend (Z6: `insert`/`with check`;
Z8: fehlendes `update`-Tabellenrecht — keine `using`-Filterung).

**3) Z1–Z6 und Z8 bis Z-ENDE unverändert im Diff:** der volle Diff (siehe
unten) enthält ausschließlich Zeilen innerhalb des Z7-Kopfkommentars und
-Rumpfs; keine Trefferzeile außerhalb dieses Blocks.

```
$ git diff -- app/supabase/test/28_hlk_bereitschaftsplan.sql
diff --git a/app/supabase/test/28_hlk_bereitschaftsplan.sql b/app/supabase/test/28_hlk_bereitschaftsplan.sql
index 825ef70..e39004b 100644
--- a/app/supabase/test/28_hlk_bereitschaftsplan.sql
+++ b/app/supabase/test/28_hlk_bereitschaftsplan.sql
@@ -378,36 +378,61 @@ $$;
 -- ---------------------------------------------------------------------
 -- Z7: MONTEUR NEGATIV - kein delete, auch nicht auf eine bestehende, fuer ihn
 -- sichtbare Zeile.
+--
+-- Semantik (siehe 0021_hlk_bereitschaftsplan.sql, Abschnitt 3): `using`
+-- filtert bei delete die Treffermenge, es weist sie nicht ab - 42501 entsteht
+-- nur bei fehlendem Tabellenrecht oder einer verletzten `with check` (insert/
+-- update). app_user besitzt delete auf public.on_call_plan, die Policy
+-- on_call_plan_delete traegt `using (public.is_staff())`; der Monteur loescht
+-- daher 0 Zeilen ohne Fehler. Geprueft wird die Wirkung, nicht ein SQLSTATE.
 -- ---------------------------------------------------------------------
 do $$
 declare
   v_state text;
   v_id uuid;
+  v_deleted integer;
   v_exists boolean;
+  v_count_vorher integer;
+  v_count_nachher integer;
 begin
   perform set_config('app.user_id', '28a00000-0000-0000-0000-000000000003', true);
   v_id := nullif(current_setting('kb28a.plan_a2', true), '')::uuid;

+  select count(*) into v_count_vorher from public.on_call_plan;
+
   v_state := null;
+  v_deleted := null;
   begin
     delete from public.on_call_plan where id = v_id;
+    get diagnostics v_deleted = row_count;
   exception
-    when insufficient_privilege then v_state := sqlstate;
     when others then v_state := sqlstate;
   end;

-  if v_state is distinct from '42501' then
+  if v_state is not null then
     raise exception
-      'SMOKE Z7 FAIL SQLSTATE % statt 42501 beim Loeschversuch des Monteurs',
-      coalesce(v_state, 'kein Fehler - der Monteur hat die Zuweisung entfernt');
+      'SMOKE Z7 FAIL SQLSTATE % beim Loeschversuch des Monteurs - der Zeilenfilter der Policy on_call_plan_delete darf keinen Fehler auswerfen',
+      v_state;
   end if;

+  if v_deleted <> 0 then
+    raise exception 'SMOKE Z7 FAIL der Monteur hat % Zeile(n) statt 0 geloescht', v_deleted;
+  end if;
+
+  select count(*) into v_count_nachher from public.on_call_plan;
+  if v_count_nachher <> v_count_vorher then
+    raise exception 'SMOKE Z7 FAIL die Zeilenzahl hat sich trotz 0 betroffener Zeilen veraendert (% -> %)',
+      v_count_vorher, v_count_nachher;
+  end if;
+
+  perform set_config('app.user_id', '28a00000-0000-0000-0000-000000000001', true);
   select exists(select 1 from public.on_call_plan where id = v_id) into v_exists;
+  perform set_config('app.user_id', '28a00000-0000-0000-0000-000000000003', true);
   if not v_exists then
-    raise exception 'SMOKE Z7 FAIL die Zuweisung besteht nach dem abgewiesenen Loeschversuch nicht mehr';
+    raise exception 'SMOKE Z7 FAIL die Zuweisung besteht nach dem Loeschversuch des Monteurs nicht mehr';
   end if;

-  raise notice 'SMOKE Z7 OK der Monteur wird bei delete mit 42501 abgewiesen, die Zeile bleibt bestehen';
+  raise notice 'SMOKE Z7 OK der Zeilenfilter der Policy on_call_plan_delete (using is_staff()) entfernt die Zeile aus der Treffermenge - 0 betroffene Zeilen, kein Fehler, die Zuweisung bleibt bestehen';
 end
 $$;
```

**4) Unit-Tests aus `app/`:**

```
$ node --test test/*.test.mjs
...
1..177
# tests 177
# suites 0
# pass 177
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 5454.235952
```

**Exit-Code: 0.** Ergebnis **177/177**, unverändert zur genannten Baseline
2026-08-17. Die SQL-Smokes sind nicht Teil dieser Suite; der Lauf belegt nur,
dass keine andere Datei angefasst wurde.

## Ausdrücklicher Hinweis: kein DB-Lauf möglich

In dieser Sandbox ist **kein PostgreSQL** verfügbar (kein `psql`, kein
`createdb`). Der neue Z7-Block wurde **nicht** gegen eine echte Datenbank
ausgeführt — weder der ursprüngliche fehlschlagende Lauf noch der jetzt
korrigierte. Die Korrektur beruht ausschließlich auf: dem CI-Fehlerprotokoll
aus `AUFTRAG_15.md`, dem Migrationsquelltext (`0021_hlk_bereitschaftsplan.sql`,
Abschnitt 3, insbesondere Zeilen 105–146: Policies `on_call_plan_select`/
`_insert`/`_delete` sowie der additive `grant select, insert, delete ...`),
dem Vergleichsmuster Z6 in derselben Datei sowie der dokumentierten
PostgreSQL-RLS-Semantik (`using` filtert bei `delete`/beim Zeilenfilter eines
`update`, `with check` weist bei `insert`/`update` ab). Der Nachweis entsteht
erst durch den nächsten CI-Lauf des Jobs `database` bzw. einen lokalen Lauf
durch Dennis. **Es wird kein SQL-/Smoke-Lauf behauptet.**

## Geprüfte Nebenfrage: `kb28a.plan_a2` sicher gesetzt?

Ja. `kb28a.plan_a2` wird in Z2 (Disponent legt Zuweisung an, Zeile ~254–260)
per `perform set_config('kb28a.plan_a2', v_id::text, false)` gesetzt,
unmittelbar nachdem `v_id is null` bereits mit `raise exception` abgefangen
wurde — Z2 läuft grün vor Z6/Z7, `v_id` in Z7 ist damit nie `NULL`. Kein
Stopppunkt aus diesem Grund.

## Weitere Fälle mit `42501` bei `delete`/`update`-`using`? (Befund)

Geprüft: alle `42501`-Vorkommen der Datei (`grep -n "42501"`) außerhalb von
Z7 sind Z6 und Z8.

- **Z6** (Zeile ~340–376): `insert`-Versuch des Monteurs, geprüft gegen
  `with check (public.is_staff())` der Policy `on_call_plan_insert` — `42501`
  ist hier weiterhin die korrekte Erwartung (fehlendes Tabellenrecht wäre
  ebenfalls 42501, aber der `with check` greift zuerst; unverändert, siehe
  Auftrag).
- **Z8** (Zeile ~417–441): `update`-Versuch des **Disponenten** (Staff,
  `app.user_id = ...0002`) — hier fehlt schlicht das Tabellenrecht `update`
  vollständig (`0021`, Abschnitt 3: nur `select, insert, delete` gegrantet,
  ausdrücklich kein `update`). Ein fehlendes Tabellenrecht liefert bei
  `update` weiterhin `42501` unabhängig vom `using`-Filter, weil der Zugriff
  schon vor der Zeilenauswertung an der Rechteprüfung scheitert. Diese
  Erwartung ist korrekt und **kein** Fall des in Z7 behobenen Musters.

**Kein weiterer Fall gefunden**, der `42501` bei `delete` oder beim
`using`-Zeilenfilter eines `update` erwartet, obwohl das Tabellenrecht
vorhanden ist. Z9–Z12 und Z-ENDE prüfen andere Sachverhalte (Staff-`delete`
ohne erwarteten Fehler, FK-Verhalten via `23503`, Audit-Trail,
Rollback-Gegenprobe) und sind nicht betroffen.

## Git-Status (nur eigener Umfang, nur lesende Befehle)

```
$ git status --porcelain -- app/supabase/test/28_hlk_bereitschaftsplan.sql
 M app/supabase/test/28_hlk_bereitschaftsplan.sql
```

Der übrige Arbeitsbaum trägt zahlreiche **vorbestehende**, außerhalb dieses
Auftragsumfangs liegende Änderungen und neue Dateien (u. a. aus AUFTRAG_11
bis AUFTRAG_14, `.claude/**`, `app/src/**`, weite Teile von
`app/supabase/**`) — diese wurden von mir **nicht erzeugt und nicht
angefasst**. Nur lesende `git`-Befehle (`status`, `diff`) wurden verwendet.

**Kein Commit, kein Push, kein Merge, kein Tag, kein Rebase, kein Reset,
kein Stash.** Der Arbeitsbaum bleibt uncommitted zur Prüfung durch den
Orchestrator/Review-Chat.

## Stopppunkt

**Kein Stopppunkt ausgelöst.** Im Einzelnen geprüft:

- Keine Änderung außerhalb der Positivliste nötig — die Korrektur war
  vollständig innerhalb des Z7-Blocks (Kopfkommentar + Rumpf) umsetzbar.
- `kb28a.plan_a2` ist vor Z7 sicher gesetzt (siehe oben) — kein `NULL`-Risiko.
- Unit-Test-Lauf ergab 177/177, Exit 0.
- Kein Fehler ist wiederholt aufgetreten.
