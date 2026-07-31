\set ON_ERROR_STOP on

-- =====================================================================
-- AP14/B - Rechtestand unmittelbar vor Smoke 20 auf den FINALEN Produktstand
-- zuruecksetzen.
--
-- WARUM diese Datei ueberhaupt existiert:
--   Die frueheren Smokes der Kette vergeben pauschale Rechte an app_user, weil
--   sie sie fuer ihre eigenen Faelle brauchen:
--     * 15_ap10_smoke.sql:25   grant select, insert, update, delete on all tables
--     * 15_ap10_smoke.sql:27   grant execute on all functions
--     * 16_ap11_list.sql:23    grant select, insert, update, delete on all tables
--     * 16_ap11_list.sql:25    grant execute on all functions
--     * 17_ap12_details.sql:20 grant select, insert, update, delete on all tables
--     * 18_ap13_tasks.sql:22   grant select, insert, update, delete on all tables
--     * 18_ap13_tasks.sql:27   grant execute on public.refresh_incident_tasks_ap13(uuid)
--   Diese Grants laufen in der Kette NACH den Migrationen 0001-0011 und VOR
--   0012-0014. Ohne Ruecknahme sind die positiven Rechteerwartungen von
--   20_ap14b_data.sql bereits erfuellt, bevor Migration 0014 ueberhaupt etwas
--   erteilt: der Smoke wuerde die Testkette messen statt die Migration. Und die
--   Negativpruefung des Refresh-Ausfuehrungsrechts waere gar nicht
--   nachweisbar, weil 18_ap13_tasks.sql:27 es app_user direkt erteilt.
--
-- Was hier ausdruecklich NICHT geschieht:
--   * Es wird KEINE historische Migration und KEINE historische Testdatei
--     umgeschrieben. Der Alt-Grant bleibt dort stehen, wo er fachlich
--     hingehoert; er wird hier ausschliesslich fuer den Zielzustand
--     zurueckgenommen.
--   * Betroffen ist ausschliesslich app_user. Es gibt hier KEIN `revoke` gegen
--     authenticated, anon oder public. Die Rechte, die app_user echt ueber die
--     Gruppenrolle authenticated erbt, sind Produktstand und bleiben
--     unveraendert bestehen: 0010:81, 0010:401, 0010:405 sowie 0011:147,
--     0011:363, 0011:453, 0011:550 und 0011:607.
--   * Die gezielten Ruecknahmen am Ende von 18_ap13_tasks.sql (:40, :41 und
--     :534-541) bleiben unangetastet und sind lasttragend: sie allein sorgen
--     dafuer, dass die Negativpruefungen der ERSTEN Anwendung von 0014 (an der
--     regulaeren Migrationsstelle, also vor dieser Datei) ueberhaupt halten.
--     Wer sie entfernt, bricht die Kette bereits vor Smoke 19 - unabhaengig
--     von dieser Datei.
--   * Sequenzrechte werden bewusst NICHT angefasst. In den Migrationen
--     0001-0014 gibt es kein `serial`, kein `nextval` und kein
--     `create sequence`; public.incidents.incident_no ist
--     `bigint generated always as identity` (0001_init.sql:175), und eine
--     Identitaetsspalte braucht kein Sequenzrecht. Migration 0014 macht zu
--     Sequenzen keine Zusage, also gibt es hier auch nichts zurueckzunehmen.
--
-- Die Datei laeuft im Eigentuemerkontext - beide Startskripte verbinden als
-- postgres - und darf deshalb `revoke`/`grant` ausfuehren. Sie setzt bewusst
-- KEIN `set role`.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Ruecknahme der pauschalen Testrechte - nur gegen app_user.
--
-- `revoke ... from app_user` entfernt ausschliesslich die an app_user direkt
-- erteilten Rechte. Was PUBLIC besitzt (z. B. das Standard-Ausfuehrungsrecht
-- auf public.is_staff()) und was ueber authenticated vererbt wird, bleibt
-- unberuehrt - genau so ist es gewollt.
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from app_user;
revoke all on all routines in schema public from app_user;

-- ---------------------------------------------------------------------
-- 2) Wiederherstellung der produktseitigen Direktrechte, die NICHT aus 0014
--    stammen und von Schritt 1 mitentzogen wurden.
--
-- Schema- und Funktionsrecht aus 0012:28-29 (`usage on schema app` und
-- `execute on function app.current_user_id()`) liegen im Schema app und sind
-- von Schritt 1 (Schema public) nicht betroffen; sie werden hier deshalb weder
-- entzogen noch erneut erteilt.
-- ---------------------------------------------------------------------
-- Herkunft 0012:102 - Sitzungsverwaltung der Auth-Basis.
grant select, insert, update, delete on public.auth_accounts, public.auth_sessions to app_user;
-- Herkunft 0012:114 - Mindestrecht der Sitzungsauswertung.
grant select on public.profiles to app_user;

-- ---------------------------------------------------------------------
-- 3) Kontrollpruefung VOR der Wiederanwendung von 0014.
--
-- Belegt, dass Schritt 1 tatsaechlich gewirkt hat:
--   * public.inventory_movements und public.storage_locations sind
--     Fachtabellen aus 0001 (Policy-Ergaenzung in 0004_ap3_inventory_rls.sql),
--     denen KEINE Migration ein Recht fuer app_user oder authenticated
--     erteilt. Ein verbliebenes Recht dort kann nur aus den Pauschal-Grants
--     der Smokes stammen.
--   * public.customers select faellt hier bewusst ebenfalls weg: 0014 erteilt
--     es erst im naechsten Schritt. Damit ist unmittelbar bewiesen, dass Smoke
--     20 anschliessend die Migration misst und nicht die Testkette.
-- ---------------------------------------------------------------------
do $$
declare
  item record;
  v_wrong text[] := array[]::text[];
begin
  for item in
    select * from (values
      ('public.inventory_movements', 'select'),
      ('public.inventory_movements', 'insert'),
      ('public.storage_locations', 'select'),
      ('public.customers', 'select')
    ) as t(object_name, privilege)
  loop
    if has_table_privilege('app_user', item.object_name, item.privilege) then
      v_wrong := array_append(v_wrong, item.object_name || ' ' || item.privilege);
    end if;
  end loop;

  if array_length(v_wrong, 1) is not null then
    raise exception
      'SMOKE R1 FAIL Pauschalrecht(e) der Smokes 15-18 nicht zurueckgenommen: %',
      array_to_string(v_wrong, ', ');
  end if;

  raise notice
    'SMOKE R1 OK Pauschalrechte der Smokes 15-18 zurueckgenommen, app_user ohne Recht auf Inventar und customers';
end
$$;

-- ---------------------------------------------------------------------
-- 4) Migration 0014 unmittelbar vor Smoke 20 erneut anwenden.
--
-- 0014 sagt selbst zu, additiv und wiederholbar zu sein (`grant` ist
-- idempotent, der eine `revoke` ebenfalls, und die drei Abschlussbloecke
-- pruefen ausschliesslich). Genau deshalb kann sie hier ein zweites Mal
-- laufen: sie stellt den Zielzustand wieder her, den Schritt 1 zusammen mit
-- den Alt-Grants entfernt hat, und ihre Abschlussbloecke greifen unmittelbar
-- vor Smoke 20.
--
-- `\ir` loest relativ zum Verzeichnis DIESER Datei auf; ON_ERROR_STOP gilt in
-- der eingeschlossenen Datei weiter.
-- ---------------------------------------------------------------------
\ir ../migrations/0014_ap14b_data_grants.sql

do $$
begin
  raise notice 'SMOKE R2 OK Migration 0014 unmittelbar vor Smoke 20 erneut angewendet';
end
$$;
