-- AP14/B: administrative Benutzerverwaltung - Rechtematrix, Auditierung und
-- Schutz des letzten aktiven Administrators.
--
-- Bezug: ADR-011 / 2.3 (Passwortwechsel und administrativer Reset sind
-- auditiert) und / 2.5 (der Anwendungszugriff laeuft ausschliesslich ueber die
-- nicht privilegierte Rolle app_user). Migration 0012 hat Identitaet, Sitzungen
-- und das Mindestrecht der Sitzungsauswertung gebaut, 0014-0016 haben die
-- Rechtematrix der Fachobjekte, der Stammdaten und des Bildpfades geschlossen.
-- Diese Migration schliesst die verbleibende Luecke der administrativen
-- Benutzerverwaltung - und nichts darueber hinaus.
--
-- WAS DIESE MIGRATION NICHT TUT:
--   * Sie legt KEIN Konto an und erzeugt KEIN Passwort. Die Kontoanlage bleibt
--     dem bestehenden Bootstrap-Weg vorbehalten; deshalb gibt es hier weder
--     `insert` noch `delete` auf public.profiles und keinerlei Recht, das eine
--     Neuanlage durch die Anwendungsrolle ermoeglichen wuerde.
--   * Sie fuehrt KEINE neue Rolle ein. public.user_role bleibt unveraendert bei
--     ('admin', 'disponent', 'monteur').
--   * Sie aendert KEINE Policy und KEINE Tabelle. Angelegt bzw. ersetzt werden
--     ausschliesslich neun Triggerfunktionen, eine Hilfsfunktion und die
--     zugehoerigen Trigger sowie genau ein Spaltenrecht und genau ein
--     Ausfuehrungsrecht. Zusaetzlich wird genau EIN bestehendes Tabellenrecht
--     zurueckgenommen (Abschnitt 1a) - eine Ruecknahme, keine Erweiterung.
--
-- Verbindliche Eigenschaften:
--   * Additiv bis auf genau eine ausdrueckliche Ruecknahme: Abschnitt 1a nimmt
--     app_user das tabellenweite `delete` auf public.auth_accounts. Das ist das
--     EINZIGE `revoke` dieser Datei auf ein Tabellen- oder Spaltenrecht; es
--     erweitert nichts, sondern entzieht ein Recht, das kein Anwendungsweg
--     benutzt. Fuer public.profiles steht bewusst KEIN `revoke` (Begruendung in
--     Abschnitt 1). Darueber hinaus gibt es nur den Entzug von
--     Ausfuehrungsrechten, die unmittelbar zu einer hier NEU angelegten oder
--     ersetzten Funktion gehoeren.
--   * Wiederholbar: jedes `create or replace`, jedem `create trigger` geht ein
--     `drop trigger if exists` voraus, `grant` und `revoke` sind ohnehin
--     idempotent, und die Abschlussbloecke pruefen ausschliesslich.
--   * Empfaenger jedes `grant` ist ausschliesslich app_user (das Spaltenrecht
--     aus Abschnitt 1 und das Ausfuehrungsrecht aus Abschnitt 3a). Kein `grant`
--     an public, anon oder authenticated.
--   * Kein SUPERUSER, kein BYPASSRLS, keine Service-Rolle. Diese Datei
--     definiert zehn Funktionen: sechs mit SECURITY DEFINER (die fuenf
--     Triggerfunktionen der Abschnitte 2 und 3 sowie die Hilfsfunktion
--     public.is_active_admin_actor aus Abschnitt 3a) und vier mit SECURITY
--     INVOKER (die Waechter der Abschnitte 3b, 3c, 3d und 3e).
--     Die fuenf SECURITY-DEFINER-Triggerfunktionen sind fuer die
--     Anwendungsrolle nicht aufrufbar (revoke all unmittelbar nach jeder
--     Definition) und werden ausschliesslich beim Ausloesen ausgefuehrt.
--     public.is_active_admin_actor ist als einzige Funktion dieser Datei fuer
--     app_user ausfuehrbar; sie liefert ausschliesslich eine Ja/Nein-Aussage
--     ueber die bereits gesetzte EIGENE Identitaet und gibt keine Daten heraus
--     (ausfuehrliche Begruendung in Abschnitt 3a).
--     Die vier SECURITY-INVOKER-Waechter MUESSEN SECURITY INVOKER bleiben -
--     als SECURITY DEFINER waeren sie wirkungslos (Begruendung in Abschnitt 3b);
--     Abschnitt 4 prueft das ausdruecklich.

-- ---------------------------------------------------------------------
-- 1) Rechtematrix: genau EIN spaltenbezogenes update
--
-- WARUM DIESES RECHT NOETIG IST:
--   Der Rollenwechsel eines Benutzers ist ein UPDATE auf public.profiles.role.
--   app_user besitzt auf dieser Tabelle heute ausschliesslich das Leserecht aus
--   0012:114 (`grant select on public.profiles to app_user`). Ohne ein
--   Aenderungsrecht scheitert jeder Rollenwechsel mit SQLSTATE 42501, und zwar
--   BEVOR die Policy profiles_update ueberhaupt geprueft wird: das Tabellen-
--   bzw. Spaltenrecht ist die Voraussetzung des Zugriffs, die Policy erst die
--   Erlaubnis fuer die einzelne Zeile.
--
-- WARUM AUSSCHLIESSLICH DIE SPALTE role - UND AUSDRUECKLICH NICHT is_active:
--   Die administrative Deaktivierung eines Benutzers wird in diesem
--   Arbeitspaket ueber public.auth_accounts.is_disabled gefuehrt und NICHT ueber
--   public.profiles.is_active. Der Grund ist die Wirkung: is_disabled sperrt
--   Stufe 1 der Sitzungspruefung - also die Anmeldung UND jede bereits
--   ausgestellte Sitzung (Bedingung `not a.is_disabled`, nachgewiesen in
--   19_ap14b_platform.sql, Faelle P12 und P15). Das Recht dafuer besitzt
--   app_user bereits tabellenweit aus 0012:102; es wird hier nicht erweitert.
--   public.profiles.is_active bleibt das bestehende fachliche Feld aus AP1 und
--   wird von diesem Arbeitspaket NICHT angefasst. Es bleibt fuer app_user
--   unveraenderbar; nur der Eigentuemerkontext (Migrationen, Bootstrap) setzt
--   es. Der Schutztrigger aus Abschnitt 3 wertet es trotzdem aus, denn ein
--   inaktives Profil ist auch dann kein aktiver Administrator, wenn sein Konto
--   nicht gesperrt ist.
--
-- WARUM SPALTENBEZOGEN UND NICHT TABELLENWEIT:
--   Ein tabellenweites update auf public.profiles waere weit mehr als der
--   Rollenwechsel. Die Policy profiles_update (0001_init.sql:512-514, von 0012
--   auf app.current_user_id() umgeschrieben) entscheidet ausschliesslich ueber
--   die ZEILE (`is_admin() or id = app.current_user_id()`) und nennt keine
--   einzige Spalte. Mit einem tabellenweiten Recht koennte jede regulaer
--   angemeldete Identitaet die uebrigen Spalten ihrer EIGENEN Zeile frei
--   setzen - insbesondere is_active (Selbstaktivierung eines gesperrten
--   Profils), created_by/updated_by (Faelschung der Urheberschaft) und
--   created_at/updated_at (Faelschung der Chronologie). Gegen die Spalten role
--   und is_active steht zwar zusaetzlich der BEFORE-Trigger
--   trg_protect_profile (0001_init.sql:420-434), gegen die uebrigen aber
--   nichts. Die Spaltenbegrenzung ist deshalb die tragende Schranke und keine
--   Kosmetik.
--
-- WARUM AUF public.profiles KEIN `revoke` STEHT:
--   Diese Begruendung gilt ausschliesslich fuer public.profiles. Sie steht NICHT
--   im Widerspruch zu Abschnitt 1a, der app_user das tabellenweite `delete` auf
--   public.auth_accounts nimmt: dort GIBT es ein bestehendes Recht abzuraeumen,
--   hier gibt es keines.
--   Ein Tabellenrecht und ein Spaltenrecht sind getrennte, sich addierende
--   ACL-Eintraege; ein stehengebliebenes tabellenweites update wuerde die
--   Spaltenbegrenzung vollstaendig aushebeln. 0016 stellt seinem Spaltengrant
--   deshalb ein `revoke` voran. Fuer public.profiles ist das NICHT noetig, und
--   der Befund ist nachgeprueft: auf dieser Tabelle gibt es in der gesamten
--   Kette 0001-0016 genau EINE Rechtevergabe an app_user, naemlich 0012:114
--   (select). Weder 0014 noch 0015 noch 0016 erteilen dort ein update, es gibt
--   keinen `grant ... on all tables in schema public` und keine fruehere
--   Fassung DIESER Datei, die etwas zurueckzunehmen haette. Es gibt also
--   nichts abzuraeumen. Dass wirklich kein tabellenweites update besteht,
--   prueft Abschnitt 4 negativ - dort faellt es auch dann auf, wenn es auf
--   einem anderen Weg entstanden sein sollte.
--
-- AUSDRUECKLICH NICHT ERTEILT:
--   * kein `insert` und kein `delete` auf public.profiles - es gibt in diesem
--     Arbeitspaket keine Kontoanlage und kein physisches Loeschen eines
--     Benutzers. Die Policies profiles_insert und profiles_delete
--     (0001_init.sql:510-516) bestehen unveraendert weiter und waeren fuer eine
--     Administratoridentitaet sogar erfuellt; genau deshalb ist das fehlende
--     Tabellenrecht hier die tragende, unabhaengige Schranke.
--   * kein neues Recht auf public.auth_accounts und public.auth_sessions - die
--     Sperre eines Kontos (is_disabled) und der Widerruf seiner Sitzungen
--     laufen mit den bereits aus 0012:102 vorhandenen Rechten. Von diesen
--     bestehenden Rechten wird in Abschnitt 1a eines wieder ENTZOGEN
--     (delete auf public.auth_accounts); erweitert wird nichts.
--   * kein Recht auf public.audit_events - Auditsaetze entstehen ausschliesslich
--     in den SECURITY-DEFINER-Triggern aus Abschnitt 2, und gelesen wird der
--     Audit nicht durch die Anwendungsrolle.
-- ---------------------------------------------------------------------
grant update (role) on public.profiles to app_user;

-- ---------------------------------------------------------------------
-- 1a) Ruecknahme: physisches Loeschen eines Auth-Kontos durch die
--     Anwendungsrolle wird unterbunden
--
-- WAS ZURUECKGENOMMEN WIRD:
--   Das tabellenweite `delete` auf public.auth_accounts stammt aus
--   0012:102 (`grant select, insert, update, delete on public.auth_accounts,
--   public.auth_sessions to app_user`). Es wurde dort gemeinsam mit dem Recht
--   auf public.auth_sessions erteilt; gebraucht wird es aber nur fuer die
--   Sitzungen.
--
-- WARUM DIESES RECHT GEFAEHRLICH IST:
--   public.profiles.id verweist seit 0012 mit `on delete cascade` auf
--   public.auth_accounts. Ein DELETE auf ein Konto entfernt damit KONTO UND
--   PROFIL in einem Schritt. Dabei greift keine der Schranken dieses
--   Arbeitspakets:
--     * trg_protect_last_active_admin ist AFTER UPDATE und feuert bei einem
--       DELETE ueberhaupt nicht - der letzte aktive Administrator liesse sich
--       also loeschen, obwohl er sich nicht einmal herabstufen laesst.
--     * Es entstuende KEIN Auditsatz: die Audittrigger aus Abschnitt 2 sind
--       ebenfalls AFTER UPDATE. Der Benutzer waere spurlos verschwunden.
--   Die fachliche Deaktivierung laeuft in diesem Arbeitspaket ausschliesslich
--   ueber auth_accounts.is_disabled - auditiert (2b), geschuetzt (Abschnitt 3)
--   und umkehrbar.
--
-- WARUM DIE RUECKNAHME NICHTS KAPUTT MACHT:
--   Im gesamten Anwendungscode unter app/src gibt es KEIN `delete` auf
--   public.auth_accounts; das Recht wird von keiner Funktion gebraucht. Die
--   Kontoanlage und ein etwaiges endgueltiges Entfernen bleiben dem
--   Eigentuemerkontext (Bootstrap, Migration) vorbehalten - genau wie
--   `insert`/`delete` auf public.profiles, die app_user nie besass.
--
-- AUSDRUECKLICH NICHT ZURUECKGENOMMEN:
--   `delete` auf public.auth_sessions BLEIBT bestehen. Das Aufraeumen
--   abgelaufener Sitzungen ist ein regulaerer Betriebsvorgang der
--   Anwendungsrolle. Abschnitt 4 prueft diesen Verbleib ausdruecklich positiv,
--   damit auffaellt, wenn jemand zu viel zurueckgenommen hat.
--
-- REIHENFOLGEABHAENGIGKEIT - WICHTIG:
--   app/supabase/test/19a_ap14b_grant_reset.sql:73 erteilt in der Testkette
--   dasselbe tabellenweite Recht aus 0012:102 erneut. 19a laeuft in BEIDEN
--   Runnern VOR dieser Migration (run_db_tests.sh Zeilen 59 und 78,
--   run_ap14b_local.ps1 Zeilen 169 und 190). Dieses `revoke` ist damit der
--   letzte Stand der Kette und wird nicht nachtraeglich ueberschrieben. Wer die
--   Reihenfolge umstellt, hebt die Ruecknahme still auf - die Negativpruefung in
--   Abschnitt 4 laesst den Lauf dann scheitern.
-- ---------------------------------------------------------------------
revoke delete on public.auth_accounts from app_user;

-- ---------------------------------------------------------------------
-- 2) Auditierung der administrativen Ereignisse
--
-- Warum durchgehend als Trigger und nicht in der Anwendung - dieselbe
-- Entscheidung wie in 0001 und 0012: public.audit_events besitzt bewusst KEINE
-- Insert-Policy und app_user besitzt darauf kein Tabellenrecht. Ein direkter
-- Insert der Anwendung scheitert also; geschrieben wird ausschliesslich durch
-- SECURITY-DEFINER-Trigger. Und ein Trigger kann nicht vergessen werden: jeder
-- Weg, der die auslesende Spalte setzt, erzeugt den Eintrag.
--
-- KEIN `detail` DIESER DATEI ENTHAELT EIN PASSWORT, EINEN HASH, EIN TOKEN ODER
-- EINE E-MAIL-ADRESSE. Aufgenommen werden ausschliesslich technische Merkmale
-- und die fachlich noetigen Rollenwerte.
-- ---------------------------------------------------------------------

-- 2a) Passwortwechsel und administrativer Reset werden UNTERSCHIEDEN.
--
-- Die Funktion stammt aus 0012:170-190 und wird hier mit `create or replace`
-- ersetzt; die Datei 0012 bleibt unveraendert. Die AUSLOESEBEDINGUNG ist exakt
-- dieselbe wie bisher (`password_changed_at is not null and is distinct from
-- old`) - insbesondere loest die Hash-Erneuerung beim Anmelden (needsRehash)
-- weiterhin KEINEN Auditsatz aus. Neu ist allein die Unterscheidung der Action:
--
--   * 'password_reset_by_admin', wenn die handelnde Identitaet gesetzt und eine
--     ANDERE als das betroffene Konto ist. Genau das ist der administrative
--     Reset aus ADR-011 / 2.3.
--   * 'password_changed' sonst - also beim Selbstwechsel (Identitaet gleich
--     Konto) UND im Fall OHNE gesetzte Identitaet.
--
-- Der Fall OHNE Identitaet bleibt BEWUSST 'password_changed'. Das erhaelt das
-- bisherige Verhalten exakt: Bootstrap- und Wartungswege laufen im
-- Eigentuemerkontext ohne app.user_id, und ihre Auditsaetze hiessen bisher
-- 'password_changed'. Sie ploetzlich als administrativen Reset zu fuehren waere
-- eine stille Umdeutung des Bestandes - und sachlich falsch, denn ohne
-- Identitaet ist gerade kein Administrator benannt. Erkennbar bleibt der Fall
-- an `actor is null`.
--
-- `detail` behaelt die vier bisherigen Felder unveraendert und bekommt ein
-- fuenftes, `reset_by_admin`, damit die Unterscheidung auch dann auswertbar
-- ist, wenn nur das Detail vorliegt.
create or replace function public.tg_audit_auth_password_changed()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_actor uuid;
  v_admin_reset boolean;
begin
  if new.password_changed_at is not null
     and new.password_changed_at is distinct from old.password_changed_at then
    v_actor := app.current_user_id();
    -- Fremdes Konto UND benannte Identitaet: nur dann ist es ein Reset durch
    -- einen Administrator. Ohne Identitaet bleibt es beim bisherigen Verhalten.
    v_admin_reset := (v_actor is not null and v_actor <> new.id);

    insert into public.audit_events (entity, entity_id, action, detail, actor)
    values (
      'auth_accounts',
      new.id,
      case when v_admin_reset then 'password_reset_by_admin' else 'password_changed' end,
      jsonb_build_object(
        'account_id', new.id,
        'changed_at', new.password_changed_at,
        'password_hash_version', new.password_hash_version,
        'must_change_password', new.must_change_password,
        'reset_by_admin', v_admin_reset
      ),
      v_actor
    );
  end if;
  return new;
end $$;
revoke all on function public.tg_audit_auth_password_changed() from public, anon, authenticated;

-- Der Trigger zeigt auf die Funktion und muesste nach einem `create or replace`
-- nicht neu erzeugt werden. Er wird trotzdem neu gesetzt, damit diese Datei
-- auch auf einer Datenbank vollstaendig ist, auf der 0012 aus irgendeinem Grund
-- ohne den Trigger endete - und damit sie mehrfach hintereinander laufen kann.
drop trigger if exists trg_audit_auth_password_changed on public.auth_accounts;
create trigger trg_audit_auth_password_changed
  after update on public.auth_accounts
  for each row execute function public.tg_audit_auth_password_changed();

-- 2b) Sperre und Entsperre eines Kontos.
--
-- Bisher gab es auf public.auth_accounts.is_disabled KEINEN Audittrigger. Die
-- Sperre ist aber der wirksamste administrative Eingriff ueberhaupt: sie
-- beendet Stufe 1 der Sitzungspruefung und damit jede laufende Sitzung sofort
-- (19_ap14b_platform.sql, Fall P12/E22d). Ohne Auditsatz waere nicht
-- nachvollziehbar, wer wen wann ausgesperrt hat.
--
-- Ausgeloest wird ausschliesslich der WECHSEL des Wertes. Ein UPDATE, das
-- is_disabled unveraendert laesst - etwa die Zaehlung der Fehlversuche oder
-- last_login_at -, erzeugt keinen Satz. Ein generischer Audittrigger auf dieser
-- Tabelle waere aus demselben Grund falsch wie auf auth_sessions: er ergaebe
-- eine Auditflut ohne Aussagewert.
create or replace function public.tg_audit_auth_account_disabled()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.is_disabled is distinct from old.is_disabled then
    insert into public.audit_events (entity, entity_id, action, detail, actor)
    values (
      'auth_accounts',
      new.id,
      case when new.is_disabled then 'account_disabled' else 'account_enabled' end,
      jsonb_build_object(
        'account_id', new.id,
        'is_disabled', new.is_disabled
      ),
      app.current_user_id()
    );
  end if;
  return new;
end $$;
revoke all on function public.tg_audit_auth_account_disabled() from public, anon, authenticated;

drop trigger if exists trg_audit_auth_account_disabled on public.auth_accounts;
create trigger trg_audit_auth_account_disabled
  after update on public.auth_accounts
  for each row execute function public.tg_audit_auth_account_disabled();

-- 2c) Rollenwechsel sowie Aktivierung/Deaktivierung eines Profils.
--
-- Bisher gab es auf public.profiles KEINEN Audittrigger: 0001 haengt tg_audit()
-- ausschliesslich an die Bewegungsdaten (0001_init.sql:455-469). Ein
-- Rollenwechsel ist aber eine Rechteaenderung und gehoert nach ADR-011 in den
-- Audit.
--
-- Beide Bedingungen sind UNABHAENGIG voneinander. Aendern sich Rolle und
-- Aktivstatus in derselben Anweisung, entstehen ZWEI Saetze - einer je
-- Sachverhalt. Das ist gewollt: ein Auswerter, der nach 'role_changed' sucht,
-- soll den Fall nicht deshalb verlieren, weil zufaellig auch is_active
-- mitgeaendert wurde.
--
-- Ein UPDATE, das weder role noch is_active aendert (etwa full_name oder phone
-- im Eigentuemerkontext), erzeugt KEINEN Auditsatz. Dieselbe Rolle ein zweites
-- Mal zuzuweisen erzeugt ebenfalls keinen zweiten Satz - `is distinct from` ist
-- hier die Idempotenzschranke des Audits.
--
-- `previous_role` und `new_role` sind Enumwerte (public.user_role). Sie werden
-- ausdruecklich nach text gecastet, damit im Detail garantiert eine
-- JSON-Zeichenkette steht und die Auswertung `detail->>'new_role'` unabhaengig
-- davon funktioniert, wie jsonb_build_object einen Enumwert einordnet. Ein
-- Name, eine Adresse oder eine Rufnummer kommt im Detail NICHT vor.
create or replace function public.tg_audit_profile_admin_change()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_actor uuid := app.current_user_id();
begin
  if new.role is distinct from old.role then
    insert into public.audit_events (entity, entity_id, action, detail, actor)
    values (
      'profiles',
      new.id,
      'role_changed',
      jsonb_build_object(
        'profile_id', new.id,
        'previous_role', old.role::text,
        'new_role', new.role::text
      ),
      v_actor
    );
  end if;

  if new.is_active is distinct from old.is_active then
    insert into public.audit_events (entity, entity_id, action, detail, actor)
    values (
      'profiles',
      new.id,
      case when new.is_active then 'profile_activated' else 'profile_deactivated' end,
      jsonb_build_object(
        'profile_id', new.id,
        'is_active', new.is_active
      ),
      v_actor
    );
  end if;

  return new;
end $$;
revoke all on function public.tg_audit_profile_admin_change() from public, anon, authenticated;

drop trigger if exists trg_audit_profile_admin_change on public.profiles;
create trigger trg_audit_profile_admin_change
  after update on public.profiles
  for each row execute function public.tg_audit_profile_admin_change();

-- 2d) Anmeldesperre und ihre Aufhebung (public.auth_accounts.locked_until).
--
-- WARUM DIESER SATZ FEHLTE: 2b auditiert ausschliesslich is_disabled, also die
-- ADMINISTRATIVE Sperre. Die ANMELDESPERRE nach zu vielen Fehlversuchen
-- (auth-service.ts:168-178) hat dieselbe Wirkung fuer den Betroffenen - er kommt
-- nicht mehr hinein -, hinterliess bisher aber keine Spur. Damit war weder
-- nachvollziehbar, dass ein Konto ueberhaupt gesperrt war, noch WER oder WAS es
-- wieder entsperrt hat. Genau diese Luecke schliesst dieser Trigger; er ist die
-- Nachweisseite der beiden Waechter aus 3d und 3e.
--
-- AUSGELOEST WIRD AUSSCHLIESSLICH DER UEBERGANG:
--   * null -> nicht null  = 'account_locked'
--   * nicht null -> null  = 'account_unlocked'
-- Eine Verschiebung von einem Sperrzeitpunkt auf einen anderen (nicht null ->
-- nicht null) schreibt NICHTS. Der reale Code erzeugt sie nicht; und ein
-- Auditsatz je Zaehlschritt waere die Auditflut ohne Aussagewert, die schon 2b
-- ausdruecklich vermeidet.
--
-- `actor` DARF NULL SEIN und ist es im Regelfall: Stufe 1 der Anmeldung laeuft
-- ohne gesetzte Identitaet (withAuthTransaction, app/src/lib/db/index.ts). Genau
-- deshalb ist public.audit_events.actor nullable (0001_init.sql:362-370). Ein
-- Satz mit `actor is null` bedeutet hier "vom Anmeldeweg selbst erzeugt", ein
-- Satz mit gesetztem actor "von einer benannten Identitaet ausgeloest".
--
-- SECURITY DEFINER IST PFLICHT - und zwar hier ohne Alternative: app_user
-- besitzt auf public.audit_events KEIN Tabellenrecht (Negativpruefung 3), die
-- Tabelle hat keine Insert-Policy. Unter SECURITY INVOKER scheiterte der Insert
-- mit 42501 und wuerde damit JEDE Sperre und JEDE Entsperrung des
-- Anmeldebetriebs abbrechen. Muster und Rechteentzug wie in 2b.
--
-- `detail` IST GEHEIMNISFREI UND ABSCHLIESSEND: aufgenommen werden
-- ausschliesslich der Zaehlerstand vorher und nachher sowie der neue
-- Sperrzeitpunkt. AUSDRUECKLICH NICHT aufgenommen werden password_hash, E-Mail,
-- Sitzungskennungen oder irgendein Klartext eines Geheimnisses. Die Kennung des
-- Kontos steht bereits in entity_id; sie wird - anders als in 2a/2b - NICHT
-- zusaetzlich in detail wiederholt, damit die Feldliste geschlossen bleibt und
-- eine spaetere Ergaenzung als solche auffaellt.
create or replace function public.tg_audit_auth_account_lockout()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if old.locked_until is null and new.locked_until is not null then
    insert into public.audit_events (entity, entity_id, action, detail, actor)
    values (
      'auth_accounts',
      new.id,
      'account_locked',
      jsonb_build_object(
        'previous_failed_attempts', old.failed_attempts,
        'failed_attempts', new.failed_attempts,
        'locked_until', new.locked_until
      ),
      app.current_user_id()
    );
  elsif old.locked_until is not null and new.locked_until is null then
    insert into public.audit_events (entity, entity_id, action, detail, actor)
    values (
      'auth_accounts',
      new.id,
      'account_unlocked',
      jsonb_build_object(
        'previous_failed_attempts', old.failed_attempts,
        'failed_attempts', new.failed_attempts,
        'locked_until', new.locked_until
      ),
      app.current_user_id()
    );
  end if;
  return new;
end $$;
revoke all on function public.tg_audit_auth_account_lockout() from public, anon, authenticated;

drop trigger if exists trg_audit_auth_account_lockout on public.auth_accounts;
create trigger trg_audit_auth_account_lockout
  after update on public.auth_accounts
  for each row execute function public.tg_audit_auth_account_lockout();

-- ---------------------------------------------------------------------
-- 3) Schutz des letzten aktiven Administrators
--
-- FACHLICHE ZUSAGE: es darf nicht moeglich sein, die Anwendung administrativ
-- unbedienbar zu machen. Wer den letzten aktiven Administrator herabstuft oder
-- sperrt, wuerde genau das tun: danach koennte niemand mehr eine Rolle
-- vergeben, ein Konto entsperren oder ein Passwort zuruecksetzen - der
-- Rueckweg fuehrte ausschliesslich ueber einen Datenbankeingriff im
-- Eigentuemerkontext.
--
-- DEFINITION "aktiver Administrator" - drei Bedingungen ueber zwei Tabellen:
--   public.profiles.role = 'admin' UND public.profiles.is_active
--   UND NOT public.auth_accounts.is_disabled
-- verbunden ueber die gemeinsame Kennung (profiles.id = auth_accounts.id, seit
-- 0012 sogar per Fremdschluessel). Genau diese Bedingungen prueft auch die
-- Sitzungsauswertung; ein Administrator, der eine davon verletzt, kann sich
-- nicht anmelden und ist damit fuer diese Zusage wertlos.
--
-- WARUM DERSELBE TRIGGER AN BEIDEN TABELLEN HAENGT: die Zusage laesst sich auf
-- zwei Wegen brechen - Herabstufung (profiles.role), Deaktivierung
-- (profiles.is_active) und Kontosperre (auth_accounts.is_disabled). Ein
-- Trigger nur an public.profiles wuerde die Kontosperre nicht bemerken.
--
-- WARUM SECURITY DEFINER: die Zaehlung muss ALLE Administratoren sehen.
-- public.profiles traegt aktive RLS; unter app_user zeigt profiles_select nur
-- die eigene Zeile bzw. die von is_staff() erlaubten. Eine Zaehlung unter der
-- aufrufenden Rolle koennte deshalb faelschlich 0 ergeben und einen zulaessigen
-- Vorgang abweisen - oder, schlimmer, bei einer spaeteren Policyaenderung zu
-- hoch ausfallen. SECURITY DEFINER macht die Zaehlung von der Sicht des
-- Aufrufers unabhaengig. Die Funktion ist eine reine Triggerfunktion, wird
-- unmittelbar nach ihrer Definition fuer public, anon und authenticated
-- gesperrt und liefert dem Aufrufer keinerlei Daten zurueck - sie ist damit
-- KEIN neuer Umgehungsweg, sondern ausschliesslich eine zusaetzliche Schranke.
--
-- WARUM DER ADVISORY-LOCK - der Wettlauf, der ohne ihn bestuende:
--   Unter READ COMMITTED sieht jede Transaktion den Stand, der bei Beginn IHRER
--   Anweisung sichtbar war. Zwei gleichzeitige Transaktionen, die je einen
--   VERSCHIEDENEN von genau zwei verbliebenen Administratoren herabstufen,
--   aendern deshalb unterschiedliche Zeilen, blockieren einander nicht - und
--   beide zaehlen den jeweils ANDEREN Administrator noch als aktiv, weil die
--   fremde, noch nicht bestaetigte Aenderung fuer sie unsichtbar ist. Beide
--   Pruefungen ergaeben 1, beide Transaktionen wuerden bestaetigt, und die
--   Datenbank endete bei NULL aktiven Administratoren. Die Zusage waere still
--   gebrochen.
--   pg_advisory_xact_lock() serialisiert genau diesen Abschnitt: die zweite
--   Transaktion wartet, bis die erste endet, und zaehlt danach neu - jetzt mit
--   dem bestaetigten Ergebnis der ersten. Der Schluessel 4014017001 ist frei
--   gewaehlt (AP14-0017-001) und wird ausschliesslich hier benutzt. Der Lock
--   ist transaktionsgebunden: er wird beim Commit UND beim Rollback
--   freigegeben, kann also nicht haengen bleiben.
--   Genommen wird er ERST, wenn eine Aenderung ueberhaupt einen Administrator
--   entfernt. Der Normalbetrieb - jede Anmeldung schreibt last_login_at, jeder
--   Fehlversuch failed_attempts - laeuft nie in diesen Zweig und wird durch den
--   Lock nicht serialisiert.
--   Der Lock leistet die SERIALISIERUNG; die AKTUALITAET der anschliessenden
--   Zaehlung wird von READ COMMITTED getragen. Erst beides zusammen ergibt die
--   Zusage - der naechste Abschnitt begruendet, warum.
--
-- WARUM READ COMMITTED VERLANGT WIRD - und warum sonst verweigert wird:
--   Die Zaehlung nach dem Lock ist snapshot-abhaengig. Unter READ COMMITTED
--   nimmt jede Anweisung einen FRISCHEN Snapshot: die zweite Transaktion sieht
--   nach dem Warten das bestaetigte Ergebnis der ersten und zaehlt 0. Unter
--   REPEATABLE READ oder SERIALIZABLE gilt dagegen der Snapshot vom
--   Transaktionsbeginn; `select count(*)` sieht den bereits herabgestuften
--   Administrator weiterhin als aktiv, zaehlt 1 und liesse die Aenderung durch.
--   Der Advisory-Lock haette dann zwar serialisiert, aber auf einem veralteten
--   Stand entschieden.
--   Ein Serialisierungskonflikt faengt das NICHT auf: beide Transaktionen
--   aendern VERSCHIEDENE Zeilen und lesen unter SERIALIZABLE keine Zeile, die
--   die jeweils andere schreibt und die zu einem gefaehrlichen Muster fuehrte -
--   die Pruefung der Praedikatssperren findet keinen Zyklus, beide Transaktionen
--   werden bestaetigt. Endzustand: NULL aktive Administratoren.
--   withUserTransaction (app/src/lib/db/index.ts) setzt `begin` ohne
--   Isolationsstufe; massgeblich ist damit default_transaction_isolation, also
--   eine Laufzeitkonfiguration, die diese Migration nicht kontrolliert.
--   Deshalb prueft die Funktion die Stufe SELBST und VERWEIGERT die Operation,
--   statt sie still unsicher zuzulassen - fail-closed. Eine Herabstufung des
--   letzten Administrators darf lieber an einer Fehlkonfiguration scheitern als
--   an einer Zusage, die dann nicht gilt.
--
-- ZWEITER, GETRENNTER VERTRAG: SQLSTATE 'KB002'.
--   Die Isolationspruefung meldet 'KB002' und NICHT 'KB001'. Der Unterschied ist
--   verbindlich: 'KB001' ist ein FACHLICHES Ergebnis ("der letzte Administrator
--   ist geschuetzt") und wird von der Anwendung als solches gemeldet. 'KB002' ist
--   ein KONFIGURATIONSFEHLER der Laufzeitumgebung. Er darf NICHT wie 'KB001' als
--   fachliches Ergebnis behandelt, abgefangen oder in einen Rueckgabewert
--   uebersetzt werden, sondern muss als technischer Fehler durchschlagen und
--   sichtbar werden.
--
-- WARUM DIE BEDINGUNG `v_old_counted and not v_new_counted`:
--   Geprueft wird ausschliesslich der UEBERGANG, nicht der Zustand. Ohne diese
--   Einschraenkung wuerde der Trigger auch dann abweisen, wenn ein
--   NICHT-Administrator geaendert wird, waehrend ohnehin gerade kein aktiver
--   Administrator vorhanden ist - etwa im Bootstrap. Er wuerde also einen
--   Zustand bestrafen, den die geaenderte Zeile nicht verursacht hat.
--
-- VERTRAG MIT DER ANWENDUNG: der Fehler traegt SQLSTATE 'KB001'. Der Code ist
-- frei gewaehlt (benutzerdefinierte Klasse, kein Konflikt mit einem
-- PostgreSQL-Code) und ist der einzige zuverlaessige Weg, diesen Fall von einer
-- gewoehnlichen Rechteverweigerung (42501 aus trg_protect_profile) zu
-- unterscheiden. Die Anwendung wertet 'KB001' aus und meldet ihn fachlich; sie
-- darf ihn NICHT als technischen Fehler behandeln.
--
-- REIHENFOLGE DER TRIGGER: der Audittrigger aus Abschnitt 2c heisst
-- trg_audit_profile_admin_change und feuert wegen der alphabetischen
-- Reihenfolge vor trg_protect_last_active_admin. Das ist ohne Belang und muss
-- nicht erzwungen werden: eine Ausnahme des Schutztriggers rollt die gesamte
-- Transaktion (bzw. die umgebende Subtransaktion) zurueck - einschliesslich des
-- bereits geschriebenen Auditsatzes und eines etwaigen Sitzungswiderrufs. Ein
-- abgewiesener Versuch hinterlaesst also keinen Auditsatz.
-- ---------------------------------------------------------------------
create or replace function public.tg_protect_last_active_admin()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_old_counted boolean;
  v_new_counted boolean;
  v_remaining integer;
begin
  -- Zaehlt die geaenderte Zeile vor und nach der Aenderung als aktiver
  -- Administrator? Die jeweils andere Haelfte der Bedingung wird in der
  -- Partnertabelle nachgeschlagen.
  if tg_table_name = 'profiles' then
    v_old_counted := old.role = 'admin' and old.is_active and exists (
      select 1 from public.auth_accounts a
      where a.id = old.id and not a.is_disabled
    );
    v_new_counted := new.role = 'admin' and new.is_active and exists (
      select 1 from public.auth_accounts a
      where a.id = new.id and not a.is_disabled
    );
  else
    v_old_counted := not old.is_disabled and exists (
      select 1 from public.profiles p
      where p.id = old.id and p.role = 'admin' and p.is_active
    );
    v_new_counted := not new.is_disabled and exists (
      select 1 from public.profiles p
      where p.id = new.id and p.role = 'admin' and p.is_active
    );
  end if;

  if v_old_counted and not v_new_counted then
    -- Fail-closed VOR jeder weiteren Anweisung: unter einer strengeren
    -- Isolationsstufe entscheidet die Zaehlung weiter unten auf dem Snapshot vom
    -- Transaktionsbeginn und liesse die Herabstufung des letzten Administrators
    -- durch. SQLSTATE 'KB002' ist ein Konfigurationsfehler, kein fachliches
    -- Ergebnis (ausfuehrliche Begruendung im Kopf dieses Abschnitts).
    if current_setting('transaction_isolation') <> 'read committed' then
      raise exception
        'Der Schutz des letzten aktiven Administrators setzt READ COMMITTED voraus (gefunden: %).',
        current_setting('transaction_isolation')
        using errcode = 'KB002';
    end if;

    -- Serialisiert jede Aenderung, die einen aktiven Administrator entfernt.
    -- Der Lock leistet die Serialisierung; die Aktualitaet der folgenden
    -- Zaehlung wird von READ COMMITTED getragen - erst beides zusammen ergibt
    -- die Zusage (ausfuehrliche Begruendung im Kopf dieses Abschnitts).
    perform pg_advisory_xact_lock(4014017001);

    select count(*)
    into v_remaining
    from public.profiles p
    join public.auth_accounts a on a.id = p.id
    where p.role = 'admin' and p.is_active and not a.is_disabled;

    if v_remaining = 0 then
      raise exception
        'Der letzte aktive Administrator darf nicht herabgestuft oder gesperrt werden.'
        using errcode = 'KB001';
    end if;
  end if;

  return new;
end $$;
revoke all on function public.tg_protect_last_active_admin() from public, anon, authenticated;

drop trigger if exists trg_protect_last_active_admin on public.profiles;
create trigger trg_protect_last_active_admin
  after update on public.profiles
  for each row execute function public.tg_protect_last_active_admin();

drop trigger if exists trg_protect_last_active_admin on public.auth_accounts;
create trigger trg_protect_last_active_admin
  after update on public.auth_accounts
  for each row execute function public.tg_protect_last_active_admin();

-- ---------------------------------------------------------------------
-- 3a) Hilfsfunktion: "ist die handelnde Identitaet ein AKTIVER Administrator?"
--
-- WOZU SIE DIENT:
--   Die Abschnitte 3b und 3c verlangen fuer administrative Eingriffe eine in
--   DIESER Transaktion aus der Datenbank bestaetigte, aktive Adminrolle. Diese
--   Funktion ist die einzige Stelle, an der diese Frage beantwortet wird.
--
-- WOHER DIE ROLLE KOMMT:
--   AUSSCHLIESSLICH aus der Datenbank - aus public.profiles und
--   public.auth_accounts. Die Funktion nimmt KEINEN Parameter, liest KEIN JWT,
--   KEINEN Claim und KEINEN von der Anwendung uebergebenen Rollenwert. Wer
--   handelt, steht allein in app.user_id; WAS er darf, entscheidet die
--   Datenbank.
--
-- WARUM SECURITY DEFINER:
--   Dieselbe Begruendung wie in Abschnitt 3: public.profiles traegt aktive RLS.
--   Unter app_user zeigt profiles_select nur die eigene Zeile bzw. die von
--   is_staff() erlaubten. Eine Auswertung unter der aufrufenden Rolle
--   entschiede damit auf einer gefilterten Sicht und koennte - je nach spaeterer
--   Policyfassung - faelschlich `false` (und damit eine Abweisung eines
--   zulaessigen Vorgangs) oder `true` liefern. SECURITY DEFINER macht die
--   Aussage von der Sicht des Aufrufers unabhaengig.
--
-- WARUM DER UNBEKANNTE FALL EINE VERWEIGERUNG IST (fail-closed):
--   app.current_user_id() liefert bei nicht gesetzter Einstellung NULL
--   (0012:9-29; auch ein unbrauchbarer Wert endet dort ueber das gefangene
--   invalid_text_representation bei NULL). `p.id = NULL` ergibt keine Zeile,
--   `exists` also `false`. Ohne gesetzte Identitaet ist die Antwort damit
--   IMMER "nein" - es gibt keinen stillen Durchlass.
--
-- WARUM SIE FUER app_user AUSFUEHRBAR IST - anders als die Triggerfunktionen:
--   Sie wird zur Laufzeit aus dem SECURITY-INVOKER-Waechter aus Abschnitt 3b
--   heraus aufgerufen. Ein Trigger prueft beim Ausloesen KEIN
--   Ausfuehrungsrecht (das wird einmalig bei `create trigger` geprueft), ein
--   gewoehnlicher Funktionsaufruf dagegen schon. Ohne diesen `grant execute`
--   scheiterte jeder Waechteraufruf unter app_user mit 42501.
--   Das ist kein Informationsleck: die Funktion gibt ausschliesslich eine
--   Ja/Nein-Aussage ueber die EIGENE, bereits gesetzte Identitaet zurueck. Sie
--   nennt keine fremde Zeile, keinen Namen, keine Adresse und keine Anzahl.
--
-- WARUM SIE STRENGER IST ALS public.is_admin():
--   public.is_admin() (0001_init.sql:59-61) wertet ueber
--   public.current_user_role() AUSSCHLIESSLICH profiles.role aus. Ein
--   DEAKTIVIERTES Profil (is_active = false) und ein GESPERRTES Konto
--   (auth_accounts.is_disabled = true) gelten dort weiterhin als Administrator.
--   Diese Funktion verlangt alle DREI Bedingungen und deckt sich damit exakt mit
--   der Definition "aktiver Administrator" aus Abschnitt 3 und mit der
--   Sitzungsauswertung. public.is_admin() bleibt unveraendert; es wird hier
--   bewusst NICHT benutzt.
-- ---------------------------------------------------------------------
create or replace function public.is_active_admin_actor()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    join public.auth_accounts a on a.id = p.id
    where p.id = app.current_user_id()
      and p.role = 'admin'
      and p.is_active
      and not a.is_disabled
  )
$$;
revoke all on function public.is_active_admin_actor() from public, anon, authenticated;
grant execute on function public.is_active_admin_actor() to app_user;

-- ---------------------------------------------------------------------
-- 3b) Datenbankwaechter auf public.auth_accounts
--
-- WAS ER LEISTET:
--   Die Anwendung prueft vor jedem administrativen Eingriff mit
--   assertActiveAdmin, ob die handelnde Identitaet ein aktiver Administrator
--   ist. Diese Pruefung ist Anwendungslogik - sie kann vergessen, umgangen oder
--   ueber einen kuenftigen Weg gar nicht erst durchlaufen werden. Die
--   Rechtematrix allein faengt das NICHT auf: app_user besitzt das
--   `update`-Recht auf public.auth_accounts tabellenweit (0012:102), und die
--   Tabelle traegt keine Policy, die zwischen Selbst- und Fremdaenderung
--   unterscheidet. Ohne diesen Waechter koennte JEDE angemeldete Identitaet ein
--   fremdes Konto sperren oder dessen Passwort ersetzen, sobald ein einziger
--   Anwendungspfad die Pruefung auslaesst.
--   Der Waechter zieht diese Schranke in die Datenbank. Er ersetzt
--   assertActiveAdmin nicht, er ist die zweite, unabhaengige Ebene.
--
-- WARUM BEFORE UND NICHT AFTER:
--   Die Verweigerung muss VOR den AFTER-Audittriggern aus Abschnitt 2 greifen.
--   Ein abgewiesener Versuch soll KEINEN Auditsatz hinterlassen; die Ausnahme
--   rollt die gesamte Transaktion (bzw. die umgebende Subtransaktion) zurueck.
--
-- WARUM SECURITY INVOKER, OBWOHL ABSCHNITT 3 SECURITY DEFINER BENUTZT:
--   Der Waechter muss den TATSAECHLICH ausfuehrenden Rollenkontext kennen, denn
--   Schritt 2 vergleicht `current_user` mit dem Tabelleneigentuemer. In einer
--   SECURITY-DEFINER-Funktion ist `current_user` der Funktionseigentuemer; die
--   Eigentuemerausnahme waere dann IMMER wahr und der Waechter vollstaendig
--   wirkungslos. Deshalb ist genau der RLS-abhaengige Teil - und nur er - in die
--   SECURITY-DEFINER-Hilfsfunktion aus Abschnitt 3a ausgelagert.
--   Ein SECURITY DEFINER auf DIESER Funktion waere also ein Fehler und kein
--   Detail; Abschnitt 4 laesst den Lauf in diesem Fall scheitern.
--   Ein Trigger prueft beim Ausloesen kein EXECUTE-Recht (das wird bei
--   `create trigger` geprueft) - der Aufruf von is_active_admin_actor() aus dem
--   Funktionskoerper heraus dagegen schon. Daher der `grant execute` in 3a.
--
-- WARUM DIE EIGENTUEMERAUSNAHME (Schritt 2) NOETIG IST:
--   Migrationen, Bootstrap und Testfixtures schreiben password_hash,
--   must_change_password und is_disabled im Eigentuemerkontext OHNE gesetzte
--   Identitaet. Belegte Faelle:
--     * app/scripts/bootstrap-admin.mjs:248-257 - Erstinbetriebnahme des ersten
--       Administrators. Dort gibt es per Definition noch keinen Administrator,
--       der den Waechter erfuellen koennte; die Verbindung laeuft ueber
--       BOOTSTRAP_DATABASE_URL, also die Migrationsrolle.
--     * 0012_ap14b_platform_auth.sql:198-209 - Uebernahme der Konten aus der
--       endlichen Kompatibilitaetsschicht.
--     * 19_ap14b_platform.sql:333/344 - Fixtures der Smokes.
--   Ohne die Ausnahme koennte die Datenbank nicht mehr in Betrieb genommen
--   werden.
--
-- WARUM DIE AUSNAHME KEINE LUECKE IST:
--   Wer als Eigentuemer schreibt, koennte den Trigger ohnehin entfernen,
--   aendern oder mit `alter table ... disable trigger` stilllegen. Die Ausnahme
--   schafft also kein Recht, das der Eigentuemer nicht bereits haette.
--   pg_has_role(current_user, <Eigentuemer>, 'USAGE') deckt zugleich Superuser
--   und jede Mitgliedschaft in der Eigentuemerrolle ab.
--   BETRIEBSVORAUSSETZUNG, ausdruecklich benannt: die Anmelderolle der
--   Anwendung darf auf dem Zielserver NICHT Mitglied der Eigentuemerrolle und
--   nicht Superuser sein - sonst ist die Ausnahme fuer den Normalbetrieb
--   erfuellt und der Waechter wirkungslos. `set role app_user` setzt
--   `current_user` auf app_user; genau deshalb messen die Smokes den Waechter
--   tatsaechlich und nicht nur seine Anwesenheit.
--
-- WARUM DER ANMELDEBETRIEB WEITERLAEUFT - die drei belegten Schreibwege:
--   * auth-service.ts:168-178 (Fehlversuch) setzt ausschliesslich
--     failed_attempts und locked_until. Weder is_disabled noch ein
--     Passwortfeld aendert sich -> Schritt 1 laesst durch.
--   * auth-service.ts:189-199 (erfolgreiche Anmeldung) setzt failed_attempts,
--     locked_until, last_login_at und ueber `coalesce($2::text, password_hash)`
--     den Hash NUR dann wirklich, wenn needsRehash gegriffen hat. Der Hash steht
--     also IMMER in der SET-Liste, aendert sich aber fast nie. Deshalb prueft
--     der Waechter auf WERTAENDERUNG (`is distinct from`) und nicht auf die
--     SET-Liste - eine Pruefung der SET-Liste wuerde jede Anmeldung brechen.
--   * Greift needsRehash doch, ist es das Nachziehen eines veralteten
--     Argon2-Parametersatzes und KEIN Passwortwechsel: password_changed_at wird
--     dabei NICHT nachgetragen. Genau daran unterscheidet v_login_rehash den
--     Vorgang vom echten Wechsel - dieselbe Unterscheidung nutzen bereits
--     Abschnitt 2a und Fall P18 in 19_ap14b_platform.sql:555-570.
--     last_login_at ist der verlangte Mitnachweis, dass es sich um die
--     erfolgreiche Anmeldung handelt.
--     WORAN `v_actor is null` WIRKLICH HAENGT - richtiggestellt: die Bedingung
--     beschraenkt den Freibrief darauf, dass in dieser Transaktion KEINE
--     Identitaet gesetzt ist. Sie sagt NICHTS darueber aus, welche
--     TypeScript-Funktion die Transaktion geoeffnet hat; die Datenbank sieht
--     den Aufrufer nicht. Jeder Weg ohne gesetzte app.user_id trifft diesen
--     Zweig - heute ist das im Anwendungscode ausschliesslich Stufe 1 der
--     Anmeldung (withAuthTransaction, app/src/lib/db/index.ts), morgen kann es
--     ein weiterer Weg sein.
--     Was diesen Zustand absichert, ist deshalb NICHT der Funktionsname,
--     sondern die zentrale Anweisungsschranke (app/src/lib/db/statement-guard.ts):
--     sie weist `set_config` und jede Sitzungs-/Transaktionssteuerung an jeder
--     Position ab und verhindert damit, dass fachlicher Code die Identitaet
--     selbst setzt oder loescht. Der Freibrief ist dadurch an die
--     Identitaetslage gebunden und nicht an eine Aufrufstelle.
--
-- WARUM DER SELBSTFALL (Schritt 3) ERLAUBT BLEIBT:
--   changeOwnPassword (auth-service.ts:507-546) laeuft unter der EIGENEN
--   Identitaet und muss fuer JEDE Rolle funktionieren. Andernfalls koennte ein
--   Monteur den nach einem administrativen Reset erzwungenen Wechsel nicht
--   durchfuehren und waere dauerhaft ausgesperrt.
--   `not old.is_disabled and not new.is_disabled` begrenzt den Fall auf ein
--   aktives Konto, und `not v_disable_change` verhindert, dass sich jemand ueber
--   diesen Zweig selbst entsperrt.
--
-- OFFEN UND BEWUSST NICHT GEDECKT - ehrlich benannt:
--   * Eine Anweisung ohne gesetzte Identitaet, die password_hash UND
--     last_login_at gemeinsam aendert, ist auf Datenbankebene von der echten
--     Anmeldung nicht unterscheidbar. Wer ohne Identitaet schreiben kann,
--     kann diesen Zweig also nachbilden.
--   * public.auth_accounts.email deckt dieser Waechter NICHT ab. Eine
--     Adressaenderung ist nicht Gegenstand dieses Arbeitspakets.
--
-- SQLSTATE-VERTRAG: 'KB003' ist neu und frei gewaehlt (benutzerdefinierte
--   Klasse, kein Konflikt mit einem PostgreSQL-Code). Er ist ausdruecklich
--   NICHT 'KB001' (fachlicher Schutz des letzten Administrators, von
--   app/src/lib/admin-users.ts nach `last_admin` uebersetzt), NICHT 'KB002'
--   (Konfigurationsfehler der Isolationsstufe) und NICHT '42501'
--   (trg_protect_profile aus 0001). 'KB003' bedeutet genau eines: die
--   Anwendungsschranke assertActiveAdmin wurde umgangen oder fehlt. Er darf
--   NICHT in einen fachlichen Rueckgabewert uebersetzt werden, sondern muss als
--   technischer Fehler sichtbar durchschlagen.
--
-- TRIGGERREIHENFOLGE: BEFORE-Trigger feuern in alphabetischer Namensfolge.
--   trg_protect_auth_account_admin_change sortiert vor trg_touch_auth_accounts
--   (0012:96-99). Das ist ohne Belang: der Waechter wertet weder updated_at noch
--   updated_by aus.
-- ---------------------------------------------------------------------
create or replace function public.tg_protect_auth_account_admin_change()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare
  v_actor uuid := app.current_user_id();
  v_disable_change boolean;
  v_password_change boolean;
  v_login_rehash boolean;
begin
  v_disable_change := new.is_disabled is distinct from old.is_disabled;

  v_password_change :=
         new.password_hash        is distinct from old.password_hash
      or new.password_changed_at  is distinct from old.password_changed_at
      or new.must_change_password is distinct from old.must_change_password;

  -- Anmeldevorgang mit Nachziehen eines veralteten Parametersatzes.
  v_login_rehash :=
         v_actor is null
     and new.password_hash        is distinct from old.password_hash
     and new.password_changed_at  is not distinct from old.password_changed_at
     and new.must_change_password is not distinct from old.must_change_password
     and new.last_login_at        is distinct from old.last_login_at;

  -- 1) Nicht sensibel: Anmeldebetrieb und Verwaltungsspalten.
  if not v_disable_change and (not v_password_change or v_login_rehash) then
    return new;
  end if;

  -- 2) Eigentuemer-/Wartungskontext.
  if pg_catalog.pg_has_role(
       current_user,
       (select c.relowner from pg_catalog.pg_class c
         where c.oid = 'public.auth_accounts'::regclass),
       'USAGE') then
    return new;
  end if;

  -- 3) Eigener echter Passwortwechsel des betroffenen aktiven Kontos.
  if not v_disable_change
     and v_actor is not null
     and v_actor = new.id
     and not old.is_disabled
     and not new.is_disabled then
    return new;
  end if;

  -- 4) Alles Uebrige verlangt eine in DIESER Transaktion aus der Datenbank
  --    bestaetigte, aktive Adminrolle.
  if not public.is_active_admin_actor() then
    raise exception
      'Administrative Aenderung an public.auth_accounts ohne aktive Adminrolle verweigert.'
      using errcode = 'KB003';
  end if;

  return new;
end $$;
revoke all on function public.tg_protect_auth_account_admin_change() from public, anon, authenticated;

drop trigger if exists trg_protect_auth_account_admin_change on public.auth_accounts;
create trigger trg_protect_auth_account_admin_change
  before update on public.auth_accounts
  for each row execute function public.tg_protect_auth_account_admin_change();

-- ---------------------------------------------------------------------
-- 3c) Haertung des Rollenwaechters auf public.profiles
--
-- BEFUND ZUM BESTEHENDEN trg_protect_profile (0001_init.sql:419-434, von 0012
-- auf app.current_user_id() portiert - siehe 0012:312-329): er erfuellt den
-- geforderten Datenbankvertrag NICHT vollstaendig.
--   * Er laesst bei NICHT gesetzter Identitaet ohne jede weitere Pruefung durch
--     (`if app.current_user_id() is null or public.is_admin() then return new`,
--     0001_init.sql:423-425). Fuer app_user faengt das die Policy
--     profiles_update (0001_init.sql:512-514) ab, weil deren USING-Ausdruck ohne
--     Identitaet keine Zeile liefert; der Trigger ALLEIN ist an dieser Stelle
--     aber fail-open.
--   * Er stuetzt sich auf public.is_admin() (0001_init.sql:59-61), das
--     ausschliesslich profiles.role liest. Ein DEAKTIVIERTES Profil
--     (is_active = false) oder ein GESPERRTES Konto (is_disabled = true) mit der
--     Rolle 'admin' kommt damit heute durch - genau die Luecke, die
--     assertActiveAdmin in der Anwendung schliesst und die die Datenbank bisher
--     nicht kennt.
--
-- 0001_init.sql wird NICHT geaendert. Stattdessen tritt hier ein zweiter,
-- gleichartiger Waechter daneben.
--
-- DER NAME IST LASTTRAGEND - nicht umbenennen:
--   BEFORE-Trigger feuern in alphabetischer Namensfolge. 'trg_protect_profile'
--   sortiert VOR 'trg_protect_profile_active_admin'. Dadurch bleibt fuer einen
--   Nicht-Administrator weiterhin der bestehende SQLSTATE '42501' das Ergebnis
--   (bestehende Erwartung u. a. in 23_ap14b_admin_users.sql, Fall U10), und der
--   neue Waechter greift ausschliesslich in dem Fall, den der alte durchlaesst:
--   Rolle 'admin', aber Profil inaktiv oder Konto gesperrt. Ein Umbenennen
--   dieses Triggers wuerde bestehende Nachweise still umdrehen, weil dann
--   'KB003' statt '42501' entstuende.
--
-- WARUM AUSSCHLIESSLICH role:
--   profiles.is_active ist fuer app_user ohnehin nicht aenderbar - Abschnitt 1
--   erteilt das update spaltenbezogen nur auf role, und Negativpruefung 1 belegt
--   das negativ ueber pg_attribute. Eine Pruefung auf is_active waere hier
--   totes Recht.
--
-- SECURITY INVOKER, Eigentuemerausnahme und SQLSTATE 'KB003': dieselbe
-- Begruendung wie in Abschnitt 3b, einschliesslich der Betriebsvoraussetzung,
-- dass die Anmelderolle der Anwendung nicht Mitglied der Eigentuemerrolle ist.
-- ---------------------------------------------------------------------
create or replace function public.tg_protect_profile_active_admin()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.role is not distinct from old.role then
    return new;
  end if;

  if pg_catalog.pg_has_role(
       current_user,
       (select c.relowner from pg_catalog.pg_class c
         where c.oid = 'public.profiles'::regclass),
       'USAGE') then
    return new;
  end if;

  if not public.is_active_admin_actor() then
    raise exception
      'Rollenwechsel auf public.profiles ohne aktive Adminrolle verweigert.'
      using errcode = 'KB003';
  end if;

  return new;
end $$;
revoke all on function public.tg_protect_profile_active_admin() from public, anon, authenticated;

drop trigger if exists trg_protect_profile_active_admin on public.profiles;
create trigger trg_protect_profile_active_admin
  before update on public.profiles
  for each row execute function public.tg_protect_profile_active_admin();

-- ---------------------------------------------------------------------
-- 3d) Plausibilitaetswaechter auf den Sperrspalten failed_attempts und
--     locked_until
--
-- DIE BELEGTE LUECKE, DIE ER SCHLIESST:
--   Der Waechter aus Abschnitt 3b gibt in seinem Schritt 1 alles frei, was weder
--   is_disabled noch ein Passwortfeld aendert - genau damit der Anmeldebetrieb
--   weiterlaeuft. Ein reines
--     `update public.auth_accounts set failed_attempts = 0, locked_until = null`
--   und ebenso ein reines Setzen einer Sperre laufen dort deshalb UNGEPRUEFT
--   durch. app_user besitzt das `update` auf dieser Tabelle tabellenweit
--   (0012:102), und die Tabelle traegt keine Policy. Jede angemeldete Identitaet
--   - und jeder Weg, der ohne Identitaet schreiben kann - koennte damit ein
--   FREMDES Konto entsperren oder sperren, ohne dass eine einzige Schranke
--   anschlaegt. Die Anmeldesperre waere eine Empfehlung.
--
-- WAS ER PRUEFT: nicht "wer", sondern "ergibt der Schritt ueberhaupt Sinn". Er
-- laesst genau die Uebergaenge zu, die der reale Anmeldeweg erzeugt, und weist
-- alles Uebrige mit SQLSTATE 'KB004' ab.
--
-- DIE VIER SCHREIBSTELLEN DIESER BEIDEN SPALTEN IM ANWENDUNGSCODE - vollstaendig
-- aufgezaehlt, denn der Waechter muss jede von ihnen durchlassen:
--   1. auth-service.ts:168-178  Fehlversuch, OHNE Identitaet     -> Zaehlzweig
--   2. auth-service.ts:189-199  erfolgreiche Anmeldung, OHNE     -> Ruecksetzzweig
--                               Identitaet, setzt last_login_at
--   3. auth-service.ts:535-546  changeOwnPassword, eigene        -> Ruecksetzzweig
--                               Identitaet, setzt password_changed_at
--   4. admin-users.ts:309-320   adminResetPassword, Adminidentitaet,
--                               setzt password_changed_at        -> Ruecksetzzweig
--
-- ZAHLENKOPPLUNG - AUSDRUECKLICH UND BEWUSST:
--   Die 5 und die 15 in diesem Waechter sind die SPIEGELUNG der Konstanten
--   MAX_FAILED_ATTEMPTS = 5 (app/src/lib/auth-service.ts:37) und
--   LOCK_MINUTES = 15 (app/src/lib/auth-service.ts:38). Es gibt bewusst KEINE
--   Konfigurationstabelle: eine zweite Wahrheit ueber dieselbe Zahl waere
--   schlimmer als die doppelte Nennung, weil sie stillschweigend auseinander
--   laufen kann.
--   WER DORT AENDERT, MUSS HIER AENDERN. Tut er es nicht, bricht der
--   Anmeldebetrieb FAIL-CLOSED: der naechste Fehlversuch, der die neue Grenze
--   trifft, endet mit 'KB004' - laut, sofort und sichtbar. Er wird NICHT still
--   aufgeweicht. Das ist die gewollte Richtung des Fehlers.
--
-- WARUM SECURITY INVOKER: dieselbe Begruendung wie in 3b - Schritt 2 vergleicht
--   `current_user` mit dem Tabelleneigentuemer. Als SECURITY DEFINER waere die
--   Eigentuemerausnahme immer erfuellt und der Waechter wirkungslos. Abschnitt 4
--   laesst den Lauf scheitern, falls das je passiert.
--
-- WARUM BEFORE: die Verweigerung muss vor den AFTER-Audittriggern greifen; ein
--   abgewiesener Versuch hinterlaesst keinen Auditsatz - auch keinen aus 2d.
--
-- WARUM DIE ABLAUFPRUEFUNG MIT clock_timestamp() UND NICHT MIT now():
--   Waehrend einer AKTIVEN Sperre schreibt der reale Code nicht - er bricht in
--   auth-service.ts:153-155 ab, BEVOR eine Anweisung laeuft. "locked_until ist
--   an der Zaehlstelle gesetzt" bedeutet dort also immer "abgelaufen".
--   now() ist die Zeit des TRANSAKTIONSBEGINNS, nicht die des Schreibens.
--   Zwischen dem Beginn der Anmeldetransaktion und dem UPDATE liegt die
--   Passwortpruefung (Argon2id, Groessenordnung 100 ms). Eine Sperre, die genau
--   in diesem Fenster ablaeuft, ist fuer auth-service.ts:153-155 (Vergleich
--   gegen die echte Uhr) bereits abgelaufen, fuer now() aber noch aktiv. Mit
--   now() wuerde dieser voellig regulaere Fehlversuch mit 'KB004' abgewiesen -
--   ein echter, wenn auch seltener Anmeldefall waere gebrochen.
--   clock_timestamp() liefert die Zeit der Auswertung selbst und bildet damit
--   genau die Frage ab, die gemeint ist: "ist die Sperre IM AUGENBLICK DES
--   SCHREIBENS zu Ende?" Das schwaecht nichts ab - eine wirklich laufende Sperre
--   ist auch nach der echten Uhr aktiv und bleibt abgewiesen.
--   Der obere Rand der neuen Sperre wird dagegen bewusst gegen now() geprueft:
--   der Anwendungscode berechnet ihn als `now() + make_interval(mins => 15)`
--   (auth-service.ts:171-175), also aus DERSELBEN Transaktionszeit.
--
-- DIE MINUTE TOLERANZ: `new.locked_until <= now() + interval '15 minutes' +
--   interval '1 minute'` laesst ausdruecklich Laufzeitspielraum. Der reale Wert
--   trifft die 15 Minuten exakt; die zusaetzliche Minute faengt Uhr- und
--   Rundungsunterschiede ab, ohne eine Sperre zuzulassen, die den Betroffenen
--   nennenswert laenger aussperrt als vorgesehen. Eine Sperre ueber Jahre - der
--   eigentliche Missbrauch - faellt damit weiterhin durch.
--
-- SQLSTATE-VERTRAG: 'KB004' ist neu und frei gewaehlt (benutzerdefinierte
--   Klasse). Er ist NICHT 'KB003' (fehlende aktive Adminrolle, Abschnitte 3b/3c)
--   und NICHT 'KB001'/'KB002'. 'KB004' bedeutet genau eines: der versuchte
--   Uebergang der Sperrspalten entspricht keinem Vorgang, den der Anmeldeweg
--   oder ein Passwortvorgang erzeugt. Er ist ein technischer Fehler und darf
--   NICHT in einen fachlichen Rueckgabewert uebersetzt werden.
--
-- AUSDRUECKLICH NICHT GEDECKT - ehrlich benannt:
--   * Ein aktiver Administrator darf ueber den Ruecksetzzweig entsperren. Das
--     ist gewollt (Schreibstelle 4 laeuft genau so), bedeutet aber: die
--     Fremdentsperrung ist an eine aktive Adminrolle gebunden, nicht an einen
--     bestimmten Anwendungsvorgang. Eine eigene administrative Entsperrfunktion
--     gibt es in diesem Arbeitspaket NICHT; ob es sie geben soll, ist eine offene
--     Architekturfrage und ausdruecklich nicht hier entschieden.
--   * Der Eigentuemerkontext bleibt frei (Bootstrap, Migration, Fixtures) -
--     dieselbe Begruendung wie in 3b.
-- ---------------------------------------------------------------------
create or replace function public.tg_protect_auth_account_lockout()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare
  -- Der Zaehlerstand, den GENAU DIESER Schritt ergeben muss. Eine abgelaufene
  -- Sperre setzt den Zaehler zurueck - dieselbe Rechnung wie in
  -- auth-service.ts:163 (`previousAttempts`).
  v_expected integer;
begin
  -- 1) Keine der beiden Sperrspalten geaendert. Das ist der Normalfall fast
  --    jeder Anweisung auf dieser Tabelle; der Waechter hat dann nichts zu
  --    sagen.
  if new.failed_attempts is not distinct from old.failed_attempts
     and new.locked_until is not distinct from old.locked_until then
    return new;
  end if;

  -- 2) Eigentuemer-/Wartungskontext (Form und Begruendung wie in Abschnitt 3b).
  if pg_catalog.pg_has_role(
       current_user,
       (select c.relowner from pg_catalog.pg_class c
         where c.oid = 'public.auth_accounts'::regclass),
       'USAGE') then
    return new;
  end if;

  -- 3) RUECKSETZZWEIG: Zaehler auf 0 und Sperre aufgehoben.
  --    Zulaessig ist das nur als Teil eines Vorgangs, der genau das
  --    rechtfertigt. Die drei Bedingungen sind getrennte `if`, damit die
  --    Reihenfolge der Auswertung feststeht: die beiden billigen
  --    Spaltenvergleiche zuerst, der Datenbankzugriff aus 3a zuletzt.
  if new.failed_attempts = 0 and new.locked_until is null then
    -- Erfolgreiche Anmeldung (Schreibstelle 2).
    if new.last_login_at is distinct from old.last_login_at then
      return new;
    end if;
    -- Eigener Passwortwechsel oder administrativer Reset (Schreibstellen 3/4).
    if new.password_changed_at is distinct from old.password_changed_at then
      return new;
    end if;
    -- Bestaetigte aktive Adminrolle.
    if public.is_active_admin_actor() then
      return new;
    end if;

    raise exception
      'Zuruecksetzen von failed_attempts/locked_until ohne Anmeldung, ohne Passwortvorgang und ohne aktive Adminrolle verweigert.'
      using errcode = 'KB004';
  end if;

  -- 4) ZAEHLZWEIG: alles Uebrige muss ein einzelner, plausibler Fehlversuch
  --    sein.

  -- 4a) Waehrend einer wirklich laufenden Sperre schreibt der reale Code nicht.
  --     Ohne diese Bedingung liesse sich eine stehende Sperre durch einen
  --     "Zaehlschritt auf 1" abraeumen - eine Entsperrung durch die Hintertuer.
  --     Zur clock_timestamp()-Wahl siehe den Kopf dieses Abschnitts.
  if old.locked_until is not null and old.locked_until > clock_timestamp() then
    raise exception
      'Aenderung von failed_attempts/locked_until waehrend einer laufenden Sperre verweigert.'
      using errcode = 'KB004';
  end if;

  v_expected := (case when old.locked_until is null then old.failed_attempts else 0 end) + 1;

  -- 4b) Genau EIN Schritt nach oben - kein Sprung, kein Sturz, kein Verharren.
  if new.failed_attempts <> v_expected then
    raise exception
      'failed_attempts muss in genau einem Schritt auf % steigen (gefunden: %).',
      v_expected, new.failed_attempts
      using errcode = 'KB004';
  end if;

  -- 4c) Obergrenze. Sie ist die Spiegelung von MAX_FAILED_ATTEMPTS = 5
  --     (app/src/lib/auth-service.ts:37).
  if new.failed_attempts > 5 then
    raise exception
      'failed_attempts ueberschreitet die Obergrenze 5 (gefunden: %).',
      new.failed_attempts
      using errcode = 'KB004';
  end if;

  -- 4d) Ein Fehlversuch ist keine Anmeldung.
  if new.last_login_at is distinct from old.last_login_at then
    raise exception
      'Ein Zaehlschritt auf failed_attempts darf last_login_at nicht veraendern.'
      using errcode = 'KB004';
  end if;

  -- 4e) Sperre genau dann - und genau so lange -, wie der Anwendungscode sie
  --     setzt. Die 15 Minuten sind die Spiegelung von LOCK_MINUTES = 15
  --     (app/src/lib/auth-service.ts:38), die zusaetzliche Minute ist die im
  --     Kopf begruendete Laufzeittoleranz.
  if new.failed_attempts >= 5 then
    if new.locked_until is null
       or new.locked_until <= now()
       or new.locked_until > now() + interval '15 minutes' + interval '1 minute' then
      raise exception
        'Mit dem Erreichen der Obergrenze muss locked_until auf hoechstens 15 Minuten in der Zukunft stehen.'
        using errcode = 'KB004';
    end if;
  else
    if new.locked_until is not null then
      raise exception
        'Unterhalb der Obergrenze darf keine Sperre gesetzt werden (failed_attempts = %).',
        new.failed_attempts
        using errcode = 'KB004';
    end if;
  end if;

  return new;
end $$;
revoke all on function public.tg_protect_auth_account_lockout() from public, anon, authenticated;

-- TRIGGERREIHENFOLGE - der Name ist lasttragend: BEFORE-Trigger feuern in
-- alphabetischer Namensfolge. 'trg_protect_auth_account_admin_change' sortiert
-- VOR 'trg_protect_auth_account_lockout'. Eine Anweisung, die BEIDE Vertraege
-- verletzt (etwa ein fremder Passwort-Reset ohne Adminrolle, der nebenbei die
-- Sperrspalten faelscht), meldet deshalb weiterhin 'KB003' - die fehlende
-- Adminrolle ist der uebergeordnete Befund. Wer diesen Trigger umbenennt, dreht
-- bestehende Nachweise still um.
drop trigger if exists trg_protect_auth_account_lockout on public.auth_accounts;
create trigger trg_protect_auth_account_lockout
  before update on public.auth_accounts
  for each row execute function public.tg_protect_auth_account_lockout();

-- ---------------------------------------------------------------------
-- 3e) Massenwaechter: eine Anweisung, ein Konto
--
-- WAS ER LEISTET: 3d prueft JEDE ZEILE fuer sich. Eine einzige Anweisung
--   `update public.auth_accounts set failed_attempts = failed_attempts + 1`
-- ohne where-Bedingung besteht diese Zeilenpruefung fuer jede einzelne Zeile und
-- verschoebe trotzdem den Zaehlerstand der GESAMTEN Benutzerschaft in einem
-- Schritt - mit genuegend Wiederholungen bis zur flaechendeckenden Sperre. Der
-- reale Anwendungscode tut das nie: alle vier Schreibstellen (Aufzaehlung in 3d)
-- treffen ueber `where id = $1::uuid` HOECHSTENS EINE Zeile, denn
-- public.auth_accounts.id ist der Primaerschluessel.
-- Dieser Waechter macht daraus eine Zusage: mehr als ein betroffenes Konto je
-- Anweisung endet mit SQLSTATE 'KB005'.
--
-- WARUM AFTER UND FOR EACH STATEMENT: Uebergangstabellen (`referencing old table
-- ... new table ...`) sind in PostgreSQL ausschliesslich fuer AFTER-Trigger
-- zulaessig, und nur sie erlauben die Aussage ueber die GANZE Anweisung. Die
-- Ausnahme rollt die Transaktion (bzw. die umgebende Subtransaktion) zurueck -
-- einschliesslich der bereits geschriebenen Auditsaetze aus 2b und 2d und
-- einschliesslich der Datenaenderung selbst. Ein abgewiesener Massenzugriff
-- hinterlaesst also nichts.
--
-- DIE GRENZE - AUSDRUECKLICH BENANNT, DAMIT NIEMAND MEHR ERWARTET:
--   Eine SCHLEIFE aus n Einzelanweisungen umgeht diesen Waechter vollstaendig.
--   Er verhindert den Massenzugriff, nicht die Wiederholung. Seinen Wert
--   entfaltet er erst ZUSAMMEN mit 3d: dort kostet jede Sperre fuenf plausible,
--   aufeinanderfolgende Zaehlschritte JE KONTO, von denen jeder einzelne die
--   Reihenfolge einhalten muss und der letzte einen Auditsatz aus 2d
--   hinterlaesst. Aus einer stillen Anweisung wird damit ein lautes,
--   nachgezeichnetes Vielfaches.
--
-- WARUM UEBER id VERBUNDEN WIRD: die beiden Uebergangstabellen sind
-- unsortierte Mengen; die Zuordnung alt/neu laeuft ueber den Primaerschluessel.
-- Eine Anweisung, die id SELBST aendert, faende die Verbindung nicht - sie kommt
-- im Anwendungscode nicht vor (id ist Primaerschluessel und Ziel der
-- Fremdschluessel aus public.profiles) und bliebe im Eigentuemerkontext ohnehin
-- erlaubt.
--
-- KOSTEN, ehrlich benannt: ein Statement-Trigger mit Uebergangstabellen laesst
-- PostgreSQL die alten und neuen Zeilen JEDER Anweisung auf dieser Tabelle
-- zwischenspeichern - auch derjenigen, die die Sperrspalten gar nicht anfassen.
-- public.auth_accounts ist eine kleine Tabelle mit einzeiligen Anweisungen im
-- Normalbetrieb; der Aufwand ist damit vertretbar. Eine Einschraenkung ueber
-- `after update of failed_attempts, locked_until` waere billiger, haengt aber an
-- der SET-Liste statt an der Wertaenderung und waere damit von einem kuenftigen
-- BEFORE-Trigger aushebelbar, der eine Spalte ausserhalb der SET-Liste setzt.
--
-- SECURITY INVOKER und Eigentuemerausnahme: dieselbe Begruendung wie in 3b/3d.
-- Ohne die Ausnahme braechen Bootstrap, Migration und Fixtures, die mehrere
-- Konten in einer Anweisung anfassen.
-- ---------------------------------------------------------------------
create or replace function public.tg_protect_auth_account_lockout_bulk()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare
  v_touched bigint;
begin
  -- Eigentuemer-/Wartungskontext.
  if pg_catalog.pg_has_role(
       current_user,
       (select c.relowner from pg_catalog.pg_class c
         where c.oid = 'public.auth_accounts'::regclass),
       'USAGE') then
    return null;
  end if;

  select count(*)
  into v_touched
  from old_auth_accounts o
  join new_auth_accounts n on n.id = o.id
  where n.failed_attempts is distinct from o.failed_attempts
     or n.locked_until    is distinct from o.locked_until;

  if v_touched > 1 then
    raise exception
      'Eine einzelne Anweisung darf failed_attempts/locked_until hoechstens eines Kontos aendern (betroffen: %).',
      v_touched
      using errcode = 'KB005';
  end if;

  -- Der Rueckgabewert eines AFTER-Triggers wird verworfen.
  return null;
end $$;
revoke all on function public.tg_protect_auth_account_lockout_bulk() from public, anon, authenticated;

drop trigger if exists trg_protect_auth_account_lockout_bulk on public.auth_accounts;
create trigger trg_protect_auth_account_lockout_bulk
  after update on public.auth_accounts
  referencing old table as old_auth_accounts new table as new_auth_accounts
  for each statement execute function public.tg_protect_auth_account_lockout_bulk();

-- ---------------------------------------------------------------------
-- 4) Abschlusspruefung (fail-closed)
--
-- Positiv: jedes Recht, jede Funktion und jeder Trigger, auf die die
-- administrative Benutzerverwaltung angewiesen ist, muss tatsaechlich vorhanden
-- sein.
-- Negativ: die ausdruecklich verweigerten Rechte duerfen nicht vorhanden sein -
-- auch nicht mittelbar ueber eine Gruppenrolle, denn has_*_privilege
-- beruecksichtigt die Rollenmitgliedschaft.
-- ---------------------------------------------------------------------

-- Positiv 1: Tabellen- und Spaltenrechte.
--
-- has_table_privilege beantwortet ausschliesslich die Frage nach dem
-- TABELLENRECHT; bei einem rein spaltenbezogen erteilten update liefert es
-- false. Das update steht deshalb NICHT in dieser Schleife, sondern im
-- Spaltenblock - und, als Nachweis der Begrenzung, in Negativpruefung 1.
do $$
declare
  item record;
  missing text[] := array[]::text[];
begin
  for item in
    select * from (values
      -- Herkunft 0012:114, NICHT von dieser Migration erteilt: WAECHTER ueber
      -- das Leserecht, ohne das weder die Sitzungsauswertung noch die
      -- Benutzerliste eine Zeile faende.
      ('public.profiles', 'select'),
      -- Herkunft 0012:102, ebenfalls nur WAECHTER: Kontosperre und
      -- Passwort-Reset schreiben public.auth_accounts, der Sitzungswiderruf
      -- public.auth_sessions.
      ('public.auth_accounts', 'select'),
      ('public.auth_accounts', 'update'),
      ('public.auth_sessions', 'select'),
      ('public.auth_sessions', 'update')
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

  if not has_column_privilege('app_user', 'public.profiles', 'role', 'update') then
    raise exception
      'AP14/B: app_user fehlt das update-Recht auf public.profiles.role - kein Rollenwechsel moeglich';
  end if;

  -- Ausfuehrungsrecht auf die Hilfsfunktion aus Abschnitt 3a. Ohne dieses Recht
  -- scheitert JEDER Waechteraufruf der Abschnitte 3b und 3c unter app_user mit
  -- 42501 - und zwar erst zur Laufzeit, mitten im Betrieb: ein Trigger prueft
  -- beim Ausloesen kein Ausfuehrungsrecht, der Funktionsaufruf in seinem
  -- Koerper dagegen schon. Diese Pruefung faengt das hier ab.
  if not has_function_privilege('app_user', 'public.is_active_admin_actor()', 'execute') then
    raise exception
      'AP14/B: app_user fehlt das execute-Recht auf public.is_active_admin_actor() - die Waechter aus 3b/3c koennen nicht laufen';
  end if;

  raise notice
    'AP14/B: app_user darf public.profiles.role aendern und public.is_active_admin_actor() aufrufen; Waechter auf profiles, auth_accounts und auth_sessions bestehen';
end
$$;

-- Positiv 2: alle zehn Funktionen dieser Datei bestehen - und JEDE in der
-- fuer sie richtigen Ausfuehrungsart. Geprueft werden ZWEI getrennte
-- Erwartungen, denn hier ist beides ein Fehler: ein fehlender wie ein zu viel
-- gesetzter SECURITY DEFINER.
--
--   * SECURITY DEFINER ist Pflicht fuer die fuenf Triggerfunktionen der
--     Abschnitte 2 und 3 sowie fuer die Hilfsfunktion aus 3a. Ohne prosecdef
--     wuerde der Audit an der fehlenden Insert-Policy von public.audit_events
--     scheitern, die Zaehlung des Schutztriggers durch die RLS von
--     public.profiles gefiltert und die Rollenauskunft aus 3a auf einer
--     gefilterten Sicht entschieden - alles drei wuerde nicht auffallen,
--     sondern still falsch arbeiten. Fuer den Sperr-Audit aus 2d gilt es
--     zusaetzlich haerter: ohne prosecdef braeche JEDE Sperre und JEDE
--     Entsperrung des Anmeldebetriebs mit 42501 ab.
--   * SECURITY INVOKER ist Pflicht fuer die vier Waechter aus 3b, 3c, 3d und
--     3e. Ein SECURITY DEFINER waere dort ein FEHLER und muss den Lauf
--     abbrechen: in einer SECURITY-DEFINER-Funktion ist `current_user` der
--     Funktionseigentuemer, die Eigentuemerausnahme waere damit IMMER erfuellt
--     und der Waechter vollstaendig wirkungslos - ohne jede Fehlermeldung im
--     Betrieb.
do $$
declare
  v_name text;
  missing text[] := array[]::text[];
  not_definer text[] := array[]::text[];
  not_invoker text[] := array[]::text[];
  v_secdef boolean;
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
    raise exception
      'AP14/B: Funktion(en) fehlen: %', array_to_string(missing, ', ');
  end if;
  if array_length(not_definer, 1) is not null then
    raise exception
      'AP14/B: Funktion(en) ohne SECURITY DEFINER: %',
      array_to_string(not_definer, ', ');
  end if;
  if array_length(not_invoker, 1) is not null then
    raise exception
      'AP14/B: Waechter mit SECURITY DEFINER statt SECURITY INVOKER - die Eigentuemerausnahme waere immer erfuellt und der Waechter wirkungslos: %',
      array_to_string(not_invoker, ', ');
  end if;

  raise notice
    'AP14/B: sechs Funktionen als SECURITY DEFINER und vier Waechter als SECURITY INVOKER definiert';
end
$$;

-- Positiv 3: die Trigger haengen an den erwarteten Tabellen. Der Schutztrigger
-- muss an BEIDEN Tabellen haengen; fehlte er an public.auth_accounts, liesse
-- sich der letzte Administrator ueber die Kontosperre trotzdem entfernen.
-- Eine Funktion ohne ihren Trigger ist wirkungslos, faellt aber nirgends auf -
-- deshalb werden Funktion (Positiv 2) und Aufhaengung getrennt geprueft.
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
      -- Die beiden Waechter aus 3b und 3c. Ihre NAMEN sind lasttragend: die
      -- alphabetische Reihenfolge der BEFORE-Trigger entscheidet, welcher
      -- SQLSTATE ein Nicht-Administrator sieht (Begruendung in Abschnitt 3c).
      ('public.auth_accounts', 'trg_protect_auth_account_admin_change'),
      ('public.profiles', 'trg_protect_profile_active_admin'),
      -- Der Sperr-Audit aus 2d und die beiden Waechter aus 3d/3e. Ohne den
      -- Statement-Trigger aus 3e bliebe die Zeilenpruefung aus 3d fuer eine
      -- Anweisung ohne where-Bedingung wirkungslos.
      ('public.auth_accounts', 'trg_audit_auth_account_lockout'),
      ('public.auth_accounts', 'trg_protect_auth_account_lockout'),
      ('public.auth_accounts', 'trg_protect_auth_account_lockout_bulk')
    ) as t(table_name, trigger_name)
  loop
    if not exists (
      select 1
      from pg_trigger tg
      where tg.tgrelid = item.table_name::regclass
        and tg.tgname = item.trigger_name
        and not tg.tgisinternal
    ) then
      missing := array_append(missing, item.table_name || ' ' || item.trigger_name);
    end if;
  end loop;

  if array_length(missing, 1) is not null then
    raise exception
      'AP14/B: Trigger fehlen: %', array_to_string(missing, ', ');
  end if;

  raise notice
    'AP14/B: alle zehn Trigger vorhanden, der Schutz des letzten Administrators an profiles UND auth_accounts, alle vier Waechter und der Sperr-Audit aufgehaengt';
end
$$;

-- Negativpruefung 1: die Spaltenbegrenzung des update auf public.profiles.
--
-- Die Spaltenliste wird bewusst NICHT haendisch gefuehrt, sondern aus
-- pg_attribute gelesen. Eine haendische Liste (id, full_name, phone, is_active,
-- created_at, created_by, updated_at, updated_by) waere ab dem Tag falsch, an
-- dem eine Migration eine Spalte ergaenzt: die neue Spalte fiele durch das
-- Raster und niemand bemerkte ihre versehentliche Freigabe.
--
-- Zusaetzlich wird das TABELLENWEITE update mit has_table_privilege geprueft.
-- has_column_privilege liefert bei einer tabellenweiten Vergabe fuer JEDE
-- Spalte true und wuerde zwar ebenfalls anschlagen, die Ursache aber nicht
-- benennen. Erst beide Pruefungen zusammen sind eindeutig.
do $$
declare
  item record;
  unexpected text[] := array[]::text[];
begin
  if has_table_privilege('app_user', 'public.profiles', 'update') then
    raise exception
      'AP14/B: app_user besitzt ein TABELLENWEITES update auf public.profiles - die Spaltenbegrenzung ist ausgehebelt';
  end if;

  for item in
    select a.attname::text as column_name
    from pg_attribute a
    where a.attrelid = 'public.profiles'::regclass
      and a.attnum > 0
      and not a.attisdropped
      and a.attname::text <> 'role'
    order by a.attnum
  loop
    if has_column_privilege('app_user', 'public.profiles', item.column_name, 'update') then
      unexpected := array_append(unexpected, item.column_name);
    end if;
  end loop;

  if array_length(unexpected, 1) is not null then
    raise exception
      'AP14/B: app_user darf unerwartete Spalte(n) von public.profiles aendern: %',
      array_to_string(unexpected, ', ');
  end if;

  raise notice
    'AP14/B: ausser role ist keine Spalte von public.profiles fuer app_user aenderbar (Katalogabgleich ueber pg_attribute)';
end
$$;

-- Negativpruefung 2: keine Kontoanlage und kein physisches Loeschen eines
-- Benutzers durch die Anwendungsrolle. Die Policies profiles_insert und
-- profiles_delete bestehen unveraendert weiter und waeren fuer eine
-- Administratoridentitaet erfuellt - die tragende Schranke ist deshalb das
-- fehlende Tabellenrecht.
do $$
declare
  item record;
  unexpected text[] := array[]::text[];
begin
  for item in
    select * from (values
      ('public.profiles', 'insert'),
      ('public.profiles', 'delete'),
      ('public.profiles', 'truncate'),
      ('public.profiles', 'references'),
      ('public.profiles', 'trigger')
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

  raise notice
    'AP14/B: kein insert und kein delete auf public.profiles - keine Kontoanlage, kein physisches Loeschen';
end
$$;

-- Negativpruefung 3: der Audit bleibt fuer die Anwendungsrolle vollstaendig
-- unerreichbar - lesend und schreibend, auch mittelbar. Geschrieben wird
-- ausschliesslich durch die SECURITY-DEFINER-Trigger aus Abschnitt 2.
--
-- Geprueft werden die sieben klassischen Tabellenprivilegien. Das seit
-- PostgreSQL 17 zusaetzliche MAINTAIN wird bewusst NICHT geprueft: es erlaubt
-- ausschliesslich Wartungsbefehle und keinen Datenzugriff, und
-- has_table_privilege wuerde bei einem der Zielversion unbekannten
-- Privilegnamen mit einem Fehler abbrechen.
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

  raise notice 'AP14/B: public.audit_events bleibt fuer app_user unerreichbar';
end
$$;

-- Negativpruefung 4: app_user bleibt eine nicht privilegierte Rolle. Ohne diese
-- Pruefung waere die gesamte Rechtematrix wertlos - mit SUPERUSER oder
-- BYPASSRLS gilt keine Policy und keine Spaltenbegrenzung.
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

  raise notice 'AP14/B: app_user ohne SUPERUSER und ohne BYPASSRLS';
end
$$;

-- Negativpruefung 4a: app_user ist NICHT Mitglied der Eigentuemerrolle.
--
-- WARUM ZUSAETZLICH ZU NEGATIVPRUEFUNG 4: dort werden ausschliesslich die
-- ROLLENATTRIBUTE rolsuper und rolbypassrls gelesen. Diese Attribute werden
-- ueber eine Mitgliedschaft NICHT vererbt - eine Rolle kann also alle Rechte
-- eines Superusers ueber `set role` erhalten, ohne dass rolsuper bei ihr selbst
-- gesetzt waere. Fuer diese Datei ist das nicht theoretisch: die
-- Eigentuemerausnahme der Waechter aus 3b, 3c und 3d ist erfuellt, sobald der
-- Schreibende Mitglied der Eigentuemerrolle ist. Waere app_user Mitglied, liefe
-- der Normalbetrieb dauerhaft in diese Ausnahme, saemtliche Waechter waeren
-- wirkungslos - und zwar ohne jede Fehlermeldung.
--
-- WARUM 'MEMBER' UND NICHT 'USAGE': 'USAGE' fragt nach der automatischen
-- Vererbung. Eine mit `noinherit` versehene Mitgliedschaft liefert dort false,
-- erlaubt aber weiterhin `set role <eigentuemer>`; ab PostgreSQL 16 steuert
-- jedes `grant ... with inherit/set` beides getrennt. Fuer eine
-- Betriebsvoraussetzung ist deshalb der strengere Modus 'MEMBER' richtig. Dass
-- die Waechter selbst 'USAGE' benutzen, ist kein Widerspruch: ein FREIBRIEF
-- soll so eng wie moeglich sein, eine VORAUSSETZUNG so frueh wie moeglich
-- anschlagen.
--
-- GRENZE DIESER PRUEFUNG - ausdruecklich benannt, damit niemand mehr aus ihr
-- liest, als sie leistet: die Migration sieht ausschliesslich die
-- NOLOGIN-Gruppenrolle app_user. Die ANMELDEROLLE der Anwendung hat im
-- Repository bewusst keinen festen Namen (supabase/bootstrap/README.md); sie
-- wird auf dem Zielserver angelegt und ist von hier aus nicht bestimmbar. Die
-- Zusage ueber die ANMELDEROLLE traegt deshalb ausschliesslich das Startgate in
-- app/src/lib/db/index.ts, das vor der ersten fachlichen Transaktion
-- `session_user` gegen dieselben drei Zusagen misst.
do $$
declare
  v_auth_owner oid;
  v_profile_owner oid;
begin
  select c.relowner into v_auth_owner
  from pg_catalog.pg_class c
  where c.oid = 'public.auth_accounts'::regclass;

  select c.relowner into v_profile_owner
  from pg_catalog.pg_class c
  where c.oid = 'public.profiles'::regclass;

  -- Der Cast auf name ist kein Zierrat: ohne ihn muesste die
  -- Funktionsaufloesung zwischen pg_has_role(name, oid, text) und
  -- pg_has_role(oid, oid, text) entscheiden.
  if pg_catalog.pg_has_role('app_user'::name, v_auth_owner, 'MEMBER')
     or pg_catalog.pg_has_role('app_user'::name, v_profile_owner, 'MEMBER') then
    raise exception
      'AP14/B: app_user ist Mitglied der Eigentuemerrolle von public.auth_accounts bzw. public.profiles - die Eigentuemerausnahme der Waechter aus 3b/3c/3d waere im Normalbetrieb immer erfuellt und die Waechter damit wirkungslos';
  end if;

  raise notice
    'AP14/B: app_user ist nicht Mitglied der Eigentuemerrolle von public.auth_accounts und public.profiles (die Anmelderolle selbst prueft das Startgate in app/src/lib/db/index.ts)';
end
$$;

-- Negativpruefung 5: die Ruecknahme aus Abschnitt 1a hat gewirkt - und NUR sie.
--
-- Negativ: app_user darf public.auth_accounts nicht mehr loeschen. Ein
-- verbliebenes delete waere die schwerste Luecke dieser Datei: es entfernte
-- ueber `on delete cascade` Konto UND Profil, ohne Auditsatz und ohne dass der
-- Schutz des letzten aktiven Administrators (AFTER UPDATE) ueberhaupt feuerte.
-- Diese Pruefung schlaegt auch dann an, wenn das Recht auf einem anderen Weg
-- entstanden ist - etwa durch eine spaeter eingereihte Datei, die 0012:102 oder
-- 19a_ap14b_grant_reset.sql:73 wiederholt.
--
-- Positiv zur Abgrenzung: select und update auf public.auth_accounts sowie
-- delete auf public.auth_sessions muessen ERHALTEN bleiben. Ohne diese
-- Gegenprobe fiele nicht auf, wenn jemand zu viel zurueckgenommen haette - der
-- Ausfall zeigte sich sonst erst im Betrieb (keine Kontosperre, kein
-- Passwort-Reset, kein Aufraeumen abgelaufener Sitzungen).
do $$
declare
  item record;
  missing text[] := array[]::text[];
begin
  if has_table_privilege('app_user', 'public.auth_accounts', 'delete') then
    raise exception
      'AP14/B: app_user besitzt weiterhin delete auf public.auth_accounts - ein Konto liesse sich samt Profil und ohne Auditsatz physisch loeschen (Ruecknahme in Abschnitt 1a wirkungslos, Reihenfolge der Testkette pruefen)';
  end if;

  for item in
    select * from (values
      ('public.auth_accounts', 'select'),
      ('public.auth_accounts', 'update'),
      -- ABSICHTLICH erhalten: das Aufraeumen abgelaufener Sitzungen ist ein
      -- regulaerer Betriebsvorgang der Anwendungsrolle.
      ('public.auth_sessions', 'delete')
    ) as t(object_name, privilege)
  loop
    if not has_table_privilege('app_user', item.object_name, item.privilege) then
      missing := array_append(missing, item.object_name || ' ' || item.privilege);
    end if;
  end loop;

  if array_length(missing, 1) is not null then
    raise exception
      'AP14/B: die Ruecknahme aus Abschnitt 1a hat zu viel entzogen - es fehlt/fehlen: %',
      array_to_string(missing, ', ');
  end if;

  raise notice
    'AP14/B: kein delete auf public.auth_accounts; select/update dort und delete auf public.auth_sessions bestehen unveraendert';
end
$$;

-- =====================================================================
-- Ende Migration 0017
-- =====================================================================
