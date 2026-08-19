# MELDUNG_25 — Smoke 28/Z12: `max(detail)` auf `jsonb` korrigiert, Durchsicht 26–29

> Ausgeführt vom Ausführungsagenten, 2026-08-19, gemäß `AUFTRAG_25.md`.
> **Kein Datenbanklauf möglich** (keine PostgreSQL-Instanz in dieser Umgebung).
> Die Korrektur ist ausschließlich statisch geprüft (Lesen von Migrationen 0001/0021/0022,
> Stilvergleich mit 21/22, `grep`-Gegenproben, Klammer-/`$$`-Bilanz, Node-Testlauf). Der
> Nachweis der Ausführbarkeit ist **Dennis' nächster Lauf** von
> `run_ap14b_local.ps1 -TemporaryCluster`.

## Geänderte Dateien (Positivliste eingehalten)

- `app/supabase/test/28_hlk_bereitschaftsplan.sql` — Z12 korrigiert (einzige inhaltliche
  Änderung).
- `app/supabase/test/29_hlk_dispo_board.sql` — **nicht geändert**. Die vollständige Durchsicht
  (siehe unten) fand dort keine nachweislich nicht ausführbare Stelle.

Dateizeitstempel als Nachweis: `28_hlk_bereitschaftsplan.sql` trägt jetzt 2026-08-19 (heute),
`29_hlk_dispo_board.sql`, `26_hlk_kataloge.sql` und `27_hlk_anrufdaten.sql` tragen unverändert
ihre alten Stände (17.08.2026) — bestätigt per `ls -la --time-style=full-iso`.

## Neuer Z12-Block (Wortlaut, `28_hlk_bereitschaftsplan.sql:581–620`)

```sql
-- ---------------------------------------------------------------------
-- Z12: AUDIT BEI DELETE - das Entfernen der Zuweisung aus Z9 hat einen
-- Audit-Datensatz erzeugt, der die geloeschte Zeile unter detail.old traegt.
-- Laeuft im EIGENTUEMERKONTEXT: app_user besitzt kein Recht auf
-- public.audit_events (0014_ap14b_data_grants.sql).
-- ---------------------------------------------------------------------
do $$
declare
  v_id uuid;
  v_count integer;
  v_detail jsonb;
begin
  v_id := nullif(current_setting('kb28a.plan_a3', true), '')::uuid;

  select count(*) into v_count
  from public.audit_events
  where entity = 'on_call_plan' and entity_id = v_id and action = 'DELETE';

  if v_count <> 1 then
    raise exception
      'SMOKE Z12 FAIL % statt 1 Audit-Datensatz fuer das delete der Zuweisung aus Z9 gefunden', v_count;
  end if;

  select detail into v_detail
  from public.audit_events
  where entity = 'on_call_plan' and entity_id = v_id and action = 'DELETE';

  if v_detail is null or v_detail->'old' is null then
    raise exception 'SMOKE Z12 FAIL der Audit-Datensatz traegt kein detail.old mit der geloeschten Zeile';
  end if;
  if (v_detail->'old'->>'id') is distinct from v_id::text then
    raise exception
      'SMOKE Z12 FAIL detail.old->id ist % statt der geloeschten Kennung %',
      coalesce(v_detail->'old'->>'id', 'NULL'), v_id;
  end if;

  raise notice
    'SMOKE Z12 OK das Entfernen einer Zuweisung erzeugt einen Audit-Datensatz mit der geloeschten Zeile unter detail.old';
end
$$;
```

**Begründung der Form:** Der Fall prüft ohnehin auf genau einen Treffer. Statt der ungültigen
Aggregation `max(detail)` (PostgreSQL kennt für `jsonb` keine `max`/`min`/`sum`-Aggregatfunktion
— keine Ordnungsoperatorklasse) wird jetzt zuerst mit `count(*)` die Anzahl geprüft und danach,
sobald genau ein Satz feststeht, `detail` per einfachem `select … into` derselben Bedingung
gelesen (die Bedingung liefert nach der Zählprüfung garantiert höchstens eine Zeile — ein
plain `select … into` in PL/pgSQL ist dafür die einfachste tragfähige Form, kein Umweg über
`::text` oder `order by … limit 1` nötig). Alle drei bestehenden Fehlermeldungen (falsche
Anzahl, fehlendes `detail.old`, abweichende `id`) bleiben wörtlich erhalten; die geprüfte
Aussage ist unverändert.

## Durchsicht 26–29 — alle Funde

**Suchmuster wie in AUFTRAG_25 gefordert:** Aggregatfunktionen über `jsonb` (`max`, `min`,
`sum`, `order by`/`distinct` auf `jsonb`), Verweise auf nicht existierende Spalten/Tabellen/
Views/Funktionen/Policies/Indizes, Vergleiche ohne passenden Operator, `into`-Ziele mit
unpassendem Typ.

### Fund 1 — behoben
- **Datei:Zeile:** `app/supabase/test/28_hlk_bereitschaftsplan.sql:595` (vor der Korrektur)
- **Anweisung:** `select count(*), max(detail) into v_count, v_detail from public.audit_events …`
- **Begründung:** `detail` ist `jsonb` (`0001_init.sql:367`); PostgreSQL hat keine
  `max()`-Aggregatfunktion für `jsonb` — die Anweisung scheitert bereits bei der
  Funktionsauflösung, unabhängig von den Daten. Genau der in AUFTRAG_25 beschriebene Fehler.
- **Status:** behoben (siehe Block oben).

### Rest von 28 ab Z12 (Z-ENDE)
- Geprüft: `Z-ENDE`-Block (`28_hlk_bereitschaftsplan.sql:628–671`). Verwendet nur `count(*)`
  über bestehende Tabellen (`profiles`, `auth_accounts`, `construction_stages`, `technicians`,
  `on_call_plan`, `audit_events`) und `pg_proc`/`pg_namespace` — alle Spalten- und
  Tabellennamen gegen `0021_hlk_bereitschaftsplan.sql` und `0001_init.sql` geprüft, keine
  Abweichung gefunden. Kein weiterer Fund.

### `29_hlk_dispo_board.sql` — vollständig gelesen (612 Zeilen)
Kein einziger Treffer für eine nachweislich nicht ausführbare Anweisung. Im Einzelnen
gegengeprüft:

- **AA1** (Zeilen 122–183): `pg_policies`-Zählung für `qualifications` (erwartet 2) und
  `technician_qualifications` (erwartet 3) — deckt sich exakt mit
  `0022_hlk_dispo_board.sql:113–190` (zwei Policies auf `qualifications`, drei auf
  `technician_qualifications`). Kein Fund.
- **AA3/AA5** (Zeilen 218–297): Constraint `qualifications_color_chk` und fehlendes
  `delete`-Tabellenrecht auf `qualifications` — beides in `0022` so angelegt
  (`qualifications_color_chk`, Grant nur `select, insert, update`). Kein Fund.
- **AA6–AA9** (Zeilen 303–406): `technician_qualifications_uq`, Policies
  `technician_qualifications_insert/_delete`, fehlendes `update`-Tabellenrecht — alles in
  `0022:141–190,268–269` vorhanden. Kein Fund.
- **AA10** (Zeilen 416–446): FK-Verhalten `technician_id`/`qualification_id`, beide `not null
  references` ohne `on delete`-Klausel (`0022:143–144`) — konsistent mit der erwarteten
  `23503`. Kein Fund.
- **AA11–AA13** (Zeilen 454–532): Check-Constraint `on_call_plan_stage_kind_chk` sowie die
  beiden partiellen Unique-Indizes `on_call_plan_bereitschaft_uq`/`on_call_plan_dispo_uq`
  (`0022:224–254`) — Testfälle spiegeln die Migration exakt. Kein Fund.
- **AA14** (Zeilen 538–558): `order by q.rank desc limit 1` — `rank` ist `integer`
  (`0022_hlk_dispo_board.sql:80`), eine ordnungsfähige Skalarspalte; kein `jsonb`-Bezug, keine
  Aggregatfunktion. Kein Fund.
- **AA-ENDE** (Zeilen 571–603): nur `count(*)` über existierende Tabellen und `pg_proc`. Kein
  Fund.
- Alle referenzierten Spalten-, Tabellen-, Policy- und Indexnamen (`qualifications`,
  `technician_qualifications`, `assignment_kind`, `on_call_plan_bereitschaft_uq`,
  `on_call_plan_dispo_uq`, `on_call_plan_assignment_kind_chk`, `on_call_plan_stage_kind_chk`,
  `technician_qualifications_uq`) wurden gegen `0022_hlk_dispo_board.sql` und
  `0021_hlk_bereitschaftsplan.sql` abgeglichen — keine Abweichung.

**Ergebnis der Durchsicht:** genau **ein** Fund insgesamt (Z12 in 28), wie im Auftrag
angekündigt. `29_hlk_dispo_board.sql` bleibt unverändert. Der Stopppunkt „mehr als drei nicht
ausführbare Stellen in 29" ist nicht erreicht (0 Stellen).

## Messwerte (DoD)

1. **Geänderte Dateien:** nur `app/supabase/test/28_hlk_bereitschaftsplan.sql` (Positivliste
   eingehalten; `29_hlk_dispo_board.sql` unverändert, Nachweis über Dateizeitstempel s. o.).
2. **`grep -n "max(detail\|min(detail\|sum(detail"` über 26/27/28/29:** keine Treffer mehr
   (leere Ausgabe).
3. **Klammer-/`$$`-Bilanz** (`grep -c '^do \$\$'` gegen `grep -c '^\$\$;'`):
   - `28_hlk_bereitschaftsplan.sql`: 15 gegen 15 — ausgeglichen.
   - `29_hlk_dispo_board.sql` (unverändert, nur Kontrolle): 16 gegen 16 — ausgeglichen.
4. **Node-Suite** (`app/`, `node --test test/*.test.mjs`): **227/227 bestanden, fail 0, Exit
   0.**

## Ausdrücklicher Hinweis

In dieser Umgebung steht **kein PostgreSQL** zur Verfügung. Die Korrektur an Z12 sowie die
gesamte Durchsicht 26–29 wurden **rein statisch** gegen die Migrationen 0001/0021/0022 und den
Stil laufender Smokes (21, 22) geprüft — **kein SQL- oder Datenbanklauf hat stattgefunden**. Der
Nachweis, dass Z12 jetzt tatsächlich durchläuft und Smoke 29 vollständig grün wird, ist **Dennis'
nächster Lauf** von `run_ap14b_local.ps1 -TemporaryCluster`.

## Stopppunkte

Keiner der drei Stopppunkte aus AUFTRAG_25 ist eingetreten:
- Durchsicht von 29 fand **0** (nicht mehr als drei) nicht ausführbare Stellen.
- Keine Korrektur erforderte eine Migrationsänderung.
- Kein Bestandstest der Node-Suite wurde rot (227/227, Exit 0).
