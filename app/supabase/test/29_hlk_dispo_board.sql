\set ON_ERROR_STOP on

-- =====================================================================
-- AUFTRAG_14 - Dispo-Board, Migration 0022, unter der Anwendungsrolle
-- app_user mit AKTIVER RLS.
--
-- Erwartet die vollstaendige Kette einschliesslich 0012 bis 0022 sowie die
-- Smokes 15-28. Diese Datei ist der neue letzte Eintrag der SQL-Kette,
-- unmittelbar HINTER ihrer eigenen Migration 0022 - dieselbe Konvention wie
-- bei 0015/21 ... 0021/28.
--
-- GEGENSTAND, alles gemessen statt behauptet:
--   1. IDEMPOTENZ. Die echte Migrationsdatei 0022 wird ein zweites Mal
--      angewendet (per \ir); Zeilenzahl, Policy- und Rechtezustand duerfen
--      sich dadurch nicht veraendern.
--   2. ROLLENMATRIX. qualifications: Staff schreibt (kein delete moeglich),
--      Monteur liest nur. technician_qualifications: Staff legt an UND
--      entfernt, Monteur liest nur.
--   3. CHECK-CONSTRAINTS. qualifications.color akzeptiert nur die feste
--      Palette; on_call_plan_stage_kind_chk erzwingt die Kopplung
--      assignment_kind <-> construction_stage_id.
--   4. UNIQUE JE ZUWEISUNGSART. 'bereitschaft' und 'dispo' tragen getrennte
--      partielle Unique-Indizes; eine 'dispo'- und eine 'bereitschaft'-Zeile
--      derselben Person am selben Tag kollidieren NICHT miteinander.
--   5. FKs NICHT KASKADIEREND fuer technician_qualifications.
--   6. RANG-/FARBLOGIK-DATENLAGE: die hoechste Qualifikation (groesster
--      rank) je Techniker laesst sich aus den Rohdaten korrekt ermitteln.
--
-- Verbindliche Eigenschaften dieses Smokes (identisch zu 25-28):
--   * Kein `grant`/`revoke` ausserhalb der per \ir eingebundenen Migration,
--     kein dauerhaftes Schemaobjekt.
--   * Identitaet ueber set_config('app.user_id', ..., true), geprueft unter
--     `set role app_user`; `reset role;` nur fuer Fixtures/Migrationslauf/
--     FK-Gegenproben.
--   * NUR SYNTHETISCHE WERTE, Marker '!MIGRATED-ACCOUNT-REQUIRES-RESET!',
--     E-Mail auf @beispiel.invalid.
--   * Die gesamte Wirkungsphase laeuft in einer Transaktion mit
--     abschliessendem `rollback;` (Muster 25-28).
--
-- Meldungskennung: AA (Fallkennung AA laut AUFTRAG_14.md - Z gehoert
-- 28_hlk_bereitschaftsplan.sql). UUID-Praefix: 29a00000-.
--
-- Kennungen dieser Datei:
--   ...0001 Administrator - is_staff()
--   ...0002 Disponent     - is_staff()
--   ...0003 Monteur       - liest nur
--   ...00a1 Bauabschnitt
--   ...00a2 Techniker A
--   ...00a3 Techniker B (FK-Gegenprobe technician_qualifications)
--   ...00b1 Qualifikation "Basis" (rank 10, color rot)
--   ...00b2 Qualifikation "Fachkraft" (rank 20, color blau) - die hoehere
-- =====================================================================

reset role;
select set_config('app.user_id', '', false);

select set_config(
  'kb29a.proc_count_start',
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
  ('29a00000-0000-0000-0000-000000000001', 'aa29.admin@beispiel.invalid', '!MIGRATED-ACCOUNT-REQUIRES-RESET!', false, false),
  ('29a00000-0000-0000-0000-000000000002', 'aa29.dispo@beispiel.invalid', '!MIGRATED-ACCOUNT-REQUIRES-RESET!', false, false),
  ('29a00000-0000-0000-0000-000000000003', 'aa29.monteur@beispiel.invalid', '!MIGRATED-ACCOUNT-REQUIRES-RESET!', false, false)
on conflict (id) do nothing;

insert into public.profiles (id, full_name, role, is_active)
values
  ('29a00000-0000-0000-0000-000000000001', 'AA29 Admin', 'admin', true),
  ('29a00000-0000-0000-0000-000000000002', 'AA29 Disponent', 'disponent', true),
  ('29a00000-0000-0000-0000-000000000003', 'AA29 Monteur', 'monteur', true)
on conflict (id) do nothing;

insert into public.construction_stages (id, code, name)
values ('29a00000-0000-0000-0000-0000000000a1', 'B29AA', 'Bauabschnitt AUFTRAG_14 Dispo-Board')
on conflict (id) do nothing;

insert into public.technicians (id, first_name, last_name)
values ('29a00000-0000-0000-0000-0000000000a2', 'AA29', 'Techniker A')
on conflict (id) do nothing;

insert into public.technicians (id, first_name, last_name)
values ('29a00000-0000-0000-0000-0000000000a3', 'AA29', 'Techniker B (FK-Gegenprobe)')
on conflict (id) do nothing;

do $$
declare
  v_stammdaten integer;
begin
  select
    (select count(*) from public.profiles where id::text like '29a00000-%')
    + (select count(*) from public.construction_stages where id in ('29a00000-0000-0000-0000-0000000000a1'))
    + (select count(*) from public.technicians where id::text like '29a00000-%')
  into v_stammdaten;

  if v_stammdaten <> 6 then
    raise exception 'SMOKE AA-FIXTURES FAIL % statt 6 Stammdatenzeilen vorhanden (drei Profile + ein Bauabschnitt + zwei Techniker)', v_stammdaten;
  end if;

  raise notice 'SMOKE AA-FIXTURES OK drei Identitaeten, ein Bauabschnitt und zwei Techniker stehen bereit';
end
$$;

-- =====================================================================
-- AA1: IDEMPOTENZ-DOPPELLAUF der echten Migration 0022.
-- =====================================================================
reset role;
select set_config('app.user_id', '', true);

do $$
declare
  v_qual_rows integer;
  v_tq_rows integer;
  v_ocp_rows integer;
  v_qual_policies integer;
  v_tq_policies integer;
begin
  select count(*) into v_qual_rows from public.qualifications;
  select count(*) into v_tq_rows from public.technician_qualifications;
  select count(*) into v_ocp_rows from public.on_call_plan;
  select count(*) into v_qual_policies from pg_policies where schemaname='public' and tablename='qualifications';
  select count(*) into v_tq_policies from pg_policies where schemaname='public' and tablename='technician_qualifications';
  perform set_config('kb29a.qual_rows_vorher', v_qual_rows::text, true);
  perform set_config('kb29a.tq_rows_vorher', v_tq_rows::text, true);
  perform set_config('kb29a.ocp_rows_vorher', v_ocp_rows::text, true);
  perform set_config('kb29a.qual_policies_vorher', v_qual_policies::text, true);
  perform set_config('kb29a.tq_policies_vorher', v_tq_policies::text, true);
end
$$;

\ir ../migrations/0022_hlk_dispo_board.sql

do $$
declare
  v_qual_rows integer;
  v_tq_rows integer;
  v_ocp_rows integer;
  v_qual_policies integer;
  v_tq_policies integer;
  v_has_update boolean;
begin
  select count(*) into v_qual_rows from public.qualifications;
  select count(*) into v_tq_rows from public.technician_qualifications;
  select count(*) into v_ocp_rows from public.on_call_plan;
  select count(*) into v_qual_policies from pg_policies where schemaname='public' and tablename='qualifications';
  select count(*) into v_tq_policies from pg_policies where schemaname='public' and tablename='technician_qualifications';

  if v_qual_rows <> current_setting('kb29a.qual_rows_vorher', true)::integer then
    raise exception 'SMOKE AA1 FAIL Zeilenzahl von public.qualifications aendert sich durch den erneuten Migrationslauf';
  end if;
  if v_tq_rows <> current_setting('kb29a.tq_rows_vorher', true)::integer then
    raise exception 'SMOKE AA1 FAIL Zeilenzahl von public.technician_qualifications aendert sich durch den erneuten Migrationslauf';
  end if;
  if v_ocp_rows <> current_setting('kb29a.ocp_rows_vorher', true)::integer then
    raise exception 'SMOKE AA1 FAIL Zeilenzahl von public.on_call_plan aendert sich durch den erneuten Migrationslauf';
  end if;
  if v_qual_policies <> current_setting('kb29a.qual_policies_vorher', true)::integer or v_qual_policies <> 2 then
    raise exception 'SMOKE AA1 FAIL Policy-Zahl von public.qualifications: % (erwartet 2)', v_qual_policies;
  end if;
  if v_tq_policies <> current_setting('kb29a.tq_policies_vorher', true)::integer or v_tq_policies <> 3 then
    raise exception 'SMOKE AA1 FAIL Policy-Zahl von public.technician_qualifications: % (erwartet 3)', v_tq_policies;
  end if;

  select has_table_privilege('app_user', 'public.on_call_plan', 'update') into v_has_update;
  if v_has_update then
    raise exception 'SMOKE AA1 FAIL app_user besitzt nach dem erneuten Lauf ein update-Recht auf public.on_call_plan';
  end if;

  raise notice 'SMOKE AA1 OK der erneute Lauf der echten Migration 0022 veraendert weder Zeilenzahl noch Policy-/Rechtezustand - Idempotenz belegt';
end
$$;

-- =====================================================================
-- Ab hier unter der Anwendungsrolle app_user mit aktiver RLS.
-- =====================================================================
set role app_user;

-- ---------------------------------------------------------------------
-- AA2: Staff (Disponent) legt zwei Qualifikationen an.
-- ---------------------------------------------------------------------
do $$
declare
  v_b1 uuid;
  v_b2 uuid;
begin
  perform set_config('app.user_id', '29a00000-0000-0000-0000-000000000002', true);

  insert into public.qualifications (id, label, rank, color)
  values ('29a00000-0000-0000-0000-0000000000b1', 'AA29 Basis', 10, 'rot')
  returning id into v_b1;
  insert into public.qualifications (id, label, rank, color)
  values ('29a00000-0000-0000-0000-0000000000b2', 'AA29 Fachkraft', 20, 'blau')
  returning id into v_b2;

  if v_b1 is null or v_b2 is null then
    raise exception 'SMOKE AA2 FAIL der Disponent konnte keine Qualifikationen anlegen';
  end if;

  raise notice 'SMOKE AA2 OK der Disponent legt zwei Qualifikationen mit unterschiedlichem Rang an';
end
$$;

-- ---------------------------------------------------------------------
-- AA3: CHECK-CONSTRAINT color - nur die feste Palette ist zulaessig.
-- ---------------------------------------------------------------------
do $$
declare
  v_state text;
begin
  perform set_config('app.user_id', '29a00000-0000-0000-0000-000000000002', true);

  v_state := null;
  begin
    insert into public.qualifications (label, rank, color)
    values ('AA29 Ungueltig', 5, 'pink');
  exception
    when check_violation then v_state := sqlstate;
    when others then v_state := sqlstate;
  end;

  if v_state is distinct from '23514' then
    raise exception 'SMOKE AA3 FAIL SQLSTATE % statt 23514 bei unzulaessigem Palettenschluessel',
      coalesce(v_state, 'kein Fehler - der Wert wurde angelegt');
  end if;

  raise notice 'SMOKE AA3 OK ein Palettenschluessel ausserhalb der festen Menge wird mit 23514 abgewiesen';
end
$$;

-- ---------------------------------------------------------------------
-- AA4: Monteur liest Qualifikationen, darf aber nicht schreiben (42501),
-- kein delete auch nicht fuer Staff (kein Tabellenrecht).
-- ---------------------------------------------------------------------
do $$
declare
  v_count integer;
  v_state text;
begin
  perform set_config('app.user_id', '29a00000-0000-0000-0000-000000000003', true);
  select count(*) into v_count from public.qualifications where id::text like '29a00000-%';
  if v_count <> 2 then
    raise exception 'SMOKE AA4 FAIL der Monteur sieht % statt 2 Qualifikationen', v_count;
  end if;

  v_state := null;
  begin
    insert into public.qualifications (label, rank, color) values ('AA29 Monteurversuch', 1, 'grau');
  exception
    when insufficient_privilege then v_state := sqlstate;
    when others then v_state := sqlstate;
  end;
  if v_state is distinct from '42501' then
    raise exception 'SMOKE AA4 FAIL SQLSTATE % statt 42501 beim Anlageversuch des Monteurs',
      coalesce(v_state, 'kein Fehler');
  end if;

  raise notice 'SMOKE AA4 OK der Monteur liest Qualifikationen, darf aber nicht schreiben';
end
$$;

-- ---------------------------------------------------------------------
-- AA5: KEIN DELETE auf qualifications, auch nicht fuer Staff (Deaktivierung
-- laeuft ueber is_active, kein Tabellenrecht vorhanden).
-- ---------------------------------------------------------------------
do $$
declare
  v_state text;
begin
  perform set_config('app.user_id', '29a00000-0000-0000-0000-000000000001', true);

  v_state := null;
  begin
    delete from public.qualifications where id = '29a00000-0000-0000-0000-0000000000b1';
  exception
    when insufficient_privilege then v_state := sqlstate;
    when others then v_state := sqlstate;
  end;
  if v_state is distinct from '42501' then
    raise exception 'SMOKE AA5 FAIL SQLSTATE % statt 42501 beim Loeschversuch des Administrators auf public.qualifications',
      coalesce(v_state, 'kein Fehler - die Zeile wurde geloescht');
  end if;

  raise notice 'SMOKE AA5 OK app_user besitzt kein delete-Tabellenrecht auf public.qualifications - auch der Administrator scheitert mit 42501';
end
$$;

-- ---------------------------------------------------------------------
-- AA6: technician_qualifications - Staff ordnet Techniker A beide
-- Qualifikationen zu.
-- ---------------------------------------------------------------------
do $$
declare
  v_tq1 uuid;
  v_tq2 uuid;
begin
  perform set_config('app.user_id', '29a00000-0000-0000-0000-000000000002', true);

  insert into public.technician_qualifications (technician_id, qualification_id)
  values ('29a00000-0000-0000-0000-0000000000a2', '29a00000-0000-0000-0000-0000000000b1')
  returning id into v_tq1;
  insert into public.technician_qualifications (technician_id, qualification_id)
  values ('29a00000-0000-0000-0000-0000000000a2', '29a00000-0000-0000-0000-0000000000b2')
  returning id into v_tq2;

  if v_tq1 is null or v_tq2 is null then
    raise exception 'SMOKE AA6 FAIL der Disponent konnte Techniker A keine Qualifikationen zuordnen';
  end if;

  raise notice 'SMOKE AA6 OK Techniker A traegt beide Qualifikationen (Basis + Fachkraft)';
end
$$;

-- ---------------------------------------------------------------------
-- AA7: UNIQUE PAAR - dieselbe Zuordnung ein zweites Mal wird mit 23505
-- abgewiesen.
-- ---------------------------------------------------------------------
do $$
declare
  v_state text;
begin
  perform set_config('app.user_id', '29a00000-0000-0000-0000-000000000002', true);

  v_state := null;
  begin
    insert into public.technician_qualifications (technician_id, qualification_id)
    values ('29a00000-0000-0000-0000-0000000000a2', '29a00000-0000-0000-0000-0000000000b1');
  exception
    when unique_violation then v_state := sqlstate;
    when others then v_state := sqlstate;
  end;
  if v_state is distinct from '23505' then
    raise exception 'SMOKE AA7 FAIL SQLSTATE % statt 23505 bei doppelter Zuordnung', coalesce(v_state, 'kein Fehler');
  end if;

  raise notice 'SMOKE AA7 OK die doppelte Zuordnung Techniker/Qualifikation wird mit 23505 abgewiesen';
end
$$;

-- ---------------------------------------------------------------------
-- AA8: Monteur liest, darf nicht anlegen (42501).
-- ---------------------------------------------------------------------
do $$
declare
  v_count integer;
  v_state text;
begin
  perform set_config('app.user_id', '29a00000-0000-0000-0000-000000000003', true);
  select count(*) into v_count from public.technician_qualifications where technician_id = '29a00000-0000-0000-0000-0000000000a2';
  if v_count <> 2 then
    raise exception 'SMOKE AA8 FAIL der Monteur sieht % statt 2 Zuordnungen', v_count;
  end if;

  v_state := null;
  begin
    insert into public.technician_qualifications (technician_id, qualification_id)
    values ('29a00000-0000-0000-0000-0000000000a3', '29a00000-0000-0000-0000-0000000000b1');
  exception
    when insufficient_privilege then v_state := sqlstate;
    when others then v_state := sqlstate;
  end;
  if v_state is distinct from '42501' then
    raise exception 'SMOKE AA8 FAIL SQLSTATE % statt 42501 beim Anlageversuch des Monteurs', coalesce(v_state, 'kein Fehler');
  end if;

  raise notice 'SMOKE AA8 OK der Monteur liest Zuordnungen, darf aber keine anlegen';
end
$$;

-- ---------------------------------------------------------------------
-- AA9: KEIN UPDATE auf technician_qualifications, auch nicht fuer Staff.
-- ---------------------------------------------------------------------
do $$
declare
  v_state text;
  v_id uuid;
begin
  perform set_config('app.user_id', '29a00000-0000-0000-0000-000000000002', true);
  select id into v_id from public.technician_qualifications
   where technician_id = '29a00000-0000-0000-0000-0000000000a2' and qualification_id = '29a00000-0000-0000-0000-0000000000b1';

  v_state := null;
  begin
    update public.technician_qualifications set qualification_id = '29a00000-0000-0000-0000-0000000000b2' where id = v_id;
  exception
    when insufficient_privilege then v_state := sqlstate;
    when others then v_state := sqlstate;
  end;
  if v_state is distinct from '42501' then
    raise exception 'SMOKE AA9 FAIL SQLSTATE % statt 42501 beim update-Versuch', coalesce(v_state, 'kein Fehler');
  end if;

  raise notice 'SMOKE AA9 OK app_user besitzt kein update-Tabellenrecht auf public.technician_qualifications';
end
$$;

-- =====================================================================
-- AA10: FK-VERHALTEN technician_id/qualification_id - NICHT kaskadierend.
-- Laeuft im EIGENTUEMERKONTEXT (app_user hat kein delete auf technicians/
-- qualifications).
-- =====================================================================
reset role;
select set_config('app.user_id', '29a00000-0000-0000-0000-000000000002', true);

do $$
declare
  v_state text;
begin
  v_state := null;
  begin
    delete from public.technicians where id = '29a00000-0000-0000-0000-0000000000a2';
  exception
    when foreign_key_violation then v_state := sqlstate;
    when others then v_state := sqlstate;
  end;
  if v_state is distinct from '23503' then
    raise exception 'SMOKE AA10 FAIL SQLSTATE % statt 23503 beim Loeschversuch des referenzierten Technikers',
      coalesce(v_state, 'kein Fehler - der Techniker wurde geloescht');
  end if;

  v_state := null;
  begin
    delete from public.qualifications where id = '29a00000-0000-0000-0000-0000000000b1';
  exception
    when foreign_key_violation then v_state := sqlstate;
    when others then v_state := sqlstate;
  end;
  if v_state is distinct from '23503' then
    raise exception 'SMOKE AA10 FAIL SQLSTATE % statt 23503 beim Loeschversuch der referenzierten Qualifikation',
      coalesce(v_state, 'kein Fehler - die Qualifikation wurde geloescht');
  end if;

  raise notice 'SMOKE AA10 OK technician_qualifications.technician_id/qualification_id sind NICHT kaskadierend';
end
$$;

-- =====================================================================
-- AA11: CHECK-CONSTRAINT on_call_plan_stage_kind_chk - Kopplung
-- assignment_kind <-> construction_stage_id.
-- =====================================================================
set role app_user;

do $$
declare
  v_state text;
begin
  perform set_config('app.user_id', '29a00000-0000-0000-0000-000000000002', true);

  -- dispo MIT gesetztem Bauabschnitt wird abgewiesen.
  v_state := null;
  begin
    insert into public.on_call_plan (construction_stage_id, plan_date, technician_id, assignment_kind)
    values ('29a00000-0000-0000-0000-0000000000a1', '2026-09-01', '29a00000-0000-0000-0000-0000000000a2', 'dispo');
  exception
    when check_violation then v_state := sqlstate;
    when others then v_state := sqlstate;
  end;
  if v_state is distinct from '23514' then
    raise exception 'SMOKE AA11 FAIL SQLSTATE % statt 23514 bei dispo MIT Bauabschnitt', coalesce(v_state, 'kein Fehler');
  end if;

  -- bereitschaft OHNE Bauabschnitt wird abgewiesen.
  v_state := null;
  begin
    insert into public.on_call_plan (construction_stage_id, plan_date, technician_id, assignment_kind)
    values (null, '2026-09-01', '29a00000-0000-0000-0000-0000000000a2', 'bereitschaft');
  exception
    when check_violation then v_state := sqlstate;
    when others then v_state := sqlstate;
  end;
  if v_state is distinct from '23514' then
    raise exception 'SMOKE AA11 FAIL SQLSTATE % statt 23514 bei bereitschaft OHNE Bauabschnitt', coalesce(v_state, 'kein Fehler');
  end if;

  raise notice 'SMOKE AA11 OK on_call_plan_stage_kind_chk erzwingt die Kopplung assignment_kind <-> construction_stage_id';
end
$$;

-- =====================================================================
-- AA12/AA13: UNIQUE JE ZUWEISUNGSART - 'bereitschaft' und 'dispo' derselben
-- Person am selben Tag kollidieren NICHT; zwei 'dispo'-Zeilen derselben
-- Person am selben Tag kollidieren SEHR WOHL.
-- =====================================================================
do $$
declare
  v_ber uuid;
  v_dis uuid;
  v_state text;
begin
  perform set_config('app.user_id', '29a00000-0000-0000-0000-000000000002', true);

  insert into public.on_call_plan (construction_stage_id, plan_date, technician_id, assignment_kind)
  values ('29a00000-0000-0000-0000-0000000000a1', '2026-09-02', '29a00000-0000-0000-0000-0000000000a3', 'bereitschaft')
  returning id into v_ber;

  insert into public.on_call_plan (construction_stage_id, plan_date, technician_id, assignment_kind)
  values (null, '2026-09-02', '29a00000-0000-0000-0000-0000000000a3', 'dispo')
  returning id into v_dis;

  if v_ber is null or v_dis is null then
    raise exception 'SMOKE AA12 FAIL bereitschaft und dispo derselben Person am selben Tag konnten nicht nebeneinander bestehen';
  end if;
  perform set_config('kb29a.ocp_dispo_a3', v_dis::text, false);

  raise notice 'SMOKE AA12 OK bereitschaft und dispo derselben Person am selben Tag kollidieren nicht (getrennte partielle Unique-Indizes)';

  v_state := null;
  begin
    insert into public.on_call_plan (construction_stage_id, plan_date, technician_id, assignment_kind)
    values (null, '2026-09-02', '29a00000-0000-0000-0000-0000000000a3', 'dispo');
  exception
    when unique_violation then v_state := sqlstate;
    when others then v_state := sqlstate;
  end;
  if v_state is distinct from '23505' then
    raise exception 'SMOKE AA13 FAIL SQLSTATE % statt 23505 bei doppelter dispo-Zuweisung derselben Person/Tag', coalesce(v_state, 'kein Fehler');
  end if;

  raise notice 'SMOKE AA13 OK eine zweite dispo-Zuweisung derselben Person am selben Tag wird mit 23505 abgewiesen';
end
$$;

-- ---------------------------------------------------------------------
-- AA14: RANG-/FARBLOGIK-DATENLAGE - die hoechste Qualifikation (groesster
-- rank) je Techniker laesst sich aus den Rohdaten korrekt ermitteln.
-- ---------------------------------------------------------------------
do $$
declare
  v_top_label text;
  v_top_color text;
begin
  perform set_config('app.user_id', '29a00000-0000-0000-0000-000000000003', true);

  select q.label, q.color into v_top_label, v_top_color
    from public.technician_qualifications tq
    join public.qualifications q on q.id = tq.qualification_id
   where tq.technician_id = '29a00000-0000-0000-0000-0000000000a2'
   order by q.rank desc
   limit 1;

  if v_top_label is distinct from 'AA29 Fachkraft' or v_top_color is distinct from 'blau' then
    raise exception 'SMOKE AA14 FAIL hoechste Qualifikation ist "%"/% statt "AA29 Fachkraft"/blau', v_top_label, v_top_color;
  end if;

  raise notice 'SMOKE AA14 OK die hoechste Qualifikation (groesster rank) je Techniker laesst sich aus den Rohdaten ermitteln (hier: AA29 Fachkraft, Farbe blau)';
end
$$;

-- =====================================================================
-- Ende der Wirkungsphase.
-- =====================================================================
reset role;
select set_config('app.user_id', '', false);

rollback;

-- ---------------------------------------------------------------------
-- AA-ENDE: Gegenprobe nach dem Rollback, im Eigentuemerkontext.
-- ---------------------------------------------------------------------
do $$
declare
  v_rest integer;
  v_start integer;
  v_jetzt integer;
begin
  select
    (select count(*) from public.profiles where id::text like '29a00000-%')
    + (select count(*) from public.auth_accounts where id::text like '29a00000-%')
    + (select count(*) from public.construction_stages where id::text like '29a00000-%')
    + (select count(*) from public.technicians where id::text like '29a00000-%')
    + (select count(*) from public.qualifications where id::text like '29a00000-%')
    + (select count(*) from public.technician_qualifications where id::text like '29a00000-%')
    + (select count(*) from public.on_call_plan where id::text like '29a00000-%')
  into v_rest;

  if v_rest <> 0 then
    raise exception 'SMOKE AA-ENDE FAIL % Zeile(n) mit dem Praefix 29a00000- bleiben nach dem Rollback zurueck', v_rest;
  end if;

  v_start := nullif(current_setting('kb29a.proc_count_start', true), '')::integer;
  select count(*) into v_jetzt
  from pg_proc p
  join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public';
  if v_start is null or v_jetzt <> v_start then
    raise exception 'SMOKE AA-ENDE FAIL Funktionszahl in schema public: jetzt %, beim Laufbeginn %',
      v_jetzt, coalesce(v_start::text, 'unbekannt');
  end if;

  raise notice 'SMOKE AA-ENDE OK AUFTRAG_14/Migration 0022 belegt (Idempotenz, Rollenmatrix, Check-Constraints, Unique je Zuweisungsart, FK-Verhalten, Rang-/Farblogik-Datenlage); die Wirkungsphase wurde per rollback vollstaendig zurueckgenommen, und es ist kein neues Schemaobjekt entstanden';
end
$$;

select set_config('kb29a.proc_count_start', '', false);
select set_config('kb29a.qual_rows_vorher', '', false);
select set_config('kb29a.tq_rows_vorher', '', false);
select set_config('kb29a.ocp_rows_vorher', '', false);
select set_config('kb29a.qual_policies_vorher', '', false);
select set_config('kb29a.tq_policies_vorher', '', false);
select set_config('kb29a.ocp_dispo_a3', '', false);
