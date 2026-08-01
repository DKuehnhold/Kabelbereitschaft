-- AP14/B: Rechtematrix der Bilddokumentation fuer die Anwendungsrolle app_user.
--
-- Bezug: ADR-011 / 2.5 - der Anwendungszugriff laeuft ausschliesslich ueber die
-- nicht privilegierte Rolle app_user. Migration 0014 hat die Rechtematrix der
-- Vorgangs-, Aufgaben- und Sync-Objekte geschlossen und den Bildmetadaten
-- bewusst nur das Leserecht gegeben, das die Galerie und die Dashboardkennzahl
-- brauchen: `grant select on public.incident_images to app_user` (0014:40).
-- Migration 0015 hat dasselbe fuer Stammdaten und Inventar getan. Diese
-- Migration schliesst die verbleibende Luecke des Bildpfades - und nichts
-- darueber hinaus.
--
-- WELCHE RECHTE FEHLEN UND WARUM:
--   * insert auf public.incident_images. Der Metadatensatz eines Bildes wird in
--     @/lib/image-upload-core (insertImageMetadata) geschrieben, in derselben
--     Transaktion wie der Dedup-Marker. Mit dem reinen Leserecht aus 0014
--     scheitert dieser Weg mit 42501, noch bevor eine Policy geprueft wird.
--   * update auf public.incident_images - und zwar AUSSCHLIESSLICH
--     SPALTENBEZOGEN auf category, description, deleted_at und deleted_by. Genau
--     diese vier Spalten und keine weitere braucht der Anwendungscode; es gibt
--     dort exakt drei UPDATE-Wege, alle in @/lib/image-actions:
--       - Kategorie     UPDATE_IMAGE_CATEGORY_SQL     setzt category
--       - Beschreibung  UPDATE_IMAGE_DESCRIPTION_SQL  setzt description
--       - Soft-Delete   SOFT_DELETE_IMAGE_SQL         setzt deleted_at und
--                                                     deleted_by
--     Einen weiteren Aenderungsweg auf diese Tabelle gibt es nicht,
--     insbesondere kein `on conflict ... do update`.
--
-- WARUM DAS update SPALTENBEZOGEN SEIN MUSS - der storage_path-Umgehungsweg:
--   Die Policy images_update (0001_init.sql:571-573) entscheidet ausschliesslich
--   ueber die ZEILE (`is_staff() or uploaded_by = app.current_user_id()`). Sie
--   begrenzt KEINE Spalte. Mit einem tabellenweiten update-Recht koennte eine
--   voellig regulaer berechtigte Identitaet den `storage_path` IHRER EIGENEN
--   Bildzeile auf den Objektschluessel eines FREMDEN Bildes setzen - die Policy
--   waere dabei erfuellt, denn die geaenderte Zeile gehoert ihr. Die Galerie
--   signiert diesen Wert unveraendert (@/lib/images-server:159,
--   `createImageSignedUrl(r.storage_path)`). Das Ergebnis waere eine gueltige
--   GET-URL auf ein Objekt, das die Zeilen-RLS dieser Identitaet nie gezeigt
--   haette: eine Umgehung der Zeilensichtbarkeit ueber den Objektspeicher, an
--   der Datenbank vorbei.
--   Ebenso frei ueberschreibbar waeren incident_id (Umhaengen einer Bildzeile an
--   einen fremden Vorgang), uploaded_by (Faelschung der Urheberschaft),
--   gps_lat, gps_lon und taken_at (die fuer V1 gesperrten Standort- und
--   EXIF-Angaben) sowie die Integritaetsangaben file_hash, file_size, mime_type
--   und file_name.
--   Die Spaltenbegrenzung schliesst DIESEN Weg - den UPDATE-Weg - vollstaendig.
--   Sie ist keine Kosmetik. Sie ist aber NICHT die einzige denkbare Herkunft
--   eines fremden Objektschluessels, und diese Datei behauptet das ausdruecklich
--   nicht:
--
-- WAS DIE SPALTENBEGRENZUNG NICHT LEISTET - der INSERT-Weg bleibt offen:
--   Abschnitt 1 erteilt `insert` weiterhin TABELLENWEIT, also auch auf
--   storage_path; Fall G12 in 22_ap14b_images.sql sichert genau das zu. Eine
--   Identitaet, die SQL an der Anwendung vorbei als app_user absetzen kann,
--   koennte damit eine NEUE Bildzeile in einem Vorgang anlegen, fuer den
--   images_insert erfuellt ist, und storage_path dabei auf den Objektschluessel
--   eines FREMDEN Bildes setzen. Die Galerie signiert auch diesen Wert
--   unveraendert (@/lib/images-server:159); die Wirkung waere dieselbe wie beim
--   UPDATE-Weg oben.
--   Per Rechtevergabe laesst sich dieser Weg NICHT schliessen: der Uploadpfad
--   MUSS storage_path schreiben (@/lib/image-upload-core, insertImageMetadata -
--   die Spalte steht in der Spaltenliste des INSERT). Ein spaltenbegrenztes
--   insert ohne storage_path wuerde den Upload brechen.
--   Die Schranke des INSERT-Weges ist deshalb eine ANWENDUNGSSCHRANKE und keine
--   Datenbankschranke: die Anwendung berechnet den Objektschluessel selbst und
--   uebernimmt ihn nie aus Eingabedaten - buildStoragePath() (aus @/lib/images)
--   wird in @/lib/image-upload-core:306 aus der bereits geprueften
--   Vorgangskennung, einer selbst erzeugten Bildkennung und dem bereinigten
--   Dateinamen gebildet, und genau dieser Wert - kein anderer - geht als
--   storagePath in insertImageMetadata (@/lib/image-upload-core:333).
--   Diese Anwendungsschranke ist SCHWAECHER als ein Datenbankrecht: sie wirkt
--   nur, solange jeder Schreibzugriff durch den Anwendungscode laeuft, und
--   faellt, sobald jemand SQL an der Anwendung vorbei absetzt. Das Spaltenrecht
--   des update gilt auch dann. Dieser Unterschied ist bekannt und hier bewusst
--   benannt statt zugedeckt.
--
-- WARUM KEIN delete AUF public.incident_images:
--   Das fachliche Loeschen ist ein Soft-Delete ueber die Spalten deleted_at und
--   deleted_by (0005_ap4_images.sql:29-30); das Objekt im Objektspeicher bleibt
--   dabei bewusst stehen. Es gibt keinen Anwendungspfad, der eine Bildzeile
--   physisch entfernt. Die Delete-Policy images_delete bleibt unveraendert
--   bestehen und ist auf is_admin() begrenzt (0001_init.sql:574-575) - sie waere
--   also fuer eine Administratoridentitaet erfuellbar. Genau deshalb ist das
--   fehlende Tabellenrecht hier die tragende, unabhaengige Schranke und nicht
--   die Policy. Die Negativprobe steht in Abschnitt 3, die Gegenprobe gegen die
--   laufende Datenbank in 22_ap14b_images.sql, Fall G2.
--
-- WARUM KEIN delete AUF public.sync_actions:
--   Der Dedup-Marker des Bild-Uploads liegt jetzt in DERSELBEN Transaktion wie
--   der Metadatensatz (@/lib/image-upload-core, insertDedupMarker als erste
--   Anweisung der Transaktion). Ein Fehlschlag rollt die Transaktion zurueck und
--   entfernt den Marker dadurch; ein Kompensations-DELETE gibt es nicht mehr.
--   Das ist dasselbe Muster wie im migrierten /api/sync und der Grund, warum
--   0014 dieses Recht ausdruecklich verweigert (0014:64-66) und
--   20_ap14b_data.sql:699 es negativ prueft. Diese Negativpruefung BLEIBT
--   GUELTIG: diese Migration erteilt auf public.sync_actions kein einziges
--   Recht, und sie laeuft in der Kette hinter Smoke 20. Abschnitt 3 haelt den
--   Zustand zusaetzlich fest.
--
-- DAS EINE `revoke` - was es zuruecknimmt und was ausdruecklich NICHT:
--   Abschnitt 1 stellt dem Spaltengrant ein
--   `revoke update on public.incident_images from app_user` voran. Es ist
--   zwingend: Tabellenrecht und Spaltenrecht sind getrennte ACL-Eintraege und
--   addieren sich. Ein stehengebliebenes tabellenweites update wuerde die
--   Spaltenbegrenzung vollstaendig aushebeln, ohne dass eine Pruefung auf die
--   vier Spalten das ueberhaupt bemerken koennte.
--   Zurueckgenommen wird ausschliesslich das update-Recht auf
--   public.incident_images - also genau das Recht, das eine FRUEHERE FASSUNG
--   DIESER DATEI SELBST erteilt hat (`grant insert, update on
--   public.incident_images to app_user`). KEIN Altrecht aus 0001-0015 wird
--   angetastet: dort gibt es auf public.incident_images genau EINE
--   Rechtevergabe, naemlich 0014:40 (select an app_user) - kein update, kein
--   `grant` an public, anon oder authenticated und kein `grant ... on all tables
--   in schema public`. Auf public.sync_actions ist die einzige Vergabe 0014:66
--   (select, insert an app_user); sie wird hier nicht beruehrt. Es gibt in
--   dieser Datei kein weiteres `revoke`, keines gegen public, anon oder
--   authenticated und keines auf eine andere Tabelle.
--   Ein `revoke` auf Tabellenebene raeumt zugleich die Spaltenrechte desselben
--   Privilegs ab. Genau deshalb steht es VOR dem Spaltengrant: jeder Lauf
--   entfernt zuerst jedes update-Recht dieser Tabelle und erteilt danach exakt
--   die vier Spalten. Daraus FOLGT, dass die Datei bei jedem Lauf im selben
--   Zustand endet - gemessen ist das in der Testkette allerdings nicht (siehe
--   "Additiv und wiederholbar" unten). Auf einer Datenbank, die noch nie ein
--   update-Recht auf dieser Tabelle hatte, ist das `revoke` folgenlos;
--   PostgreSQL kann dabei eine Warnung ausgeben, bricht aber nicht ab.
--   Die pauschalen Alt-Grants der Smokes 15-18 sind kein Gegenbeispiel: sie
--   stehen in Testdateien und werden in der Kette von 19a_ap14b_grant_reset.sql
--   vollstaendig zurueckgenommen, bevor 0014 erneut angewendet wird.
--
-- Verbindliche Eigenschaften:
--   * Veraendert werden ausschliesslich RECHTE. Keine Tabelle, Spalte, Policy,
--     View, Funktion, kein Index und kein Trigger wird angelegt oder inhaltlich
--     veraendert; kein `create`, kein `create or replace`, kein `drop`, kein
--     `alter`.
--   * Es gibt genau EIN `revoke` (Abschnitt 1, Begruendung oben). Es zielt
--     allein auf das tabellenweite update auf public.incident_images, das diese
--     Datei frueher selbst erteilt hat.
--   * Empfaenger jedes `grant` ist ausschliesslich app_user. Es gibt keinen
--     `grant` an public, anon oder authenticated.
--   * Objektgenau, und beim update sogar spaltengenau. Kein
--     `grant ... on all tables in schema public`, damit ein kuenftiges Objekt
--     nicht versehentlich mitfreigegeben wird; und keine tabellenweite
--     Aenderungserlaubnis, damit eine kuenftige Spalte nicht versehentlich
--     mitaenderbar wird.
--   * Additiv und wiederholbar - BEGRUENDET, NICHT GEMESSEN: `grant` ist
--     idempotent, das eine `revoke` steht unmittelbar vor dem zugehoerigen
--     `grant`, und die Abschlussbloecke pruefen ausschliesslich. Aus diesen drei
--     Eigenschaften folgt, dass die Datei mehrfach hintereinander laufen darf.
--     GEMESSEN ist das hier NICHT: in der Testkette (app/supabase/test/
--     run_db_tests.sh) wird 0016 genau EINMAL angewendet - anders als 0014, das
--     ueber 19a_ap14b_grant_reset.sql ein zweites Mal laeuft. Ein zweiter Lauf
--     von 0016 ist damit ein offener Punkt und keine belegte Zusage.
--   * Ein Tabellenrecht ist die Voraussetzung des Zugriffs, nicht seine
--     Erlaubnis. Die Zeilensichtbarkeit bleibt unveraendert Sache der
--     bestehenden RLS-Policies; KEINE Policy wird angelegt, geaendert oder
--     gelockert. WELCHE ZEILE gesehen, angelegt und geaendert werden darf,
--     entscheiden weiterhin allein images_select, images_insert und
--     images_update (0001_init.sql:566-573, von 0012 auf app.current_user_id()
--     umgeschrieben); WELCHE SPALTE geaendert werden darf, entscheidet das
--     Spaltenrecht aus Abschnitt 1. Das sind zwei getrennte Schranken, und
--     keine ersetzt die andere.

-- ---------------------------------------------------------------------
-- 1) Bildmetadaten (Upload- und Aenderungswege aus @/lib/image-upload-core
--    und @/lib/image-actions)
--
-- Das Leserecht dieser Tabelle stammt aus 0014:40 und wird hier nicht erneut
-- erteilt. Der Bildpfad braucht darueber hinaus nur die beiden Rechte dieses
-- Abschnitts - insert tabellenweit und update spaltenbezogen -; alles
-- Weitere, was der Bildpfad liest oder schreibt (public.sync_actions,
-- public.incidents, public.profiles, public.incident_notes), ist bereits durch
-- 0012 und 0014 abgedeckt und wird in Abschnitt 2 ausschliesslich als Waechter
-- geprueft.
--
-- Die drei Anweisungen gehoeren zusammen und muessen in dieser Reihenfolge
-- stehen (ausfuehrliche Begruendung im Kopf):
--   1. Das `revoke` nimmt das tabellenweite update zurueck, das eine fruehere
--      Fassung DIESER Datei erteilt hat. Ohne diesen Schritt bliebe der
--      Tabelleneintrag neben dem Spaltengrant stehen und wuerde die
--      Spaltenbegrenzung aushebeln - beides sind getrennte, sich addierende
--      ACL-Eintraege. Weil ein Tabellen-`revoke` auch die Spaltenrechte
--      desselben Privilegs abraeumt, steht es VOR dem Spaltengrant; daraus
--      folgt die Wiederholbarkeit der Datei - begruendet, in der Testkette
--      aber nicht gemessen (Kopf, "Additiv und wiederholbar").
--   2. `insert` bleibt tabellenweit: insertImageMetadata() schreibt eine
--      vollstaendige neue Zeile, und die Werte, die es dabei NICHT setzt
--      (uploaded_by, uploaded_at), kommen aus dem Spaltendefault. Das schliesst
--      storage_path ausdruecklich EIN - der Uploadpfad muss diese Spalte
--      schreiben. Ein per INSERT gesetzter fremder Objektschluessel ist damit
--      durch kein Datenbankrecht ausgeschlossen; begrenzt wird dieser Weg
--      allein durch die Anwendung selbst (buildStoragePath(), Begruendung im
--      Kopf unter "WAS DIE SPALTENBEGRENZUNG NICHT LEISTET").
--   3. `update` ausschliesslich auf den vier Spalten, die die drei
--      Aenderungswege aus @/lib/image-actions tatsaechlich setzen.
-- ---------------------------------------------------------------------
revoke update on public.incident_images from app_user;
grant insert on public.incident_images to app_user;
grant update (category, description, deleted_at, deleted_by) on public.incident_images to app_user;

-- ---------------------------------------------------------------------
-- 2) Ausdruecklich NICHT erteilte Rechte
-- ---------------------------------------------------------------------
-- Kein delete auf public.incident_images (Begruendung im Kopf, Negativprobe in
-- Abschnitt 3).
--
-- Kein TABELLENWEITES update auf public.incident_images: erteilt sind
-- ausschliesslich die vier Spalten aus Abschnitt 1. Jede weitere Spalte - allen
-- voran storage_path, incident_id und uploaded_by - bleibt fuer app_user
-- unveraenderbar (Begruendung im Kopf, Negativproben in Abschnitt 3, Gegenprobe
-- gegen die laufende Datenbank in 22_ap14b_images.sql).
--
-- Kein Recht auf public.sync_actions: die vorhandenen select und insert aus
-- 0014:66 genuegen dem Bildpfad vollstaendig, und das fehlende delete ist
-- fachlich gewollt (Begruendung im Kopf).
--
-- Kein Recht auf public.audit_events: Auditsaetze der Bildzeilen entstehen
-- ausschliesslich im SECURITY-DEFINER-Trigger public.tg_audit() ueber
-- trg_audit_images (0001_init.sql:464-466), und gelesen wird der Audit nicht
-- durch die Anwendungsrolle. Die Negativprobe steht in Abschnitt 4.
--
-- Kein Recht auf public.incident_notes ueber den Bestand hinaus: die Chronik
-- der Bildereignisse schreibt der SECURITY-DEFINER-Trigger
-- trg_incident_image_event (0005_ap4_images.sql:118-124). Er wird beim
-- Ausloesen ohne Recht des aufrufenden Benutzers ausgefuehrt; das select und
-- insert aus 0014:63 bleibt unveraendert und reicht.
--
-- Kein Sequenzrecht. public.incident_images.id ist
-- `uuid default gen_random_uuid()` (0001_init.sql:248); es gibt in diesem Scope
-- kein `serial`, kein `nextval` und keine Sequenz - also auch nichts zu
-- erteilen.
--
-- Kein Ausfuehrungsrecht auf public.tg_incident_image_event() und
-- public.image_category_label(text): die erste ist eine reine Triggerfunktion,
-- die zweite wird ausschliesslich innerhalb dieser Triggerfunktion aufgerufen.
-- Es wird hier auch KEIN bestehendes Recht auf diese Funktionen widerrufen -
-- das waere eine Aenderung des Bestandsrechtestands ausserhalb dieses Auftrags.

-- ---------------------------------------------------------------------
-- 3) Abschlusspruefung
--
-- Positiv: jedes Recht, auf das der Bildpfad angewiesen ist, muss tatsaechlich
-- vorhanden sein.
-- Negativ: die ausdruecklich verweigerten Rechte duerfen nicht vorhanden sein -
-- auch nicht mittelbar ueber eine Gruppenrolle, denn has_table_privilege
-- beruecksichtigt die Rollenmitgliedschaft.
--
-- Das update wird auf zwei Ebenen geprueft, weil es auf zwei Ebenen existiert:
--   * has_table_privilege beantwortet ausschliesslich die Frage nach dem
--     TABELLENRECHT. Bei einem reinen Spaltenrecht liefert es false - deshalb
--     steht ('public.incident_images','update') nicht mehr im Positivblock,
--     sondern in der Negativpruefung 1.
--   * has_column_privilege beantwortet die Frage je SPALTE und liefert auch dann
--     true, wenn das Recht tabellenweit vorliegt. Der Positivblock allein wuerde
--     eine tabellenweite Vergabe deshalb NICHT auffallen lassen; erst der
--     Katalogabgleich und der Negativeintrag zusammen belegen die Begrenzung.
-- ---------------------------------------------------------------------
do $$
declare
  item record;
  missing text[] := array[]::text[];
begin
  for item in
    select * from (values
      -- Herkunft 0014:40, NICHT von dieser Migration erteilt: WAECHTER ueber das
      -- Leserecht, auf dem die Galerie (@/lib/images-server,
      -- LIST_INCIDENT_IMAGES_SQL) und die Dashboardkennzahl
      -- (TODAYS_IMAGE_COUNT_SQL) beruhen. Ein Wegfall soll hier auffallen statt
      -- erst zur Laufzeit.
      ('public.incident_images', 'select'),
      -- Von dieser Migration erteilt (Abschnitt 1). Das update steht hier
      -- bewusst NICHT: es ist spaltenbezogen erteilt, und has_table_privilege
      -- liefert dafuer false. Geprueft wird es im Spaltenblock unten und -
      -- negativ - in Negativpruefung 1.
      ('public.incident_images', 'insert'),
      -- Herkunft 0014:66, ebenfalls nur WAECHTER: der Dedup-Marker des
      -- Offline-Replays wird gesetzt (insert) und innerhalb derselben
      -- Transaktion gelesen (select).
      ('public.sync_actions', 'select'),
      ('public.sync_actions', 'insert'),
      -- Herkunft 0012:114, ebenfalls nur WAECHTER: die Galerie loest die Namen
      -- der Uploader ueber public.profiles auf (@/lib/images-server,
      -- LIST_UPLOADER_NAMES_SQL).
      ('public.profiles', 'select'),
      -- Herkunft 0014:55, ebenfalls nur WAECHTER: die Vorabberechtigungspruefung
      -- des Uploads (`select id from public.incidents where id = $1`) laeuft,
      -- BEVOR ein Byte in den Objektspeicher geht (@/lib/image-upload-core).
      -- Faellt dieses Recht weg, liefert der Upload nur noch ein leeres
      -- Ergebnis - fail-closed, aber ohne dass ein Smoke anschlaegt.
      ('public.incidents', 'select')
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

  raise notice
    'AP14/B: Bildpfad-Tabellenrechte vollstaendig (incident_images select/insert, Waechter auf sync_actions, profiles und incidents)';
end
$$;

-- Positivpruefung der SPALTENRECHTE: die vier Spalten, die die drei
-- Aenderungswege aus @/lib/image-actions setzen, muessen fuer app_user
-- aenderbar sein. Fehlt eine, scheitert der zugehoerige Weg zur Laufzeit mit
-- 42501, noch bevor images_update geprueft wird.
--
-- Dieser Block belegt NUR die Vollstaendigkeit, nicht die Begrenzung:
-- has_column_privilege liefert auch bei einem tabellenweiten Recht true. Die
-- Begrenzung belegt der Katalogabgleich unmittelbar danach.
do $$
declare
  v_column text;
  missing text[] := array[]::text[];
begin
  foreach v_column in array array[
    'category', 'description', 'deleted_at', 'deleted_by'
  ]
  loop
    if not has_column_privilege('app_user', 'public.incident_images', v_column, 'update') then
      missing := array_append(missing, v_column);
    end if;
  end loop;

  if array_length(missing, 1) is not null then
    raise exception
      'AP14/B: app_user fehlt/fehlen das update-Recht auf Spalte(n) von public.incident_images: %',
      array_to_string(missing, ', ');
  end if;

  raise notice
    'AP14/B: app_user darf category, description, deleted_at und deleted_by von incident_images aendern';
end
$$;

-- Negativpruefung der SPALTENRECHTE, KATALOGBASIERT: jede uebrige Spalte von
-- public.incident_images muss fuer app_user unveraenderbar sein.
--
-- Die Spaltenliste wird bewusst NICHT haendisch gefuehrt, sondern aus
-- pg_attribute gelesen. Eine haendische Liste waere ab dem Tag falsch, an dem
-- eine Migration eine Spalte ergaenzt: die neue Spalte fiele durch das Raster,
-- und niemand wuerde bemerken, dass sie versehentlich mitfreigegeben wurde.
-- `attnum > 0` blendet die Systemspalten aus, `not attisdropped` die logisch
-- geloeschten.
--
-- Diese Pruefung ist der eigentliche Nachweis des storage_path-Umgehungsweges
-- aus dem Kopf: sie schlaegt an, sobald storage_path, incident_id, uploaded_by,
-- gps_lat, gps_lon oder eine Integritaetsangabe aenderbar wird.
do $$
declare
  item record;
  unexpected text[] := array[]::text[];
begin
  for item in
    select a.attname::text as column_name
    from pg_attribute a
    where a.attrelid = 'public.incident_images'::regclass
      and a.attnum > 0
      and not a.attisdropped
      and a.attname::text <> all (array[
        'category', 'description', 'deleted_at', 'deleted_by'
      ])
    order by a.attnum
  loop
    if has_column_privilege('app_user', 'public.incident_images', item.column_name, 'update') then
      unexpected := array_append(unexpected, item.column_name);
    end if;
  end loop;

  if array_length(unexpected, 1) is not null then
    raise exception
      'AP14/B: app_user darf unerwartete Spalte(n) von public.incident_images aendern: %',
      array_to_string(unexpected, ', ');
  end if;

  raise notice
    'AP14/B: keine weitere Spalte von incident_images ist fuer app_user aenderbar (Katalogabgleich ueber pg_attribute)';
end
$$;

-- Negativpruefung 1: Soft-Delete statt physischem Loeschen, Rollback statt
-- Kompensation, und kein tabellenweites update. Jeder Treffer hier waere ein
-- stiller Weg, der eine fachliche Zusage bricht.
do $$
declare
  item record;
  unexpected text[] := array[]::text[];
begin
  for item in
    select * from (values
      -- Fachlich geloescht wird ueber deleted_at/deleted_by, nie physisch.
      ('public.incident_images', 'delete'),
      -- Das update ist ausschliesslich spaltenbezogen erteilt (Abschnitt 1).
      -- has_table_privilege liefert bei einem reinen Spaltenrecht false und ist
      -- deshalb GENAU HIER - und nur hier - der richtige Nachweis: dieser
      -- Eintrag belegt, dass das tabellenweite Recht wirklich weg ist und keine
      -- spaetere Anwendung es erneut erteilt hat. Der Katalogabgleich oben
      -- allein koennte das nicht zeigen, denn has_column_privilege liefert bei
      -- einem tabellenweiten Recht fuer JEDE Spalte true - er wuerde dann zwar
      -- ebenfalls anschlagen, aber mit einer irrefuehrenden Meldung.
      ('public.incident_images', 'update'),
      -- truncate, references und trigger braucht kein Anwendungspfad; sie
      -- stehen hier, damit eine pauschale Vergabe auffaellt.
      ('public.incident_images', 'truncate'),
      ('public.incident_images', 'references'),
      ('public.incident_images', 'trigger'),
      -- Die Zusage "Rollback statt Kompensation" haengt genau an diesem
      -- fehlenden delete, denn die Delete-Policy aus 0006:39-42 besteht
      -- unveraendert weiter. Gleiche Pruefung wie 0014 und
      -- 20_ap14b_data.sql:699 - diese Migration aendert daran nichts.
      ('public.sync_actions', 'delete'),
      -- Ein Dedup-Marker ist unveraenderlich; es gibt fuer ihn keine
      -- Update-Policy (0006:30-44).
      ('public.sync_actions', 'update')
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
    'AP14/B: kein delete und kein tabellenweites update auf incident_images, kein delete/update auf sync_actions';
end
$$;

-- Negativpruefung 2: der Audit bleibt fuer die Anwendungsrolle vollstaendig
-- unerreichbar - lesend und schreibend, auch mittelbar.
--
-- Geprueft werden die sieben klassischen Tabellenprivilegien. Das seit
-- PostgreSQL 17 zusaetzliche MAINTAIN wird bewusst NICHT geprueft: es erlaubt
-- ausschliesslich Wartungsbefehle (etwa VACUUM oder ANALYZE) und keinen
-- Datenzugriff, und has_table_privilege wuerde bei einem der Zielversion
-- unbekannten Privilegnamen mit einem Fehler abbrechen.
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

-- Negativpruefung 3: app_user bleibt eine nicht privilegierte Rolle. Ohne diese
-- Pruefung waere die gesamte Rechtematrix wertlos - mit SUPERUSER oder
-- BYPASSRLS gilt keine Policy. Muster aus 0015 bzw. 20_ap14b_data.sql, Fall D19.
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

-- =====================================================================
-- Ende Migration 0016
-- =====================================================================
