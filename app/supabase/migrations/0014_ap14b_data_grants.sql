-- AP14/B: Rechtematrix der Fachobjekte fuer die Anwendungsrolle app_user.
--
-- Bezug: ADR-011 / 2.5 - der Anwendungszugriff laeuft ausschliesslich ueber die
-- nicht privilegierte Rolle app_user. Migration 0012 hat dafuer bewusst nur das
-- Mindestrecht der Sitzungsauswertung erteilt (`grant select on public.profiles`)
-- und die Rechtematrix der uebrigen Fachtabellen ausdruecklich offen gelassen:
-- "Die vollstaendige Rechtematrix fuer die uebrigen Fachtabellen gehoert zur
-- Migration der Datenmodule und ist hier bewusst nicht enthalten." (0012).
-- Diese Migration schliesst genau diese Luecke und nichts darueber hinaus.
--
-- Verbindliche Eigenschaften:
--   * Veraendert werden ausschliesslich RECHTE. Keine Tabelle, Policy, View
--     oder Funktion wird angelegt oder inhaltlich veraendert; kein
--     `create or replace`, kein `drop`.
--   * Empfaenger jedes `grant` ist ausschliesslich app_user. Es gibt keinen
--     `grant` an public, anon oder authenticated. Es gibt genau EINEN `revoke`
--     (Abschnitt 3, public.refresh_incident_tasks_ap13(uuid)): dieses
--     Ausfuehrungsrecht ist ohne Produktaufruf und wird deshalb entzogen; weil
--     app_user es mittelbar ueber authenticated erbt, muss der Entzug auch
--     authenticated einschliessen, um zu wirken. Er ist idempotent und damit
--     wiederholbar.
--   * Objektgenau. Kein `grant ... on all tables in schema public`, damit ein
--     kuenftiges Objekt nicht versehentlich mitfreigegeben wird.
--   * Additiv und wiederholbar: `grant` ist idempotent, der Abschlussblock
--     prueft ausschliesslich.
--   * Ein Tabellenrecht ist die Voraussetzung des Zugriffs, nicht seine
--     Erlaubnis. Die Zeilensichtbarkeit bleibt unveraendert Sache der
--     bestehenden RLS-Policies; keine Policy wird gelockert.

-- ---------------------------------------------------------------------
-- 1) Lesende Fachobjekte
-- ---------------------------------------------------------------------
grant select on public.customers to app_user;
grant select on public.construction_stages to app_user;
grant select on public.vzg_lines to app_user;
grant select on public.on_call_numbers to app_user;
grant select on public.cable_types to app_user;
grant select on public.contacts to app_user;
grant select on public.contact_phone_numbers to app_user;
grant select on public.incident_images to app_user;
-- Bleibt lesend: geschrieben wird ausschliesslich durch den
-- SECURITY-DEFINER-Trigger public.tg_incident_status_history().
grant select on public.incident_status_history to app_user;
-- Die Liste ist eine security_invoker-View; ihre Basistabellen sind oben und
-- in Abschnitt 2 einzeln freigegeben.
grant select on public.incident_list_view to app_user;
-- Singleton der Anwendungsvorgaben. Notwendig, weil die Vorgangs-Lesewege die
-- Standardvorbelegung (Kunde, Bereitschaftsnummer) jetzt selbst aus PostgreSQL
-- lesen und nicht mehr ueber @/lib/masterdata.
grant select on public.app_settings to app_user;

-- ---------------------------------------------------------------------
-- 2) Schreibende Fachtabellen
-- ---------------------------------------------------------------------
grant select, insert, update on public.incidents to app_user;
-- update noetig: eine Zuweisung wird fachlich ueber is_active = false beendet,
-- nicht geloescht.
grant select, insert, update on public.incident_assignments to app_user;
-- delete noetig: public.update_incident_ap12() loescht nicht uebermittelte
-- Kabelpositionen.
grant select, insert, update, delete on public.incident_cable_positions to app_user;
-- Notizen sind anhaengbar und unveraenderlich (kein update, kein delete).
grant select, insert on public.incident_notes to app_user;
-- Bewusst KEIN delete: die Offline-Synchronisation wird auf eine Transaktion je
-- Eintrag umgestellt; ein Fehlschlag rollt zurueck statt zu kompensieren.
grant select, insert on public.sync_actions to app_user;

-- Bewusst KEIN Recht auf public.audit_events: Auditsaetze entstehen
-- ausschliesslich in SECURITY-DEFINER-Triggern (Entscheidung aus 0001), und
-- gelesen wird der Audit nicht durch die Anwendungsrolle.

-- ---------------------------------------------------------------------
-- 3) Direktvergabe der bisher nur geerbten Rechte
--
-- Die folgenden Rechte besitzt app_user heute nur mittelbar ueber die
-- Supabase-Altrolle authenticated (`grant authenticated to app_user` aus
-- bootstrap/01_roles.sql). Die direkte Vergabe macht den Zielzustand von dieser
-- Altrolle unabhaengig, OHNE ihr etwas zu entziehen: es gibt hier bewusst
-- keinen `revoke` gegen authenticated oder anon. Ob und wann die Altrolle
-- entfaellt, ist eine Architekturentscheidung und nicht Gegenstand dieser
-- Migration.
-- ---------------------------------------------------------------------
-- Kein delete: die Loeschsperre aus 0011 (fehlende Delete-Policy,
-- revoke delete, trg_incident_tasks_no_delete) bleibt unveraendert.
grant select, insert, update on public.incident_tasks to app_user;

grant execute on function public.get_assigned_incident_contact(uuid) to app_user;
grant execute on function public.create_incident_ap12(
  uuid, uuid, uuid, uuid, public.incident_priority, text, text, text, text, text,
  text, text, text, numeric, numeric, text, text, text, uuid, uuid, jsonb
) to app_user;
grant execute on function public.update_incident_ap12(
  uuid, uuid, uuid, uuid, uuid, public.incident_priority, text, text, text, text, text,
  text, text, text, numeric, numeric, text, text, text, uuid, uuid, jsonb
) to app_user;
grant execute on function public.bulk_update_incident_status_ap13(
  jsonb, public.incident_status
) to app_user;
grant execute on function public.assign_incident_monteur_ap13(
  uuid, uuid, timestamptz, uuid[]
) to app_user;
grant execute on function public.bulk_assign_incident_monteur_ap13(jsonb, uuid) to app_user;
grant execute on function public.get_assigned_incident_tasks(uuid) to app_user;

-- Ohne Ausfuehrungsrecht fuer app_user bleiben
-- public.refresh_incident_tasks_ap13(uuid) und
-- public.sync_incident_tasks_internal(uuid). Die beiden Faelle sind aber NICHT
-- gleich, und der Unterschied ist hier ausdruecklich festzuhalten:
--
--   * public.sync_incident_tasks_internal(uuid) ist echt gesperrt. Die interne
--     Reconciliation ist ein SECURITY-DEFINER-Weg, der die RLS von
--     incident_tasks notwendigerweise umgeht (0011, Abschnitt 3), und wird
--     ausschliesslich von Triggern aufgerufen. 0011:241 entzieht das
--     Ausfuehrungsrecht public, anon UND authenticated; damit besteht auch
--     mittelbar kein Weg fuer app_user. Hier ist deshalb KEIN weiterer
--     `revoke` noetig, nur die Negativpruefung unten.
--   * public.refresh_incident_tasks_ap13(uuid) war dagegen bisher NICHT
--     gesperrt: 0011:315 erteilt `grant execute ... to authenticated`, und
--     bootstrap/01_roles.sql:21 macht app_user mit `grant authenticated to
--     app_user` zum Mitglied dieser Rolle. app_user konnte die Refresh-RPC
--     also mittelbar ausfuehren.
--
-- Dieses geerbte Recht wird jetzt entzogen. Begruendung, belegbar:
--   * Es gibt KEINEN Produktaufruf der Refresh-RPC. Die einzige Nennung im
--     Anwendungscode ist das Typliteral in
--     app/src/lib/database.types.ts:572; die einzigen echten Aufrufe stehen in
--     app/supabase/test/18_ap13_tasks.sql. Ein ungenutztes Recht auf eine
--     SECURITY-DEFINER-Funktion, die die RLS von incident_tasks umgeht,
--     widerspricht dem Least-Privilege-Anspruch aus ADR-011 / 2.5.
--   * Der Entzug MUSS authenticated einschliessen. Ein `revoke` allein gegen
--     app_user waere wirkungslos, weil das Recht ueber die Gruppenrolle
--     authenticated vererbt wird. public und anon stehen nur der
--     Vollstaendigkeit halber dabei (0011:314 hat sie bereits entzogen); ein
--     wiederholter Entzug ist folgenlos und haelt die Migration wiederholbar.
--   * Der interne Ableitungspfad bleibt davon UNBERUEHRT. Die Trigger aus
--     0011:249-281 rufen public.sync_incident_tasks_internal(uuid) auf, und
--     eine Triggerfunktion wird beim Ausloesen ohne Ausfuehrungsrecht des
--     aufrufenden Benutzers ausgefuehrt. Abgeleitete Aufgaben entstehen und
--     verschwinden also weiterhin genau wie bisher; nur der manuelle
--     Staff-Refresh ist nach diesem Entzug ausschliesslich fuer
--     Eigentuemer-/Wartungsrollen erreichbar.
revoke all on function public.refresh_incident_tasks_ap13(uuid)
  from public, anon, authenticated, app_user;

-- ---------------------------------------------------------------------
-- 4) Abschlusspruefung
--
-- Positiv: jedes oben genannte Recht muss tatsaechlich vorhanden sein.
-- Negativ: die ausdruecklich verweigerten Rechte duerfen nicht vorhanden sein -
-- auch nicht mittelbar ueber eine Gruppenrolle, denn has_*_privilege beruecksichtigt
-- die Mitgliedschaft.
-- ---------------------------------------------------------------------
do $$
declare
  item record;
  missing text[] := array[]::text[];
begin
  for item in
    select * from (values
      ('public.customers', 'select'),
      ('public.construction_stages', 'select'),
      ('public.vzg_lines', 'select'),
      ('public.on_call_numbers', 'select'),
      ('public.cable_types', 'select'),
      ('public.contacts', 'select'),
      ('public.contact_phone_numbers', 'select'),
      ('public.incident_images', 'select'),
      ('public.incident_status_history', 'select'),
      ('public.incident_list_view', 'select'),
      ('public.app_settings', 'select'),
      -- Herkunft 0012:114, NICHT von dieser Migration erteilt. Der Eintrag
      -- steht hier ausschliesslich als PRUEFUNG: die Vorgangs-Lesewege setzen
      -- das Mindestrecht der Sitzungsauswertung voraus, und ein Wegfall soll
      -- hier auffallen statt erst zur Laufzeit.
      ('public.profiles', 'select'),
      ('public.incidents', 'select'),
      ('public.incidents', 'insert'),
      ('public.incidents', 'update'),
      ('public.incident_assignments', 'select'),
      ('public.incident_assignments', 'insert'),
      ('public.incident_assignments', 'update'),
      ('public.incident_cable_positions', 'select'),
      ('public.incident_cable_positions', 'insert'),
      ('public.incident_cable_positions', 'update'),
      ('public.incident_cable_positions', 'delete'),
      ('public.incident_notes', 'select'),
      ('public.incident_notes', 'insert'),
      ('public.sync_actions', 'select'),
      ('public.sync_actions', 'insert'),
      ('public.incident_tasks', 'select'),
      ('public.incident_tasks', 'insert'),
      ('public.incident_tasks', 'update')
    ) as t(object_name, privilege)
  loop
    if not has_table_privilege('app_user', item.object_name, item.privilege) then
      missing := array_append(missing, item.object_name || ' ' || item.privilege);
    end if;
  end loop;

  if array_length(missing, 1) is not null then
    raise exception
      'AP14/B: app_user fehlt/fehlen die Tabellenrecht(e): %',
      array_to_string(missing, ', ');
  end if;
end
$$;

do $$
declare
  signature text;
  missing text[] := array[]::text[];
begin
  foreach signature in array array[
    'public.get_assigned_incident_contact(uuid)',
    'public.create_incident_ap12(uuid, uuid, uuid, uuid, public.incident_priority, '
      || 'text, text, text, text, text, text, text, text, numeric, numeric, '
      || 'text, text, text, uuid, uuid, jsonb)',
    'public.update_incident_ap12(uuid, uuid, uuid, uuid, uuid, public.incident_priority, '
      || 'text, text, text, text, text, text, text, text, numeric, numeric, '
      || 'text, text, text, uuid, uuid, jsonb)',
    'public.bulk_update_incident_status_ap13(jsonb, public.incident_status)',
    'public.assign_incident_monteur_ap13(uuid, uuid, timestamptz, uuid[])',
    'public.bulk_assign_incident_monteur_ap13(jsonb, uuid)',
    'public.get_assigned_incident_tasks(uuid)'
  ]
  loop
    if not has_function_privilege('app_user', signature, 'execute') then
      missing := array_append(missing, signature);
    end if;
  end loop;

  if array_length(missing, 1) is not null then
    raise exception
      'AP14/B: app_user fehlt das Ausfuehrungsrecht auf: %',
      array_to_string(missing, ', ');
  end if;
end
$$;

-- Negativpruefung der Ausfuehrungsrechte. has_function_privilege beruecksichtigt
-- die Rollenmitgliedschaft; ein ueber authenticated geerbtes Recht faellt hier
-- also ebenso auf wie eine Direktvergabe. Beide Funktionen werden von 0011
-- angelegt und laufen in der Kette vorher - die Signaturen sind damit
-- aufloesbar (has_function_privilege bricht bei einem unbekannten Objekt ab).
do $$
declare
  signature text;
  unexpected text[] := array[]::text[];
begin
  foreach signature in array array[
    'public.refresh_incident_tasks_ap13(uuid)',
    'public.sync_incident_tasks_internal(uuid)'
  ]
  loop
    if has_function_privilege('app_user', signature, 'execute') then
      unexpected := array_append(unexpected, signature);
    end if;
  end loop;

  if array_length(unexpected, 1) is not null then
    raise exception
      'AP14/B: app_user besitzt unerwartete(s) Ausfuehrungsrecht(e): %',
      array_to_string(unexpected, ', ');
  end if;
end
$$;

do $$
declare
  item record;
  unexpected text[] := array[]::text[];
begin
  for item in
    select * from (values
      ('public.incidents', 'delete'),
      ('public.incident_notes', 'delete'),
      ('public.incident_tasks', 'delete'),
      -- Abschnitt 2 vergibt auf sync_actions bewusst nur select und insert. Die
      -- Zusage "Rollback statt Kompensation" haengt genau an diesem fehlenden
      -- delete, denn die Delete-Policy aus 0006 besteht unveraendert weiter.
      -- Ohne Negativpruefung waere die Zusage nicht abgesichert.
      ('public.sync_actions', 'delete'),
      ('public.audit_events', 'select'),
      ('public.audit_events', 'insert'),
      ('public.audit_events', 'update'),
      ('public.audit_events', 'delete'),
      ('public.audit_events', 'truncate'),
      ('public.audit_events', 'references'),
      ('public.audit_events', 'trigger')
    ) as t(object_name, privilege)
  loop
    if has_table_privilege('app_user', item.object_name, item.privilege) then
      unexpected := array_append(unexpected, item.object_name || ' ' || item.privilege);
    end if;
  end loop;

  if array_length(unexpected, 1) is not null then
    raise exception
      'AP14/B: app_user besitzt unerwartete Tabellenrecht(e): %',
      array_to_string(unexpected, ', ');
  end if;
end
$$;

-- =====================================================================
-- Ende Migration 0014
-- =====================================================================
