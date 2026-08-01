-- AP14/B: Rechtematrix der Stammdaten und des Inventars fuer die
-- Anwendungsrolle app_user.
--
-- Bezug: ADR-011 / 2.5 - der Anwendungszugriff laeuft ausschliesslich ueber die
-- nicht privilegierte Rolle app_user. Migration 0014 hat die Rechtematrix der
-- Vorgangs-, Aufgaben- und Sync-Objekte geschlossen und den Stammdaten sowie
-- dem Inventar bewusst nur das Leserecht gegeben, das die Vorgangswege
-- brauchen (0014, Abschnitt 1). Diese Migration schliesst die verbleibende
-- Luecke der Stammdatenpflege und der Materialwirtschaft - und nichts
-- darueber hinaus.
--
-- Verbindliche Eigenschaften:
--   * Veraendert werden ausschliesslich RECHTE. Keine Tabelle, Spalte, Policy,
--     View, Funktion oder Trigger wird angelegt oder inhaltlich veraendert;
--     kein `create`, kein `create or replace`, kein `drop`, kein `alter`.
--   * Empfaenger jedes `grant` ist ausschliesslich app_user. Es gibt keinen
--     `grant` an public, anon oder authenticated.
--   * Objektgenau. Kein `grant ... on all tables in schema public`, damit ein
--     kuenftiges Objekt nicht versehentlich mitfreigegeben wird.
--   * Additiv und wiederholbar: `grant` ist idempotent, die Abschlussbloecke
--     pruefen ausschliesslich. Die Datei darf mehrfach hintereinander laufen.
--   * Ein Tabellenrecht ist die Voraussetzung des Zugriffs, nicht seine
--     Erlaubnis. Die Zeilensichtbarkeit bleibt unveraendert Sache der
--     bestehenden RLS-Policies; keine Policy wird gelockert. Wer schreiben
--     darf, entscheiden weiterhin allein stages_write/oncall_write und die
--     AP9-Policies `<tabelle>_write` (is_staff()) sowie materials_write und
--     locations_write (is_admin()) und movements_insert.
--
-- Ein `revoke` ist in dieser Migration nicht erforderlich und findet nicht
-- statt: in den Migrationen 0001-0014 erteilt keine Anweisung einem der unten
-- genannten Objekte ein Recht fuer app_user, authenticated, anon oder public.
-- Die einzigen Vergaben auf diese Objekte sind die reinen Leserechte aus 0014,
-- Abschnitt 1 (customers, construction_stages, vzg_lines, on_call_numbers,
-- cable_types, contacts, contact_phone_numbers, app_settings). Nachpruefbar ist
-- das an 19a_ap14b_grant_reset.sql, Abschnitt 3: dort steht genau diese
-- Negativprobe fuer public.inventory_movements und public.storage_locations
-- fest, weil beiden Objekten bis hierher KEINE Migration ein Recht erteilt.

-- ---------------------------------------------------------------------
-- 1) Stammdaten (Pflegewege aus @/lib/masterdata-actions)
--
-- Das Leserecht dieser Tabellen stammt - wo vorhanden - aus 0014, Abschnitt 1
-- und wird hier nicht erneut erteilt.
-- ---------------------------------------------------------------------
-- saveOnCallNumber() und setOnCallNumberActive(): insert bzw. update;
-- deaktiviert wird ueber is_active, nicht ueber delete.
grant insert, update on public.on_call_numbers to app_user;
-- saveCustomer() und setCustomerActive().
grant insert, update on public.customers to app_user;
-- saveStage() und setStageActive(); die Pflege umfasst wus_bst und
-- default_on_call_number_id (Spalten aus 0007, Abschnitt 2).
grant insert, update on public.construction_stages to app_user;
-- saveVzgLine() und setVzgLineActive().
grant insert, update on public.vzg_lines to app_user;
-- saveContact() und setContactActive(). `insert ... returning id`
-- (masterdata-actions.ts, saveContact) braucht zusaetzlich das bereits aus
-- 0014, Abschnitt 1 vorhandene select.
grant insert, update on public.contacts to app_user;
-- saveContact() ersetzt die Nummern eines Kontakts vollstaendig: erst
-- `delete ... where contact_id = ...`, dann ein insert je Nummer. Deshalb
-- bewusst KEIN update - es gibt keinen Pfad, der eine einzelne Nummer aendert.
grant insert, delete on public.contact_phone_numbers to app_user;
-- Dieselbe Ersetzung fuer die Bauabschnittszuordnung eines Kontakts. Bisher
-- besitzt app_user auf dieser Tabelle gar kein Recht; das select ist noetig,
-- weil listContacts() die Zuordnung je Kontakt mitliest (masterdata.ts).
grant select, insert, delete on public.construction_stage_contacts to app_user;
-- saveTechnician(), setTechnicianActive() und der Import; select fuer
-- listTechnicians() und den Abgleich vorhandener Namen.
grant select, insert, update on public.technicians to app_user;
-- saveTeam() und setTeamActive(); select fuer listTeams().
grant select, insert, update on public.teams to app_user;
-- saveTeam() ersetzt die Mitgliedschaft vollstaendig (delete + insert je
-- Mitglied). Deshalb bewusst KEIN update.
grant select, insert, delete on public.team_members to app_user;
-- saveCableType() und setCableTypeActive().
grant insert, update on public.cable_types to app_user;
-- saveSettings() schreibt den Singleton als Upsert
-- (`insert ... on conflict (id) do update`) und braucht dafuer insert UND
-- update. Das select stammt aus 0014, Abschnitt 1.
grant insert, update on public.app_settings to app_user;

-- ---------------------------------------------------------------------
-- 2) Inventar (Pflege- und Buchungswege aus @/lib/inventory-actions,
--    Lesewege aus @/lib/inventory)
-- ---------------------------------------------------------------------
-- saveMaterial(), setMaterialActive() und die Lesewege listMaterials(),
-- materialUnit(). Bewusst KEIN delete: ein Material wird fachlich ueber
-- is_active deaktiviert und nie entfernt.
grant select, insert, update on public.materials to app_user;
-- saveLocation(), setLocationActive() und listLocations(). Bewusst KEIN
-- delete, gleiche Begruendung wie beim Material.
grant select, insert, update on public.storage_locations to app_user;
-- Die Bestands-View bleibt unveraendert die einzige Bestandsquelle
-- (inventory.ts, STOCK_SQL). Sie ist bewusst KEINE security_invoker-View - die
-- Begruendung steht in 0001_init.sql unmittelbar unter ihrer Definition: als
-- Aggregat-View laeuft sie mit den Rechten des Eigentuemers, damit alle
-- Berechtigten den korrekten Gesamtbestand sehen. Diese Migration tastet die
-- View nicht an. Ein Basistabellenrecht ist fuer diesen Lesepfad deshalb nicht
-- erforderlich; das select auf public.inventory_movements unten dient allein
-- dem Bewegungsverlauf.
grant select on public.material_stock to app_user;
-- Bewegungsverlauf (listMovements()) und die Buchungen createMovement(),
-- takeoutMaterial(), returnMaterial(), consumeMaterial().
-- Ausdruecklich KEIN update und KEIN delete: die Chronik ist unveraenderbar.
-- Es gibt fuer sie weder eine Update- noch eine Delete-Policy
-- (0001_init.sql, Abschnitt "Materialbewegungen: unveraenderbares Journal");
-- das fehlende Tabellenrecht ist die zweite, unabhaengige Schranke.
grant select, insert on public.inventory_movements to app_user;

-- ---------------------------------------------------------------------
-- 3) Ausdruecklich NICHT erteilte Rechte
-- ---------------------------------------------------------------------
-- Kein Recht auf public.audit_events: Auditsaetze entstehen ausschliesslich in
-- SECURITY-DEFINER-Triggern (public.tg_audit() aus 0001, feldgenau erweitert in
-- 0007), und gelesen wird der Audit nicht durch die Anwendungsrolle. Die
-- Negativprobe steht in Abschnitt 4.
--
-- Kein Sequenzrecht. Alle Primaerschluessel dieses Scopes sind
-- `uuid default gen_random_uuid()`; public.app_settings.id ist ein `smallint`
-- mit Default 1 und der Singletonbedingung `id = 1` (0007, Abschnitt 3.10). Es
-- gibt in diesem Scope kein `serial`, kein `nextval` und keine Sequenz - also
-- auch nichts zu erteilen.
--
-- Kein Ausfuehrungsrecht auf public.check_inventory_nonnegative(): sie ist eine
-- reine Triggerfunktion (trg_inventory_nonneg, before insert on
-- public.inventory_movements) und wird beim Ausloesen ohne Ausfuehrungsrecht
-- des aufrufenden Benutzers ausgefuehrt - dieselbe Begruendung, mit der 0014
-- die Triggerpfade der Aufgabenableitung unberuehrt laesst. Es wird hier auch
-- KEIN bestehendes Recht auf diese Funktion widerrufen: das waere eine
-- Aenderung des Bestandsrechtestands ausserhalb dieses Auftrags.

-- ---------------------------------------------------------------------
-- 4) Abschlusspruefung
--
-- Positiv: jedes oben erteilte Recht muss tatsaechlich vorhanden sein.
-- Negativ: die ausdruecklich verweigerten Rechte duerfen nicht vorhanden sein -
-- auch nicht mittelbar ueber eine Gruppenrolle, denn has_table_privilege
-- beruecksichtigt die Rollenmitgliedschaft.
-- ---------------------------------------------------------------------
do $$
declare
  item record;
  missing text[] := array[]::text[];
begin
  for item in
    select * from (values
      -- Stammdaten (Abschnitt 1)
      ('public.on_call_numbers', 'insert'),
      ('public.on_call_numbers', 'update'),
      ('public.customers', 'insert'),
      ('public.customers', 'update'),
      ('public.construction_stages', 'insert'),
      ('public.construction_stages', 'update'),
      ('public.vzg_lines', 'insert'),
      ('public.vzg_lines', 'update'),
      ('public.contacts', 'insert'),
      ('public.contacts', 'update'),
      ('public.contact_phone_numbers', 'insert'),
      ('public.contact_phone_numbers', 'delete'),
      ('public.construction_stage_contacts', 'select'),
      ('public.construction_stage_contacts', 'insert'),
      ('public.construction_stage_contacts', 'delete'),
      ('public.technicians', 'select'),
      ('public.technicians', 'insert'),
      ('public.technicians', 'update'),
      ('public.teams', 'select'),
      ('public.teams', 'insert'),
      ('public.teams', 'update'),
      ('public.team_members', 'select'),
      ('public.team_members', 'insert'),
      ('public.team_members', 'delete'),
      ('public.cable_types', 'insert'),
      ('public.cable_types', 'update'),
      ('public.app_settings', 'insert'),
      ('public.app_settings', 'update'),
      -- Inventar (Abschnitt 2)
      ('public.materials', 'select'),
      ('public.materials', 'insert'),
      ('public.materials', 'update'),
      ('public.storage_locations', 'select'),
      ('public.storage_locations', 'insert'),
      ('public.storage_locations', 'update'),
      ('public.material_stock', 'select'),
      ('public.inventory_movements', 'select'),
      ('public.inventory_movements', 'insert'),
      -- Herkunft 0012:114, NICHT von dieser Migration erteilt. Der Eintrag
      -- steht hier ausschliesslich als PRUEFUNG: der Bewegungsverlauf loest die
      -- Namen der Urheber ueber public.profiles auf (inventory.ts,
      -- PROFILE_NAMES_SQL), und ein Wegfall soll hier auffallen statt erst zur
      -- Laufzeit.
      ('public.profiles', 'select'),
      -- Herkunft 0014:55, ebenfalls nur PRUEFUNG: der Bewegungsverlauf
      -- verbindet jede Buchung mit ihrem Vorgang (inventory.ts,
      -- MOVEMENT_SELECT, left join public.incidents).
      ('public.incidents', 'select'),
      -- Herkunft ebenfalls 0014:55 und ebenfalls nur PRUEFUNG, aber aus einem
      -- zweiten, staerkeren Grund: die drei vorgangsbezogenen Buchungswege
      -- (takeoutMaterial, returnMaterial, consumeMaterial in
      -- inventory-actions.ts) serialisieren sich ueber
      -- `select id from public.incidents where id = $1 for update`. Eine
      -- Sperrklausel verlangt neben select auch das update-Recht. Faellt es weg,
      -- scheitern alle drei Buchungswege still mit 42501 - fail-closed, aber
      -- ohne dass ein Smoke anschlaegt. Dieser Eintrag macht genau das sichtbar.
      ('public.incidents', 'update')
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

-- Negativpruefung 1: unveraenderbare Chronik und Deaktivierung ueber is_active.
-- Jeder Treffer hier waere ein stiller Weg, der die fachliche Zusage bricht.
do $$
declare
  item record;
  unexpected text[] := array[]::text[];
begin
  for item in
    select * from (values
      -- Die Chronik ist unveraenderbar; es gibt weder Update- noch
      -- Delete-Policy (0001).
      ('public.inventory_movements', 'update'),
      ('public.inventory_movements', 'delete'),
      -- Deaktivierung laeuft ueber is_active, nicht ueber delete.
      ('public.materials', 'delete'),
      ('public.storage_locations', 'delete'),
      ('public.customers', 'delete'),
      ('public.construction_stages', 'delete'),
      ('public.vzg_lines', 'delete'),
      ('public.contacts', 'delete'),
      ('public.technicians', 'delete'),
      ('public.teams', 'delete'),
      ('public.cable_types', 'delete'),
      ('public.on_call_numbers', 'delete'),
      ('public.app_settings', 'delete'),
      -- Vollstaendige Ersetzung statt Einzelaenderung.
      ('public.contact_phone_numbers', 'update'),
      ('public.construction_stage_contacts', 'update'),
      ('public.team_members', 'update'),
      -- Die Bestands-View ist ausschliesslich ein Lesepfad.
      ('public.material_stock', 'insert'),
      ('public.material_stock', 'update'),
      ('public.material_stock', 'delete')
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

-- Negativpruefung 2: der Audit bleibt fuer die Anwendungsrolle vollstaendig
-- unerreichbar - lesend und schreibend, auch mittelbar.
do $$
declare
  privilege text;
  unexpected text[] := array[]::text[];
begin
  foreach privilege in array array[
    'select', 'insert', 'update', 'delete', 'truncate', 'references', 'trigger'
  ]
  loop
    if has_table_privilege('app_user', 'public.audit_events', privilege) then
      unexpected := array_append(unexpected, privilege);
    end if;
  end loop;

  if array_length(unexpected, 1) is not null then
    raise exception
      'AP14/B: app_user besitzt unerwartete(s) Recht(e) auf public.audit_events: %',
      array_to_string(unexpected, ', ');
  end if;
end
$$;

-- Negativpruefung 3: app_user bleibt eine nicht privilegierte Rolle. Ohne diese
-- Pruefung waere die gesamte Rechtematrix wertlos - mit SUPERUSER oder
-- BYPASSRLS gilt keine Policy. Muster aus 20_ap14b_data.sql, Fall D19.
do $$
declare
  v_flags record;
begin
  select rolsuper, rolbypassrls
  into v_flags
  from pg_roles where rolname = 'app_user';

  if not found then
    raise exception 'AP14/B: Rolle app_user fehlt';
  end if;
  if v_flags.rolsuper or v_flags.rolbypassrls then
    raise exception
      'AP14/B: app_user ist privilegiert (rolsuper=% rolbypassrls=%)',
      v_flags.rolsuper, v_flags.rolbypassrls;
  end if;
end
$$;

-- =====================================================================
-- Ende Migration 0015
-- =====================================================================
