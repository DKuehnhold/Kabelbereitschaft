\set ON_ERROR_STOP on

-- =====================================================================
-- AP14/B - administrative Benutzerverwaltung unter der Anwendungsrolle
-- app_user mit AKTIVER RLS.
--
-- Erwartet die vollstaendige Kette einschliesslich 0012 bis 0017 sowie die
-- Smokes 19_ap14b_platform.sql, 19a_ap14b_grant_reset.sql, 20_ap14b_data.sql,
-- 21_ap14b_masterdata_inventory.sql und 22_ap14b_images.sql. Diese Datei ist
-- der neue letzte Eintrag der Kette und laeuft unmittelbar hinter Migration
-- 0017.
--
-- Verbindliche Eigenschaften dieses Smokes:
--   * Er laeuft HINTER Migration 0017 und misst damit den echten
--     Produktrechtestand der Benutzerverwaltung. Der Rechtestand ist
--     ZWEITEILIG: select auf public.profiles gilt TABELLENWEIT (0012:114),
--     update gilt AUSSCHLIESSLICH auf der Spalte role (0017). Diese Zweiteilung
--     wird durchgehend auseinandergehalten: die POLICY profiles_update
--     entscheidet, WELCHE ZEILE geaendert werden darf, das SPALTENRECHT,
--     WELCHE SPALTE. Er fuehrt selbst KEIN `grant` und KEIN `revoke` aus,
--     aendert keine Policy und schaltet keinen Trigger ab.
--   * Die Identitaet wird immer transaktionsgebunden mit
--     set_config('app.user_id', ..., true) gesetzt - genau so, wie
--     withUserTransaction() es tut (app/src/lib/db/index.ts). Jeder `do`-Block
--     ist eine eigene Transaktion, die Identitaet endet mit ihm.
--   * Geprueft wird unter `set role app_user` mit aktiver RLS. Der
--     Eigentuemerkontext dient ausschliesslich den Fixtures, den Gegenproben,
--     die app_user gerade NICHT lesen darf (public.audit_events), und der
--     Vorbereitung von U15/U16 - dort muss public.profiles.is_active gesetzt
--     werden, und genau das darf app_user nach 0017 nicht.
--   * NUR SYNTHETISCHE WERTE. Keine echte Person, kein echtes Passwort, kein
--     echter Hash. Die beiden Hashliterale sind bewusst als solche erkennbar
--     ('$argon2id$u23-synthetisch-...') und werden in U17 daraufhin geprueft,
--     dass sie in keinem Auditsatz auftauchen.
--   * Gezaehlt wird ausschliesslich RELATIV ueber die eigenen Kennungen. Kein
--     Fall zaehlt absolut ueber eine ganze Tabelle - mit EINER dokumentierten
--     Ausnahme: U15/U16 zaehlen die aktiven Administratoren der GESAMTEN
--     Datenbank, weil genau das der Gegenstand des Schutztriggers ist. Diese
--     beiden Faelle laufen deshalb in einer ausdruecklichen Transaktion, die
--     mit ROLLBACK endet (ausfuehrliche Begruendung dort).
--
-- AUFRAEUMEN: anders als 20-22 raeumt diese Datei am Ende ausdruecklich auf
-- (Vorgabe des Arbeitspakets). Entfernt werden ausschliesslich die eigenen
-- Auditsaetze, Profile und Konten mit dem Praefix 23b00000-. Danach hinterlaesst
-- die Datei keine Rolle, keine Identitaet und keine Zeile.
--
-- FALLGRUPPE U19-U29 - die beiden DATENBANKWAECHTER aus 0017:
--   0017 haengt seit der Sicherheitsnachbesserung zwei zusaetzliche
--   BEFORE-UPDATE-Waechter ein - trg_protect_auth_account_admin_change auf
--   public.auth_accounts (Abschnitt 3b) und trg_protect_profile_active_admin auf
--   public.profiles (Abschnitt 3c) - und nimmt app_user das tabellenweite
--   `delete` auf public.auth_accounts (Abschnitt 1a). Der Vertrag lautet: eine
--   administrative Aenderung ohne AKTIVE Adminrolle endet mit SQLSTATE KB003,
--   ohne Wirkung und ohne Auditsatz, waehrend der Anmeldebetrieb und der eigene
--   Passwortwechsel unveraendert weiterlaufen. Genau das misst U19-U29.
--   Der Unterschied zu public.is_admin() ist der Kern: is_admin()
--   (0001_init.sql:59-61) liest ausschliesslich profiles.role und haelt ein
--   deaktiviertes Profil oder ein gesperrtes Konto weiterhin fuer einen
--   Administrator. public.is_active_admin_actor() (0017, Abschnitt 3a) verlangt
--   alle DREI Bedingungen.
--
--   Dafuer braucht die Datei drei zusaetzliche Identitaeten:
--     * 23b00000-...-000000000005 - Disponent, aktiv, Konto offen. Der
--       Nicht-Administrator, den die Rechtematrix allein nicht aufhaelt.
--     * 23b00000-...-000000000006 - Rolle 'admin', Profil INAKTIV. Fuer
--       public.is_admin() ein Administrator, fuer die Waechter keiner.
--     * 23b00000-...-000000000007 - Rolle 'admin', Profil aktiv, Konto
--       GESPERRT. Derselbe Sachverhalt ueber die zweite Tabelle.
--   ...0006 und ...0007 sind ausdruecklich KEINE aktiven Administratoren im
--   Sinne von 0017, Abschnitt 3 (...0006 scheitert an p.is_active, ...0007 an
--   a.is_disabled). Sie erhoehen die Zaehlung der aktiven Administratoren in
--   U15/U16 deshalb NICHT, und beide Faelle bleiben unveraendert.
--
-- ZAEHLWEISE DES AUDITS IN U19-U38: RELATIV. U11-U14 haben fuer Konto ...0004
-- bereits Auditsaetze erzeugt; ein absoluter Vergleich mit 0 waere dort schlicht
-- falsch. "Kein Auditsatz" heisst in dieser Fallgruppe nachweislich "kein
-- ZUSAETZLICHER Auditsatz": gezaehlt wird vor dem Versuch und danach, verglichen
-- wird die Differenz.
--
-- FALLGRUPPE U30-U38 - der WAECHTERVERTRAG DER SPERRSPALTEN:
--   0017 haengt zusaetzlich einen Plausibilitaetswaechter (Abschnitt 3d,
--   SQLSTATE 'KB004'), einen Massenwaechter (Abschnitt 3e, SQLSTATE 'KB005')
--   und einen Audittrigger (Abschnitt 2d) auf public.auth_accounts.failed_attempts
--   und public.auth_accounts.locked_until. Der Vertrag lautet: zugelassen sind
--   ausschliesslich die Uebergaenge, die der reale Anmeldeweg erzeugt - je
--   Anweisung hoechstens EIN Konto -, und Sperre wie Entsperrung hinterlassen
--   einen Auditsatz. Genau das misst U30-U38.
--
-- Meldungskennung: U (U1-U38). Der Buchstabe ist in der Kette frei: 19 nutzt P,
-- 20 nutzt D/R, 21 nutzt M/N, 22 nutzt B/G.
-- =====================================================================

reset role;
select set_config('app.user_id', '', false);

-- ---------------------------------------------------------------------
-- Fixtures im Eigentuemerkontext (RLS gilt fuer den Eigentuemer nicht; das ist
-- genau der Grund, weshalb alle Wirkungsfaelle weiter unten unter
-- `set role app_user` laufen).
--
-- Sieben Identitaeten. Vier davon tragen die Faelle U1-U18:
--   * zwei Administratoren (der handelnde ...0001 und der zweite ...0002 fuer
--     U16),
--   * zwei Monteure (...0003 als Ziel des Rollenwechsels, ...0004 fuer
--     Selbstversuch, Kontosperre und Passwortwege).
-- Drei weitere tragen die Waechterfaelle U19-U29:
--   * ...0005 - Disponent, Profil aktiv, Konto offen. Ein regulaer angemeldeter
--     Nicht-Administrator; die Rechtematrix allein haelt ihn NICHT auf, weil
--     app_user `update` auf public.auth_accounts tabellenweit besitzt
--     (0012:102) und die Tabelle keine Policy traegt.
--   * ...0006 - Rolle 'admin', Profil INAKTIV (is_active = false), Konto offen.
--   * ...0007 - Rolle 'admin', Profil aktiv, Konto GESPERRT (is_disabled = true).
--
-- ZWINGEND UND HIER FESTGEHALTEN: ...0006 und ...0007 sind AUSDRUECKLICH KEINE
-- aktiven Administratoren. Die Definition aus 0017, Abschnitt 3, verlangt alle
-- drei Bedingungen (role = 'admin' UND profiles.is_active UND NOT
-- auth_accounts.is_disabled); ...0006 verletzt die zweite, ...0007 die dritte.
-- Beide fallen deshalb aus der Zaehlung
--   `profiles p join auth_accounts a on a.id = p.id
--    where p.role = 'admin' and p.is_active and not a.is_disabled`
-- heraus, die U15 und U16 fuehren. U15 bleibt bei genau EINEM aktiven
-- Administrator, U16 bei genau ZWEIEN; beide Faelle sind unveraendert.
-- (U15 setzt is_active = false fuer jedes AKTIVE Adminprofil ausser ...0001 und
-- fasst dabei auch ...0007 an - das geschieht in der Transaktion, die mit
-- ROLLBACK endet, und ist danach spurlos zurueckgenommen. ...0007 zaehlt wegen
-- seines gesperrten Kontos ohnehin nicht mit.)
-- Wer ...0006 aktiviert oder ...0007 entsperrt, bricht U15 und U16.
--
-- Jedes Profil braucht ein Auth-Konto, weil 0012 den Fremdschluessel
-- public.profiles.id auf public.auth_accounts umgehaengt hat.
--
-- Die vier ADMIN-Konten (...0001, ...0002, ...0006, ...0007) tragen bewusst den
-- Platzhalter '!MIGRATED-ACCOUNT-REQUIRES-RESET!' statt eines Argon2id-artigen
-- Werts - uebernommen aus 20_ap14b_data.sql und 22_ap14b_images.sql: der Runner
-- startet die Node-Integrationstests in DERSELBEN Datenbank NACH dieser Datei,
-- und usableAdminCount() zaehlt jedes aktive Admin-Profil, dessen password_hash
-- auf '$argon2id$' passt. Ein solcher Wert liesse die Bootstrap-Faelle
-- scheitern. Dieser Smoke braucht den Hash nicht: die Identitaet wird ueber
-- set_config('app.user_id', ...) gesetzt. Diesen Wert NICHT auf einen
-- '$argon2id$'-Wert zurueckdrehen.
--
-- is_disabled wird fuer JEDE Zeile ausdruecklich gesetzt, obwohl der Vorgabewert
-- false ist: der gesperrte Zustand von ...0007 ist eine tragende Eigenschaft der
-- Fixtures und soll nicht aus einer Spaltenvorgabe erschlossen werden muessen.
-- ---------------------------------------------------------------------
insert into public.auth_accounts (id, email, password_hash, must_change_password, is_disabled)
values
  ('23b00000-0000-0000-0000-000000000001', 'u23.admin@beispiel.invalid', '!MIGRATED-ACCOUNT-REQUIRES-RESET!', false, false),
  ('23b00000-0000-0000-0000-000000000002', 'u23.admin.zweit@beispiel.invalid', '!MIGRATED-ACCOUNT-REQUIRES-RESET!', false, false),
  ('23b00000-0000-0000-0000-000000000003', 'u23.monteur@beispiel.invalid', '$argon2id$synthetisch', false, false),
  ('23b00000-0000-0000-0000-000000000004', 'u23.monteur.zweit@beispiel.invalid', '$argon2id$synthetisch', false, false),
  ('23b00000-0000-0000-0000-000000000005', 'u23.disponent@beispiel.invalid', '$argon2id$synthetisch', false, false),
  ('23b00000-0000-0000-0000-000000000006', 'u23.admin.inaktiv@beispiel.invalid', '!MIGRATED-ACCOUNT-REQUIRES-RESET!', false, false),
  ('23b00000-0000-0000-0000-000000000007', 'u23.admin.gesperrt@beispiel.invalid', '!MIGRATED-ACCOUNT-REQUIRES-RESET!', false, true)
on conflict (id) do nothing;

insert into public.profiles (id, full_name, role, is_active)
values
  ('23b00000-0000-0000-0000-000000000001', 'U23 Admin', 'admin', true),
  ('23b00000-0000-0000-0000-000000000002', 'U23 Admin Zweit', 'admin', true),
  ('23b00000-0000-0000-0000-000000000003', 'U23 Monteur', 'monteur', true),
  ('23b00000-0000-0000-0000-000000000004', 'U23 Monteur Zweit', 'monteur', true),
  ('23b00000-0000-0000-0000-000000000005', 'U23 Disponent', 'disponent', true),
  ('23b00000-0000-0000-0000-000000000006', 'U23 Admin Inaktiv', 'admin', false),
  ('23b00000-0000-0000-0000-000000000007', 'U23 Admin Gesperrt', 'admin', true)
on conflict (id) do nothing;

-- Gegenprobe der Fixtures im Eigentuemerkontext, BEVOR irgendein Fall laeuft:
-- ...0006 und ...0007 duerfen nicht als aktive Administratoren zaehlen, und
-- ...0001/...0002 muessen es tun. Ohne diese Probe koennte ein spaeter
-- verschobener Vorgabewert U15/U16 still umdrehen, und der Bruch faellt erst
-- viel weiter unten und mit irrefuehrender Meldung auf.
do $$
declare
  v_aktiv integer;
  v_nicht_aktiv integer;
begin
  select count(*) into v_aktiv
  from public.profiles p
  join public.auth_accounts a on a.id = p.id
  where p.id in (
      '23b00000-0000-0000-0000-000000000001',
      '23b00000-0000-0000-0000-000000000002'
    )
    and p.role = 'admin' and p.is_active and not a.is_disabled;

  select count(*) into v_nicht_aktiv
  from public.profiles p
  join public.auth_accounts a on a.id = p.id
  where p.id in (
      '23b00000-0000-0000-0000-000000000006',
      '23b00000-0000-0000-0000-000000000007'
    )
    and p.role = 'admin' and p.is_active and not a.is_disabled;

  if v_aktiv <> 2 then
    raise exception
      'SMOKE U-FIXTURES FAIL % aktive Administratoren unter ...0001/...0002 statt zwei', v_aktiv;
  end if;
  if v_nicht_aktiv <> 0 then
    raise exception
      'SMOKE U-FIXTURES FAIL ...0006/...0007 zaehlen als % aktive(r) Administrator(en) statt als keiner - U15/U16 waeren nicht mehr aussagekraeftig',
      v_nicht_aktiv;
  end if;

  raise notice
    'SMOKE U-FIXTURES OK sieben Identitaeten angelegt, ...0006 (Profil inaktiv) und ...0007 (Konto gesperrt) zaehlen nicht als aktive Administratoren';
end
$$;

-- =====================================================================
-- Ab hier unter der Anwendungsrolle app_user.
--
-- Grundlage der Zeilensichtbarkeit und der Schreibrechte:
--   * profiles_select using `id = app.current_user_id() or is_staff()`
--   * profiles_update using/with check `is_admin() or id = app.current_user_id()`
--     Das ist eine reine ZEILENSCHRANKE; die Policy nennt keine einzige Spalte.
--   * BEFORE-Trigger trg_protect_profile (0001_init.sql:420-434): nur ein
--     Administrator - oder ein Kontext ohne Identitaet - darf role oder
--     is_active aendern; sonst 42501.
--   * public.auth_accounts und public.auth_sessions tragen KEINE RLS, sondern
--     ausschliesslich Rechte (0012:101-102).
-- =====================================================================
set role app_user;

-- ---------------------------------------------------------------------
-- U1-U7: Rechte- und Strukturfaelle. Sie brauchen weder eine Identitaet noch
-- eine Zeile: has_*_privilege und die Systemkataloge sind fuer jede Rolle
-- lesbar. Beide has_*-Funktionen beruecksichtigen die Rollenmitgliedschaft,
-- decken also auch ein mittelbar ueber authenticated geerbtes Recht auf.
-- ---------------------------------------------------------------------

-- U1: das eine Recht, ohne das der Rollenwechsel mit 42501 scheitern wuerde -
-- und zwar noch bevor profiles_update ueberhaupt geprueft wird.
do $$
begin
  if not has_column_privilege('app_user', 'public.profiles', 'role', 'update') then
    raise exception 'SMOKE U1 FAIL app_user darf public.profiles.role nicht aendern';
  end if;

  raise notice 'SMOKE U1 OK app_user besitzt das update-Recht auf public.profiles.role';
end
$$;

-- U2: NEGATIV - es gibt KEIN tabellenweites update auf public.profiles.
--
-- has_table_privilege beantwortet ausschliesslich die Frage nach dem
-- Tabellenrecht und liefert bei einem rein spaltenbezogen erteilten update
-- false. Genau hier - und nur hier - ist das der richtige Nachweis: er belegt,
-- dass das tabellenweite Recht wirklich fehlt. Der Spaltenabgleich in U3
-- allein koennte das nicht zeigen, denn has_column_privilege liefert bei einem
-- tabellenweiten Recht fuer JEDE Spalte true.
do $$
begin
  if has_table_privilege('app_user', 'public.profiles', 'update') then
    raise exception
      'SMOKE U2 FAIL app_user besitzt ein TABELLENWEITES update auf public.profiles - die Spaltenbegrenzung ist ausgehebelt';
  end if;

  raise notice 'SMOKE U2 OK kein tabellenweites update auf public.profiles';
end
$$;

-- U3: NEGATIV je Spalte. Ausdruecklich genannt sind is_active, full_name, phone
-- und id; zusaetzlich laeuft ein Katalogabgleich ueber pg_attribute, damit eine
-- spaeter ergaenzte Spalte nicht unbemerkt mitfreigegeben wird.
--
-- is_active ist der wichtigste Eintrag dieser Liste: die administrative
-- Deaktivierung dieses Arbeitspakets laeuft ueber
-- public.auth_accounts.is_disabled und NICHT ueber public.profiles.is_active.
-- Waere is_active fuer app_user aenderbar, koennte jede Identitaet ihr eigenes
-- Profil wieder aktivieren - profiles_update ist fuer die eigene Zeile
-- erfuellt, und trg_protect_profile greift bei einem Administrator nicht.
do $$
declare
  v_column text;
  item record;
  unexpected text[] := array[]::text[];
begin
  foreach v_column in array array['is_active', 'full_name', 'phone', 'id']
  loop
    if has_column_privilege('app_user', 'public.profiles', v_column, 'update') then
      unexpected := array_append(unexpected, v_column);
    end if;
  end loop;

  for item in
    select a.attname::text as column_name
    from pg_attribute a
    where a.attrelid = 'public.profiles'::regclass
      and a.attnum > 0
      and not a.attisdropped
      and a.attname::text <> 'role'
    order by a.attnum
  loop
    if has_column_privilege('app_user', 'public.profiles', item.column_name, 'update')
       and item.column_name <> all (unexpected) then
      unexpected := array_append(unexpected, item.column_name);
    end if;
  end loop;

  if array_length(unexpected, 1) is not null then
    raise exception
      'SMOKE U3 FAIL app_user darf unerwartete Spalte(n) von public.profiles aendern: %',
      array_to_string(unexpected, ', ');
  end if;

  raise notice
    'SMOKE U3 OK ausser role ist keine Spalte von public.profiles fuer app_user aenderbar (Katalogabgleich ueber pg_attribute)';
end
$$;

-- U4: NEGATIV - keine Kontoanlage und kein physisches Loeschen eines Benutzers.
-- Die Policies profiles_insert und profiles_delete (0001_init.sql:510-516)
-- bestehen unveraendert weiter und waeren fuer eine Administratoridentitaet
-- sogar erfuellt; die tragende Schranke ist deshalb das fehlende Tabellenrecht.
do $$
declare
  privilege text;
  unexpected text[] := array[]::text[];
begin
  foreach privilege in array array['insert', 'delete', 'truncate', 'references', 'trigger']
  loop
    if has_table_privilege('app_user', 'public.profiles', privilege) then
      unexpected := array_append(unexpected, privilege);
    end if;
  end loop;

  if array_length(unexpected, 1) is not null then
    raise exception 'SMOKE U4 FAIL app_user besitzt auf public.profiles: %',
      array_to_string(unexpected, ', ');
  end if;

  raise notice
    'SMOKE U4 OK kein insert und kein delete auf public.profiles - keine Kontoanlage, kein physisches Loeschen';
end
$$;

-- U5: NEGATIV - der Audit bleibt fuer die Anwendungsrolle vollstaendig
-- unerreichbar. Geprueft werden die sieben klassischen Tabellenprivilegien; das
-- seit PostgreSQL 17 zusaetzliche MAINTAIN wird bewusst NICHT geprueft (es
-- erlaubt nur Wartungsbefehle, und has_table_privilege bricht bei einem der
-- Zielversion unbekannten Privilegnamen ab).
do $$
declare
  privilege text;
  unexpected text[] := array[]::text[];
  v_rows integer;
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
    raise exception 'SMOKE U5 FAIL app_user besitzt auf public.audit_events: %',
      array_to_string(unexpected, ', ');
  end if;

  -- Gegenprobe an der laufenden Datenbank: auch der Lesezugriff scheitert.
  begin
    select count(*) into v_rows from public.audit_events;
    raise exception 'SMOKE U5 FAIL app_user liest audit_events (% Zeile(n))', v_rows;
  exception
    -- insufficient_privilege ist genau SQLSTATE 42501.
    when insufficient_privilege then null;
  end;

  raise notice
    'SMOKE U5 OK app_user besitzt kein Recht auf public.audit_events und kann sie auch nicht lesen';
end
$$;

-- U6: die zehn Triggeraufhaengungen (neun verschiedene Triggernamen, denn
-- trg_protect_last_active_admin haengt an zwei Tabellen) sind vorhanden.
--
-- Der Schutz des letzten aktiven Administrators muss an BEIDEN Tabellen
-- haengen: fehlte er an public.auth_accounts, liesse sich der letzte
-- Administrator ueber die Kontosperre trotzdem entfernen.
--
-- Die beiden Waechter aus 0017 (Abschnitte 3b/3c) stehen ebenfalls in der
-- Liste. Eine Triggerfunktion ohne ihren Trigger ist wirkungslos, faellt aber
-- nirgends auf - deshalb wird die Aufhaengung getrennt von der Ausfuehrungsart
-- (U7) geprueft. Die NAMEN der beiden Waechter sind zusaetzlich lasttragend:
-- BEFORE-Trigger feuern in alphabetischer Namensfolge, und davon haengt ab,
-- welchen SQLSTATE ein Nicht-Administrator sieht (Nachweis in U29).
do $$
declare
  item record;
  missing text[] := array[]::text[];
begin
  for item in
    select * from (values
      ('public.auth_accounts', 'trg_audit_auth_password_changed'),
      ('public.auth_accounts', 'trg_audit_auth_account_disabled'),
      ('public.profiles', 'trg_audit_profile_admin_change'),
      ('public.profiles', 'trg_protect_last_active_admin'),
      ('public.auth_accounts', 'trg_protect_last_active_admin'),
      ('public.auth_accounts', 'trg_protect_auth_account_admin_change'),
      ('public.profiles', 'trg_protect_profile_active_admin'),
      -- Der Sperr-Audit aus 0017/2d sowie der Plausibilitaets- und der
      -- Massenwaechter aus 0017/3d und 3e. Fehlte der Statement-Trigger aus 3e,
      -- bliebe die Zeilenpruefung aus 3d fuer eine Anweisung ohne
      -- where-Bedingung wirkungslos (Nachweis in U37).
      ('public.auth_accounts', 'trg_audit_auth_account_lockout'),
      ('public.auth_accounts', 'trg_protect_auth_account_lockout'),
      ('public.auth_accounts', 'trg_protect_auth_account_lockout_bulk')
    ) as t(table_name, trigger_name)
  loop
    if not exists (
      select 1 from pg_trigger tg
      where tg.tgrelid = item.table_name::regclass
        and tg.tgname = item.trigger_name
        and not tg.tgisinternal
    ) then
      missing := array_append(missing, item.table_name || ' ' || item.trigger_name);
    end if;
  end loop;

  if array_length(missing, 1) is not null then
    raise exception 'SMOKE U6 FAIL Trigger fehlen: %', array_to_string(missing, ', ');
  end if;

  raise notice
    'SMOKE U6 OK alle zehn Triggeraufhaengungen vorhanden, der Schutz des letzten Administrators an profiles UND auth_accounts, alle vier Waechter aus 0017 und der Sperr-Audit aufgehaengt';
end
$$;

-- U7: JEDE der zehn Funktionen laeuft in der fuer sie richtigen
-- Ausfuehrungsart. Geprueft werden ZWEI GETRENNTE Erwartungen, denn hier ist
-- beides ein Fehler - ein fehlender wie ein zu viel gesetzter SECURITY DEFINER.
--
-- SECURITY DEFINER ist Pflicht fuer die fuenf Triggerfunktionen der Abschnitte 2
-- und 3 sowie fuer die Hilfsfunktion public.is_active_admin_actor (3a):
--   Ohne prosecdef wuerde der Audit an der fehlenden Insert-Policy von
--   public.audit_events scheitern, die Zaehlung des Schutztriggers durch die RLS
--   von public.profiles gefiltert und die Rollenauskunft aus 3a auf einer
--   gefilterten Sicht entschieden - alles drei wuerde nicht auffallen, sondern
--   still falsch arbeiten. Beim Sperr-Audit aus 2d waere die Folge sogar sofort
--   sichtbar: JEDE Sperre und JEDE Entsperrung des Anmeldebetriebs braeche mit
--   42501 ab.
--
-- SECURITY INVOKER ist Pflicht fuer die vier Waechter aus 3b, 3c, 3d und 3e.
-- WARUM EIN SECURITY DEFINER DORT EIN FEHLER WAERE - und zwar der schwerste
-- dieser Datei:
--   Alle vier Waechter vergleichen in ihrer Eigentuemerausnahme `current_user`
--   mit dem Eigentuemer der betroffenen Tabelle und lassen den
--   Eigentuemerkontext durch (Migration, Bootstrap, Fixtures). In einer
--   SECURITY-DEFINER-Funktion ist `current_user` aber NICHT die aufrufende
--   Rolle, sondern der FUNKTIONSEIGENTUEMER - und der ist genau der
--   Tabelleneigentuemer. Die Eigentuemerausnahme waere damit IMMER erfuellt,
--   jeder Aufruf kaeme dort durch, und weder public.is_active_admin_actor()
--   (3b/3c) noch die Plausibilitaetspruefung (3d) noch die Mengenpruefung (3e)
--   wuerde je erreicht: der Waechter waere vollstaendig wirkungslos - ohne eine
--   einzige Fehlermeldung im Betrieb. Ein solcher Waechter waere gruen,
--   vorhanden, aufgehaengt und nutzlos. Deshalb laesst dieser Fall den Lauf in
--   diesem Fall scheitern.
--
-- Zusaetzlich das Ausfuehrungsrecht auf die Hilfsfunktion: ein Trigger prueft
-- beim Ausloesen KEIN execute-Recht (das wird einmalig bei `create trigger`
-- geprueft), der Funktionsaufruf in seinem Koerper dagegen schon. Fehlte
-- app_user dieses Recht, scheiterte jeder Waechteraufruf erst zur Laufzeit,
-- mitten im Betrieb, mit 42501.
do $$
declare
  v_name text;
  v_secdef boolean;
  missing text[] := array[]::text[];
  not_definer text[] := array[]::text[];
  not_invoker text[] := array[]::text[];
begin
  foreach v_name in array array[
    'tg_audit_auth_password_changed',
    'tg_audit_auth_account_disabled',
    'tg_audit_profile_admin_change',
    'tg_audit_auth_account_lockout',
    'tg_protect_last_active_admin',
    'is_active_admin_actor'
  ]
  loop
    select p.prosecdef
    into v_secdef
    from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public' and p.proname = v_name;

    if not found then
      missing := array_append(missing, v_name);
    elsif not v_secdef then
      not_definer := array_append(not_definer, v_name);
    end if;
  end loop;

  foreach v_name in array array[
    'tg_protect_auth_account_admin_change',
    'tg_protect_profile_active_admin',
    'tg_protect_auth_account_lockout',
    'tg_protect_auth_account_lockout_bulk'
  ]
  loop
    select p.prosecdef
    into v_secdef
    from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public' and p.proname = v_name;

    if not found then
      missing := array_append(missing, v_name);
    elsif v_secdef then
      not_invoker := array_append(not_invoker, v_name);
    end if;
  end loop;

  if array_length(missing, 1) is not null then
    raise exception 'SMOKE U7 FAIL Funktion(en) fehlen: %',
      array_to_string(missing, ', ');
  end if;
  if array_length(not_definer, 1) is not null then
    raise exception 'SMOKE U7 FAIL Funktion(en) ohne SECURITY DEFINER: %',
      array_to_string(not_definer, ', ');
  end if;
  if array_length(not_invoker, 1) is not null then
    raise exception
      'SMOKE U7 FAIL Waechter mit SECURITY DEFINER statt SECURITY INVOKER - die Eigentuemerausnahme waere immer erfuellt und der Waechter wirkungslos: %',
      array_to_string(not_invoker, ', ');
  end if;

  if not has_function_privilege('app_user', 'public.is_active_admin_actor()', 'execute') then
    raise exception
      'SMOKE U7 FAIL app_user fehlt das execute-Recht auf public.is_active_admin_actor() - die Waechter aus 3b, 3c und 3d scheiterten zur Laufzeit mit 42501';
  end if;

  raise notice
    'SMOKE U7 OK sechs Funktionen als SECURITY DEFINER, vier Waechter als SECURITY INVOKER, app_user darf public.is_active_admin_actor() aufrufen';
end
$$;

-- ---------------------------------------------------------------------
-- U8-U14: Wirkungsfaelle mit gesetzter Identitaet.
--
-- Der Audit wird jeweils im EIGENTUEMERKONTEXT gegengeprueft (`reset role` /
-- `set role app_user` innerhalb des Blocks, Muster aus 19_ap14b_platform.sql,
-- Faelle P16 und P18): app_user darf public.audit_events nicht lesen (U5), die
-- Gegenprobe waere sonst nicht moeglich.
-- ---------------------------------------------------------------------

-- U8: der Administrator aendert die Rolle eines Monteurs auf disponent.
--
-- Drei Schranken muessen gleichzeitig erfuellt sein, und alle drei sind
-- verschieden: das SPALTENRECHT auf role (0017), die ZEILENPOLICY
-- profiles_update (is_admin()) und der BEFORE-Trigger trg_protect_profile
-- (is_admin()). Danach muss GENAU EIN Auditsatz entstanden sein.
do $$
declare
  v_admin uuid := '23b00000-0000-0000-0000-000000000001';
  v_monteur uuid := '23b00000-0000-0000-0000-000000000003';
  v_rows integer;
  v_role public.user_role;
  v_audit integer;
  v_actor uuid;
  v_previous text;
  v_new text;
begin
  perform set_config('app.user_id', v_admin::text, true);

  update public.profiles
     set role = 'disponent'::public.user_role
   where id = v_monteur;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'SMOKE U8 FAIL % betroffene Zeile(n) statt genau einer', v_rows;
  end if;

  select role into v_role from public.profiles where id = v_monteur;
  if v_role is distinct from 'disponent' then
    raise exception 'SMOKE U8 FAIL role=% statt disponent', coalesce(v_role::text, 'NULL');
  end if;

  reset role;
  select count(*) into v_audit
  from public.audit_events
  where entity = 'profiles' and entity_id = v_monteur and action = 'role_changed';
  select a.actor, a.detail->>'previous_role', a.detail->>'new_role'
  into v_actor, v_previous, v_new
  from public.audit_events a
  where a.entity = 'profiles' and a.entity_id = v_monteur and a.action = 'role_changed'
  limit 1;
  set role app_user;

  if v_audit <> 1 then
    raise exception 'SMOKE U8 FAIL % Auditsatz/-saetze statt genau einem', v_audit;
  end if;
  if v_actor is distinct from v_admin then
    raise exception 'SMOKE U8 FAIL actor=% statt %', coalesce(v_actor::text, 'NULL'), v_admin;
  end if;
  if v_previous is distinct from 'monteur' or v_new is distinct from 'disponent' then
    raise exception 'SMOKE U8 FAIL previous_role=% new_role=%',
      coalesce(v_previous, 'NULL'), coalesce(v_new, 'NULL');
  end if;

  raise notice
    'SMOKE U8 OK Administrator aendert die Rolle eines Monteurs auf disponent, genau ein Auditsatz role_changed mit korrektem actor';
end
$$;

-- U9: IDEMPOTENZ AUF AUDITEBENE - dieselbe Rolle ein zweites Mal zuzuweisen
-- laeuft durch (die Zeile wird angefasst, updated_at zieht nach), erzeugt aber
-- KEINEN zweiten Auditsatz. Die Schranke ist `is distinct from` in
-- tg_audit_profile_admin_change.
do $$
declare
  v_admin uuid := '23b00000-0000-0000-0000-000000000001';
  v_monteur uuid := '23b00000-0000-0000-0000-000000000003';
  v_rows integer;
  v_audit integer;
begin
  perform set_config('app.user_id', v_admin::text, true);

  update public.profiles
     set role = 'disponent'::public.user_role
   where id = v_monteur;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception
      'SMOKE U9 FAIL die wiederholte Zuweisung betrifft % Zeile(n) statt genau einer', v_rows;
  end if;

  reset role;
  select count(*) into v_audit
  from public.audit_events
  where entity = 'profiles' and entity_id = v_monteur and action = 'role_changed';
  set role app_user;

  if v_audit <> 1 then
    raise exception
      'SMOKE U9 FAIL % Auditsatz/-saetze nach der wiederholten Zuweisung statt unveraendert einem', v_audit;
  end if;

  raise notice
    'SMOKE U9 OK dieselbe Rolle ein zweites Mal zuzuweisen erzeugt keinen weiteren Auditsatz';
end
$$;

-- U10: NEGATIV SELBSTVERSUCH - ein Monteur darf seine eigene Rolle nicht
-- aendern.
--
-- Die Abweisung stammt aus dem BEFORE-Trigger trg_protect_profile und NICHT aus
-- dem Spaltenrecht: das update-Recht auf role besitzt app_user fuer ALLE
-- Identitaeten, denn es ist dieselbe Datenbankrolle (U1). Auch profiles_update
-- ist erfuellt, denn es ist die eigene Zeile. Erwartet wird SQLSTATE 42501,
-- danach eine unveraenderte Rolle und - weil ein BEFORE-Trigger die Anweisung
-- abbricht und der AFTER-Trigger deshalb nie laeuft - kein Auditsatz.
do $$
declare
  v_monteur uuid := '23b00000-0000-0000-0000-000000000004';
  v_role_before public.user_role;
  v_role_after public.user_role;
  v_audit integer;
  v_reached boolean := false;
begin
  perform set_config('app.user_id', v_monteur::text, true);

  select role into v_role_before from public.profiles where id = v_monteur;
  if v_role_before is distinct from 'monteur' then
    raise exception 'SMOKE U10 FAIL Ausgangsrolle=% statt monteur',
      coalesce(v_role_before::text, 'NULL');
  end if;

  begin
    update public.profiles
       set role = 'admin'::public.user_role
     where id = v_monteur;
    v_reached := true;
  exception
    when insufficient_privilege then null;
  end;

  if v_reached then
    raise exception 'SMOKE U10 FAIL der Monteur konnte seine eigene Rolle aendern';
  end if;

  select role into v_role_after from public.profiles where id = v_monteur;
  if v_role_after is distinct from v_role_before then
    raise exception 'SMOKE U10 FAIL role=% statt unveraendert %',
      coalesce(v_role_after::text, 'NULL'), v_role_before;
  end if;

  reset role;
  select count(*) into v_audit
  from public.audit_events
  where entity = 'profiles' and entity_id = v_monteur;
  set role app_user;

  if v_audit <> 0 then
    raise exception
      'SMOKE U10 FAIL der abgewiesene Versuch hinterlaesst % Auditsatz/-saetze', v_audit;
  end if;

  raise notice
    'SMOKE U10 OK die Selbstaenderung der Rolle endet mit 42501 (trg_protect_profile), ohne Wirkung und ohne Auditsatz';
end
$$;

-- U11: KONTOSPERRE UND ENTSPERRE - der wirksamste administrative Eingriff.
--
-- is_disabled beendet Stufe 1 der Sitzungspruefung und damit jede laufende
-- Sitzung sofort (19_ap14b_platform.sql, Fall P12/E22d). Erwartet wird je genau
-- ein Auditsatz: account_disabled beim Sperren, account_enabled beim Entsperren.
do $$
declare
  v_admin uuid := '23b00000-0000-0000-0000-000000000001';
  v_target uuid := '23b00000-0000-0000-0000-000000000004';
  v_disabled boolean;
  v_audit_off integer;
  v_audit_on integer;
  v_actor uuid;
  v_detail text;
begin
  perform set_config('app.user_id', v_admin::text, true);

  update public.auth_accounts set is_disabled = true where id = v_target;
  select is_disabled into v_disabled from public.auth_accounts where id = v_target;
  if v_disabled is distinct from true then
    raise exception 'SMOKE U11 FAIL is_disabled=% statt true', coalesce(v_disabled::text, 'NULL');
  end if;

  update public.auth_accounts set is_disabled = false where id = v_target;
  select is_disabled into v_disabled from public.auth_accounts where id = v_target;
  if v_disabled is distinct from false then
    raise exception 'SMOKE U11 FAIL is_disabled=% statt false', coalesce(v_disabled::text, 'NULL');
  end if;

  reset role;
  select
    count(*) filter (where action = 'account_disabled'),
    count(*) filter (where action = 'account_enabled')
  into v_audit_off, v_audit_on
  from public.audit_events
  where entity = 'auth_accounts' and entity_id = v_target;
  select a.actor, a.detail->>'is_disabled'
  into v_actor, v_detail
  from public.audit_events a
  where a.entity = 'auth_accounts' and a.entity_id = v_target
    and a.action = 'account_disabled'
  limit 1;
  set role app_user;

  if v_audit_off <> 1 or v_audit_on <> 1 then
    raise exception
      'SMOKE U11 FAIL account_disabled=% account_enabled=%, erwartet je 1',
      v_audit_off, v_audit_on;
  end if;
  if v_actor is distinct from v_admin then
    raise exception 'SMOKE U11 FAIL actor=% statt %', coalesce(v_actor::text, 'NULL'), v_admin;
  end if;
  if v_detail is distinct from 'true' then
    raise exception 'SMOKE U11 FAIL detail is_disabled=%', coalesce(v_detail, 'NULL');
  end if;

  raise notice
    'SMOKE U11 OK Kontosperre und Entsperre erzeugen je genau einen Auditsatz mit korrektem actor';
end
$$;

-- U12: IDEMPOTENZ AUF AUDITEBENE - denselben is_disabled-Wert erneut zu setzen
-- fasst die Zeile an (updated_at zieht nach), erzeugt aber keinen weiteren
-- Auditsatz. Ohne diese Schranke ergaebe jede Anmeldung, jeder Fehlversuch und
-- jede Hash-Erneuerung einen Auditsatz ohne Aussagewert.
do $$
declare
  v_admin uuid := '23b00000-0000-0000-0000-000000000001';
  v_target uuid := '23b00000-0000-0000-0000-000000000004';
  v_rows integer;
  v_audit integer;
begin
  perform set_config('app.user_id', v_admin::text, true);

  update public.auth_accounts set is_disabled = false where id = v_target;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'SMOKE U12 FAIL % betroffene Zeile(n) statt genau einer', v_rows;
  end if;

  -- Eine voellig unbeteiligte Aenderung derselben Zeile darf ebenfalls keinen
  -- Auditsatz erzeugen.
  update public.auth_accounts set failed_attempts = 1 where id = v_target;
  update public.auth_accounts set failed_attempts = 0 where id = v_target;

  reset role;
  select count(*) into v_audit
  from public.audit_events
  where entity = 'auth_accounts' and entity_id = v_target
    and action in ('account_disabled', 'account_enabled');
  set role app_user;

  if v_audit <> 2 then
    raise exception
      'SMOKE U12 FAIL % Sperr-/Entsperrsatz/-saetze statt unveraendert zwei', v_audit;
  end if;

  raise notice
    'SMOKE U12 OK derselbe is_disabled-Wert und unbeteiligte Aenderungen erzeugen keinen weiteren Auditsatz';
end
$$;

-- U13: ADMINISTRATIVER PASSWORT-RESET auf einem FREMDEN Konto.
--
-- Ausgeloest wird der Auditsatz ausschliesslich von password_changed_at; die
-- Hash-Erneuerung beim Anmelden (needsRehash) bleibt unauditiert
-- (19_ap14b_platform.sql, Fall P18). Neu in 0017 ist die Unterscheidung: weil
-- die handelnde Identitaet gesetzt und eine ANDERE als das betroffene Konto
-- ist, lautet die Action 'password_reset_by_admin' und detail->>'reset_by_admin'
-- ist true.
--
-- Das Hashliteral ist synthetisch und ausdruecklich als solches erkennbar. U17
-- prueft, dass es in KEINEM Auditsatz auftaucht.
do $$
declare
  v_admin uuid := '23b00000-0000-0000-0000-000000000001';
  v_target uuid := '23b00000-0000-0000-0000-000000000004';
  v_hash text := '$argon2id$u23-synthetisch-reset';
  v_reset integer;
  v_changed integer;
  v_actor uuid;
  v_flag text;
  v_must boolean;
begin
  perform set_config('app.user_id', v_admin::text, true);

  update public.auth_accounts
     set password_hash = v_hash,
         password_hash_version = 1,
         must_change_password = true,
         password_changed_at = now()
   where id = v_target;

  select must_change_password into v_must
  from public.auth_accounts where id = v_target;
  if v_must is distinct from true then
    raise exception 'SMOKE U13 FAIL must_change_password=% statt true',
      coalesce(v_must::text, 'NULL');
  end if;

  reset role;
  select
    count(*) filter (where action = 'password_reset_by_admin'),
    count(*) filter (where action = 'password_changed')
  into v_reset, v_changed
  from public.audit_events
  where entity = 'auth_accounts' and entity_id = v_target;
  select a.actor, a.detail->>'reset_by_admin'
  into v_actor, v_flag
  from public.audit_events a
  where a.entity = 'auth_accounts' and a.entity_id = v_target
    and a.action = 'password_reset_by_admin'
  limit 1;
  set role app_user;

  if v_reset <> 1 then
    raise exception 'SMOKE U13 FAIL % Auditsatz/-saetze password_reset_by_admin statt genau einem', v_reset;
  end if;
  if v_changed <> 0 then
    raise exception
      'SMOKE U13 FAIL der Reset wurde zusaetzlich als password_changed gefuehrt (% Satz/Saetze)', v_changed;
  end if;
  if v_actor is distinct from v_admin then
    raise exception 'SMOKE U13 FAIL actor=% statt %', coalesce(v_actor::text, 'NULL'), v_admin;
  end if;
  if v_flag is distinct from 'true' then
    raise exception 'SMOKE U13 FAIL detail reset_by_admin=%', coalesce(v_flag, 'NULL');
  end if;

  raise notice
    'SMOKE U13 OK der Reset eines fremden Kontos wird als password_reset_by_admin mit reset_by_admin=true auditiert';
end
$$;

-- U14: SELBSTWECHSEL - dieselbe Aenderung mit der Identitaet des betroffenen
-- Kontos ergibt 'password_changed' und reset_by_admin=false. Genau diese
-- Unterscheidung ist der ganze Zweck von 0017, Abschnitt 2a.
--
-- Der Block ist eine EIGENE Transaktion; now() liefert deshalb einen anderen
-- Zeitpunkt als in U13, und password_changed_at ist wirklich `is distinct from`
-- dem Vorwert.
do $$
declare
  v_self uuid := '23b00000-0000-0000-0000-000000000004';
  v_hash text := '$argon2id$u23-synthetisch-selbst';
  v_reset integer;
  v_changed integer;
  v_actor uuid;
  v_flag text;
begin
  perform set_config('app.user_id', v_self::text, true);

  update public.auth_accounts
     set password_hash = v_hash,
         password_hash_version = 1,
         must_change_password = false,
         password_changed_at = now(),
         failed_attempts = 0,
         locked_until = null
   where id = v_self;

  reset role;
  select
    count(*) filter (where action = 'password_reset_by_admin'),
    count(*) filter (where action = 'password_changed')
  into v_reset, v_changed
  from public.audit_events
  where entity = 'auth_accounts' and entity_id = v_self;
  select a.actor, a.detail->>'reset_by_admin'
  into v_actor, v_flag
  from public.audit_events a
  where a.entity = 'auth_accounts' and a.entity_id = v_self
    and a.action = 'password_changed'
  limit 1;
  set role app_user;

  if v_changed <> 1 then
    raise exception
      'SMOKE U14 FAIL % Auditsatz/-saetze password_changed statt genau einem', v_changed;
  end if;
  if v_reset <> 1 then
    raise exception
      'SMOKE U14 FAIL % Auditsatz/-saetze password_reset_by_admin statt unveraendert einem', v_reset;
  end if;
  if v_actor is distinct from v_self then
    raise exception 'SMOKE U14 FAIL actor=% statt %', coalesce(v_actor::text, 'NULL'), v_self;
  end if;
  if v_flag is distinct from 'false' then
    raise exception 'SMOKE U14 FAIL detail reset_by_admin=%', coalesce(v_flag, 'NULL');
  end if;

  raise notice
    'SMOKE U14 OK der Selbstwechsel wird als password_changed mit reset_by_admin=false auditiert';
end
$$;

-- =====================================================================
-- U15/U16: SCHUTZ DES LETZTEN AKTIVEN ADMINISTRATORS.
--
-- WARUM DIESE BEIDEN FAELLE IN EINER AUSDRUECKLICHEN TRANSAKTION MIT ROLLBACK
-- LAUFEN:
--   Der Schutztrigger zaehlt die aktiven Administratoren der GESAMTEN
--   Datenbank. Um den Fall "genau ein aktiver Administrator" herzustellen,
--   muessen alle uebrigen Administratoren voruebergehend deaktiviert werden -
--   auch die Fixtures der Smokes 15-22 und ein etwaiger Bootstrap-Administrator.
--   Dieser Eingriff darf die Datenbank nicht ueberdauern: die
--   Node-Integrationstests laufen danach in DERSELBEN Datenbank. Die
--   Transaktion wird deshalb am Ende vollstaendig zurueckgerollt; danach ist
--   der Bestand exakt wie vorher, einschliesslich der hier entstandenen
--   Auditsaetze.
--   Die Vorbereitung laeuft zwingend im EIGENTUEMERKONTEXT: sie setzt
--   public.profiles.is_active, und genau das darf app_user nach 0017 nicht (U3).
--   Die eigentlichen Versuche laufen unter app_user.
-- =====================================================================
reset role;
select set_config('app.user_id', '', false);

begin;

-- U15: mit genau EINEM aktiven Administrator scheitern BEIDE Wege - die
-- Herabstufung ueber public.profiles.role und die Sperre ueber
-- public.auth_accounts.is_disabled - mit SQLSTATE KB001, und der Zustand ist
-- danach unveraendert.
do $$
declare
  v_admin uuid := '23b00000-0000-0000-0000-000000000001';
  v_active integer;
  v_role public.user_role;
  v_disabled boolean;
  v_state text;
  v_audit integer;
begin
  -- Vorbedingung: der Testadministrator ist selbst ein aktiver Administrator.
  select count(*) into v_active
  from public.profiles p
  join public.auth_accounts a on a.id = p.id
  where p.id = v_admin and p.role = 'admin' and p.is_active and not a.is_disabled;
  if v_active <> 1 then
    raise exception 'SMOKE U15 FAIL der Testadministrator ist kein aktiver Administrator';
  end if;

  -- Alle uebrigen aktiven Administratoren voruebergehend deaktivieren. Der
  -- Schutztrigger laesst das zu, weil danach noch genau einer uebrig ist.
  update public.profiles
     set is_active = false
   where role = 'admin' and is_active and id <> v_admin;

  select count(*) into v_active
  from public.profiles p
  join public.auth_accounts a on a.id = p.id
  where p.role = 'admin' and p.is_active and not a.is_disabled;
  if v_active <> 1 then
    raise exception
      'SMOKE U15 FAIL % aktive Administratoren statt genau einem - der Fall waere nicht aussagekraeftig',
      v_active;
  end if;

  set role app_user;
  perform set_config('app.user_id', v_admin::text, true);

  -- Weg 1: Herabstufung.
  v_state := null;
  begin
    update public.profiles
       set role = 'monteur'::public.user_role
     where id = v_admin;
  exception
    when others then v_state := sqlstate;
  end;
  if v_state is distinct from 'KB001' then
    raise exception
      'SMOKE U15 FAIL Herabstufung des letzten Administrators: SQLSTATE % statt KB001',
      coalesce(v_state, 'kein Fehler');
  end if;

  -- Weg 2: Kontosperre.
  v_state := null;
  begin
    update public.auth_accounts set is_disabled = true where id = v_admin;
  exception
    when others then v_state := sqlstate;
  end;
  if v_state is distinct from 'KB001' then
    raise exception
      'SMOKE U15 FAIL Sperre des letzten Administrators: SQLSTATE % statt KB001',
      coalesce(v_state, 'kein Fehler');
  end if;

  -- Der Zustand ist unveraendert.
  select p.role, a.is_disabled
  into v_role, v_disabled
  from public.profiles p
  join public.auth_accounts a on a.id = p.id
  where p.id = v_admin;
  if v_role is distinct from 'admin' or v_disabled is distinct from false then
    raise exception 'SMOKE U15 FAIL role=% is_disabled=% statt admin/false',
      coalesce(v_role::text, 'NULL'), coalesce(v_disabled::text, 'NULL');
  end if;

  -- Ein abgewiesener Versuch hinterlaesst keinen Auditsatz: die Ausnahme des
  -- Schutztriggers rollt die Subtransaktion einschliesslich des bereits
  -- geschriebenen Auditsatzes zurueck.
  reset role;
  select count(*) into v_audit
  from public.audit_events
  where entity_id = v_admin and action in ('role_changed', 'account_disabled');
  if v_audit <> 0 then
    raise exception
      'SMOKE U15 FAIL die abgewiesenen Versuche hinterlassen % Auditsatz/-saetze', v_audit;
  end if;

  raise notice
    'SMOKE U15 OK Herabstufung und Sperre des letzten aktiven Administrators scheitern beide mit KB001, ohne Wirkung und ohne Auditsatz';
end
$$;

-- U16: mit ZWEI aktiven Administratoren gelingt die Herabstufung des einen; die
-- anschliessende Herabstufung des verbliebenen scheitert mit KB001. Der Fall
-- belegt, dass der Trigger nicht pauschal jede Herabstufung verweigert, sondern
-- ausschliesslich die letzte.
do $$
declare
  v_admin uuid := '23b00000-0000-0000-0000-000000000001';
  v_admin2 uuid := '23b00000-0000-0000-0000-000000000002';
  v_active integer;
  v_rows integer;
  v_role public.user_role;
  v_state text;
begin
  -- Vorbereitung im Eigentuemerkontext: den zweiten Administrator wieder
  -- aktivieren (U15 hat ihn mit deaktiviert).
  reset role;
  perform set_config('app.user_id', '', true);

  update public.profiles set is_active = true where id = v_admin2;

  select count(*) into v_active
  from public.profiles p
  join public.auth_accounts a on a.id = p.id
  where p.role = 'admin' and p.is_active and not a.is_disabled;
  if v_active <> 2 then
    raise exception
      'SMOKE U16 FAIL % aktive Administratoren statt genau zwei - der Fall waere nicht aussagekraeftig',
      v_active;
  end if;

  set role app_user;
  perform set_config('app.user_id', v_admin::text, true);

  -- Der vorletzte Administrator darf herabgestuft werden.
  update public.profiles
     set role = 'monteur'::public.user_role
   where id = v_admin2;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception
      'SMOKE U16 FAIL die Herabstufung des vorletzten Administrators betrifft % Zeile(n) statt einer',
      v_rows;
  end if;

  select role into v_role from public.profiles where id = v_admin2;
  if v_role is distinct from 'monteur' then
    raise exception 'SMOKE U16 FAIL role des zweiten Administrators=% statt monteur',
      coalesce(v_role::text, 'NULL');
  end if;

  -- Der verbliebene nicht mehr.
  v_state := null;
  begin
    update public.profiles
       set role = 'monteur'::public.user_role
     where id = v_admin;
  exception
    when others then v_state := sqlstate;
  end;
  if v_state is distinct from 'KB001' then
    raise exception
      'SMOKE U16 FAIL Herabstufung des verbliebenen Administrators: SQLSTATE % statt KB001',
      coalesce(v_state, 'kein Fehler');
  end if;

  select role into v_role from public.profiles where id = v_admin;
  if v_role is distinct from 'admin' then
    raise exception 'SMOKE U16 FAIL role des letzten Administrators=% statt admin',
      coalesce(v_role::text, 'NULL');
  end if;

  raise notice
    'SMOKE U16 OK bei zwei aktiven Administratoren gelingt die Herabstufung des einen, die des verbliebenen scheitert mit KB001';
end
$$;

-- Der Rollback nimmt die voruebergehende Deaktivierung aller uebrigen
-- Administratoren, die Herabstufung des zweiten Testadministrators und jeden in
-- U15/U16 entstandenen Auditsatz vollstaendig zurueck. Er gibt zugleich den
-- Advisory-Lock des Schutztriggers frei - er ist transaktionsgebunden und endet
-- auch beim Rollback.
rollback;

reset role;
select set_config('app.user_id', '', false);

-- U17: KEIN HASHMATERIAL IM AUDIT. Die beiden synthetischen Passwortliterale
-- aus U13 und U14 duerfen in keinem Auditsatz der gesamten Datenbank vorkommen -
-- weder als Wert noch als Feldname. Geprueft wird im Eigentuemerkontext, weil
-- app_user public.audit_events nicht lesen darf (U5).
do $$
declare
  v_leaks integer;
begin
  select count(*) into v_leaks
  from public.audit_events
  where detail::text like '%u23-synthetisch%';
  if v_leaks <> 0 then
    raise exception
      'SMOKE U17 FAIL % Auditsatz/-saetze enthalten das synthetische Passwortliteral', v_leaks;
  end if;

  select count(*) into v_leaks
  from public.audit_events
  where entity_id in (
      '23b00000-0000-0000-0000-000000000001',
      '23b00000-0000-0000-0000-000000000002',
      '23b00000-0000-0000-0000-000000000003',
      '23b00000-0000-0000-0000-000000000004',
      '23b00000-0000-0000-0000-000000000005',
      '23b00000-0000-0000-0000-000000000006',
      '23b00000-0000-0000-0000-000000000007'
    )
    and (detail ? 'password' or detail ? 'password_hash' or detail ? 'token'
         or detail::text like '%argon2%');
  if v_leaks <> 0 then
    raise exception
      'SMOKE U17 FAIL % Auditsatz/-saetze mit Passwort-, Hash- oder Tokenmaterial', v_leaks;
  end if;

  raise notice
    'SMOKE U17 OK kein Auditsatz enthaelt das synthetische Passwortliteral oder sonstiges Hashmaterial';
end
$$;

-- U18: app_user bleibt eine nicht privilegierte Rolle. Ohne diese Gegenprobe
-- waeren alle Faelle oben wertlos - mit SUPERUSER oder BYPASSRLS gilt keine
-- Policy und keine Spaltenbegrenzung.
do $$
declare
  v_flags record;
begin
  select rolsuper, rolbypassrls
  into v_flags
  from pg_roles where rolname = 'app_user';

  if not found then
    raise exception 'SMOKE U18 FAIL Rolle app_user fehlt';
  end if;
  if v_flags.rolsuper or v_flags.rolbypassrls then
    raise exception 'SMOKE U18 FAIL app_user ist privilegiert (super=% bypassrls=%)',
      v_flags.rolsuper, v_flags.rolbypassrls;
  end if;

  raise notice 'SMOKE U18 OK app_user ohne SUPERUSER und ohne BYPASSRLS';
end
$$;

-- =====================================================================
-- U19-U29: DIE BEIDEN DATENBANKWAECHTER AUS 0017 (Abschnitte 3b und 3c) UND DIE
-- RUECKNAHME DES `delete` AUS ABSCHNITT 1a.
--
-- GEGENSTAND: die Anwendung prueft vor jedem administrativen Eingriff mit
-- assertActiveAdmin, ob die handelnde Identitaet ein AKTIVER Administrator ist.
-- Das ist Anwendungslogik - sie kann vergessen, umgangen oder ueber einen
-- kuenftigen Weg gar nicht erst durchlaufen werden. Die Rechtematrix faengt das
-- NICHT auf: app_user besitzt `update` auf public.auth_accounts tabellenweit
-- (0012:102), und die Tabelle traegt keine Policy, die zwischen Selbst- und
-- Fremdaenderung unterscheidet. U19-U29 messen die zweite, unabhaengige Ebene in
-- der Datenbank.
--
-- WARUM HIER ERNEUT `set role app_user` STEHT - und warum das lasttragend ist:
--   U17 und U18 haben im EIGENTUEMERKONTEXT gemessen (U17 muss
--   public.audit_events lesen, was app_user nicht darf). Ohne diese Zeile liefe
--   die gesamte Fallgruppe als Eigentuemer - und BEIDE Waechter liessen dann
--   ueber ihre Eigentuemerausnahme (Schritt 2) jeden einzelnen Versuch durch.
--   Jeder Negativfall wuerde "kein Fehler" melden und rot; schlimmer waere der
--   umgekehrte Zuschnitt: haetten die Faelle keine Erwartung an den SQLSTATE,
--   waeren sie gruen, ohne irgendetwas gemessen zu haben. `set role app_user`
--   setzt `current_user` auf app_user; erst dadurch greift die Ausnahme nicht
--   mehr und die Waechter werden tatsaechlich gemessen.
--
-- ZAEHLWEISE DES AUDITS: RELATIV. U11-U14 haben fuer Konto ...0004 bereits
-- Auditsaetze erzeugt (je einen account_disabled, account_enabled,
-- password_reset_by_admin und password_changed). Ein absoluter Vergleich mit 0
-- waere schlicht falsch. Gezaehlt wird deshalb VOR dem Versuch und DANACH;
-- "kein Auditsatz" heisst hier nachweislich "kein ZUSAETZLICHER Auditsatz".
--
-- FEHLERBEHANDLUNG: jeder Negativfall faengt den erwarteten SQLSTATE
-- ausdruecklich ab UND faengt zusaetzlich `others`, um den tatsaechlich
-- aufgetretenen Code in die FAIL-Meldung zu schreiben. Ein Fall, der aus dem
-- falschen Grund gruen wird, ist wertlos - und ein Fall, der aus dem falschen
-- Grund rot wird, kostet ohne diese Angabe eine halbe Stunde Suche.
--
-- KEIN HASHMATERIAL IN DEN MELDUNGEN: die Faelle vergleichen password_hash
-- ausschliesslich auf Gleichheit und geben den Wert NIE aus. Alle benutzten
-- Literale sind synthetisch und als solche erkennbar.
-- =====================================================================
set role app_user;

-- U19: die Ruecknahme aus 0017, Abschnitt 1a - KATALOG UND WIRKLICHKEIT.
--
-- WARUM DIESES RECHT DIE SCHWERSTE LUECKE WAERE: public.profiles.id verweist
-- seit 0012 mit `on delete cascade` auf public.auth_accounts. Ein `delete` auf
-- ein Konto naehme KONTO UND PROFIL in einem Schritt mit - an jeder Schranke
-- dieses Arbeitspakets vorbei, denn trg_protect_last_active_admin und beide
-- Audittrigger sind AFTER UPDATE und feuern bei einem DELETE ueberhaupt nicht.
-- Der letzte aktive Administrator liesse sich spurlos entfernen, obwohl er sich
-- nicht einmal herabstufen laesst (U15).
--
-- Der Katalogbefund allein genuegt nicht: has_table_privilege sagt nur, was in
-- der ACL steht. Die Gegenprobe an der laufenden Datenbank belegt zusaetzlich,
-- dass die Kaskade wirklich nicht gefeuert hat - und sie laeuft ausdruecklich
-- mit der Identitaet eines GUELTIGEN Administrators: das Recht fehlt der
-- Datenbankrolle, nicht der Person, und keine Identitaet kann es zurueckholen.
do $$
declare
  v_admin uuid := '23b00000-0000-0000-0000-000000000001';
  v_target uuid := '23b00000-0000-0000-0000-000000000004';
  item record;
  missing text[] := array[]::text[];
  v_state text;
  v_accounts integer;
  v_profiles integer;
begin
  if has_table_privilege('app_user', 'public.auth_accounts', 'delete') then
    raise exception
      'SMOKE U19 FAIL app_user besitzt delete auf public.auth_accounts - ein Konto liesse sich samt Profil, ohne Auditsatz und ohne Adminschutz physisch loeschen (Reihenfolge der Testkette gegen 19a_ap14b_grant_reset.sql pruefen)';
  end if;

  -- Positiv zur Abgrenzung: es wurde nicht ZU VIEL entzogen. Ohne diese
  -- Gegenprobe fiele erst im Betrieb auf, dass Kontosperre, Passwort-Reset oder
  -- das Aufraeumen abgelaufener Sitzungen nicht mehr gehen.
  for item in
    select * from (values
      ('public.auth_accounts', 'select'),
      ('public.auth_accounts', 'update'),
      ('public.auth_sessions', 'delete')
    ) as t(object_name, privilege)
  loop
    if not has_table_privilege('app_user', item.object_name, item.privilege) then
      missing := array_append(missing, item.object_name || ' ' || item.privilege);
    end if;
  end loop;

  if array_length(missing, 1) is not null then
    raise exception
      'SMOKE U19 FAIL die Ruecknahme hat zu viel entzogen, es fehlt/fehlen: %',
      array_to_string(missing, ', ');
  end if;

  perform set_config('app.user_id', v_admin::text, true);

  v_state := null;
  begin
    delete from public.auth_accounts where id = v_target;
  exception
    when sqlstate '42501' then v_state := '42501';
    when others then v_state := sqlstate;
  end;
  if v_state is distinct from '42501' then
    raise exception
      'SMOKE U19 FAIL delete auf public.auth_accounts: SQLSTATE % statt 42501',
      coalesce(v_state, 'kein Fehler');
  end if;

  -- Konto UND Profil bestehen weiter - das ist der eigentliche Nachweis, dass
  -- die Kaskade profiles.id -> auth_accounts nicht gefeuert hat.
  select count(*) into v_accounts from public.auth_accounts where id = v_target;
  select count(*) into v_profiles from public.profiles where id = v_target;
  if v_accounts <> 1 or v_profiles <> 1 then
    raise exception
      'SMOKE U19 FAIL Konto=% Profil=% statt je genau einem - die Kaskade hat gefeuert',
      v_accounts, v_profiles;
  end if;

  raise notice
    'SMOKE U19 OK kein delete auf public.auth_accounts (Katalog), der Versuch endet mit 42501, Konto und Profil bestehen unveraendert weiter';
end
$$;

-- U20: NEGATIV - eine DISPONENTENIDENTITAET sperrt kein fremdes Konto.
--
-- Die Rechtematrix haelt diesen Versuch NICHT auf: das update-Recht auf
-- public.auth_accounts ist tabellenweit und gilt fuer dieselbe Datenbankrolle,
-- gleich welche Identitaet gesetzt ist. Die einzige Schranke ist der Waechter
-- aus 0017/3b, Schritt 4.
do $$
declare
  v_actor uuid := '23b00000-0000-0000-0000-000000000005';
  v_target uuid := '23b00000-0000-0000-0000-000000000004';
  v_before boolean;
  v_after boolean;
  v_audit_before integer;
  v_audit_after integer;
  v_state text;
begin
  reset role;
  select count(*) into v_audit_before
  from public.audit_events
  where entity = 'auth_accounts' and entity_id = v_target
    and action = 'account_disabled';
  set role app_user;

  perform set_config('app.user_id', v_actor::text, true);

  select is_disabled into v_before from public.auth_accounts where id = v_target;
  if v_before is distinct from false then
    raise exception 'SMOKE U20 FAIL Ausgangszustand is_disabled=% statt false',
      coalesce(v_before::text, 'NULL');
  end if;

  v_state := null;
  begin
    update public.auth_accounts set is_disabled = true where id = v_target;
  exception
    when sqlstate 'KB003' then v_state := 'KB003';
    when others then v_state := sqlstate;
  end;
  if v_state is distinct from 'KB003' then
    raise exception 'SMOKE U20 FAIL SQLSTATE % statt KB003',
      coalesce(v_state, 'kein Fehler - die Disponentenidentitaet hat ein fremdes Konto gesperrt');
  end if;

  select is_disabled into v_after from public.auth_accounts where id = v_target;
  if v_after is distinct from v_before then
    raise exception 'SMOKE U20 FAIL is_disabled=% statt unveraendert %',
      coalesce(v_after::text, 'NULL'), coalesce(v_before::text, 'NULL');
  end if;

  reset role;
  select count(*) into v_audit_after
  from public.audit_events
  where entity = 'auth_accounts' and entity_id = v_target
    and action = 'account_disabled';
  set role app_user;

  if v_audit_after <> v_audit_before then
    raise exception
      'SMOKE U20 FAIL der abgewiesene Versuch hinterlaesst % zusaetzliche(n) Auditsatz/-saetze account_disabled',
      v_audit_after - v_audit_before;
  end if;

  raise notice
    'SMOKE U20 OK eine Disponentenidentitaet sperrt kein fremdes Konto: KB003, ohne Wirkung, ohne zusaetzlichen Auditsatz';
end
$$;

-- U21: NEGATIV - eine Nicht-Administratoridentitaet setzt kein FREMDES Passwort
-- zurueck.
--
-- Handelnde Identitaet ist Konto ...0003. Sein Profil traegt seit U8 die Rolle
-- 'disponent' (davor 'monteur'); massgeblich ist allein, dass es NICHT 'admin'
-- ist - genau deshalb steht die Erwartung hier nicht an der Rolle, sondern am
-- SQLSTATE.
--
-- Der Versuch ist die vollstaendige Form des administrativen Resets aus U13
-- (Hash, Version, must_change_password, password_changed_at). Er muss an
-- Schritt 4 des Waechters scheitern: Schritt 1 greift nicht (Passwortfelder
-- aendern sich und es ist kein Anmelde-Rehash), Schritt 2 nicht (current_user
-- ist app_user), Schritt 3 nicht (fremdes Konto).
do $$
declare
  v_actor uuid := '23b00000-0000-0000-0000-000000000003';
  v_target uuid := '23b00000-0000-0000-0000-000000000004';
  v_hash_before text;
  v_hash_after text;
  v_changed_before timestamptz;
  v_changed_after timestamptz;
  v_reset_before integer;
  v_reset_after integer;
  v_changed_audit_before integer;
  v_changed_audit_after integer;
  v_state text;
begin
  reset role;
  select
    count(*) filter (where action = 'password_reset_by_admin'),
    count(*) filter (where action = 'password_changed')
  into v_reset_before, v_changed_audit_before
  from public.audit_events
  where entity = 'auth_accounts' and entity_id = v_target;
  set role app_user;

  perform set_config('app.user_id', v_actor::text, true);

  select password_hash, password_changed_at
  into v_hash_before, v_changed_before
  from public.auth_accounts where id = v_target;

  v_state := null;
  begin
    update public.auth_accounts
       set password_hash = '$argon2id$synthetisch-fremdreset',
           password_hash_version = 1,
           must_change_password = true,
           password_changed_at = now()
     where id = v_target;
  exception
    when sqlstate 'KB003' then v_state := 'KB003';
    when others then v_state := sqlstate;
  end;
  if v_state is distinct from 'KB003' then
    raise exception 'SMOKE U21 FAIL SQLSTATE % statt KB003',
      coalesce(v_state, 'kein Fehler - eine Nicht-Administratoridentitaet hat ein fremdes Passwort ersetzt');
  end if;

  select password_hash, password_changed_at
  into v_hash_after, v_changed_after
  from public.auth_accounts where id = v_target;

  -- Der Hash wird ausschliesslich VERGLICHEN und nie ausgegeben.
  if v_hash_after is distinct from v_hash_before then
    raise exception 'SMOKE U21 FAIL password_hash des fremden Kontos wurde veraendert';
  end if;
  if v_changed_after is distinct from v_changed_before then
    raise exception 'SMOKE U21 FAIL password_changed_at wurde veraendert';
  end if;

  reset role;
  select
    count(*) filter (where action = 'password_reset_by_admin'),
    count(*) filter (where action = 'password_changed')
  into v_reset_after, v_changed_audit_after
  from public.audit_events
  where entity = 'auth_accounts' and entity_id = v_target;
  set role app_user;

  if v_reset_after <> v_reset_before or v_changed_audit_after <> v_changed_audit_before then
    raise exception
      'SMOKE U21 FAIL der abgewiesene Versuch hinterlaesst % zusaetzliche(n) password_reset_by_admin und % zusaetzliche(n) password_changed',
      v_reset_after - v_reset_before, v_changed_audit_after - v_changed_audit_before;
  end if;

  raise notice
    'SMOKE U21 OK eine Nicht-Administratoridentitaet setzt kein fremdes Passwort zurueck: KB003, ohne Wirkung, ohne zusaetzlichen Auditsatz';
end
$$;

-- U22: DIE EIGENTLICHE LUECKE - Rolle 'admin', aber INAKTIVES PROFIL.
--
-- Konto ...0006 traegt in public.profiles die Rolle 'admin' und ist damit fuer
-- public.is_admin() (0001_init.sql:59-61) ein Administrator: diese Funktion
-- liest ueber public.current_user_role() AUSSCHLIESSLICH profiles.role und
-- kennt weder profiles.is_active noch auth_accounts.is_disabled. Jede Schranke,
-- die sich allein auf is_admin() stuetzt, laesst diesen Handelnden also durch -
-- obwohl er sich wegen seines inaktiven Profils nicht einmal anmelden koennte
-- (Stufe 4 der Sitzungspruefung, 19_ap14b_platform.sql).
--
-- Genau deshalb prueft public.is_active_admin_actor() (0017/3a) ALLE DREI
-- Bedingungen ueber BEIDE Tabellen. Dieser Fall ist der Nachweis, dass der
-- Waechter die strengere Funktion benutzt und nicht die alte.
do $$
declare
  v_actor uuid := '23b00000-0000-0000-0000-000000000006';
  v_target uuid := '23b00000-0000-0000-0000-000000000004';
  v_before boolean;
  v_after boolean;
  v_audit_before integer;
  v_audit_after integer;
  v_state text;
  v_is_admin boolean;
begin
  reset role;
  select count(*) into v_audit_before
  from public.audit_events
  where entity = 'auth_accounts' and entity_id = v_target
    and action = 'account_disabled';
  set role app_user;

  perform set_config('app.user_id', v_actor::text, true);

  -- Vorbedingung des Falls: die alte Schranke haelt diesen Handelnden wirklich
  -- fuer einen Administrator. Waere das nicht so, wuerde der Fall zwar gruen,
  -- aber die geschlossene Luecke gar nicht beruehren.
  select public.is_admin() into v_is_admin;
  if v_is_admin is distinct from true then
    raise exception
      'SMOKE U22 FAIL public.is_admin()=% - der Fall trifft die gemeinte Luecke nicht mehr',
      coalesce(v_is_admin::text, 'NULL');
  end if;

  select is_disabled into v_before from public.auth_accounts where id = v_target;

  v_state := null;
  begin
    update public.auth_accounts set is_disabled = true where id = v_target;
  exception
    when sqlstate 'KB003' then v_state := 'KB003';
    when others then v_state := sqlstate;
  end;
  if v_state is distinct from 'KB003' then
    raise exception 'SMOKE U22 FAIL SQLSTATE % statt KB003',
      coalesce(v_state, 'kein Fehler - ein Administrator mit INAKTIVEM Profil hat ein fremdes Konto gesperrt');
  end if;

  select is_disabled into v_after from public.auth_accounts where id = v_target;
  if v_after is distinct from v_before then
    raise exception 'SMOKE U22 FAIL is_disabled=% statt unveraendert %',
      coalesce(v_after::text, 'NULL'), coalesce(v_before::text, 'NULL');
  end if;

  reset role;
  select count(*) into v_audit_after
  from public.audit_events
  where entity = 'auth_accounts' and entity_id = v_target
    and action = 'account_disabled';
  set role app_user;

  if v_audit_after <> v_audit_before then
    raise exception
      'SMOKE U22 FAIL der abgewiesene Versuch hinterlaesst % zusaetzliche(n) Auditsatz/-saetze account_disabled',
      v_audit_after - v_audit_before;
  end if;

  raise notice
    'SMOKE U22 OK Rolle admin bei INAKTIVEM Profil sperrt kein fremdes Konto: KB003 trotz public.is_admin()=true, ohne Wirkung, ohne zusaetzlichen Auditsatz';
end
$$;

-- U23: derselbe Sachverhalt ueber die ZWEITE Tabelle - Rolle 'admin', Profil
-- aktiv, aber GESPERRTES KONTO (auth_accounts.is_disabled).
--
-- Konto ...0007 ist der Fall, der im Betrieb wirklich vorkommt: ein
-- Administrator wird gesperrt, und eine noch laufende oder wiederhergestellte
-- Sitzung soll danach nichts mehr bewirken koennen. public.is_admin() sieht
-- weiterhin einen Administrator; is_active_admin_actor() nicht, weil die dritte
-- Bedingung `not a.is_disabled` verletzt ist.
do $$
declare
  v_actor uuid := '23b00000-0000-0000-0000-000000000007';
  v_target uuid := '23b00000-0000-0000-0000-000000000004';
  v_hash_before text;
  v_hash_after text;
  v_changed_before timestamptz;
  v_changed_after timestamptz;
  v_reset_before integer;
  v_reset_after integer;
  v_state text;
  v_is_admin boolean;
begin
  reset role;
  select count(*) into v_reset_before
  from public.audit_events
  where entity = 'auth_accounts' and entity_id = v_target
    and action = 'password_reset_by_admin';
  set role app_user;

  perform set_config('app.user_id', v_actor::text, true);

  select public.is_admin() into v_is_admin;
  if v_is_admin is distinct from true then
    raise exception
      'SMOKE U23 FAIL public.is_admin()=% - der Fall trifft die gemeinte Luecke nicht mehr',
      coalesce(v_is_admin::text, 'NULL');
  end if;

  select password_hash, password_changed_at
  into v_hash_before, v_changed_before
  from public.auth_accounts where id = v_target;

  v_state := null;
  begin
    update public.auth_accounts
       set password_hash = '$argon2id$synthetisch-gesperrter-admin',
           password_hash_version = 1,
           must_change_password = true,
           password_changed_at = now()
     where id = v_target;
  exception
    when sqlstate 'KB003' then v_state := 'KB003';
    when others then v_state := sqlstate;
  end;
  if v_state is distinct from 'KB003' then
    raise exception 'SMOKE U23 FAIL SQLSTATE % statt KB003',
      coalesce(v_state, 'kein Fehler - ein Administrator mit GESPERRTEM Konto hat ein fremdes Passwort ersetzt');
  end if;

  select password_hash, password_changed_at
  into v_hash_after, v_changed_after
  from public.auth_accounts where id = v_target;
  if v_hash_after is distinct from v_hash_before then
    raise exception 'SMOKE U23 FAIL password_hash des fremden Kontos wurde veraendert';
  end if;
  if v_changed_after is distinct from v_changed_before then
    raise exception 'SMOKE U23 FAIL password_changed_at wurde veraendert';
  end if;

  reset role;
  select count(*) into v_reset_after
  from public.audit_events
  where entity = 'auth_accounts' and entity_id = v_target
    and action = 'password_reset_by_admin';
  set role app_user;

  if v_reset_after <> v_reset_before then
    raise exception
      'SMOKE U23 FAIL der abgewiesene Versuch hinterlaesst % zusaetzliche(n) Auditsatz/-saetze password_reset_by_admin',
      v_reset_after - v_reset_before;
  end if;

  raise notice
    'SMOKE U23 OK Rolle admin bei GESPERRTEM Konto setzt kein fremdes Passwort zurueck: KB003, ohne Wirkung, ohne zusaetzlichen Auditsatz';
end
$$;

-- U24: KEIN STILLER NULL-FALL - ohne gesetzte Identitaet gibt es keinen
-- administrativen Eingriff.
--
-- app.current_user_id() liefert bei nicht gesetzter Einstellung NULL
-- (0012:9-29). public.is_active_admin_actor() vergleicht damit `p.id = NULL`,
-- findet keine Zeile und antwortet `false` - fail-closed, ohne Sonderzweig.
-- Der Fall ist wichtig, weil der ALTE Waechter trg_protect_profile an genau
-- dieser Stelle fail-OPEN ist (`if app.current_user_id() is null ... return
-- new`, 0001_init.sql:423-425): dort faengt nur die Policy profiles_update ab.
-- Auf public.auth_accounts gibt es ueberhaupt keine Policy - hier ist der
-- Waechter die einzige Schranke.
do $$
declare
  v_target uuid := '23b00000-0000-0000-0000-000000000004';
  v_before boolean;
  v_after boolean;
  v_audit_before integer;
  v_audit_after integer;
  v_state text;
begin
  reset role;
  select count(*) into v_audit_before
  from public.audit_events
  where entity = 'auth_accounts' and entity_id = v_target
    and action = 'account_disabled';
  set role app_user;

  -- Ausdruecklich KEINE Identitaet.
  perform set_config('app.user_id', '', true);
  if app.current_user_id() is not null then
    raise exception 'SMOKE U24 FAIL die Identitaet ist entgegen der Annahme gesetzt';
  end if;

  select is_disabled into v_before from public.auth_accounts where id = v_target;

  v_state := null;
  begin
    update public.auth_accounts set is_disabled = true where id = v_target;
  exception
    when sqlstate 'KB003' then v_state := 'KB003';
    when others then v_state := sqlstate;
  end;
  if v_state is distinct from 'KB003' then
    raise exception 'SMOKE U24 FAIL SQLSTATE % statt KB003',
      coalesce(v_state, 'kein Fehler - ohne Identitaet wurde ein Konto gesperrt');
  end if;

  select is_disabled into v_after from public.auth_accounts where id = v_target;
  if v_after is distinct from v_before then
    raise exception 'SMOKE U24 FAIL is_disabled=% statt unveraendert %',
      coalesce(v_after::text, 'NULL'), coalesce(v_before::text, 'NULL');
  end if;

  reset role;
  select count(*) into v_audit_after
  from public.audit_events
  where entity = 'auth_accounts' and entity_id = v_target
    and action = 'account_disabled';
  set role app_user;

  if v_audit_after <> v_audit_before then
    raise exception
      'SMOKE U24 FAIL der abgewiesene Versuch hinterlaesst % zusaetzliche(n) Auditsatz/-saetze account_disabled',
      v_audit_after - v_audit_before;
  end if;

  raise notice
    'SMOKE U24 OK ohne gesetzte Identitaet endet die Kontosperre mit KB003, ohne Wirkung und ohne zusaetzlichen Auditsatz';
end
$$;

-- U25: DIE POSITIVE GEGENPROBE - ohne sie waere die ganze Negativreihe wertlos.
--
-- U20 bis U24 belegen ausschliesslich, dass etwas NICHT geht. Ein Waechter, der
-- schlicht alles abweist, wuerde jeden dieser Faelle ebenfalls gruen machen und
-- die Anwendung dabei unbedienbar. Deshalb fuehrt dieser Fall GENAU DIESELBE
-- Anweisung wie U20 aus - nur mit der Identitaet eines gueltigen aktiven
-- Administrators - und verlangt, dass sie GELINGT und regulaer auditiert wird.
--
-- Der Zustand wird am Ende wieder hergestellt (Entsperre durch DENSELBEN
-- Administrator). Dabei entsteht planmaessig ein ZWEITER Auditsatz
-- (account_enabled); er wird hier ausdruecklich mitgezaehlt, damit die folgenden
-- Faelle nicht ueber eine unerklaerte Zahl stolpern.
do $$
declare
  v_admin uuid := '23b00000-0000-0000-0000-000000000001';
  v_target uuid := '23b00000-0000-0000-0000-000000000004';
  v_disabled boolean;
  v_off_before integer;
  v_on_before integer;
  v_off_after integer;
  v_on_after integer;
  v_actor uuid;
  v_rows integer;
begin
  reset role;
  select
    count(*) filter (where action = 'account_disabled'),
    count(*) filter (where action = 'account_enabled')
  into v_off_before, v_on_before
  from public.audit_events
  where entity = 'auth_accounts' and entity_id = v_target;
  set role app_user;

  perform set_config('app.user_id', v_admin::text, true);

  update public.auth_accounts set is_disabled = true where id = v_target;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'SMOKE U25 FAIL % betroffene Zeile(n) statt genau einer', v_rows;
  end if;

  select is_disabled into v_disabled from public.auth_accounts where id = v_target;
  if v_disabled is distinct from true then
    raise exception 'SMOKE U25 FAIL is_disabled=% statt true',
      coalesce(v_disabled::text, 'NULL');
  end if;

  reset role;
  select
    count(*) filter (where action = 'account_disabled'),
    count(*) filter (where action = 'account_enabled')
  into v_off_after, v_on_after
  from public.audit_events
  where entity = 'auth_accounts' and entity_id = v_target;
  -- Der zuletzt geschriebene Sperrsatz - U11 hat bereits einen erzeugt, deshalb
  -- wird ueber created_at der NEUE ausgewaehlt.
  select a.actor
  into v_actor
  from public.audit_events a
  where a.entity = 'auth_accounts' and a.entity_id = v_target
    and a.action = 'account_disabled'
  order by a.created_at desc, a.id desc
  limit 1;
  set role app_user;

  if v_off_after - v_off_before <> 1 then
    raise exception
      'SMOKE U25 FAIL % zusaetzliche(r) Auditsatz/-saetze account_disabled statt genau einem',
      v_off_after - v_off_before;
  end if;
  if v_on_after <> v_on_before then
    raise exception
      'SMOKE U25 FAIL die Sperre hat % zusaetzliche(n) Auditsatz/-saetze account_enabled erzeugt',
      v_on_after - v_on_before;
  end if;
  if v_actor is distinct from v_admin then
    raise exception 'SMOKE U25 FAIL actor=% statt %',
      coalesce(v_actor::text, 'NULL'), v_admin;
  end if;

  -- Zustand wiederherstellen - durch denselben Administrator, damit auch dieser
  -- Weg unter dem Waechter laeuft und nicht ueber den Eigentuemerkontext.
  update public.auth_accounts set is_disabled = false where id = v_target;

  select is_disabled into v_disabled from public.auth_accounts where id = v_target;
  if v_disabled is distinct from false then
    raise exception 'SMOKE U25 FAIL is_disabled=% statt zurueckgesetzt auf false',
      coalesce(v_disabled::text, 'NULL');
  end if;

  reset role;
  select
    count(*) filter (where action = 'account_disabled'),
    count(*) filter (where action = 'account_enabled')
  into v_off_after, v_on_after
  from public.audit_events
  where entity = 'auth_accounts' and entity_id = v_target;
  set role app_user;

  if v_off_after - v_off_before <> 1 or v_on_after - v_on_before <> 1 then
    raise exception
      'SMOKE U25 FAIL Zuwachs account_disabled=% account_enabled=%, erwartet je genau einer',
      v_off_after - v_off_before, v_on_after - v_on_before;
  end if;

  raise notice
    'SMOKE U25 OK ein gueltiger aktiver Administrator sperrt und entsperrt dasselbe fremde Konto, je genau ein Auditsatz mit korrektem actor';
end
$$;

-- U26: DER ANMELDEBETRIEB BLEIBT FUNKTIONSFAEHIG - der wichtigste Positivfall
-- dieser Gruppe.
--
-- Stufe 1 der Anmeldung laeuft ohne gesetzte Identitaet (withAuthTransaction,
-- app/src/lib/db/index.ts): zu diesem Zeitpunkt ist noch niemand angemeldet.
-- Wuerde der Waechter dort greifen, waere die Anwendung nicht mehr benutzbar -
-- und zwar fuer JEDEN, einschliesslich der Administratoren. Dieser Fall bildet
-- die drei belegten Schreibwege nach:
--   a) Fehlversuch (auth-service.ts:168-178): nur failed_attempts und
--      locked_until - Schritt 1 des Waechters laesst durch, weil weder
--      is_disabled noch ein Passwortfeld angefasst wird. Seit 0017/3d muss der
--      Schritt zusaetzlich PLAUSIBEL sein (genau ein Zaehlschritt nach oben,
--      unterhalb der Obergrenze keine Sperre); U30-U38 messen diesen zweiten
--      Vertrag getrennt.
--   b) erfolgreiche Anmeldung mit Hash-Erneuerung (auth-service.ts:189-199):
--      failed_attempts, locked_until, last_login_at UND password_hash. Der Hash
--      steht dort immer in der SET-Liste (`coalesce($2::text, password_hash)`),
--      aendert sich aber nur, wenn needsRehash gegriffen hat. Der Waechter prueft
--      deshalb auf WERTAENDERUNG und nicht auf die SET-Liste.
--   c) Kein Auditsatz: das Nachziehen eines veralteten Argon2-Parametersatzes
--      ist KEIN Passwortwechsel, password_changed_at bleibt unberuehrt - genau
--      daran unterscheidet 0017/2a den Vorgang (Fall P18 in
--      19_ap14b_platform.sql).
--   d) NEGATIVE ABGRENZUNG im selben Block: derselbe Hashwechsel OHNE
--      last_login_at scheitert mit KB003. Ohne diesen Teil bliebe offen, ob der
--      Freibrief an den ANMELDEVORGANG oder bloss an die SPALTE password_hash
--      gebunden ist. Er ist an den Vorgang gebunden.
do $$
declare
  v_target uuid := '23b00000-0000-0000-0000-000000000004';
  v_hash_before text;
  v_hash_after text;
  v_changed_before timestamptz;
  v_changed_after timestamptz;
  v_login timestamptz;
  v_attempts integer;
  v_reset_before integer;
  v_changed_audit_before integer;
  v_reset_after integer;
  v_changed_audit_after integer;
  v_state text;
begin
  reset role;
  select
    count(*) filter (where action = 'password_reset_by_admin'),
    count(*) filter (where action = 'password_changed')
  into v_reset_before, v_changed_audit_before
  from public.audit_events
  where entity = 'auth_accounts' and entity_id = v_target;
  set role app_user;

  -- Stufe 1 der Anmeldung: ausdruecklich KEINE Identitaet.
  perform set_config('app.user_id', '', true);

  select password_hash, password_changed_at
  into v_hash_before, v_changed_before
  from public.auth_accounts where id = v_target;

  -- a) Fehlversuch.
  --    KORREKTUR (Reviewbefund M1): frueher stand hier
  --    `failed_attempts = 1, locked_until = now() + interval '5 minutes'`.
  --    Diese Kombination erzeugt der reale Code NIE. auth-service.ts:171-175
  --    setzt locked_until ausschliesslich dann, wenn der neue Zaehlerstand die
  --    Obergrenze erreicht (`when $2::integer >= $3::integer`) - bei
  --    failed_attempts = 1 steht dort zwingend NULL. Und die Sperrdauer betraegt
  --    LOCK_MINUTES = 15 Minuten (auth-service.ts:38), nicht fuenf. Der Fall
  --    bildete damit einen Vorgang nach, den es nicht gibt; seit 0017/3d wuerde
  --    genau diese erfundene Kombination zu Recht mit KB004 enden.
  update public.auth_accounts
     set failed_attempts = 1,
         locked_until = null
   where id = v_target;

  select failed_attempts into v_attempts
  from public.auth_accounts where id = v_target;
  if v_attempts is distinct from 1 then
    raise exception 'SMOKE U26 FAIL failed_attempts=% statt 1 - der Fehlversuch wurde abgewiesen',
      coalesce(v_attempts::text, 'NULL');
  end if;

  -- b) erfolgreiche Anmeldung mit Hash-Erneuerung.
  update public.auth_accounts
     set failed_attempts = 0,
         locked_until = null,
         last_login_at = now(),
         password_hash = '$argon2id$synthetisch-erneuert',
         password_hash_version = 1
   where id = v_target;

  select password_hash, last_login_at, password_changed_at
  into v_hash_after, v_login, v_changed_after
  from public.auth_accounts where id = v_target;

  if v_hash_after is not distinct from v_hash_before then
    raise exception 'SMOKE U26 FAIL der Anmelde-Rehash hat den Hash nicht ersetzt';
  end if;
  if v_login is null then
    raise exception 'SMOKE U26 FAIL last_login_at ist nicht gesetzt';
  end if;
  -- c) password_changed_at bleibt unberuehrt - der Grund, weshalb kein
  --    Auditsatz entstehen darf.
  if v_changed_after is distinct from v_changed_before then
    raise exception 'SMOKE U26 FAIL password_changed_at wurde beim Anmelde-Rehash veraendert';
  end if;

  reset role;
  select
    count(*) filter (where action = 'password_reset_by_admin'),
    count(*) filter (where action = 'password_changed')
  into v_reset_after, v_changed_audit_after
  from public.audit_events
  where entity = 'auth_accounts' and entity_id = v_target;
  set role app_user;

  if v_reset_after <> v_reset_before or v_changed_audit_after <> v_changed_audit_before then
    raise exception
      'SMOKE U26 FAIL der Anmelde-Rehash erzeugt % zusaetzliche(n) password_reset_by_admin und % zusaetzliche(n) password_changed - erwartet sind keine',
      v_reset_after - v_reset_before, v_changed_audit_after - v_changed_audit_before;
  end if;

  -- d) derselbe Hashwechsel OHNE last_login_at: kein Anmeldevorgang, also kein
  --    Freibrief.
  v_hash_before := v_hash_after;
  v_state := null;
  begin
    update public.auth_accounts
       set password_hash = '$argon2id$synthetisch-untergeschoben'
     where id = v_target;
  exception
    when sqlstate 'KB003' then v_state := 'KB003';
    when others then v_state := sqlstate;
  end;
  if v_state is distinct from 'KB003' then
    raise exception 'SMOKE U26 FAIL SQLSTATE % statt KB003 - der Freibrief haengt an der Spalte statt am Anmeldevorgang',
      coalesce(v_state, 'kein Fehler');
  end if;

  select password_hash into v_hash_after
  from public.auth_accounts where id = v_target;
  if v_hash_after is distinct from v_hash_before then
    raise exception 'SMOKE U26 FAIL der untergeschobene Hash wurde uebernommen';
  end if;

  raise notice
    'SMOKE U26 OK Fehlversuch und Anmelde-Rehash laufen ohne Identitaet und ohne Auditsatz durch, derselbe Hashwechsel ohne last_login_at endet mit KB003';
end
$$;

-- U27: DER EIGENE ECHTE PASSWORTWECHSEL BLEIBT ERLAUBT - aber nur fuer ein
-- AKTIVES Konto.
--
-- changeOwnPassword laeuft unter der eigenen Identitaet und muss fuer JEDE Rolle
-- funktionieren. Andernfalls koennte ein Monteur den nach einem administrativen
-- Reset erzwungenen Wechsel nicht durchfuehren und waere dauerhaft ausgesperrt.
-- Schritt 3 des Waechters laesst diesen Fall deshalb durch. U14 hat die
-- AUDITSEITE dieses Vorgangs bereits belegt; hier geht es um den Waechter.
--
-- Teil b begrenzt den Freibrief: `not old.is_disabled and not new.is_disabled`.
-- WARUM DAS FAIL-CLOSED RICHTIG IST: ein gesperrtes Konto ist administrativ aus
-- dem Verkehr gezogen. Duerfte es sein Passwort weiter selbst setzen, waere die
-- Sperre eine Empfehlung statt einer Schranke - der Betroffene koennte den
-- Zugang praeparieren und im Augenblick der Entsperrung sofort wieder handeln.
-- Der Weg zurueck fuehrt ausschliesslich ueber einen aktiven Administrator, der
-- entsperrt (U25) und - wenn noetig - zuruecksetzt (U13).
-- Die Sperre und die Entsperre laufen hier im EIGENTUEMERKONTEXT: sie sind
-- Vorbereitung des Falls, nicht sein Gegenstand.
do $$
declare
  v_self uuid := '23b00000-0000-0000-0000-000000000003';
  v_rows integer;
  v_hash_before text;
  v_hash_after text;
  v_changed_before timestamptz;
  v_changed_after timestamptz;
  v_audit_before integer;
  v_audit_after integer;
  v_state text;
begin
  -- a) aktives Konto: der eigene echte Wechsel laeuft.
  perform set_config('app.user_id', v_self::text, true);

  update public.auth_accounts
     set password_hash = '$argon2id$synthetisch-selbstwechsel',
         password_hash_version = 1,
         must_change_password = false,
         password_changed_at = now()
   where id = v_self;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception
      'SMOKE U27 FAIL der eigene Passwortwechsel betrifft % Zeile(n) statt genau einer', v_rows;
  end if;

  -- b) dasselbe auf einem GESPERRTEN Konto. Die Sperre setzt der
  --    Eigentuemerkontext ohne Identitaet - genau der Weg, den Schritt 2 des
  --    Waechters ausdruecklich offen laesst.
  reset role;
  perform set_config('app.user_id', '', true);
  update public.auth_accounts set is_disabled = true where id = v_self;

  set role app_user;
  perform set_config('app.user_id', v_self::text, true);

  select password_hash, password_changed_at
  into v_hash_before, v_changed_before
  from public.auth_accounts where id = v_self;

  reset role;
  select count(*) into v_audit_before
  from public.audit_events
  where entity = 'auth_accounts' and entity_id = v_self
    and action = 'password_changed';
  set role app_user;

  v_state := null;
  begin
    update public.auth_accounts
       set password_hash = '$argon2id$synthetisch-selbstwechsel-gesperrt',
           password_hash_version = 1,
           must_change_password = false,
           password_changed_at = now()
     where id = v_self;
  exception
    when sqlstate 'KB003' then v_state := 'KB003';
    when others then v_state := sqlstate;
  end;
  if v_state is distinct from 'KB003' then
    raise exception 'SMOKE U27 FAIL SQLSTATE % statt KB003 - ein gesperrtes Konto hat sein Passwort selbst gesetzt',
      coalesce(v_state, 'kein Fehler');
  end if;

  select password_hash, password_changed_at
  into v_hash_after, v_changed_after
  from public.auth_accounts where id = v_self;
  if v_hash_after is distinct from v_hash_before then
    raise exception 'SMOKE U27 FAIL password_hash des gesperrten Kontos wurde veraendert';
  end if;
  if v_changed_after is distinct from v_changed_before then
    raise exception 'SMOKE U27 FAIL password_changed_at des gesperrten Kontos wurde veraendert';
  end if;

  reset role;
  select count(*) into v_audit_after
  from public.audit_events
  where entity = 'auth_accounts' and entity_id = v_self
    and action = 'password_changed';
  if v_audit_after <> v_audit_before then
    raise exception
      'SMOKE U27 FAIL der abgewiesene Selbstwechsel hinterlaesst % zusaetzliche(n) Auditsatz/-saetze password_changed',
      v_audit_after - v_audit_before;
  end if;

  -- Zustand wiederherstellen, ebenfalls im Eigentuemerkontext.
  perform set_config('app.user_id', '', true);
  update public.auth_accounts set is_disabled = false where id = v_self;
  set role app_user;

  raise notice
    'SMOKE U27 OK der eigene echte Passwortwechsel gelingt auf einem aktiven Konto und endet auf einem gesperrten mit KB003, ohne Wirkung und ohne zusaetzlichen Auditsatz';
end
$$;

-- U28: DER PROFILWAECHTER - dieselbe Luecke auf public.profiles.
--
-- VOR 0017/3c waeren BEIDE Versuche dieses Falls GELUNGEN. Der bestehende
-- trg_protect_profile (0001_init.sql:419-434) stuetzt sich allein auf
-- public.is_admin() und wertet weder profiles.is_active noch
-- auth_accounts.is_disabled aus. Ein Handelnder mit der Rolle 'admin' und
-- inaktivem Profil (...0006) oder gesperrtem Konto (...0007) kam dort durch,
-- und auch die Policy profiles_update haette ihn nicht aufgehalten: ihr
-- USING-Ausdruck lautet `is_admin() or id = app.current_user_id()` und ist fuer
-- beide erfuellt. Der Rollenwechsel eines FREMDEN Profils waere also von einem
-- Konto ausgegangen, das sich nicht einmal anmelden kann.
--
-- Der neue Waechter greift genau in diesem Zwischenraum. Beide Versuche muessen
-- mit KB003 enden - nicht mit 42501: der alte Trigger sortiert zwar davor,
-- laesst diese beiden Handelnden aber durch (das ist der Unterschied zu U29).
do $$
declare
  v_inaktiv uuid := '23b00000-0000-0000-0000-000000000006';
  v_gesperrt uuid := '23b00000-0000-0000-0000-000000000007';
  v_target uuid := '23b00000-0000-0000-0000-000000000004';
  v_role_before public.user_role;
  v_role_after public.user_role;
  v_audit_before integer;
  v_audit_after integer;
  v_state text;
begin
  reset role;
  select count(*) into v_audit_before
  from public.audit_events
  where entity = 'profiles' and entity_id = v_target and action = 'role_changed';
  set role app_user;

  -- Versuch 1: Rolle 'admin', Profil INAKTIV.
  perform set_config('app.user_id', v_inaktiv::text, true);

  select role into v_role_before from public.profiles where id = v_target;
  if v_role_before is distinct from 'monteur' then
    raise exception 'SMOKE U28 FAIL Ausgangsrolle des Ziels=% statt monteur',
      coalesce(v_role_before::text, 'NULL');
  end if;

  v_state := null;
  begin
    update public.profiles
       set role = 'disponent'::public.user_role
     where id = v_target;
  exception
    when sqlstate 'KB003' then v_state := 'KB003';
    when others then v_state := sqlstate;
  end;
  if v_state is distinct from 'KB003' then
    raise exception
      'SMOKE U28 FAIL Versuch mit INAKTIVEM Adminprofil: SQLSTATE % statt KB003',
      coalesce(v_state, 'kein Fehler - der Rollenwechsel ist gelungen');
  end if;

  -- Versuch 2: Rolle 'admin', Konto GESPERRT.
  perform set_config('app.user_id', v_gesperrt::text, true);

  v_state := null;
  begin
    update public.profiles
       set role = 'disponent'::public.user_role
     where id = v_target;
  exception
    when sqlstate 'KB003' then v_state := 'KB003';
    when others then v_state := sqlstate;
  end;
  if v_state is distinct from 'KB003' then
    raise exception
      'SMOKE U28 FAIL Versuch mit GESPERRTEM Adminkonto: SQLSTATE % statt KB003',
      coalesce(v_state, 'kein Fehler - der Rollenwechsel ist gelungen');
  end if;

  select role into v_role_after from public.profiles where id = v_target;
  if v_role_after is distinct from v_role_before then
    raise exception 'SMOKE U28 FAIL role=% statt unveraendert %',
      coalesce(v_role_after::text, 'NULL'), v_role_before;
  end if;

  reset role;
  select count(*) into v_audit_after
  from public.audit_events
  where entity = 'profiles' and entity_id = v_target and action = 'role_changed';
  set role app_user;

  if v_audit_after <> v_audit_before then
    raise exception
      'SMOKE U28 FAIL die abgewiesenen Versuche hinterlassen % zusaetzliche(n) Auditsatz/-saetze role_changed',
      v_audit_after - v_audit_before;
  end if;

  raise notice
    'SMOKE U28 OK weder ein inaktives Adminprofil noch ein gesperrtes Adminkonto aendert eine fremde Rolle: je KB003, ohne Wirkung und ohne zusaetzlichen Auditsatz';
end
$$;

-- U29: DER REIHENFOLGEVERTRAG DER BEFORE-TRIGGER.
--
-- BEFORE-Trigger feuern in ALPHABETISCHER Namensfolge. 'trg_protect_profile'
-- sortiert vor 'trg_protect_profile_active_admin' und entscheidet deshalb
-- ZUERST. Fuer einen gewoehnlichen Nicht-Administrator bleibt damit der
-- bestehende SQLSTATE '42501' das Ergebnis - genau wie in U10 und in jedem
-- Nachweis, der vor 0017 entstanden ist. Der neue Waechter greift ausschliesslich
-- in dem Zwischenraum, den der alte durchlaesst (U28).
--
-- WARUM DIESER FALL AUSDRUECKLICH KB003 VERBIETET: benennte jemand den neuen
-- Trigger so um, dass er alphabetisch VOR 'trg_protect_profile' sortiert, kippte
-- der SQLSTATE fuer JEDEN Nicht-Administrator still von 42501 auf KB003. Beide
-- Codes bedeuten Verschiedenes - 42501 ist eine gewoehnliche Rechteverweigerung,
-- KB003 meldet eine umgangene Anwendungsschranke und darf nicht in einen
-- fachlichen Rueckgabewert uebersetzt werden. Dieser Fall laesst den Bruch
-- sofort auffallen.
--
-- Geaendert wird die EIGENE Zeile, damit die Policy profiles_update erfuellt ist
-- und die Abweisung wirklich vom Trigger stammt und nicht von der Zeilenschranke.
do $$
declare
  v_actor uuid := '23b00000-0000-0000-0000-000000000003';
  v_role_before public.user_role;
  v_role_after public.user_role;
  v_audit_before integer;
  v_audit_after integer;
  v_state text;
begin
  reset role;
  select count(*) into v_audit_before
  from public.audit_events
  where entity = 'profiles' and entity_id = v_actor and action = 'role_changed';
  set role app_user;

  perform set_config('app.user_id', v_actor::text, true);

  select role into v_role_before from public.profiles where id = v_actor;
  if v_role_before = 'admin' then
    raise exception
      'SMOKE U29 FAIL die handelnde Identitaet ist bereits Administrator - der Fall waere nicht aussagekraeftig';
  end if;

  v_state := null;
  begin
    update public.profiles
       set role = 'admin'::public.user_role
     where id = v_actor;
  exception
    when sqlstate '42501' then v_state := '42501';
    when sqlstate 'KB003' then v_state := 'KB003';
    when others then v_state := sqlstate;
  end;

  if v_state = 'KB003' then
    raise exception
      'SMOKE U29 FAIL KB003 statt 42501 - trg_protect_profile_active_admin hat vor trg_protect_profile entschieden; die alphabetische Reihenfolge der BEFORE-Trigger ist gekippt (Trigger umbenannt?)';
  end if;
  if v_state is distinct from '42501' then
    raise exception 'SMOKE U29 FAIL SQLSTATE % statt 42501',
      coalesce(v_state, 'kein Fehler - die Selbsterhebung zum Administrator ist gelungen');
  end if;

  select role into v_role_after from public.profiles where id = v_actor;
  if v_role_after is distinct from v_role_before then
    raise exception 'SMOKE U29 FAIL role=% statt unveraendert %',
      coalesce(v_role_after::text, 'NULL'), v_role_before;
  end if;

  reset role;
  select count(*) into v_audit_after
  from public.audit_events
  where entity = 'profiles' and entity_id = v_actor and action = 'role_changed';
  set role app_user;

  if v_audit_after <> v_audit_before then
    raise exception
      'SMOKE U29 FAIL der abgewiesene Versuch hinterlaesst % zusaetzliche(n) Auditsatz/-saetze role_changed',
      v_audit_after - v_audit_before;
  end if;

  raise notice
    'SMOKE U29 OK die Selbsterhebung zum Administrator endet mit 42501 aus trg_protect_profile und AUSDRUECKLICH NICHT mit KB003 - der Reihenfolgevertrag der BEFORE-Trigger haelt';
end
$$;

-- =====================================================================
-- U30-U38: DER WAECHTERVERTRAG DER SPERRSPALTEN (0017, Abschnitte 2d, 3d, 3e)
--
-- DIE LUECKE, DIE DIESE FALLGRUPPE MISST: der Waechter aus 0017/3b gibt in
-- seinem Schritt 1 alles frei, was weder is_disabled noch ein Passwortfeld
-- aendert - genau damit der Anmeldebetrieb weiterlaeuft (U26). Ein reines
--   `update public.auth_accounts set failed_attempts = 0, locked_until = null`
-- und ebenso ein reines Setzen einer Sperre liefen damit ungeprueft durch,
-- obwohl app_user `update` auf dieser Tabelle tabellenweit besitzt (0012:102)
-- und die Tabelle keine Policy traegt. 0017/3d prueft deshalb den UEBERGANG auf
-- Plausibilitaet (SQLSTATE 'KB004'), 0017/3e begrenzt jede Anweisung auf
-- hoechstens EIN Konto (SQLSTATE 'KB005'), und 0017/2d schreibt Sperre und
-- Entsperrung in den Audit.
--
-- ZWEI GETRENNTE SQLSTATES, UND JEDER NEGATIVFALL PRUEFT AUSDRUECKLICH AUF
-- SEINEN: 'KB004' bedeutet "der Uebergang selbst ist unplausibel", 'KB005'
-- bedeutet "eine Anweisung hat mehrere Konten angefasst". Ein Fall, der nur auf
-- "irgendeinen Fehler" pruefte, wuerde eine Verwechslung der beiden Vertraege
-- nicht bemerken - und ebenso wenig ein 42501 aus einer ganz anderen Ursache.
--
-- DIE ZAHLEN 5 UND 15 sind die Spiegelung von MAX_FAILED_ATTEMPTS = 5
-- (app/src/lib/auth-service.ts:37) und LOCK_MINUTES = 15
-- (app/src/lib/auth-service.ts:38). Diese Faelle messen die Spiegelung mit: wer
-- die Konstanten aendert, ohne 0017/3d nachzuziehen, sieht es hier zuerst.
--
-- AUSGANGSLAGEN werden durchgehend im EIGENTUEMERKONTEXT gesetzt. Das ist kein
-- Umweg, sondern Gegenstand: 0017/3d und 3e lassen den Eigentuemer ausdruecklich
-- durch (Bootstrap, Migration, Fixtures), und nur so laesst sich eine
-- Ausgangslage herstellen, die der Waechter unter app_user gerade nicht
-- zulaesst.
--
-- BETROFFENE KONTEN: ...0003 (U30-U37) und ...0004 (U37/U38). Beide sind
-- Nicht-Administratoren; die Zaehlung der aktiven Administratoren aus U15/U16
-- ist zu diesem Zeitpunkt ohnehin abgeschlossen.
-- =====================================================================

-- U30: DER ZAEHLSCHRITT 0 -> 1 OHNE IDENTITAET GELINGT.
--
-- Das ist der haeufigste Schreibvorgang der gesamten Tabelle: ein einzelner
-- Fehlversuch in Stufe 1 der Anmeldung (auth-service.ts:168-178), ohne gesetzte
-- Identitaet. Braeche er, waere die Anmeldung fuer JEDEN unbenutzbar - deshalb
-- steht dieser Positivfall an der Spitze der Gruppe und nicht am Ende.
do $$
declare
  v_target uuid := '23b00000-0000-0000-0000-000000000003';
  v_attempts integer;
  v_locked timestamptz;
  v_rows integer;
begin
  -- Ausgangslage im Eigentuemerkontext: Zaehler auf 0, keine Sperre.
  reset role;
  perform set_config('app.user_id', '', true);
  update public.auth_accounts
     set failed_attempts = 0, locked_until = null
   where id = v_target;
  set role app_user;

  -- Stufe 1 der Anmeldung: ausdruecklich KEINE Identitaet.
  perform set_config('app.user_id', '', true);

  update public.auth_accounts set failed_attempts = 1 where id = v_target;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'SMOKE U30 FAIL % betroffene Zeile(n) statt genau einer', v_rows;
  end if;

  select failed_attempts, locked_until into v_attempts, v_locked
  from public.auth_accounts where id = v_target;

  if v_attempts is distinct from 1 then
    raise exception
      'SMOKE U30 FAIL failed_attempts=% statt 1 - der regulaere Fehlversuch wurde abgewiesen',
      coalesce(v_attempts::text, 'NULL');
  end if;
  if v_locked is not null then
    raise exception 'SMOKE U30 FAIL locked_until ist gesetzt, obwohl die Obergrenze nicht erreicht ist';
  end if;

  raise notice
    'SMOKE U30 OK der Zaehlschritt 0 -> 1 laeuft ohne Identitaet durch und setzt keine Sperre';
end
$$;

-- U31: DER ZAEHLSCHRITT 4 -> 5 MIT DER SPERRE GELINGT.
--
-- Der fuenfte Fehlversuch ist der einzige, der eine Sperre setzen darf, und er
-- setzt sie auf genau `now() + make_interval(mins => 15)` - dieselbe Rechnung
-- wie auth-service.ts:171-175. Damit misst dieser Fall beide Zahlen der
-- Spiegelung auf einmal.
do $$
declare
  v_target uuid := '23b00000-0000-0000-0000-000000000003';
  v_attempts integer;
  v_locked timestamptz;
begin
  -- Ausgangslage 4 im Eigentuemerkontext. Unter app_user waere sie nicht
  -- herstellbar - genau das ist der Sinn des Waechters.
  reset role;
  perform set_config('app.user_id', '', true);
  update public.auth_accounts
     set failed_attempts = 4, locked_until = null
   where id = v_target;
  set role app_user;

  perform set_config('app.user_id', '', true);

  update public.auth_accounts
     set failed_attempts = 5,
         locked_until = now() + make_interval(mins => 15)
   where id = v_target;

  select failed_attempts, locked_until into v_attempts, v_locked
  from public.auth_accounts where id = v_target;

  if v_attempts is distinct from 5 then
    raise exception
      'SMOKE U31 FAIL failed_attempts=% statt 5 - der Sperrschritt wurde abgewiesen',
      coalesce(v_attempts::text, 'NULL');
  end if;
  if v_locked is null or v_locked <= now() then
    raise exception 'SMOKE U31 FAIL locked_until=% statt eines Zeitpunkts in der Zukunft',
      coalesce(v_locked::text, 'NULL');
  end if;

  -- Zustand zuruecknehmen, damit die folgenden Faelle ihre eigene Ausgangslage
  -- setzen koennen.
  reset role;
  update public.auth_accounts
     set failed_attempts = 0, locked_until = null
   where id = v_target;
  set role app_user;

  raise notice
    'SMOKE U31 OK der Zaehlschritt 4 -> 5 setzt die Sperre auf 15 Minuten und wird zugelassen';
end
$$;

-- U32: NEGATIV - EINE SPERRE OHNE ZAEHLERENTWICKLUNG.
--
-- Der Zaehler bleibt stehen, nur locked_until springt in die Zukunft. Genau so
-- saehe die stille Aussperrung eines Benutzers aus: kein Fehlversuch, keine
-- Spur, aber die Anmeldung ist zu. Der reale Code erzeugt diesen Uebergang nie -
-- eine Sperre entsteht ausschliesslich MIT dem Erreichen der Obergrenze.
do $$
declare
  v_target uuid := '23b00000-0000-0000-0000-000000000003';
  v_locked timestamptz;
  v_attempts integer;
  v_audit_before integer;
  v_audit_after integer;
  v_state text;
begin
  reset role;
  perform set_config('app.user_id', '', true);
  update public.auth_accounts
     set failed_attempts = 1, locked_until = null
   where id = v_target;
  select count(*) into v_audit_before
  from public.audit_events
  where entity = 'auth_accounts' and entity_id = v_target and action = 'account_locked';
  set role app_user;

  perform set_config('app.user_id', '', true);

  v_state := null;
  begin
    update public.auth_accounts
       set locked_until = now() + make_interval(mins => 15)
     where id = v_target;
  exception
    when sqlstate 'KB004' then v_state := 'KB004';
    when others then v_state := sqlstate;
  end;
  if v_state is distinct from 'KB004' then
    raise exception 'SMOKE U32 FAIL SQLSTATE % statt KB004 - eine Sperre ohne Zaehlerentwicklung wurde zugelassen',
      coalesce(v_state, 'kein Fehler');
  end if;

  select failed_attempts, locked_until into v_attempts, v_locked
  from public.auth_accounts where id = v_target;
  if v_attempts is distinct from 1 or v_locked is not null then
    raise exception 'SMOKE U32 FAIL failed_attempts=% locked_until=% statt unveraendert 1/NULL',
      coalesce(v_attempts::text, 'NULL'), coalesce(v_locked::text, 'NULL');
  end if;

  reset role;
  select count(*) into v_audit_after
  from public.audit_events
  where entity = 'auth_accounts' and entity_id = v_target and action = 'account_locked';
  set role app_user;

  if v_audit_after <> v_audit_before then
    raise exception
      'SMOKE U32 FAIL der abgewiesene Versuch hinterlaesst % zusaetzliche(n) Auditsatz/-saetze account_locked',
      v_audit_after - v_audit_before;
  end if;

  raise notice
    'SMOKE U32 OK eine Sperre ohne Zaehlerentwicklung endet mit KB004, ohne Wirkung und ohne Auditsatz';
end
$$;

-- U33: NEGATIV - EINE SPERRE WEIT IN DER ZUKUNFT.
--
-- Der Zaehlschritt 4 -> 5 ist fuer sich genommen plausibel; die Sperrdauer ist
-- es nicht. Ohne die Obergrenze aus 0017/3d waere die Aussperrung auf Jahre der
-- billigste Angriff dieser Tabelle: ein einziger, voellig unauffaelliger
-- Zaehlschritt.
do $$
declare
  v_target uuid := '23b00000-0000-0000-0000-000000000003';
  v_attempts integer;
  v_locked timestamptz;
  v_state text;
begin
  reset role;
  perform set_config('app.user_id', '', true);
  update public.auth_accounts
     set failed_attempts = 4, locked_until = null
   where id = v_target;
  set role app_user;

  perform set_config('app.user_id', '', true);

  v_state := null;
  begin
    update public.auth_accounts
       set failed_attempts = 5,
           locked_until = now() + interval '100 years'
     where id = v_target;
  exception
    when sqlstate 'KB004' then v_state := 'KB004';
    when others then v_state := sqlstate;
  end;
  if v_state is distinct from 'KB004' then
    raise exception 'SMOKE U33 FAIL SQLSTATE % statt KB004 - eine Sperre ueber 100 Jahre wurde zugelassen',
      coalesce(v_state, 'kein Fehler');
  end if;

  select failed_attempts, locked_until into v_attempts, v_locked
  from public.auth_accounts where id = v_target;
  if v_attempts is distinct from 4 or v_locked is not null then
    raise exception 'SMOKE U33 FAIL failed_attempts=% locked_until=% statt unveraendert 4/NULL',
      coalesce(v_attempts::text, 'NULL'), coalesce(v_locked::text, 'NULL');
  end if;

  -- Ausgangslage zuruecknehmen.
  reset role;
  update public.auth_accounts
     set failed_attempts = 0, locked_until = null
   where id = v_target;
  set role app_user;

  raise notice
    'SMOKE U33 OK eine Sperre weit in der Zukunft endet mit KB004, obwohl der Zaehlschritt selbst plausibel waere';
end
$$;

-- U34: NEGATIV - DIE REINE, VORGANGSLOSE ENTSPERRUNG.
--
-- DER KERN DES BEFUNDS: `failed_attempts = 0, locked_until = null` ist die
-- Anweisung, die eine stehende Anmeldesperre aufhebt. Sie beruehrt weder
-- is_disabled noch ein Passwortfeld und lief deshalb an 0017/3b vorbei. Ohne
-- 0017/3d koennte JEDE angemeldete Identitaet - und jeder Weg ohne Identitaet -
-- ein fremdes Konto entsperren.
--
-- Geprueft werden BEIDE Wege, die nach 0017/3d unzulaessig sind: mit der
-- Identitaet eines regulaeren Nicht-Administrators (Disponent ...0005) und ganz
-- ohne Identitaet. Weder last_login_at noch password_changed_at aendert sich -
-- es gibt also keinen Vorgang, der das Zuruecksetzen traegt.
do $$
declare
  v_target uuid := '23b00000-0000-0000-0000-000000000003';
  v_disponent uuid := '23b00000-0000-0000-0000-000000000005';
  v_attempts integer;
  v_locked timestamptz;
  v_audit_before integer;
  v_audit_after integer;
  v_state text;
begin
  -- Ausgangslage: gesperrtes Konto. Nur der Eigentuemerkontext darf sie setzen.
  reset role;
  perform set_config('app.user_id', '', true);
  update public.auth_accounts
     set failed_attempts = 5, locked_until = now() + make_interval(mins => 15)
   where id = v_target;
  select count(*) into v_audit_before
  from public.audit_events
  where entity = 'auth_accounts' and entity_id = v_target and action = 'account_unlocked';
  set role app_user;

  -- a) mit der Identitaet eines aktiven Nicht-Administrators.
  perform set_config('app.user_id', v_disponent::text, true);

  v_state := null;
  begin
    update public.auth_accounts
       set failed_attempts = 0, locked_until = null
     where id = v_target;
  exception
    when sqlstate 'KB004' then v_state := 'KB004';
    when others then v_state := sqlstate;
  end;
  if v_state is distinct from 'KB004' then
    raise exception 'SMOKE U34 FAIL Entsperrung durch einen Disponenten: SQLSTATE % statt KB004',
      coalesce(v_state, 'kein Fehler');
  end if;

  -- b) ganz ohne Identitaet - der Weg, den Stufe 1 der Anmeldung benutzt.
  perform set_config('app.user_id', '', true);

  v_state := null;
  begin
    update public.auth_accounts
       set failed_attempts = 0, locked_until = null
     where id = v_target;
  exception
    when sqlstate 'KB004' then v_state := 'KB004';
    when others then v_state := sqlstate;
  end;
  if v_state is distinct from 'KB004' then
    raise exception 'SMOKE U34 FAIL Entsperrung ohne Identitaet: SQLSTATE % statt KB004',
      coalesce(v_state, 'kein Fehler');
  end if;

  select failed_attempts, locked_until into v_attempts, v_locked
  from public.auth_accounts where id = v_target;
  if v_attempts is distinct from 5 or v_locked is null then
    raise exception 'SMOKE U34 FAIL failed_attempts=% locked_until=% statt unveraendert 5/gesetzt',
      coalesce(v_attempts::text, 'NULL'), coalesce(v_locked::text, 'NULL');
  end if;

  reset role;
  select count(*) into v_audit_after
  from public.audit_events
  where entity = 'auth_accounts' and entity_id = v_target and action = 'account_unlocked';
  set role app_user;

  if v_audit_after <> v_audit_before then
    raise exception
      'SMOKE U34 FAIL die abgewiesenen Versuche hinterlassen % zusaetzliche(n) Auditsatz/-saetze account_unlocked',
      v_audit_after - v_audit_before;
  end if;

  raise notice
    'SMOKE U34 OK die vorgangslose Entsperrung endet mit KB004 - mit Disponentenidentitaet wie ohne Identitaet, ohne Wirkung und ohne Auditsatz';
end
$$;

-- U35: DIE POSITIVE GEGENPROBE ZU U34 - DIE ENTSPERRUNG DURCH DIE ANMELDUNG.
--
-- Ohne diesen Fall waere U34 wertlos: ein Waechter, der jede Entsperrung
-- abweist, sperrte jedes Konto nach fuenf Fehlversuchen fuer immer aus. Die
-- erfolgreiche Anmeldung nach abgelaufener Sperre (auth-service.ts:189-199)
-- setzt Zaehler und Sperre zurueck UND schreibt last_login_at - genau dieser
-- Mitnachweis traegt den Ruecksetzzweig aus 0017/3d.
do $$
declare
  v_target uuid := '23b00000-0000-0000-0000-000000000003';
  v_attempts integer;
  v_locked timestamptz;
  v_login timestamptz;
begin
  reset role;
  perform set_config('app.user_id', '', true);
  update public.auth_accounts
     set failed_attempts = 5, locked_until = now() + make_interval(mins => 15)
   where id = v_target;
  set role app_user;

  perform set_config('app.user_id', '', true);

  update public.auth_accounts
     set failed_attempts = 0,
         locked_until = null,
         last_login_at = now()
   where id = v_target;

  select failed_attempts, locked_until, last_login_at
  into v_attempts, v_locked, v_login
  from public.auth_accounts where id = v_target;

  if v_attempts is distinct from 0 or v_locked is not null then
    raise exception 'SMOKE U35 FAIL failed_attempts=% locked_until=% statt 0/NULL',
      coalesce(v_attempts::text, 'NULL'), coalesce(v_locked::text, 'NULL');
  end if;
  if v_login is null then
    raise exception 'SMOKE U35 FAIL last_login_at ist nicht gesetzt';
  end if;

  raise notice
    'SMOKE U35 OK die erfolgreiche Anmeldung setzt Zaehler und Sperre zurueck - last_login_at traegt den Ruecksetzzweig';
end
$$;

-- U36: NEGATIV - DER ZAEHLERSPRUNG.
--
-- 0 -> 3 in einem Schritt. Wer den Zaehler frei setzen darf, ist nur einen
-- Schritt von der Sperre entfernt und braucht dafuer keine fuenf Fehlversuche.
-- 0017/3d verlangt deshalb genau EINEN Schritt nach oben.
do $$
declare
  v_target uuid := '23b00000-0000-0000-0000-000000000003';
  v_attempts integer;
  v_state text;
begin
  reset role;
  perform set_config('app.user_id', '', true);
  update public.auth_accounts
     set failed_attempts = 0, locked_until = null
   where id = v_target;
  set role app_user;

  perform set_config('app.user_id', '', true);

  v_state := null;
  begin
    update public.auth_accounts set failed_attempts = 3 where id = v_target;
  exception
    when sqlstate 'KB004' then v_state := 'KB004';
    when others then v_state := sqlstate;
  end;
  if v_state is distinct from 'KB004' then
    raise exception 'SMOKE U36 FAIL SQLSTATE % statt KB004 - der Zaehlersprung 0 -> 3 wurde zugelassen',
      coalesce(v_state, 'kein Fehler');
  end if;

  select failed_attempts into v_attempts
  from public.auth_accounts where id = v_target;
  if v_attempts is distinct from 0 then
    raise exception 'SMOKE U36 FAIL failed_attempts=% statt unveraendert 0',
      coalesce(v_attempts::text, 'NULL');
  end if;

  raise notice
    'SMOKE U36 OK der Zaehlersprung 0 -> 3 endet mit KB004 und bleibt ohne Wirkung';
end
$$;

-- U37: NEGATIV - MEHRERE KONTEN IN EINER ANWEISUNG (0017/3e, SQLSTATE KB005).
--
-- Der entscheidende Punkt dieses Falls: die Anweisung ist ZEILENWEISE voellig
-- plausibel. Beide Konten stehen auf 0, beide gingen auf 1 - 0017/3d liesse
-- jede einzelne Zeile durch. Erst der Statement-Trigger aus 0017/3e sieht, dass
-- EINE Anweisung ZWEI Konten angefasst hat, und weist mit 'KB005' ab. Deshalb
-- pruefen wir hier ausdruecklich auf KB005 und nicht auf KB004: ein KB004 an
-- dieser Stelle hiesse, dass der Massenwaechter gar nicht zum Zuge kam.
--
-- Die mehrzeilige AUSGANGSLAGE setzt der Eigentuemerkontext - er ist von 3e
-- ausdruecklich ausgenommen und belegt damit zugleich, dass Fixtures und
-- Migrationen weiterhin mehrere Konten in einem Schritt anfassen duerfen.
do $$
declare
  v_first uuid := '23b00000-0000-0000-0000-000000000003';
  v_second uuid := '23b00000-0000-0000-0000-000000000004';
  v_sum integer;
  v_state text;
begin
  reset role;
  perform set_config('app.user_id', '', true);
  update public.auth_accounts
     set failed_attempts = 0, locked_until = null
   where id in (v_first, v_second);
  set role app_user;

  perform set_config('app.user_id', '', true);

  v_state := null;
  begin
    update public.auth_accounts
       set failed_attempts = failed_attempts + 1
     where id in (v_first, v_second);
  exception
    when sqlstate 'KB005' then v_state := 'KB005';
    when others then v_state := sqlstate;
  end;
  if v_state is distinct from 'KB005' then
    raise exception
      'SMOKE U37 FAIL SQLSTATE % statt KB005 - eine Anweisung hat die Sperrspalten mehrerer Konten geaendert',
      coalesce(v_state, 'kein Fehler');
  end if;

  select coalesce(sum(failed_attempts), -1) into v_sum
  from public.auth_accounts where id in (v_first, v_second);
  if v_sum is distinct from 0 then
    raise exception
      'SMOKE U37 FAIL Summe der failed_attempts=% statt unveraendert 0 - die abgewiesene Anweisung hat gewirkt',
      coalesce(v_sum::text, 'NULL');
  end if;

  raise notice
    'SMOKE U37 OK eine Anweisung ueber zwei Konten endet mit KB005 und bleibt ohne Wirkung, obwohl jede Zeile fuer sich plausibel waere';
end
$$;

-- U38: DER AUDITNACHWEIS ZU SPERRE UND ENTSPERRUNG (0017/2d).
--
-- Ein Waechter ohne Nachweis ist nur die halbe Zusage: waere die Sperre nicht
-- auditiert, bliebe unsichtbar, dass ein Konto ueberhaupt gesperrt war und was
-- es wieder geoeffnet hat. Gezaehlt wird RELATIV (Zaehlweise dieser Datei ab
-- U19): erwartet wird je genau EIN ZUSAETZLICHER Satz.
--
-- `actor` ist bei beiden Saetzen NULL und muss es sein - Stufe 1 der Anmeldung
-- hat keine Identitaet (0001_init.sql:362-370 laesst actor ausdruecklich zu).
--
-- NEGATIVE GEGENPROBE IM SELBEN FALL: `detail` darf weder den password_hash
-- noch die E-Mail-Adresse des Kontos enthalten. U17 prueft dasselbe fuer die
-- synthetischen Hashliterale ueber die ganze Datenbank; hier wird zusaetzlich
-- gegen die TATSAECHLICHEN Werte dieses Kontos geprueft, damit auch ein
-- kuenftig ergaenztes Detailfeld auffaellt.
do $$
declare
  v_target uuid := '23b00000-0000-0000-0000-000000000004';
  v_locked_before integer;
  v_unlocked_before integer;
  v_locked_after integer;
  v_unlocked_after integer;
  v_actor_locked uuid;
  v_actor_unlocked uuid;
  v_detail jsonb;
  v_hash text;
  v_email text;
begin
  reset role;
  perform set_config('app.user_id', '', true);
  update public.auth_accounts
     set failed_attempts = 4, locked_until = null
   where id = v_target;
  select
    count(*) filter (where action = 'account_locked'),
    count(*) filter (where action = 'account_unlocked')
  into v_locked_before, v_unlocked_before
  from public.audit_events
  where entity = 'auth_accounts' and entity_id = v_target;
  set role app_user;

  perform set_config('app.user_id', '', true);

  -- a) Der fuenfte Fehlversuch sperrt.
  update public.auth_accounts
     set failed_attempts = 5,
         locked_until = now() + make_interval(mins => 15)
   where id = v_target;

  -- b) Die erfolgreiche Anmeldung hebt die Sperre wieder auf. Der
  --    Ruecksetzzweig aus 0017/3d verlangt dafuer keinen abgelaufenen
  --    Sperrzeitpunkt - im Betrieb kaeme dieser Weg ohnehin erst nach Ablauf
  --    zustande, weil auth-service.ts:153-155 vorher abbricht.
  update public.auth_accounts
     set failed_attempts = 0,
         locked_until = null,
         last_login_at = now()
   where id = v_target;

  reset role;
  select
    count(*) filter (where action = 'account_locked'),
    count(*) filter (where action = 'account_unlocked')
  into v_locked_after, v_unlocked_after
  from public.audit_events
  where entity = 'auth_accounts' and entity_id = v_target;

  select a.actor, a.detail
  into v_actor_locked, v_detail
  from public.audit_events a
  where a.entity = 'auth_accounts' and a.entity_id = v_target
    and a.action = 'account_locked'
  order by a.created_at desc, a.id desc
  limit 1;

  select a.actor
  into v_actor_unlocked
  from public.audit_events a
  where a.entity = 'auth_accounts' and a.entity_id = v_target
    and a.action = 'account_unlocked'
  order by a.created_at desc, a.id desc
  limit 1;

  select password_hash, email into v_hash, v_email
  from public.auth_accounts where id = v_target;

  if v_locked_after - v_locked_before <> 1 then
    raise exception
      'SMOKE U38 FAIL % zusaetzliche(r) Auditsatz/-saetze account_locked statt genau einem',
      v_locked_after - v_locked_before;
  end if;
  if v_unlocked_after - v_unlocked_before <> 1 then
    raise exception
      'SMOKE U38 FAIL % zusaetzliche(r) Auditsatz/-saetze account_unlocked statt genau einem',
      v_unlocked_after - v_unlocked_before;
  end if;
  if v_actor_locked is not null or v_actor_unlocked is not null then
    raise exception
      'SMOKE U38 FAIL actor=%/% statt NULL - der Anmeldeweg hat keine Identitaet',
      coalesce(v_actor_locked::text, 'NULL'), coalesce(v_actor_unlocked::text, 'NULL');
  end if;

  if v_detail->>'previous_failed_attempts' is distinct from '4'
     or v_detail->>'failed_attempts' is distinct from '5'
     or v_detail->>'locked_until' is null then
    raise exception 'SMOKE U38 FAIL detail des Sperrsatzes: %', coalesce(v_detail::text, 'NULL');
  end if;

  -- Geheimnisfreiheit, ausdruecklich gegen die echten Werte dieses Kontos.
  if v_detail ? 'password_hash' or v_detail ? 'email'
     or strpos(v_detail::text, v_hash) > 0
     or strpos(lower(v_detail::text), lower(v_email)) > 0 then
    raise exception
      'SMOKE U38 FAIL detail des Sperrsatzes enthaelt Hash- oder Adressmaterial';
  end if;

  set role app_user;

  raise notice
    'SMOKE U38 OK Sperre und Entsperrung erzeugen je genau einen Auditsatz ohne Identitaet, und detail enthaelt weder Hash noch E-Mail-Adresse';
end
$$;

-- Zurueck in den Eigentuemerkontext: das Aufraeumen unten loest updated_by,
-- loescht Auditsaetze, Profile und Konten. Jeder dieser Wege ist app_user nach
-- 0017 verwehrt - und soll es bleiben.
reset role;
select set_config('app.user_id', '', false);

-- ---------------------------------------------------------------------
-- Aufraeumen im Eigentuemerkontext. Entfernt werden ausschliesslich die eigenen
-- Zeilen mit dem Praefix 23b00000-.
--
-- Die Reihenfolge ist zwingend:
--   1. public.auth_accounts.updated_by loesen. Die Aenderungen aus U11-U14
--      liefen MIT gesetzter Identitaet, deshalb traegt die Spalte jetzt eine
--      Profil-ID; ihr Fremdschluessel zeigt seit 0012 auf public.profiles.
--      Ohne dieses Loesen scheitert Schritt 3. Der Trigger tg_touch_updated()
--      setzt den Wert aus der aktuellen Identitaet - die ist hier leer, also
--      NULL. (Muster aus 19_ap14b_platform.sql.)
--   2. Die eigenen Auditsaetze entfernen: public.audit_events.actor zeigt
--      ebenfalls auf public.profiles.
--   3. Profile, danach Konten.
-- ---------------------------------------------------------------------
update public.auth_accounts
set updated_by = null
where id in (
  '23b00000-0000-0000-0000-000000000001',
  '23b00000-0000-0000-0000-000000000002',
  '23b00000-0000-0000-0000-000000000003',
  '23b00000-0000-0000-0000-000000000004',
  '23b00000-0000-0000-0000-000000000005',
  '23b00000-0000-0000-0000-000000000006',
  '23b00000-0000-0000-0000-000000000007'
);

delete from public.audit_events
where actor in (
    '23b00000-0000-0000-0000-000000000001',
    '23b00000-0000-0000-0000-000000000002',
    '23b00000-0000-0000-0000-000000000003',
    '23b00000-0000-0000-0000-000000000004',
    '23b00000-0000-0000-0000-000000000005',
    '23b00000-0000-0000-0000-000000000006',
    '23b00000-0000-0000-0000-000000000007'
  )
  -- Bewusst OHNE Einschraenkung auf `entity`: die Gegenprobe unten zaehlt
  -- ebenfalls ueber die reine Kennung, und beide muessen denselben Bestand
  -- meinen.
  or entity_id in (
    '23b00000-0000-0000-0000-000000000001',
    '23b00000-0000-0000-0000-000000000002',
    '23b00000-0000-0000-0000-000000000003',
    '23b00000-0000-0000-0000-000000000004',
    '23b00000-0000-0000-0000-000000000005',
    '23b00000-0000-0000-0000-000000000006',
    '23b00000-0000-0000-0000-000000000007'
  );

delete from public.profiles
where id in (
  '23b00000-0000-0000-0000-000000000001',
  '23b00000-0000-0000-0000-000000000002',
  '23b00000-0000-0000-0000-000000000003',
  '23b00000-0000-0000-0000-000000000004',
  '23b00000-0000-0000-0000-000000000005',
  '23b00000-0000-0000-0000-000000000006',
  '23b00000-0000-0000-0000-000000000007'
);

delete from public.auth_accounts
where id in (
  '23b00000-0000-0000-0000-000000000001',
  '23b00000-0000-0000-0000-000000000002',
  '23b00000-0000-0000-0000-000000000003',
  '23b00000-0000-0000-0000-000000000004',
  '23b00000-0000-0000-0000-000000000005',
  '23b00000-0000-0000-0000-000000000006',
  '23b00000-0000-0000-0000-000000000007'
);

-- Gegenprobe des Aufraeumens: es bleibt keine eigene Zeile zurueck.
do $$
declare
  v_rest integer;
begin
  select
    (select count(*) from public.profiles where id::text like '23b00000-%')
    + (select count(*) from public.auth_accounts where id::text like '23b00000-%')
    + (select count(*) from public.audit_events
       where actor::text like '23b00000-%' or entity_id::text like '23b00000-%')
  into v_rest;

  if v_rest <> 0 then
    raise exception 'SMOKE U-ENDE FAIL % eigene Zeile(n) bleiben zurueck', v_rest;
  end if;

  raise notice
    'SMOKE U-ENDE OK AP14B-Benutzerverwaltung U1-U38 unter app_user mit aktiver RLS belegt (Rechtematrix, Audit, Schutz des letzten Administrators, alle vier Waechter aus 0017, der Reihenfolgevertrag der BEFORE-Trigger sowie der Plausibilitaets-, Mengen- und Auditvertrag der Sperrspalten), alle eigenen Testdaten entfernt';
end
$$;
