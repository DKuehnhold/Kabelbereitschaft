\set ON_ERROR_STOP on

-- =====================================================================
-- AUFTRAG_10 - Bereitschaftsplan (Einsatzplanung), Migration 0021, unter der
-- Anwendungsrolle app_user mit AKTIVER RLS.
--
-- Erwartet die vollstaendige Kette einschliesslich 0012 bis 0021 sowie die
-- Smokes 15-27. Diese Datei ist der neue letzte Eintrag der SQL-Kette,
-- unmittelbar HINTER ihrer eigenen Migration 0021 - dieselbe Konvention wie
-- bei 0015/21, 0016/22, 0017/23, 0018/25, 0019/26 und 0020/27.
--
-- GEGENSTAND, alles gemessen statt behauptet:
--   1. IDEMPOTENZ. Die echte Migrationsdatei 0021 wird ein zweites Mal
--      angewendet (per \ir, keine Kopie); Zeilenzahl, Policy- und
--      Rechtezustand duerfen sich dadurch nicht veraendern.
--   2. UNIQUE. Dieselbe Person kann fuer denselben Bauabschnitt/Tag nicht
--      zweimal zugewiesen werden (23505); mehrere VERSCHIEDENE Personen fuer
--      denselben Bauabschnitt/Tag sind dagegen ausdruecklich zulaessig (wie
--      in der Excel-Matrix).
--   3. ROLLENMATRIX. Der Monteur liest, schreibt nicht (weder insert noch
--      delete); Staff (admin, disponent) legt an UND entfernt.
--   4. FKs NICHT KASKADIEREND: weder construction_stage_id noch
--      technician_id sind ON DELETE CASCADE.
--   5. AUDIT BEI DELETE: das Entfernen einer Zuweisung erzeugt einen
--      Audit-Datensatz (public.audit_events), der die geloeschte Zeile
--      unter detail.old traegt - eine entfernte Zuweisung ist damit nicht
--      spurlos.
--   6. KEIN UPDATE: weder Policy noch Tabellenrecht erlauben ein update auf
--      public.on_call_plan, auch nicht fuer Staff.
--
-- Verbindliche Eigenschaften dieses Smokes (identisch zu 25/26/27):
--   * Er fuehrt KEIN `grant` und KEIN `revoke` aus, aendert keine Policy und
--     schaltet keinen Trigger ab. Die einzigen DDL-Anweisungen ausserhalb der
--     per \ir eingebundenen Migration gibt es hier nicht.
--   * Er erzeugt KEIN dauerhaftes Schemaobjekt.
--   * Die Identitaet wird immer mit set_config('app.user_id', ..., true)
--     gesetzt - genau so, wie withUserTransaction() es tut
--     (app/src/lib/db/index.ts). Geprueft wird unter `set role app_user` mit
--     aktiver RLS; der Eigentuemerkontext (`reset role;`) dient
--     ausschliesslich den Fixtures, dem Migrationslauf selbst, den beiden
--     FK-Gegenproben und dem Audit-Nachweis (app_user besitzt ohnehin kein
--     Recht auf public.audit_events, 0014_ap14b_data_grants.sql).
--   * NUR SYNTHETISCHE WERTE. Alle drei Konten tragen den projektweit
--     etablierten Marker '!MIGRATED-ACCOUNT-REQUIRES-RESET!'. E-Mail-Adressen
--     liegen auf @beispiel.invalid.
--
-- WARUM DIE GANZE WIRKUNGSPHASE IN EINER TRANSAKTION MIT ROLLBACK LAEUFT:
--   Dieselbe Begruendung wie in 25/26/27: ein expliziter Transaktionsrahmen
--   mit `rollback;` ist das im Projekt durchgehend verwendete, bereits
--   geprueft sichere Muster. DDL ist in PostgreSQL transaktional; der
--   Rollback nimmt daher auch den erneuten Lauf von 0021 (reine
--   `create table if not exists`/idempotente Guards/`grant`, ohnehin ohne
--   Wirkung auf den bereits erreichten Zielzustand) folgenlos zurueck.
--
-- WARUM Z1 DIE MIGRATION PER `\ir` EINBINDET UND NICHT NACHBAUT:
--   Gegenstand ist die Datei
--   app/supabase/migrations/0021_hlk_bereitschaftsplan.sql selbst - eine
--   Kopie ihrer Anweisungen wuerde nur die Kopie pruefen. `\ir` loest den Pfad
--   relativ zum Verzeichnis DIESER Datei auf (app/supabase/test/) und
--   funktioniert auch innerhalb einer offenen Transaktion.
--
-- Meldungskennung: Z (Fallkennung Z laut AUFTRAG_10.md). Z ist in der Kette
-- bislang frei (siehe Aufzaehlung im Kopf von 25_ap15b_incident_metrics.sql;
-- Y gehoert 27_hlk_anrufdaten.sql). UUID-Praefix: 28a00000-. Er kommt in
-- keiner anderen Test- oder Migrationsdatei vor.
--
-- Kennungen dieser Datei:
--   ...0001 Administrator - is_staff(), darf anlegen/entfernen
--   ...0002 Disponent     - is_staff(), darf anlegen/entfernen
--   ...0003 Monteur       - darf lesen, nicht schreiben
--   ...00a1 Bauabschnitt
--   ...00a2 Techniker A (fuer die Unique-Gegenprobe und den Rollentest)
--   ...00a3 Techniker B (zweite, VERSCHIEDENE Person am selben Tag)
--   ...00a4 zweiter Bauabschnitt (fuer die FK-Gegenprobe von
--           construction_stage_id)
--   ...00a5 dritter Techniker (fuer die FK-Gegenprobe von technician_id)
-- =====================================================================

reset role;
select set_config('app.user_id', '', false);

-- ---------------------------------------------------------------------
-- Ausgangsstand der Funktionen in schema public, sitzungsweit und ausserhalb
-- des Transaktionsrahmens festgehalten - dient Z-ENDE als Nachweis, dass
-- dieser Smoke kein Schemaobjekt erzeugt. Muster aus 25/26/27.
-- ---------------------------------------------------------------------
select set_config(
  'kb28a.proc_count_start',
  (
    select count(*)::text
    from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public'
  ),
  false);

begin;

-- ---------------------------------------------------------------------
-- Fixtures im Eigentuemerkontext.
-- ---------------------------------------------------------------------
insert into public.auth_accounts (id, email, password_hash, must_change_password, is_disabled)
values
  ('28a00000-0000-0000-0000-000000000001', 'z28.admin@beispiel.invalid', '!MIGRATED-ACCOUNT-REQUIRES-RESET!', false, false),
  ('28a00000-0000-0000-0000-000000000002', 'z28.dispo@beispiel.invalid', '!MIGRATED-ACCOUNT-REQUIRES-RESET!', false, false),
  ('28a00000-0000-0000-0000-000000000003', 'z28.monteur@beispiel.invalid', '!MIGRATED-ACCOUNT-REQUIRES-RESET!', false, false)
on conflict (id) do nothing;

insert into public.profiles (id, full_name, role, is_active)
values
  ('28a00000-0000-0000-0000-000000000001', 'Z28 Admin', 'admin', true),
  ('28a00000-0000-0000-0000-000000000002', 'Z28 Disponent', 'disponent', true),
  ('28a00000-0000-0000-0000-000000000003', 'Z28 Monteur', 'monteur', true)
on conflict (id) do nothing;

insert into public.construction_stages (id, code, name)
values ('28a00000-0000-0000-0000-0000000000a1', 'B28Z', 'Bauabschnitt AUFTRAG_10 Bereitschaftsplan')
on conflict (id) do nothing;

insert into public.construction_stages (id, code, name)
values ('28a00000-0000-0000-0000-0000000000a4', 'B28Z2', 'Bauabschnitt AUFTRAG_10 FK-Gegenprobe')
on conflict (id) do nothing;

insert into public.technicians (id, first_name, last_name)
values ('28a00000-0000-0000-0000-0000000000a2', 'Z28', 'Techniker A')
on conflict (id) do nothing;

insert into public.technicians (id, first_name, last_name)
values ('28a00000-0000-0000-0000-0000000000a3', 'Z28', 'Techniker B')
on conflict (id) do nothing;

insert into public.technicians (id, first_name, last_name)
values ('28a00000-0000-0000-0000-0000000000a5', 'Z28', 'Techniker C (FK-Gegenprobe)')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Z-FIXTURES: Ausgangslage im Eigentuemerkontext belegen.
-- ---------------------------------------------------------------------
do $$
declare
  v_admin integer;
  v_dispo integer;
  v_monteur integer;
  v_stammdaten integer;
begin
  select count(*) into v_admin from public.profiles
   where id = '28a00000-0000-0000-0000-000000000001' and role = 'admin' and is_active;
  select count(*) into v_dispo from public.profiles
   where id = '28a00000-0000-0000-0000-000000000002' and role = 'disponent' and is_active;
  select count(*) into v_monteur from public.profiles
   where id = '28a00000-0000-0000-0000-000000000003' and role = 'monteur' and is_active;

  if v_admin <> 1 or v_dispo <> 1 or v_monteur <> 1 then
    raise exception
      'SMOKE Z-FIXTURES FAIL Rollen nicht wie gewollt (admin=%, disponent=%, monteur=% - erwartet je 1)',
      v_admin, v_dispo, v_monteur;
  end if;

  select
    (select count(*) from public.construction_stages where id in
      ('28a00000-0000-0000-0000-0000000000a1', '28a00000-0000-0000-0000-0000000000a4'))
    + (select count(*) from public.technicians where id in
      ('28a00000-0000-0000-0000-0000000000a2', '28a00000-0000-0000-0000-0000000000a3',
       '28a00000-0000-0000-0000-0000000000a5'))
  into v_stammdaten;

  if v_stammdaten <> 5 then
    raise exception
      'SMOKE Z-FIXTURES FAIL % von 5 Stammdatenzeilen vorhanden (zwei Bauabschnitte, drei Techniker)',
      v_stammdaten;
  end if;

  raise notice
    'SMOKE Z-FIXTURES OK drei Identitaeten (Administrator, Disponent, Monteur), zwei Bauabschnitte und drei Techniker stehen bereit';
end
$$;

-- =====================================================================
-- Z1: IDEMPOTENZ-DOPPELLAUF. Die echte Migration wird ein zweites Mal
-- angewendet; die NOTICE-Meldungen ("relation ... already exists, skipping",
-- "policy ... already exists, skipping" fuer die dank Guard uebersprungenen
-- create policy) sind erwartet.
-- =====================================================================
reset role;
select set_config('app.user_id', '', true);

do $$
declare
  v_rows_vorher integer;
  v_policies_vorher integer;
begin
  select count(*) into v_rows_vorher from public.on_call_plan;
  select count(*) into v_policies_vorher from pg_policies
   where schemaname = 'public' and tablename = 'on_call_plan';
  perform set_config('kb28a.rows_vorher', v_rows_vorher::text, true);
  perform set_config('kb28a.policies_vorher', v_policies_vorher::text, true);
end
$$;

\ir ../migrations/0021_hlk_bereitschaftsplan.sql

do $$
declare
  v_rows_vorher integer;
  v_policies_vorher integer;
  v_rows_nachher integer;
  v_policies_nachher integer;
  v_has_update boolean;
begin
  v_rows_vorher := current_setting('kb28a.rows_vorher', true)::integer;
  v_policies_vorher := current_setting('kb28a.policies_vorher', true)::integer;

  select count(*) into v_rows_nachher from public.on_call_plan;
  select count(*) into v_policies_nachher from pg_policies
   where schemaname = 'public' and tablename = 'on_call_plan';

  if v_rows_nachher <> v_rows_vorher then
    raise exception
      'SMOKE Z1 FAIL Zeilenzahl von public.on_call_plan aendert sich durch den erneuten Migrationslauf: % -> %',
      v_rows_vorher, v_rows_nachher;
  end if;
  if v_policies_nachher <> v_policies_vorher or v_policies_nachher <> 3 then
    raise exception
      'SMOKE Z1 FAIL Policy-Zahl von public.on_call_plan nach dem erneuten Lauf: % (vorher %, erwartet 3)',
      v_policies_nachher, v_policies_vorher;
  end if;

  select has_table_privilege('app_user', 'public.on_call_plan', 'update') into v_has_update;
  if v_has_update then
    raise exception
      'SMOKE Z1 FAIL app_user besitzt nach dem erneuten Lauf ein update-Tabellenrecht auf public.on_call_plan';
  end if;

  raise notice
    'SMOKE Z1 OK der erneute Lauf der echten Migration 0021 veraendert weder Zeilenzahl noch Policy-/Rechtezustand von public.on_call_plan - Idempotenz belegt';
end
$$;

-- =====================================================================
-- Ab hier unter der Anwendungsrolle app_user mit aktiver RLS.
-- =====================================================================
set role app_user;

-- ---------------------------------------------------------------------
-- Z2: STAFF (Disponent) legt eine Zuweisung an.
-- ---------------------------------------------------------------------
do $$
declare
  v_id uuid;
begin
  perform set_config('app.user_id', '28a00000-0000-0000-0000-000000000002', true);

  insert into public.on_call_plan (construction_stage_id, plan_date, technician_id)
  values ('28a00000-0000-0000-0000-0000000000a1', '2026-08-24', '28a00000-0000-0000-0000-0000000000a2')
  returning id into v_id;

  if v_id is null then
    raise exception 'SMOKE Z2 FAIL der Disponent konnte keine Zuweisung anlegen';
  end if;
  perform set_config('kb28a.plan_a2', v_id::text, false);

  raise notice 'SMOKE Z2 OK der Disponent legt eine Zuweisung an';
end
$$;

-- ---------------------------------------------------------------------
-- Z3: UNIQUE - dieselbe Person kann fuer denselben Bauabschnitt/Tag nicht
-- ein zweites Mal zugewiesen werden (23505).
-- ---------------------------------------------------------------------
do $$
declare
  v_state text;
begin
  perform set_config('app.user_id', '28a00000-0000-0000-0000-000000000002', true);

  v_state := null;
  begin
    insert into public.on_call_plan (construction_stage_id, plan_date, technician_id)
    values ('28a00000-0000-0000-0000-0000000000a1', '2026-08-24', '28a00000-0000-0000-0000-0000000000a2');
  exception
    when unique_violation then v_state := sqlstate;
    when others then v_state := sqlstate;
  end;

  if v_state is distinct from '23505' then
    raise exception
      'SMOKE Z3 FAIL SQLSTATE % statt 23505 bei der doppelten Zuweisung derselben Person am selben Tag/Bauabschnitt',
      coalesce(v_state, 'kein Fehler - die doppelte Zuweisung wurde angelegt');
  end if;

  raise notice 'SMOKE Z3 OK die doppelte Zuweisung derselben Person am selben Tag/Bauabschnitt wird mit 23505 abgewiesen';
end
$$;

-- ---------------------------------------------------------------------
-- Z4: MEHRERE VERSCHIEDENE PERSONEN je Bauabschnitt/Tag sind ausdruecklich
-- zulaessig (wie in der Excel-Matrix) - keine Verletzung der Unique-Bedingung.
-- ---------------------------------------------------------------------
do $$
declare
  v_id uuid;
begin
  perform set_config('app.user_id', '28a00000-0000-0000-0000-000000000002', true);

  insert into public.on_call_plan (construction_stage_id, plan_date, technician_id)
  values ('28a00000-0000-0000-0000-0000000000a1', '2026-08-24', '28a00000-0000-0000-0000-0000000000a3')
  returning id into v_id;

  if v_id is null then
    raise exception 'SMOKE Z4 FAIL eine zweite, VERSCHIEDENE Person konnte fuer denselben Tag/Bauabschnitt nicht zugewiesen werden';
  end if;
  perform set_config('kb28a.plan_a3', v_id::text, false);

  raise notice 'SMOKE Z4 OK mehrere verschiedene Personen duerfen denselben Bauabschnitt/Tag tragen';
end
$$;

-- ---------------------------------------------------------------------
-- Z5: MONTEUR darf lesen - beide in Z2/Z4 angelegten Zuweisungen sind
-- sichtbar.
-- ---------------------------------------------------------------------
do $$
declare
  v_count integer;
begin
  perform set_config('app.user_id', '28a00000-0000-0000-0000-000000000003', true);

  select count(*) into v_count from public.on_call_plan
   where construction_stage_id = '28a00000-0000-0000-0000-0000000000a1'
     and plan_date = '2026-08-24';

  if v_count <> 2 then
    raise exception 'SMOKE Z5 FAIL der Monteur sieht % statt 2 Zuweisungen fuer B28Z/2026-08-24', v_count;
  end if;

  raise notice 'SMOKE Z5 OK der Monteur darf den Bereitschaftsplan lesen';
end
$$;

-- ---------------------------------------------------------------------
-- Z6: MONTEUR NEGATIV - kein insert.
-- ---------------------------------------------------------------------
do $$
declare
  v_state text;
  v_count_vorher integer;
  v_count_nachher integer;
begin
  perform set_config('app.user_id', '28a00000-0000-0000-0000-000000000003', true);

  select count(*) into v_count_vorher from public.on_call_plan;

  v_state := null;
  begin
    insert into public.on_call_plan (construction_stage_id, plan_date, technician_id)
    values ('28a00000-0000-0000-0000-0000000000a1', '2026-08-25', '28a00000-0000-0000-0000-0000000000a2');
  exception
    when insufficient_privilege then v_state := sqlstate;
    when others then v_state := sqlstate;
  end;

  if v_state is distinct from '42501' then
    raise exception
      'SMOKE Z6 FAIL SQLSTATE % statt 42501 beim Anlageversuch des Monteurs',
      coalesce(v_state, 'kein Fehler - der Monteur hat eine Zuweisung angelegt');
  end if;

  select count(*) into v_count_nachher from public.on_call_plan;
  if v_count_nachher <> v_count_vorher then
    raise exception 'SMOKE Z6 FAIL die Zeilenzahl hat sich trotz abgewiesenem insert veraendert (% -> %)',
      v_count_vorher, v_count_nachher;
  end if;

  raise notice 'SMOKE Z6 OK der Monteur wird bei insert mit 42501 abgewiesen, es entsteht keine Zeile';
end
$$;

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

-- ---------------------------------------------------------------------
-- Z8: KEIN UPDATE - auch Staff scheitert, weil weder Policy noch
-- Tabellenrecht ein update erlauben.
-- ---------------------------------------------------------------------
do $$
declare
  v_state text;
  v_id uuid;
begin
  perform set_config('app.user_id', '28a00000-0000-0000-0000-000000000002', true);
  v_id := nullif(current_setting('kb28a.plan_a2', true), '')::uuid;

  v_state := null;
  begin
    update public.on_call_plan set plan_date = '2026-08-26' where id = v_id;
  exception
    when insufficient_privilege then v_state := sqlstate;
    when others then v_state := sqlstate;
  end;

  if v_state is distinct from '42501' then
    raise exception
      'SMOKE Z8 FAIL SQLSTATE % statt 42501 beim update-Versuch des Disponenten - app_user duerfte kein update-Tabellenrecht auf public.on_call_plan besitzen',
      coalesce(v_state, 'kein Fehler - die Zeile wurde geaendert');
  end if;

  raise notice 'SMOKE Z8 OK app_user besitzt kein update-Tabellenrecht auf public.on_call_plan - der Versuch des Disponenten scheitert mit 42501';
end
$$;

-- ---------------------------------------------------------------------
-- Z9: STAFF (Administrator) entfernt eine Zuweisung.
-- ---------------------------------------------------------------------
do $$
declare
  v_id uuid;
  v_deleted integer;
  v_exists boolean;
begin
  perform set_config('app.user_id', '28a00000-0000-0000-0000-000000000001', true);
  v_id := nullif(current_setting('kb28a.plan_a3', true), '')::uuid;

  delete from public.on_call_plan where id = v_id;
  get diagnostics v_deleted = row_count;
  if v_deleted <> 1 then
    raise exception 'SMOKE Z9 FAIL der Administrator konnte die Zuweisung nicht entfernen (% Zeile(n) betroffen)', v_deleted;
  end if;

  select exists(select 1 from public.on_call_plan where id = v_id) into v_exists;
  if v_exists then
    raise exception 'SMOKE Z9 FAIL die Zuweisung besteht nach dem delete des Administrators weiterhin';
  end if;

  raise notice 'SMOKE Z9 OK der Administrator entfernt eine Zuweisung';
end
$$;

-- =====================================================================
-- Z10: FK-VERHALTEN von construction_stage_id - NICHT kaskadierend. Laeuft im
-- EIGENTUEMERKONTEXT wie X8/Y6/Y7: app_user hat kein delete auf
-- public.construction_stages, ein Loeschversuch unter app_user wuerde also am
-- Tabellenrecht scheitern und nichts ueber das FK-Verhalten selbst aussagen.
-- =====================================================================
reset role;
select set_config('app.user_id', '28a00000-0000-0000-0000-000000000002', true);

do $$
declare
  v_plan uuid;
  v_state text;
  v_after uuid;
begin
  insert into public.on_call_plan (construction_stage_id, plan_date, technician_id)
  values ('28a00000-0000-0000-0000-0000000000a4', '2026-08-27', '28a00000-0000-0000-0000-0000000000a5')
  returning id into v_plan;

  v_state := null;
  begin
    delete from public.construction_stages where id = '28a00000-0000-0000-0000-0000000000a4';
  exception
    when foreign_key_violation then v_state := sqlstate;
    when others then v_state := sqlstate;
  end;

  if v_state is distinct from '23503' then
    raise exception
      'SMOKE Z10 FAIL SQLSTATE % statt 23503 beim Loeschversuch des referenzierten Bauabschnitts - construction_stage_id waere kaskadierend oder ON DELETE SET NULL',
      coalesce(v_state, 'kein Fehler - der Bauabschnitt wurde geloescht');
  end if;

  select construction_stage_id into v_after from public.on_call_plan where id = v_plan;
  if v_after is distinct from '28a00000-0000-0000-0000-0000000000a4'::uuid then
    raise exception
      'SMOKE Z10 FAIL construction_stage_id wurde auf % geaendert statt unveraendert zu bleiben - das waere ON DELETE SET NULL',
      coalesce(v_after::text, 'NULL');
  end if;

  raise notice
    'SMOKE Z10 OK on_call_plan.construction_stage_id ist NICHT kaskadierend: das Loeschen des referenzierten Bauabschnitts wird mit 23503 abgewiesen';
end
$$;

-- ---------------------------------------------------------------------
-- Z11: FK-VERHALTEN von technician_id - NICHT kaskadierend. Dieselbe
-- Begruendung und derselbe Kontext wie Z10.
-- ---------------------------------------------------------------------
do $$
declare
  v_plan uuid;
  v_state text;
  v_after uuid;
begin
  select id into v_plan from public.on_call_plan
   where construction_stage_id = '28a00000-0000-0000-0000-0000000000a4'
     and technician_id = '28a00000-0000-0000-0000-0000000000a5';

  v_state := null;
  begin
    delete from public.technicians where id = '28a00000-0000-0000-0000-0000000000a5';
  exception
    when foreign_key_violation then v_state := sqlstate;
    when others then v_state := sqlstate;
  end;

  if v_state is distinct from '23503' then
    raise exception
      'SMOKE Z11 FAIL SQLSTATE % statt 23503 beim Loeschversuch des referenzierten Technikers - technician_id waere kaskadierend oder ON DELETE SET NULL',
      coalesce(v_state, 'kein Fehler - der Techniker wurde geloescht');
  end if;

  select technician_id into v_after from public.on_call_plan where id = v_plan;
  if v_after is distinct from '28a00000-0000-0000-0000-0000000000a5'::uuid then
    raise exception
      'SMOKE Z11 FAIL technician_id wurde auf % geaendert statt unveraendert zu bleiben - das waere ON DELETE SET NULL',
      coalesce(v_after::text, 'NULL');
  end if;

  raise notice
    'SMOKE Z11 OK on_call_plan.technician_id ist NICHT kaskadierend: das Loeschen des referenzierten Technikers wird mit 23503 abgewiesen';
end
$$;

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

-- =====================================================================
-- Ende der Wirkungsphase.
-- =====================================================================
reset role;
select set_config('app.user_id', '', false);

rollback;

-- ---------------------------------------------------------------------
-- Z-ENDE: Gegenprobe nach dem Rollback, im Eigentuemerkontext.
-- ---------------------------------------------------------------------
do $$
declare
  v_rest integer;
  v_start integer;
  v_jetzt integer;
begin
  select
    (select count(*) from public.profiles where id::text like '28a00000-%')
    + (select count(*) from public.auth_accounts where id::text like '28a00000-%')
    + (select count(*) from public.construction_stages where id::text like '28a00000-%')
    + (select count(*) from public.technicians where id::text like '28a00000-%')
    + (select count(*) from public.on_call_plan where id::text like '28a00000-%')
    + (select count(*) from public.audit_events where entity = 'on_call_plan'
        and entity_id::text like '28a00000-%')
  into v_rest;

  if v_rest <> 0 then
    raise exception
      'SMOKE Z-ENDE FAIL % Zeile(n) mit dem Praefix 28a00000- bleiben nach dem Rollback zurueck',
      v_rest;
  end if;

  v_start := nullif(current_setting('kb28a.proc_count_start', true), '')::integer;
  select count(*) into v_jetzt
  from pg_proc p
  join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public';
  if v_start is null or v_jetzt <> v_start then
    raise exception
      'SMOKE Z-ENDE FAIL Funktionszahl in schema public: jetzt %, beim Laufbeginn %',
      v_jetzt, coalesce(v_start::text, 'unbekannt');
  end if;

  raise notice
    'SMOKE Z-ENDE OK AUFTRAG_10/Migration 0021 belegt (Idempotenz, Unique, Rollenmatrix, FK-Verhalten, Audit bei delete, kein update); die Wirkungsphase wurde per rollback vollstaendig zurueckgenommen, und es ist kein neues Schemaobjekt entstanden';
end
$$;

select set_config('kb28a.proc_count_start', '', false);
select set_config('kb28a.plan_a2', '', false);
select set_config('kb28a.plan_a3', '', false);
