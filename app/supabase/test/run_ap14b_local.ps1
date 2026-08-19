# Lokaler Windows-Lauf der vollstaendigen AP14/B-Kette (Arbeitspaket B, Auth-Basis).
#
# Reihenfolge gemaess ADR-011 / 2.10:
#   bootstrap/01-03  ->  migrations/0001-0011  ->  Smokes 15-18
#   ->  migrations/0012, 0013, 0014  ->  Smokes 19, 20
#   ->  migrations/0015, 0016, 0017  ->  Smokes 21, 22, 23
#   ->  Smoke 24 (AP15-1, Statuskennzahlen des Dashboards, Fallkennung K)
#   ->  migrations/0018  ->  Smoke 25 (AP15-b, Fehlalarm-Kennzeichnung,
#       Fallkennung W)
#   ->  migrations/0019  ->  Smoke 26 (AUFTRAG_6, pflegbare
#       Stammdaten-Kataloge Gewerk/Funktion/Objektart, Fallkennung X)
#   ->  migrations/0020  ->  Smoke 27 (AUFTRAG_7, Anrufdaten an der Meldung
#       und "In Klaerung"-Kennzeichen, Fallkennung Y)
#   ->  migrations/0021  ->  Smoke 28 (AUFTRAG_10, Bereitschaftsplan/
#       Einsatzplanung, Fallkennung Z)
#   ->  Integrationstests des Anwendungscodes (test/integration)
#
# Smoke 24 braucht keine eigene Migration und bleibt der LETZTE ABSOLUT
# ZAEHLENDE Eintrag der SQL-Kette: seine fuenf Kennzahlen zaehlen ABSOLUT ueber
# die gesamte public.incident_list_view, duerfen die Fixtures der
# Vorgaengerdateien also nicht voraussetzen. Er nimmt seine eigene Wirkung am
# Ende vollstaendig per rollback zurueck. Dazu gehoert ein FUENFTER Node-Lauf
# (test/integration/ap15-dashboard-metrics.int.mjs): er belegt mit dem echten
# Anwendungscode aus src/lib/incident-metrics.ts, dass Anwendungsabfrage und
# Terminalstatusliste zusammenpassen - das kann der SQL-Smoke nicht leisten.
#
# Aus AP15-b kommen HINTER 24 die Migration 0018 (Fehlalarm-Kennzeichnung
# public.incidents.is_false_alarm) und ihr Smoke 25_ap15b_incident_metrics.sql
# hinzu. Diese Position haelt beide Zusagen ein: 24 bleibt der letzte absolut
# zaehlende Eintrag, und 25 zaehlt ausschliesslich relativ ueber eigene
# Kennungen und nimmt seine eigene Wirkungsphase - Fixtures und den per \ir
# erneut eingebundenen Lauf von 0018 eingeschlossen - ebenfalls vollstaendig per
# rollback zurueck. Die Migration steht unmittelbar vor ihrem Smoke, dieselbe
# Konvention wie bei 0015/21, 0016/22 und 0017/23. Dazu gehoert ein SECHSTER
# Node-Lauf (test/integration/ap15b-incident-list.int.mjs): er belegt den
# ANWENDUNGSPFAD der Fehlalarm-Semantik (src/lib/incidents.ts) und den
# Vollmengen-Export (src/lib/incident-list-actions.ts). Er steht als LETZTER
# Node-Lauf, weil seine Vollmengenfixtures den Lauf ueberdauern (Begruendung an
# der Aufrufstelle).
#
# Aus AUFTRAG_6 kommen HINTER 25 die Migration 0019 (pflegbare
# Stammdaten-Kataloge Gewerk/Funktion/Objektart sowie contacts.function_id)
# und ihr Smoke 26_hlk_kataloge.sql (Fallkennung X) hinzu. Dieselbe Konvention
# wie bei 0015/21, 0016/22, 0017/23 und 0018/25: die Migration steht
# unmittelbar vor ihrem Smoke, und dieser nimmt seine eigene Wirkungsphase -
# Fixtures und den per \ir erneut eingebundenen Lauf von 0019 eingeschlossen -
# vollstaendig per rollback zurueck. Kein zusaetzlicher Node-Lauf: AUFTRAG_6
# fuehrt keine neue Integrationssuite ein, der SQL-Smoke deckt Idempotenz,
# Seeds, Rollenmatrix und FK-Verhalten vollstaendig ab.
#
# Aus AUFTRAG_7 kommen HINTER 26 die Migration 0020 (Anrufdaten an der
# Meldung - reported_at, caller_contact_id, trade_id - sowie das "In
# Klaerung"-Kennzeichen is_in_clarification) und ihr Smoke
# 27_hlk_anrufdaten.sql (Fallkennung Y) hinzu. Dieselbe Konvention wie bei
# 0015/21, 0016/22, 0017/23, 0018/25 und 0019/26: die Migration steht
# unmittelbar vor ihrem Smoke, und dieser nimmt seine eigene Wirkungsphase -
# Fixtures und den per \ir erneut eingebundenen Lauf von 0020 eingeschlossen -
# vollstaendig per rollback zurueck. Kein zusaetzlicher Node-Lauf: AUFTRAG_7
# fuehrt keine neue Integrationssuite ein, der SQL-Smoke deckt Spaltenzustand,
# Idempotenz, FK-Verhalten, die erweiterte RPC create_incident_ap12 und die
# View-Spalten vollstaendig ab.
#
# Aus AUFTRAG_10 kommen HINTER 27 die Migration 0021 (Bereitschaftsplan/
# Einsatzplanung, Tabelle public.on_call_plan) und ihr Smoke
# 28_hlk_bereitschaftsplan.sql (Fallkennung Z) hinzu. Dieselbe Konvention wie
# bei 0015/21, 0016/22, 0017/23, 0018/25, 0019/26 und 0020/27: die Migration
# steht unmittelbar vor ihrem Smoke, und dieser nimmt seine eigene
# Wirkungsphase - Fixtures und den per \ir erneut eingebundenen Lauf von 0021
# eingeschlossen - vollstaendig per rollback zurueck. Kein zusaetzlicher
# Node-Lauf: AUFTRAG_10 fuehrt keine neue Integrationssuite ein, der
# SQL-Smoke deckt Idempotenz, Unique, Rollenmatrix, FK-Verhalten und die
# Audit-Protokollierung bei delete vollstaendig ab.
#
# Die bash-Fassung run_db_tests.sh bleibt der Weg fuer die CI; diese Datei ist
# das Windows-Gegenstueck und ergaenzt run_ap12_local.ps1 (das bewusst bei 0011
# endet und der historische AP12/AP13-Nachweis bleibt).
#
# Zwei Betriebsarten:
#   * Standard: gegen einen vorhandenen PostgreSQL-Dienst. Es wird eine
#     temporaere Datenbank angelegt und am Ende immer entfernt.
#   * -TemporaryCluster: es wird ein eigenes, temporaeres Cluster mit initdb
#     erzeugt, auf 127.0.0.1 und einem eigenen Port gestartet und am Ende
#     vollstaendig entfernt. Ein vorhandener Dienst wird dabei NICHT angefasst
#     und es wird kein Kennwort benoetigt.
#
# Kein Kennwort im Quelltext: das Kennwort wird abgefragt oder als
# SecureString uebergeben. Das Kennwort der temporaeren Anmelderolle fuer die
# Integrationstests wird zufaellig erzeugt und nirgends ausgegeben; der
# kennworttragende psql-Aufruf schreibt bewusst KEINE Umleitungsdateien.
#
# Hinweis: massgeblich ist allein der Prozess-Exitcode von psql. PostgreSQL
# schreibt auch harmlose NOTICE-Zeilen auf stderr; bei
# ErrorActionPreference=Stop wuerde PowerShell diese sonst faelschlich als
# terminierenden NativeCommandError behandeln.
#
# Gesamtzeitbudget (Korrektur nach einem Lauf, der von aussen hart beendet
# wurde und einen temporaeren Server hinterliess): das Skript hatte bisher
# keinen eigenen Deckel. Wird der PowerShell-Host von aussen abgeschossen,
# laeuft `finally` nicht mehr und der von `pg_ctl` entkoppelt gestartete
# `postgres.exe` ueberlebt. Deshalb gilt jetzt eine Gesamtfrist
# (-MaxTotalSeconds) ab Skriptbeginn: jeder externe Aufruf laeuft hoechstens
# so lange wie das Minimum aus seinem Einzellimit und der Restzeit, und ist die
# Restzeit aufgebraucht, wird er gar nicht mehr gestartet. Damit beendet sich
# der Lauf unter normalen Umstaenden SELBST rechtzeitig und durchlaeuft sein
# `finally`. Fuer die Aufraeumphase gilt ein getrenntes, festes Notbudget
# ($script:CleanupBudgetSeconds), das unabhaengig vom verbrauchten
# Gesamtbudget zur Verfuegung steht - das Aufraeumen darf niemals am
# Gesamtbudget scheitern.
#
# Reste eines frueheren, hart abgebrochenen Laufs werden vor dem Anlegen eines
# neuen Clusters erkannt und - streng auf das eigene Namensmuster begrenzt und
# fail-closed - bereinigt. Ein vorhandener PostgreSQL-Dienst und jedes
# Verzeichnis ausserhalb des Musters bleiben unberuehrt.
#
# Handle-Sicherheit (Korrektur nach zwei reproduzierbaren Stillstaenden unter
# Windows): `pg_ctl start` und `initdb` duerfen NICHT in einer PowerShell-
# Pipeline (`... 2>&1 | Out-Null`) laufen. `CreateProcess` erbt unter Windows
# alle vererbbaren Handles, also auch das Schreibende der Pipeline. Der von
# `pg_ctl` gestartete, langlebige `postgres.exe` haelt dieses Schreibende offen;
# das Leseende sieht deshalb nie ein Dateiende, und PowerShell wartet nach dem
# erfolgreichen Start endlos - ohne jede aktive Datenbankabfrage.
#
# Deshalb laufen alle externen Werkzeuge dieses Skripts ueber
# `Invoke-HandleSafeProcess`. Dort wird ein EIGENES
# `System.Diagnostics.Process` (`UseShellExecute = $false`) gestartet und nur
# mit endlichem Zeitlimit auf dessen Ende gewartet. Bewusst KEIN
# `Start-Process`: in Windows PowerShell 5.1 behaelt das von
# `Start-Process -PassThru` OHNE `-Wait` zurueckgegebene Objekt das
# Prozess-Handle nicht, weshalb der Exit-Code nach dem Ende des Werkzeugs nicht
# mehr abrufbar ist (gemessen: leerer `ExitCode` bei `HasExited = True`, auch
# nach `WaitForExit()` und `Refresh()`). `Start-Process -Wait` liefert den
# Exit-Code, gibt aber das Zeitlimit auf, auf dem die Handle-Sicherheit dieses
# Skripts beruht; das eigene Process-Objekt liefert beides.
#
# stdout und stderr werden ASYNCHRON ueber `OutputDataReceived` und
# `ErrorDataReceived` gesammelt und erst danach in DATEIEN geschrieben. Damit
# wird an keiner Stelle auf ein Stream-Ende gewartet - ein langlebiges Kind, das
# ein geerbtes Schreibende offen haelt, kann den Lauf nicht anhalten.
# Zusaetzlich wird die Bereitschaft nach dem Start mit `pg_isready` und
# begrenztem Zeitlimit geprueft und nach dem Stopp nachgewiesen, dass der Port
# nicht mehr lauscht.

[CmdletBinding()]
param(
  [string]$PostgresUser = "postgres",
  [string]$HostName = "localhost",
  [int]$Port = 5432,
  [Security.SecureString]$Password,
  [string]$BinPath = "C:\Program Files\PostgreSQL\18\bin",
  [switch]$TemporaryCluster,
  [int]$ClusterPort = 55432,
  [string]$NodeExe = "C:\Program Files\nodejs\node.exe",
  [switch]$SkipIntegrationTests,
  [int]$ClusterReadyTimeoutSeconds = 60,
  [int]$ClusterStopTimeoutSeconds = 60,
  # Angehoben von 480 auf 900: mit dem vierten Integrationslauf (administrative
  # Benutzerverwaltung) ist ein weiterer Node-Prozess samt Argon2id-Laeufen
  # hinzugekommen. Alle uebrigen Zeitgrenzen bleiben unveraendert.
  # Angehoben von 900 auf 1200: mit dem fuenften Integrationslauf
  # (Statuskennzahlen des Dashboards, AP15-1) ist ein weiterer Node-Prozess
  # hinzugekommen, und die SQL-Kette hat zusaetzlich Smoke 24 erhalten. Alle
  # uebrigen Zeitgrenzen bleiben unveraendert.
  # Seit AP15-b kommt ein SECHSTER Node-Lauf hinzu (Fehlalarm-Semantik und
  # Vollmengen-Export), der zum Nachweis der Vollmengengrenze
  # INCIDENT_FULL_EXPORT_CAP + 1 Vorgaenge anlegt. Gemessen, nicht geschaetzt:
  # der Orchestrator hat den vollstaendigen bash-Laeufer run_db_tests.sh mit
  # AP14B_INTEGRATION=require auf einem frischen postgres:18-Container gefahren
  # und Exit 0 nach 32 Sekunden fuer die gesamte Kette einschliesslich aller
  # sechs Suiten erhalten; auf die sechste Suite entfielen dabei rund 15
  # Sekunden, davon etwa 10 Sekunden fuer den Bulk-INSERT der 20001 Vorgaenge.
  # Eine unabhaengige Messung eines Pruefagenten in einem eigenen Container
  # ergab Exit 0 nach 34 Sekunden. Das Budget von 1200 Sekunden bleibt deshalb
  # BEWUSST UNVERAENDERT; es ist gegenueber der gemessenen Laufzeit reichlich
  # bemessen. Sollte der lokale Lauf dennoch am Budget scheitern, ist das ein
  # sichtbarer, fail-closed Abbruch und kein Sachfehler.
  [int]$MaxTotalSeconds = 1200
)

$ErrorActionPreference = "Stop"
$psql = Join-Path $BinPath "psql.exe"
$createdb = Join-Path $BinPath "createdb.exe"
$dropdb = Join-Path $BinPath "dropdb.exe"
$initdb = Join-Path $BinPath "initdb.exe"
$pgCtl = Join-Path $BinPath "pg_ctl.exe"
$pgIsReady = Join-Path $BinPath "pg_isready.exe"
$testRoot = Split-Path -Parent $PSCommandPath
$supabaseRoot = Split-Path -Parent $testRoot
$appRoot = Split-Path -Parent $supabaseRoot
$migrationRoot = Join-Path $supabaseRoot "migrations"
$bootstrapRoot = Join-Path $supabaseRoot "bootstrap"
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$database = "kabelbereitschaft_ap14b_test_{0}" -f $stamp
$appRole = "kb_ap14b_test_{0}" -f $stamp

# --- Zeitbudget -------------------------------------------------------------
# Eine Frist ab Skriptbeginn fuer den gesamten Arbeitsteil und ein davon
# getrenntes, festes Notbudget fuer die Aufraeumphase. Der Schalter
# $script:CleanupPhase wird an genau EINER Stelle gesetzt: als erste Anweisung
# im `finally`. Ab dann wertet Get-RemainingSeconds ausschliesslich das
# Notbudget aus, damit das Aufraeumen nie am verbrauchten Gesamtbudget
# scheitert.
if ($MaxTotalSeconds -lt 60) {
  throw "-MaxTotalSeconds muss mindestens 60 betragen (uebergeben: $MaxTotalSeconds)."
}
$script:CleanupBudgetSeconds = 90
$script:TotalDeadline = (Get-Date).AddSeconds($MaxTotalSeconds)
$script:CleanupDeadline = $script:TotalDeadline
$script:CleanupPhase = $false

$requiredTools = @($psql, $createdb, $dropdb)
if ($TemporaryCluster) { $requiredTools += @($initdb, $pgCtl, $pgIsReady) }
foreach ($tool in $requiredTools) {
  if (-not (Test-Path -LiteralPath $tool)) {
    throw "PostgreSQL-Werkzeug fehlt: $tool (Pfad ueber -BinPath anpassbar)"
  }
}

# Fail-closed vor jedem Start: ein temporaeres Cluster darf niemals auf dem
# Standardport oder auf dem Port des vorhandenen Dienstes hochkommen.
if ($TemporaryCluster) {
  if ($ClusterPort -eq 5432) {
    throw "-ClusterPort 5432 ist nicht zulaessig: das ist der Standardport eines vorhandenen PostgreSQL-Dienstes."
  }
  if ($ClusterPort -eq $Port) {
    throw ("-ClusterPort {0} entspricht dem Wert von -Port. Das temporaere Cluster braucht einen eigenen Port." -f $ClusterPort)
  }
}

$files = @(
  (Join-Path $bootstrapRoot "01_roles.sql"),
  (Join-Path $bootstrapRoot "02_compat_auth.sql"),
  (Join-Path $bootstrapRoot "03_compat_storage.sql"),
  (Join-Path $migrationRoot "0001_init.sql"),
  (Join-Path $migrationRoot "0002_storage.sql"),
  (Join-Path $migrationRoot "0003_ap2_priority.sql"),
  (Join-Path $migrationRoot "0004_ap3_inventory_rls.sql"),
  (Join-Path $migrationRoot "0005_ap4_images.sql"),
  (Join-Path $migrationRoot "0006_ap6_sync_idempotency.sql"),
  (Join-Path $migrationRoot "0007_ap9_master_data.sql"),
  (Join-Path $migrationRoot "0008_ap10_incident_master_data.sql"),
  (Join-Path $migrationRoot "0009_ap11_incident_list_view.sql"),
  (Join-Path $migrationRoot "0010_ap12_incident_details.sql"),
  (Join-Path $migrationRoot "0011_ap13_tasks_bulk.sql"),
  (Join-Path $testRoot "15_ap10_smoke.sql"),
  (Join-Path $testRoot "16_ap11_list.sql"),
  (Join-Path $testRoot "17_ap12_details.sql"),
  (Join-Path $testRoot "18_ap13_tasks.sql"),
  (Join-Path $migrationRoot "0012_ap14b_platform_auth.sql"),
  (Join-Path $migrationRoot "0013_ap14b_drop_supabase_compat.sql"),
  (Join-Path $migrationRoot "0014_ap14b_data_grants.sql"),
  (Join-Path $testRoot "19_ap14b_platform.sql"),
  (Join-Path $testRoot "19a_ap14b_grant_reset.sql"),
  (Join-Path $testRoot "20_ap14b_data.sql"),
  # 0015 und 21 stehen bewusst HINTER 20_ap14b_data.sql: dessen Fall D18 prueft
  # ausdruecklich negativ, dass app_user kein select auf
  # public.inventory_movements und kein insert auf public.customers besitzt -
  # genau diese Rechte erteilt 0015. Liefe 0015 vorher, wuerde D18 scheitern.
  (Join-Path $migrationRoot "0015_ap14b_masterdata_inventory_grants.sql"),
  (Join-Path $testRoot "21_ap14b_masterdata_inventory.sql"),
  # 0016 und 22 stehen aus demselben Grund HINTER 20_ap14b_data.sql: dessen Fall
  # D14 prueft ausdruecklich negativ, dass app_user kein delete auf
  # public.sync_actions besitzt (20_ap14b_data.sql:699). 0016 erteilt dieses
  # Recht nicht - die Negativpruefung bleibt also gueltig. Die Reihenfolge wird
  # trotzdem eingehalten: jede Rechtematrix steht unmittelbar vor ihrem Smoke,
  # die Kette bleibt lesbar, und ein spaeter ergaenztes Recht kann keine
  # bestehende Negativprobe still entwerten.
  (Join-Path $migrationRoot "0016_ap14b_image_grants.sql"),
  (Join-Path $testRoot "22_ap14b_images.sql"),
  # 0017 und 23 schliessen den AP14/B-Teil der Kette ab. Die Reihenfolge ist
  # zwingend: die Migration erteilt das spaltenbezogene update auf
  # public.profiles.role, und erst danach kann ihr Smoke es unter app_user
  # nachweisen. Beide stehen
  # ausserdem HINTER 19a_ap14b_grant_reset.sql: dessen pauschales
  # `revoke all on all tables in schema public` soll den Spaltengrant aus 0017
  # gar nicht erst erreichen koennen.
  (Join-Path $migrationRoot "0017_ap14b_admin_user_management.sql"),
  (Join-Path $testRoot "23_ap14b_admin_users.sql"),
  # 24 ist der LETZTE ABSOLUT ZAEHLENDE Eintrag der Kette und braucht keine
  # eigene Migration: seine fuenf Kennzahlen zaehlen ABSOLUT ueber die gesamte
  # public.incident_list_view und nicht relativ ueber eigene Kennungen. Er darf
  # deshalb weder die Fixtures der Vorgaengerdateien voraussetzen noch ihre
  # Zaehlungen stoeren; seine gesamte Wirkungsphase wird am Ende per rollback
  # zurueckgenommen. Ein Aufraeumen per DELETE ist wegen der unbedingten
  # Loeschsperre trg_incident_tasks_no_delete (0011:113-123) nicht moeglich.
  (Join-Path $testRoot "24_ap15_dashboard_metrics.sql"),
  # 0018 und 25 (AP15-b, Fehlalarm-Kennzeichnung) stehen HINTER 24, und genau
  # diese Position haelt die Zusage von 24 ein: 24 bleibt der letzte ABSOLUT
  # zaehlende Eintrag der Kette. 25 zaehlt ausschliesslich relativ ueber eigene
  # Kennungen (Praefix 25c00000-) und nimmt seine eigene Wirkungsphase -
  # Fixtures und den per \ir erneut eingebundenen Lauf von 0018 eingeschlossen -
  # am Ende vollstaendig per rollback zurueck; auch fuer ihn ist ein Aufraeumen
  # per DELETE wegen trg_incident_tasks_no_delete (0011:113-123) nicht moeglich.
  # Die Migration steht unmittelbar VOR ihrem Smoke - dieselbe Konvention wie bei
  # 0015/21, 0016/22 und 0017/23 - und sie muss es auch: Fall W1 von 25 prueft
  # den Zielzustand der Spalte public.incidents.is_false_alarm und scheitert
  # ausdruecklich mit "Migration 0018 ist nicht gelaufen", wenn sie fehlt. Der
  # dauerhafte Spaltenzustand aus diesem Lauf von 0018 bleibt bestehen; nur die
  # Wirkung INNERHALB von 25 wird zurueckgenommen. Genau darauf beruht der
  # sechste Integrationslauf, der danach in derselben Datenbank laeuft.
  (Join-Path $migrationRoot "0018_ap15b_incident_metrics.sql"),
  (Join-Path $testRoot "25_ap15b_incident_metrics.sql"),
  # AUFTRAG_6: pflegbare Stammdaten-Kataloge Gewerk/Funktion/Objektart sowie
  # contacts.function_id (Migration 0019, Smoke 26, Fallkennung X). Dieselbe
  # Konvention wie bei 0015/21, 0016/22, 0017/23 und 0018/25: die Migration
  # steht unmittelbar vor ihrem Smoke, der seine eigene Wirkungsphase -
  # Fixtures und den per \ir erneut eingebundenen Lauf von 0019 eingeschlossen -
  # am Ende vollstaendig per rollback zuruecknimmt. Der dauerhafte Seed-Zustand
  # der drei Kataloge (7/3/2 Startwerte) bleibt bestehen.
  (Join-Path $migrationRoot "0019_hlk_katalog_stammdaten.sql"),
  (Join-Path $testRoot "26_hlk_kataloge.sql"),
  # AUFTRAG_7: Anrufdaten an der Meldung (reported_at, caller_contact_id,
  # trade_id) und das "In Klaerung"-Kennzeichen (Migration 0020, Smoke 27,
  # Fallkennung Y). Dieselbe Konvention wie bei 0015/21, 0016/22, 0017/23,
  # 0018/25 und 0019/26: die Migration steht unmittelbar vor ihrem Smoke, der
  # seine eigene Wirkungsphase - Fixtures und den per \ir erneut
  # eingebundenen Lauf von 0020 eingeschlossen - am Ende vollstaendig per
  # rollback zuruecknimmt.
  (Join-Path $migrationRoot "0020_hlk_meldung_anrufdaten.sql"),
  (Join-Path $testRoot "27_hlk_anrufdaten.sql"),
  # AUFTRAG_10: Bereitschaftsplan (Einsatzplanung, Tabelle
  # public.on_call_plan; Migration 0021, Smoke 28, Fallkennung Z). Dieselbe
  # Konvention wie bei 0015/21, 0016/22, 0017/23, 0018/25, 0019/26 und
  # 0020/27: die Migration steht unmittelbar vor ihrem Smoke, der seine
  # eigene Wirkungsphase - Fixtures und den per \ir erneut eingebundenen
  # Lauf von 0021 eingeschlossen - am Ende vollstaendig per rollback
  # zuruecknimmt.
  (Join-Path $migrationRoot "0021_hlk_bereitschaftsplan.sql"),
  (Join-Path $testRoot "28_hlk_bereitschaftsplan.sql"),
  # AUFTRAG_14: Dispo-Board - Qualifikationen, Zuordnung
  # technician_qualifications und die Erweiterung von on_call_plan um
  # assignment_kind (Migration 0022, Smoke 29, Fallkennung AA). Dieselbe
  # Konvention wie bei 0015/21 ... 0021/28: die Migration steht unmittelbar
  # vor ihrem Smoke, der seine eigene Wirkungsphase - Fixtures und den per
  # \ir erneut eingebundenen Lauf von 0022 eingeschlossen - am Ende
  # vollstaendig per rollback zuruecknimmt.
  (Join-Path $migrationRoot "0022_hlk_dispo_board.sql"),
  (Join-Path $testRoot "29_hlk_dispo_board.sql")
)
foreach ($file in $files) {
  if (-not (Test-Path -LiteralPath $file)) { throw "Testdatei fehlt: $file" }
}

$integrationTest = Join-Path $appRoot "test\integration\ap14b-platform.int.mjs"
$moduleHooks = Join-Path $appRoot "test\integration\module-hooks.mjs"
# Zweiter Integrationslauf: die Stammdaten- und Inventarmodule mit einer eigenen
# Hooks-Datei (siehe module-hooks-app.mjs). module-hooks.mjs bleibt unveraendert.
$masterdataIntegrationTest = Join-Path $appRoot "test\integration\ap14b-masterdata-inventory.int.mjs"
$moduleHooksApp = Join-Path $appRoot "test\integration\module-hooks-app.mjs"
# Dritter Integrationslauf: der Bildpfad. Er benutzt dieselbe Hooks-Datei wie der
# Stammdatenlauf und zusaetzlich einen synthetischen S3-kompatiblen
# Testendpunkt (s3-test-endpoint.mjs, im Arbeitsspeicher, freier Port vom
# Betriebssystem). Das ist AUSDRUECKLICH KEIN MinIO und kein MinIO-Nachweis.
$imagesIntegrationTest = Join-Path $appRoot "test\integration\ap14b-images.int.mjs"
$s3TestEndpoint = Join-Path $appRoot "test\integration\s3-test-endpoint.mjs"
# Vierter Integrationslauf: die administrative Benutzerverwaltung. Er benutzt
# ausdruecklich module-hooks.mjs und NICHT module-hooks-app.mjs - er braucht die
# ECHTE Sitzungsauswertung und darf sie nicht durch einen Sitzungsstub ersetzen.
$adminUsersIntegrationTest = Join-Path $appRoot "test\integration\ap14b-admin-users.int.mjs"
# Fuenfter Integrationslauf (AP15-1): die Statuskennzahlen des Dashboards. Er
# benutzt die bereits vorhandene Hooks-Datei $moduleHooksApp, weil er die
# Anwendungsmodule laedt und ausserhalb von Next Ersatz fuer `next/cache` und
# `@/lib/auth` braucht. Eine eigene Hooks-Datei entsteht dafuer nicht.
$metricsIntegrationTest = Join-Path $appRoot "test\integration\ap15-dashboard-metrics.int.mjs"
# Sechster Integrationslauf (AP15-b): der Anwendungspfad der Fehlalarm-Semantik
# und der Vollmengen-Export. Er benutzt ebenfalls die bereits vorhandene
# Hooks-Datei $moduleHooksApp, weil er Anwendungsmodule laedt (src/lib/incidents,
# src/lib/incident-list-actions) und ausserhalb von Next Ersatz fuer
# `next/cache` und `@/lib/auth` braucht. Eine eigene Hooks-Datei entsteht dafuer
# nicht.
$ap15bIntegrationTest = Join-Path $appRoot "test\integration\ap15b-incident-list.int.mjs"
if (-not $SkipIntegrationTests) {
  foreach ($file in @($integrationTest, $moduleHooks, $masterdataIntegrationTest, $moduleHooksApp,
      $imagesIntegrationTest, $s3TestEndpoint, $adminUsersIntegrationTest,
      $metricsIntegrationTest, $ap15bIntegrationTest)) {
    if (-not (Test-Path -LiteralPath $file)) { throw "Testdatei fehlt: $file" }
  }
  if (-not (Test-Path -LiteralPath $NodeExe)) {
    throw "Node fehlt: $NodeExe (Pfad ueber -NodeExe anpassbar)"
  }
}

# Zufaelliges Kennwort der temporaeren Anmelderolle. Nur alphanumerisch, damit
# es ohne Kodierung in eine Verbindungszeichenfolge passt.
$roleAlphabet = [char[]](([char]'a'..[char]'z') + ([char]'A'..[char]'Z') + ([char]'0'..[char]'9'))
$rolePassword = -join (1..40 | ForEach-Object { $roleAlphabet | Get-Random })

$clusterDir = $null
$clusterStarted = $false
$databaseCreated = $false
$roleCreated = $false
$passwordPtr = [IntPtr]::Zero

# Eigenes Arbeitsverzeichnis fuer die Umleitungsdateien. Es liegt ausserhalb des
# Clusterverzeichnisses, weil `initdb` ein leeres Zielverzeichnis verlangt und
# schon dieser erste Aufruf umgeleitet werden muss.
$workDir = Join-Path ([IO.Path]::GetTempPath()) ("kb_ap14b_work_{0}" -f $stamp)
New-Item -ItemType Directory -Path $workDir -Force | Out-Null

<#
.SYNOPSIS
  Verbleibende Sekunden des aktuell gueltigen Zeitbudgets.

.DESCRIPTION
  Bis zum Eintritt in das `finally` ist das die Restzeit der Gesamtfrist
  (-MaxTotalSeconds ab Skriptbeginn). Ab dem Eintritt in die Aufraeumphase ist
  es ausschliesslich die Restzeit des festen Notbudgets. Genau diese eine
  Fallunterscheidung entscheidet, welches Budget gilt - deshalb steht sie hier
  und nicht verstreut an den Aufrufstellen.
#>
function Get-RemainingSeconds {
  if ($script:CleanupPhase) {
    $remaining = ($script:CleanupDeadline - (Get-Date)).TotalSeconds
  }
  else {
    $remaining = ($script:TotalDeadline - (Get-Date)).TotalSeconds
  }
  if ($remaining -lt 0) { $remaining = 0 }
  return [int][Math]::Floor($remaining)
}

<#
.SYNOPSIS
  Ein einzelnes Argument fuer die Windows-Befehlszeile schreibfertig machen.

.DESCRIPTION
  `Start-Process -ArgumentList` fuegt die Teile nur mit Leerzeichen zusammen und
  setzt selbst KEINE Anfuehrungszeichen. Ein Argument mit Leerzeichen - etwa
  `-o "-p 55432 -c listen_addresses=127.0.0.1"` fuer pg_ctl - zerfaellt dadurch
  in mehrere Argumente und das Werkzeug bricht mit "unbekannter Operationsmodus"
  ab. Deshalb wird hier nach den Regeln von Windows selbst geklammert.
#>
function Format-NativeArgument {
  param([Parameter(Mandatory)][AllowEmptyString()][string]$Value)

  if ($Value -eq "") { return '""' }
  if ($Value -notmatch '[\s"]') { return $Value }
  # Backslashes direkt vor einem Anfuehrungszeichen muessen verdoppelt werden,
  # sonst entwerten sie es. Das gilt auch am Ende des Arguments, weil dort das
  # abschliessende Anfuehrungszeichen folgt.
  $escaped = [regex]::Replace($Value, '(\\*)"', '$1$1\"')
  $escaped = [regex]::Replace($escaped, '(\\+)$', '$1$1')
  return '"' + $escaped + '"'
}

<#
.SYNOPSIS
  Handle-sicherer Aufruf eines externen Werkzeugs mit begrenzter Wartezeit.

.DESCRIPTION
  Ersetzt `& werkzeug ... 2>&1 | Out-Null`. Der Unterschied ist
  sicherheits- und nicht stilrelevant: eine PowerShell-Pipeline uebergibt dem
  Kindprozess ein vererbbares Pipe-Schreibende. Startet das Kind selbst einen
  langlebigen Prozess (`pg_ctl` -> `postgres.exe`), erbt dieser das
  Schreibende und haelt es offen. Das Leseende der Pipeline erreicht dann nie
  ein Dateiende und PowerShell wartet endlos.

  Gestartet wird ein EIGENES `System.Diagnostics.Process` mit
  `UseShellExecute = $false` und nicht `Start-Process`: in Windows PowerShell
  5.1 behaelt das von `Start-Process -PassThru` OHNE `-Wait` zurueckgegebene
  Objekt das Prozess-Handle nicht. Nach dem Ende des Werkzeugs liest sich
  `ExitCode` dort als leer, auch nach `WaitForExit()` und `Refresh()`
  (gemessen). `Start-Process -Wait` wuerde den Exit-Code liefern, aber das
  endliche Zeitlimit aufgeben, auf dem die Handle-Sicherheit dieses Skripts
  beruht. Das eigene Process-Objekt liefert beides.

  `UseShellExecute = $false` erbt ausserdem die Umgebung des PowerShell-
  Prozesses, solange `StartInfo.EnvironmentVariables` nicht veraendert wird.
  Genau darauf beruht die Kennwortuebergabe: `$env:PGPASSWORD` erreicht `psql`,
  `createdb` und `dropdb` ohne Befehlszeile und ohne Datei. Diese Sammlung wird
  hier bewusst NICHT angefasst.

  Wirksames Zeitlimit ist immer das MINIMUM aus `-TimeoutSeconds` und der
  Restzeit des aktuell gueltigen Budgets (Get-RemainingSeconds). Ist die
  Restzeit aufgebraucht, wird der Aufruf gar nicht erst gestartet, sondern mit
  einer Meldung geworfen, die das Zeitbudget als Ursache benennt.

  stdout und stderr werden ASYNCHRON ueber `OutputDataReceived` und
  `ErrorDataReceived` gesammelt und erst nach dem Prozessende in die bisherigen
  DATEIEN geschrieben. Die Ereignisse werden mit `Register-ObjectEvent`
  registriert - bewusst OHNE `-Action`, damit die Zeilen in der
  Ereigniswarteschlange landen und nicht davon abhaengen, ob die PowerShell-
  Engine gerade in `WaitForExit` blockiert. Mit `-SuppressLogFiles` unterbleibt
  das Schreiben der Umleitungsdateien; das ist fuer den einen Aufruf noetig,
  dessen Anweisungstext ein Kennwort enthaelt.

  Ausdruecklich wird NIRGENDS auf ein Stream-Ende gewartet: kein `ReadToEnd()`,
  kein parameterloses `WaitForExit()`. Ein langlebiges Kind (`pg_ctl` ->
  `postgres.exe`), das ein geerbtes Schreibende offen haelt, kann den Lauf
  daher nicht anhalten; es kann allenfalls die letzten Diagnosezeilen kosten.
  Massgeblich ist und bleibt der Exit-Code. Gewartet wird nur auf das
  gestartete Werkzeug, nicht auf dessen Nachkommen, und das mit endlichem
  Zeitlimit.
#>
function Invoke-HandleSafeProcess {
  param(
    [Parameter(Mandatory)][string]$FilePath,
    [string[]]$Arguments = @(),
    [Parameter(Mandatory)][string]$Label,
    [int]$TimeoutSeconds = 120,
    [string]$WorkingDirectory,
    [switch]$SuppressLogFiles
  )

  # Zeitbudget zuerst: ein Aufruf, der ohnehin nicht mehr in die Frist passt,
  # wird nicht gestartet. Sonst zoege eine haengende Anweisung den Lauf
  # beliebig weit ueber die Frist hinaus und der Host wuerde von aussen hart
  # beendet - genau der Fall, in dem `finally` nicht mehr laeuft.
  $remainingSeconds = Get-RemainingSeconds
  if ($script:CleanupPhase) {
    $budgetLabel = "Notbudget der Aufraeumphase"
    $budgetSeconds = $script:CleanupBudgetSeconds
  }
  else {
    $budgetLabel = "Gesamtzeitbudget"
    $budgetSeconds = $MaxTotalSeconds
  }
  if ($remainingSeconds -le 0) {
    throw ("{0} ({1}) wurde nicht gestartet: das {2} von {3} s ist erschoepft." -f
      (Split-Path -Leaf $FilePath), $Label, $budgetLabel, $budgetSeconds)
  }
  $effectiveTimeout = $TimeoutSeconds
  if ($remainingSeconds -lt $effectiveTimeout) { $effectiveTimeout = $remainingSeconds }

  $outFile = Join-Path $workDir ("{0}.out.log" -f $Label)
  $errFile = Join-Path $workDir ("{0}.err.log" -f $Label)

  # Eigene Quellkennungen je Aufruf: Wait-ClusterReady ruft dieselbe Bezeichnung
  # (pg_isready) mehrfach auf, die Warteschlangen duerfen sich nicht mischen.
  $eventToken = [guid]::NewGuid().ToString("N")
  $outEventId = "kb_ap14b_out_{0}" -f $eventToken
  $errEventId = "kb_ap14b_err_{0}" -f $eventToken
  $outLines = [System.Collections.ArrayList]::new()
  $errLines = [System.Collections.ArrayList]::new()
  $buffers = @{ $outEventId = $outLines; $errEventId = $errLines }

  $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $startInfo.FileName = $FilePath
  # UseShellExecute = $false ist Voraussetzung fuer die Umleitung;
  # CreateNoWindow entspricht dem bisherigen -NoNewWindow. Die Umgebung des
  # aufrufenden Prozesses (und damit PGPASSWORD) wird dabei geerbt.
  $startInfo.UseShellExecute = $false
  $startInfo.CreateNoWindow = $true
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true
  if ($Arguments.Count -gt 0) {
    # Bewusst EINE fertige Zeichenkette: Windows erwartet eine geklammerte
    # Befehlszeile (siehe Format-NativeArgument).
    $startInfo.Arguments =
      (($Arguments | ForEach-Object { Format-NativeArgument $_ }) -join " ")
  }
  # Ausdruecklich gesetzt: das Arbeitsverzeichnis des PowerShell-PROZESSES muss
  # nicht mit der PowerShell-Position uebereinstimmen. Relative Argumente
  # (z. B. ./test/integration/...) wuerden sonst unzuverlaessig aufgeloest.
  if ($WorkingDirectory) { $startInfo.WorkingDirectory = $WorkingDirectory }

  $process = [System.Diagnostics.Process]::new()
  $process.StartInfo = $startInfo
  $timedOut = $false
  $exitCode = $null
  try {
    Register-ObjectEvent -InputObject $process -EventName OutputDataReceived `
      -SourceIdentifier $outEventId | Out-Null
    Register-ObjectEvent -InputObject $process -EventName ErrorDataReceived `
      -SourceIdentifier $errEventId | Out-Null

    if (-not $process.Start()) {
      throw ("{0} ({1}) liess sich nicht starten." -f (Split-Path -Leaf $FilePath), $Label)
    }
    $process.BeginOutputReadLine()
    $process.BeginErrorReadLine()

    if ($process.WaitForExit($effectiveTimeout * 1000)) {
      # Eigenes Process-Objekt: das Handle bleibt gehalten, der Exit-Code ist
      # nach dem bestaetigten Ende verlaesslich abrufbar.
      $exitCode = $process.ExitCode
      if ($null -eq $exitCode) {
        # Sicherheitsnetz, kein Normalweg: Refresh() verwirft die
        # zwischengespeicherten Angaben, der Exit-Code wird erneut erfragt.
        try { $process.Refresh() } catch { }
        $exitCode = $process.ExitCode
      }
    }
    else {
      $timedOut = $true
      # Kein stilles Weiterlaufen: der Prozess wird beendet, damit kein
      # verwaister Server zurueckbleibt. Die Ueberladung Kill($true)
      # (Prozessbaum) gibt es nur in .NET Core; im .NET Framework von Windows
      # PowerShell 5.1 schlaegt sie fehl, deshalb der Rueckfall auf Kill().
      try { $process.Kill($true) } catch { try { $process.Kill() } catch { } }
      try { $process.WaitForExit(10 * 1000) | Out-Null } catch { }
    }
  }
  finally {
    # Nachlauf mit hartem Deckel: die letzten asynchron gemeldeten Zeilen
    # treffen erst kurz nach dem Prozessende in der Warteschlange ein. Es wird
    # KEIN Stream-Ende abgewartet - nach 2 s insgesamt bzw. 250 ms ohne neues
    # Ereignis ist Schluss.
    $drainDeadline = (Get-Date).AddSeconds(2)
    $idleDeadline = (Get-Date).AddMilliseconds(250)
    while ((Get-Date) -lt $drainDeadline -and (Get-Date) -lt $idleDeadline) {
      $queued = @(Get-Event | Where-Object { $buffers.ContainsKey($_.SourceIdentifier) })
      if ($queued.Count -eq 0) {
        Start-Sleep -Milliseconds 25
        continue
      }
      foreach ($queuedEvent in $queued) {
        # $null steht fuer das Stream-Ende. Es wird nicht erwartet und nicht
        # abgewartet, sondern nur uebersprungen.
        $data = $queuedEvent.SourceEventArgs.Data
        if ($null -ne $data) {
          [void]$buffers[$queuedEvent.SourceIdentifier].Add([string]$data)
        }
        Remove-Event -EventIdentifier $queuedEvent.EventIdentifier -ErrorAction SilentlyContinue
      }
      $idleDeadline = (Get-Date).AddMilliseconds(250)
    }

    # Die bisherigen Umleitungsdateien bleiben erhalten; sie sind der Weg fuer
    # die Fehlersuche im Arbeitsverzeichnis. WriteAllLines statt Set-Content,
    # weil eine leere Sammlung sonst nicht an -Value gebunden werden kann.
    # -SuppressLogFiles unterbindet das fuer kennworttragende Aufrufe: psql
    # gibt im Fehlerfall die beanstandete Anweisungszeile zurueck.
    if (-not $SuppressLogFiles) {
      try { [IO.File]::WriteAllLines($outFile, [string[]]$outLines.ToArray()) } catch { }
      try { [IO.File]::WriteAllLines($errFile, [string[]]$errLines.ToArray()) } catch { }
    }

    # Aufraeumen in jedem Fall, auch bei Zeitlimit oder Fehler: erst die
    # asynchronen Leser abmelden, dann die Ereignisregistrierungen samt
    # verbliebener Ereignisse entfernen, dann das Process-Objekt verwerfen.
    try { $process.CancelOutputRead() } catch { }
    try { $process.CancelErrorRead() } catch { }
    foreach ($sourceId in @($outEventId, $errEventId)) {
      try { Unregister-Event -SourceIdentifier $sourceId -Force -ErrorAction SilentlyContinue } catch { }
      foreach ($leftover in @(Get-Event | Where-Object { $_.SourceIdentifier -eq $sourceId })) {
        Remove-Event -EventIdentifier $leftover.EventIdentifier -ErrorAction SilentlyContinue
      }
    }
    try { $process.Dispose() } catch { }
  }

  if ($timedOut) {
    throw ("{0} ({1}) hat das wirksame Zeitlimit von {2} s ueberschritten und wurde beendet." -f
      (Split-Path -Leaf $FilePath), $Label, $effectiveTimeout)
  }
  if ($null -eq $exitCode) {
    # Fail-closed: ein unbestimmbarer Endzustand ist kein Nachweis. Er wird
    # weder stillschweigend als Erfolg (0) noch als gewoehnlicher Fehlschlag
    # ausgegeben, sondern eindeutig und mit Label gemeldet.
    throw ("{0} ({1}): kein Exit-Code ermittelbar, der Endzustand ist unbestimmbar." -f
      (Split-Path -Leaf $FilePath), $Label)
  }
  $exitCode = [int]$exitCode

  # Reihenfolge wie bisher: erst stdout, dann stderr. Die Zeilen stammen jetzt
  # unmittelbar aus der asynchronen Sammlung statt aus einem erneuten Lesen der
  # Dateien; der Inhalt ist derselbe.
  $text = @()
  if ($outLines.Count -gt 0) { $text += $outLines.ToArray() }
  if ($errLines.Count -gt 0) { $text += $errLines.ToArray() }

  return [pscustomobject]@{ ExitCode = $exitCode; Output = $text }
}

<#
.SYNOPSIS
  True, wenn auf dem Port tatsaechlich noch ein Dienst annimmt.

.DESCRIPTION
  Bewusst ein echter TCP-Verbindungsversuch und keine Auswertung von
  `Get-NetTCPConnection`: der Verbindungsversuch belegt die Aussage
  "der Port ist wieder frei" unabhaengig von optionalen Netzwerkmodulen und
  von Zustandseintraegen, die noch im TIME_WAIT stehen.
#>
function Test-TcpListening {
  param(
    [Parameter(Mandatory)][string]$TargetHost,
    [Parameter(Mandatory)][int]$TargetPort,
    [int]$TimeoutMilliseconds = 1000
  )

  $client = [System.Net.Sockets.TcpClient]::new()
  try {
    $connect = $client.ConnectAsync($TargetHost, $TargetPort)
    if (-not $connect.Wait($TimeoutMilliseconds)) { return $false }
    return $client.Connected
  }
  catch {
    # Verbindung abgelehnt bzw. Zeitueberschreitung: es lauscht nichts.
    return $false
  }
  finally { $client.Dispose() }
}

<#
.SYNOPSIS
  Reste eines frueher hart abgebrochenen Laufs erkennen und bereinigen.

.DESCRIPTION
  Wird der PowerShell-Host von aussen beendet, laeuft das `finally` dieses
  Skripts nicht mehr; ein temporaeres Cluster und das Arbeitsverzeichnis
  bleiben liegen, und der Clusterpfad ist nur noch aus dem Dateisystem
  rekonstruierbar. Deshalb wird VOR dem Anlegen eines neuen Clusters gezielt
  nach solchen Resten gesucht.

  Streng begrenzt und fail-closed:
    * gesucht wird NUR unmittelbar unter [IO.Path]::GetTempPath(), nicht rekursiv;
    * nur Verzeichnisnamen, die exakt ^kb_ap14b_(cluster|work)_\d{8}_\d{6}$
      erfuellen, also nur Namen, die dieses Skript selbst erzeugt haben kann;
    * gestoppt wird ausschliesslich ueber `pg_ctl -D <pfad> -m immediate -w stop`
      und nur, wenn der aus postmaster.pid gelesene Port weder 5432 noch der
      Port des vorhandenen Dienstes ist.
  Trifft eine Bedingung nicht zu, wird NICHT gestoppt und NICHT geloescht,
  sondern abgebrochen. Ein bestehender PostgreSQL-Dienst und jedes Verzeichnis
  ausserhalb des Musters bleiben unberuehrt.
#>
function Remove-StaleRunArtifacts {
  param(
    [Parameter(Mandatory)][string]$CurrentStamp,
    [Parameter(Mandatory)][int]$ForbiddenPort
  )

  $tempRoot = [IO.Path]::GetTempPath()
  $expectedParent = ([IO.Path]::GetFullPath($tempRoot)).TrimEnd('\', '/')
  $namePattern = '^kb_ap14b_(cluster|work)_\d{8}_\d{6}$'
  $ownNames = @(("kb_ap14b_cluster_{0}" -f $CurrentStamp), ("kb_ap14b_work_{0}" -f $CurrentStamp))

  $candidates = @(
    Get-ChildItem -LiteralPath $tempRoot -Directory -Force -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -match $namePattern -and $ownNames -notcontains $_.Name }
  )
  if ($candidates.Count -eq 0) { return }

  Write-Host ("Reste frueherer Laeufe gefunden: {0}" -f $candidates.Count)
  foreach ($candidate in $candidates) {
    Write-Host ("  Rest: {0}" -f $candidate.FullName)
  }

  foreach ($candidate in $candidates) {
    $candidatePath = $candidate.FullName

    # 1) Der Rest muss unmittelbar unter dem Temp-Verzeichnis liegen.
    $actualParent = ([IO.Path]::GetFullPath($candidate.Parent.FullName)).TrimEnd('\', '/')
    if (-not $actualParent.Equals($expectedParent, [StringComparison]::OrdinalIgnoreCase)) {
      throw ("Rest {0} liegt nicht unmittelbar unter {1}. Es wird nichts gestoppt und nichts entfernt." -f
        $candidatePath, $expectedParent)
    }

    # 2) Keine Verzeichnisverknuepfung: sonst wuerde das Entfernen ein fremdes
    #    Ziel treffen koennen.
    if (($candidate.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq [IO.FileAttributes]::ReparsePoint) {
      throw ("Rest {0} ist eine Verzeichnisverknuepfung. Es wird nichts gestoppt und nichts entfernt." -f
        $candidatePath)
    }

    $isCluster = $candidate.Name.StartsWith("kb_ap14b_cluster_", [StringComparison]::Ordinal)
    $pidFile = Join-Path $candidatePath "postmaster.pid"
    if ($isCluster -and (Test-Path -LiteralPath $pidFile)) {
      # postmaster.pid: Zeile 1 PID, Zeile 2 Datenverzeichnis, Zeile 3 Startzeit,
      # Zeile 4 Port. Nur der Port entscheidet, ob gestoppt werden darf.
      $pidLines = @()
      try { $pidLines = @(Get-Content -LiteralPath $pidFile -ErrorAction Stop) } catch { $pidLines = @() }
      if ($pidLines.Count -lt 4) {
        throw ("postmaster.pid in {0} ist unvollstaendig; der Port ist nicht bestimmbar. Es wird nichts gestoppt und nichts entfernt." -f
          $candidatePath)
      }
      $stalePort = 0
      if (-not [int]::TryParse($pidLines[3].Trim(), [ref]$stalePort)) {
        throw ("Der Port in {0} ist nicht lesbar. Es wird nichts gestoppt und nichts entfernt." -f $pidFile)
      }
      if ($stalePort -eq 5432 -or $stalePort -eq $ForbiddenPort) {
        # Klammerung beachten: -f bindet in PowerShell staerker als +, die
        # Verkettung muss deshalb zuerst zusammengesetzt werden.
        throw (("Der Rest {0} nennt Port {1}. Das ist der Standardport oder der Port des vorhandenen " +
          "Dienstes; es wird nichts gestoppt und nichts entfernt.") -f $candidatePath, $stalePort)
      }

      Write-Host ("  Stoppe verwaistes Cluster auf Port {0} ..." -f $stalePort)
      $staleStop = Invoke-HandleSafeProcess -FilePath $pgCtl -Label ("pg_ctl_stop_stale_" + $stalePort) `
        -TimeoutSeconds $ClusterStopTimeoutSeconds `
        -Arguments @("-D", $candidatePath, "-m", "immediate", "-w", "stop")
      if ($staleStop.ExitCode -ne 0) {
        $staleStop.Output | Select-Object -Last 20 | ForEach-Object { Write-Host $_ }
      }

      $staleDeadline = (Get-Date).AddSeconds(15)
      while (Test-TcpListening -TargetHost "127.0.0.1" -TargetPort $stalePort) {
        if ((Get-Date) -gt $staleDeadline) { break }
        Start-Sleep -Milliseconds 500
      }
      if (Test-TcpListening -TargetHost "127.0.0.1" -TargetPort $stalePort) {
        throw (("Auf 127.0.0.1:{0} lauscht weiterhin ein Dienst aus dem Rest {1}. Der Lauf wird " +
          "abgebrochen; es wird nichts entfernt.") -f $stalePort, $candidatePath)
      }
      Write-Host ("  Verwaistes Cluster gestoppt, 127.0.0.1:{0} lauscht nicht mehr." -f $stalePort)
    }

    for ($attempt = 1; $attempt -le 10; $attempt += 1) {
      Remove-Item -LiteralPath $candidatePath -Recurse -Force -ErrorAction SilentlyContinue
      if (-not (Test-Path -LiteralPath $candidatePath)) { break }
      Start-Sleep -Milliseconds 500
    }
    if (Test-Path -LiteralPath $candidatePath) {
      if ($isCluster) {
        throw (("Der Rest {0} liess sich nicht entfernen. Der Lauf wird abgebrochen, weil unklar " +
          "bleibt, ob dort noch ein Serverprozess laeuft.") -f $candidatePath)
      }
      Write-Warning ("Der Rest {0} liess sich nicht entfernen." -f $candidatePath)
    }
    else {
      Write-Host ("  Rest entfernt: {0}" -f $candidatePath)
    }
  }
}

# Wartet mit endlichem Zeitlimit, bis das Cluster Verbindungen annimmt.
function Wait-ClusterReady {
  param([int]$TimeoutSeconds)

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  for (;;) {
    $probe = Invoke-HandleSafeProcess -FilePath $pgIsReady -Label "pg_isready" `
      -TimeoutSeconds 20 `
      -Arguments @("-h", $HostName, "-p", "$Port", "-U", $PostgresUser, "-t", "5")
    if ($probe.ExitCode -eq 0) { return }
    if ((Get-Date) -gt $deadline) {
      $probe.Output | ForEach-Object { Write-Host $_ }
      throw ("Das temporaere Cluster war nach {0} s nicht bereit (pg_isready Exit {1})." -f
        $TimeoutSeconds, $probe.ExitCode)
    }
    Start-Sleep -Milliseconds 500
  }
}

<#
.SYNOPSIS
  Ein psql-Aufruf gegen die Testdatenbank, handle-sicher und zeitlich begrenzt.

.DESCRIPTION
  Verhalten wie bisher: die gesammelten Ausgabezeilen werden zurueckgegeben und
  $script:LastPsqlExitCode traegt den Prozess-Exitcode. Massgeblich bleibt
  allein dieser Exitcode; NOTICE-Zeilen auf stderr sind kein Fehler.
  Argumentreihenfolge und -inhalte sind unveraendert (-X, ON_ERROR_STOP=1).
  Das Kennwort erreicht psql weiterhin ausschliesslich ueber die geerbte
  Umgebungsvariable PGPASSWORD.
#>
function Invoke-Psql {
  param(
    [string]$File,
    [string]$Command,
    [string]$Label,
    [int]$TimeoutSeconds = 120,
    [switch]$SuppressLogFiles
  )

  $arguments = @("-X", "-h", $HostName, "-p", "$Port", "-U", $PostgresUser, "-d", $database,
    "-v", "ON_ERROR_STOP=1")
  if ($File) { $arguments += @("-f", $File) } else { $arguments += @("-c", $Command) }

  if (-not $Label) {
    if ($File) { $Label = "psql_" + [IO.Path]::GetFileNameWithoutExtension($File) }
    else { $Label = "psql_command" }
  }

  $run = Invoke-HandleSafeProcess -FilePath $psql -Label $Label `
    -TimeoutSeconds $TimeoutSeconds -Arguments $arguments -SuppressLogFiles:$SuppressLogFiles
  $script:LastPsqlExitCode = $run.ExitCode
  return $run.Output
}

try {
  if ($TemporaryCluster) {
    # Vor jeder Portpruefung und vor initdb: Reste eines frueheren Laufs. $Port
    # traegt hier noch den Wert von -Port, also den Port des vorhandenen
    # Dienstes - genau der darf nicht angefasst werden.
    Remove-StaleRunArtifacts -CurrentStamp $stamp -ForbiddenPort $Port

    $clusterDir = Join-Path ([IO.Path]::GetTempPath()) ("kb_ap14b_cluster_{0}" -f $stamp)

    $HostName = "127.0.0.1"
    $Port = $ClusterPort

    # Fail-closed vor dem Start: lauscht auf dem Zielport bereits etwas, ist
    # unklar, gegen welches Cluster der Lauf spaeter arbeiten wuerde.
    if (Test-TcpListening -TargetHost $HostName -TargetPort $Port) {
      throw ("Auf {0}:{1} lauscht bereits ein Dienst. Der Lauf wird abgebrochen, " +
        "damit kein fremdes Cluster benutzt oder veraendert wird." -f $HostName, $Port)
    }

    Write-Host "Erzeuge temporaeres PostgreSQL-Cluster in $clusterDir ..."
    $init = Invoke-HandleSafeProcess -FilePath $initdb -Label "initdb" -TimeoutSeconds 300 `
      -Arguments @("-D", $clusterDir, "-U", $PostgresUser, "--auth=trust", "-E", "UTF8", "--no-locale")
    if ($init.ExitCode -ne 0) {
      $init.Output | Select-Object -Last 20 | ForEach-Object { Write-Host $_ }
      throw ("initdb ist fehlgeschlagen (Exit {0})." -f $init.ExitCode)
    }

    # Markerdatei: nach einem harten Abbruch von aussen laeuft das `finally`
    # nicht mehr und der Clusterpfad steht nur noch im Arbeitsspeicher des
    # sterbenden Hosts. Diese Datei macht ihn auffindbar. Ohne Kennwoerter.
    $markerFile = Join-Path $workDir "cluster.marker"
    try {
      [IO.File]::WriteAllLines($markerFile, [string[]]@(
        ("stamp=" + $stamp),
        ("cluster_dir=" + $clusterDir),
        ("host=" + $HostName),
        ("port=" + $Port),
        ("work_dir=" + $workDir)
      ))
      Write-Host ("Markerdatei geschrieben: {0}" -f $markerFile)
    }
    catch {
      Write-Warning ("Die Markerdatei liess sich nicht schreiben: {0}" -f $_.Exception.Message)
    }

    $logFile = Join-Path $clusterDir "server.log"
    # Ab hier gilt das Cluster als gestartet: schon ein zeitueberschreitender
    # oder teilweise erfolgreicher Start muss den Stopp-Pfad im finally
    # durchlaufen, sonst bleibt ein Server zurueck.
    $clusterStarted = $true
    $start = Invoke-HandleSafeProcess -FilePath $pgCtl -Label "pg_ctl_start" -TimeoutSeconds 120 `
      -Arguments @("-D", $clusterDir, "-l", $logFile,
        "-o", ("-p {0} -c listen_addresses=127.0.0.1" -f $Port), "-w", "start")
    if ($start.ExitCode -ne 0) {
      $start.Output | Select-Object -Last 20 | ForEach-Object { Write-Host $_ }
      throw ("Das temporaere Cluster konnte nicht gestartet werden (Exit {0})." -f $start.ExitCode)
    }

    # Zweite, unabhaengige Bestaetigung: `pg_ctl -w` meldet den Start, aber erst
    # `pg_isready` belegt, dass Verbindungen tatsaechlich angenommen werden.
    Wait-ClusterReady -TimeoutSeconds $ClusterReadyTimeoutSeconds
    Write-Host ("Temporaeres Cluster laeuft und ist bereit auf {0}:{1}." -f $HostName, $Port)
  }
  else {
    if ($Password) {
      $securePassword = $Password
    }
    else {
      # Ohne -Password wuerde Read-Host unbegrenzt auf eine Konsoleneingabe
      # warten. In einem nicht-interaktiven Lauf ist das kein Warten, sondern
      # ein Stillstand bis zum Abschuss von aussen - danach bleibt ein
      # temporaerer Server zurueck. Deshalb hier fail-closed.
      if (-not [Environment]::UserInteractive -or [Console]::IsInputRedirected) {
        throw ("Kein -Password uebergeben und keine interaktive Konsole verfuegbar. " +
          "Der Lauf wird abgebrochen, statt auf eine Kennworteingabe zu warten. " +
          "Uebergib -Password als SecureString oder benutze -TemporaryCluster.")
      }
      $securePassword = Read-Host "PostgreSQL-Kennwort fuer Benutzer '$PostgresUser'" -AsSecureString
    }
    $passwordPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    # Prozessumgebungsvariable: sie wird von jedem ueber
    # Invoke-HandleSafeProcess gestarteten Werkzeug geerbt. Kein Kennwort in der
    # Befehlszeile, keines in einer Datei.
    $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPtr)
  }

  Write-Host "Erzeuge temporaere Testdatenbank $database ..."
  $create = Invoke-HandleSafeProcess -FilePath $createdb -Label "createdb" -TimeoutSeconds 60 `
    -Arguments @("-h", $HostName, "-p", "$Port", "-U", $PostgresUser, $database)
  if ($create.ExitCode -ne 0) {
    $create.Output | Select-Object -Last 20 | ForEach-Object { Write-Host $_ }
    throw "Testdatenbank konnte nicht angelegt werden."
  }
  $databaseCreated = $true

  $allOutput = [System.Collections.Generic.List[string]]::new()
  foreach ($file in $files) {
    Write-Host ("Pruefe: {0}" -f (Split-Path -Leaf $file))
    $output = Invoke-Psql -File $file -TimeoutSeconds 120
    foreach ($line in $output) { $allOutput.Add([string]$line) }
    if ($script:LastPsqlExitCode -ne 0) {
      $output | Select-Object -Last 30 | ForEach-Object { Write-Host $_ }
      throw "SQL-Lauf fehlgeschlagen: $file"
    }
  }

  $failures = @($allOutput | Where-Object { $_ -match "SMOKE\s+\S+\s+FAIL" })
  if ($failures.Count -gt 0) {
    $failures | ForEach-Object { Write-Host $_ }
    throw ("Smoke-Tests enthalten {0} FAIL-Meldung(en)." -f $failures.Count)
  }

  Write-Host ""
  Write-Host "--- AP14/B-, AP15-, AP15-b-, AUFTRAG_6- und AUFTRAG_7-Pruefungen aus 19_ap14b_platform.sql, 19a_ap14b_grant_reset.sql, 20_ap14b_data.sql, 21_ap14b_masterdata_inventory.sql, 22_ap14b_images.sql, 23_ap14b_admin_users.sql, 24_ap15_dashboard_metrics.sql, 25_ap15b_incident_metrics.sql, 26_hlk_kataloge.sql und 27_hlk_anrufdaten.sql ---"
  # Die Ueberschrift nennt Smoke 21 ausdruecklich mit. Er benutzt aber eigene
  # Fallpraefixe (M fuer Stammdaten, N fuer Inventar) und wuerde vom bisherigen
  # Muster "SMOKE [PRD]\d+" nicht erfasst - der Auszug waere irrefuehrend, weil
  # er eine Datei ankuendigt, aus der keine Zeile erscheint. Deshalb die zweite
  # Bedingung. Fuer Smoke 22 gilt dasselbe: er benutzt B (fachliche Faelle der
  # Bilddokumentation) und G (Rechte- und Negativfaelle) und braucht deshalb eine
  # eigene, dritte Bedingung. Fuer Smoke 23 gilt dasselbe ein weiteres Mal: er
  # benutzt U (administrative Benutzerverwaltung) und schliesst mit
  # "SMOKE U-ENDE" ab - beides braucht eine eigene, vierte Bedingung, sonst
  # bliebe der Nachweis der Benutzerverwaltung im Auszug unsichtbar.
  $allOutput |
    Where-Object {
      ($_ -match "(19_ap14b_platform|19a_ap14b_grant_reset|20_ap14b_data)" -and $_ -match "SMOKE [PRD]\d+") -or
      ($_ -match "21_ap14b_masterdata_inventory" -and $_ -match "SMOKE [MN]\d+") -or
      # Die Abschlusszeile von Smoke 22 heisst "SMOKE BG-ENDE" und erfuellt
      # "SMOKE [BG]\d+" nicht (auf BG folgt ein Bindestrich, keine Ziffer). Ohne
      # die dritte Alternative liefe der Smoke sichtbar bis G5 und seine
      # Abschlussbestaetigung fehlte im Konsolenauszug - ein stiller Nachweisverlust.
      ($_ -match "22_ap14b_images" -and $_ -match "SMOKE (B\d+|G\d+|BG-ENDE)") -or
      # Bewusst verallgemeinert auf "SMOKE U<...>": das fruehere Muster
      # "SMOKE (U\d+|U-ENDE)" verlangte unmittelbar hinter dem U entweder eine
      # Ziffer oder genau die Zeichenfolge "-ENDE". Der Block "SMOKE U-FIXTURES
      # OK ..." aus 23_ap14b_admin_users.sql erfuellt beides nicht und wurde
      # deshalb aus dem Konsolenauszug herausgefiltert, obwohl er geprueft wird -
      # ein stiller Nachweisverlust. "SMOKE U\S+" erfasst jede Fallkennung
      # dieses Smokes; die Einschraenkung auf die Datei steht ohnehin in der
      # ersten Bedingung dieser Alternative.
      ($_ -match "23_ap14b_admin_users" -and $_ -match "SMOKE U\S+") -or
      # Smoke 24 (AP15-1) benutzt die Fallkennung K und kennt zusaetzlich
      # "SMOKE K-FIXTURES" und "SMOKE K-ENDE". Ohne diese fuenfte Alternative
      # waere der gesamte Kennzahlnachweis im Konsolenauszug unsichtbar - genau
      # die Lehre, die in den Zeilen daruber schon zweimal festgehalten ist.
      # "SMOKE K\S+" erfasst deshalb von Anfang an jede Fallkennung dieses
      # Smokes; die Einschraenkung auf die Datei steht in der ersten Bedingung
      # dieser Alternative.
      ($_ -match "24_ap15_dashboard_metrics" -and $_ -match "SMOKE K\S+") -or
      # Smoke 25 (AP15-b) benutzt die Fallkennung W und kennt zusaetzlich
      # "SMOKE W-FIXTURES" und "SMOKE W-ENDE". Ohne diese sechste Alternative
      # waere der gesamte Nachweis der Fehlalarm-Kennzeichnung im Konsolenauszug
      # unsichtbar, obwohl die Datei laeuft und ausgewertet wird - genau der
      # stille Nachweisverlust, der in den Zeilen darueber schon dreimal
      # festgehalten ist. "SMOKE W\S+" erfasst jede Fallkennung dieses Smokes;
      # die Einschraenkung auf die Datei steht in der ersten Bedingung dieser
      # Alternative.
      ($_ -match "25_ap15b_incident_metrics" -and $_ -match "SMOKE W\S+") -or
      # Smoke 26 (AUFTRAG_6) benutzt die Fallkennung X und kennt zusaetzlich
      # "SMOKE X-FIXTURES" und "SMOKE X-ENDE". Ohne diese siebte Alternative
      # waere der gesamte Nachweis der pflegbaren Stammdaten-Kataloge
      # Gewerk/Funktion/Objektart im Konsolenauszug unsichtbar - dieselbe
      # Lehre wie in den Zeilen darueber. "SMOKE X\S+" erfasst jede
      # Fallkennung dieses Smokes; die Einschraenkung auf die Datei steht in
      # der ersten Bedingung dieser Alternative.
      ($_ -match "26_hlk_kataloge" -and $_ -match "SMOKE X\S+") -or
      # Smoke 27 (AUFTRAG_7) benutzt die Fallkennung Y und kennt zusaetzlich
      # "SMOKE Y-FIXTURES" und "SMOKE Y-ENDE". Ohne diese achte Alternative
      # waere der gesamte Nachweis der Anrufdaten/des "In Klaerung"-
      # Kennzeichens im Konsolenauszug unsichtbar - dieselbe Lehre wie in den
      # Zeilen darueber. "SMOKE Y\S+" erfasst jede Fallkennung dieses
      # Smokes; die Einschraenkung auf die Datei steht in der ersten
      # Bedingung dieser Alternative.
      ($_ -match "27_hlk_anrufdaten" -and $_ -match "SMOKE Y\S+")
    } |
    ForEach-Object { Write-Host (($_ -split "NOTICE:\s+")[-1]) }

  if (-not $SkipIntegrationTests) {
    Write-Host ""
    Write-Host "Lege temporaere Anmelderolle fuer die Integrationstests an ..."
    # Nicht privilegiert: kein SUPERUSER, kein BYPASSRLS, kein Eigentum. Die
    # Rechte kommen ausschliesslich aus der Gruppenrolle app_user.
    $createRole = @"
create role "$appRole" login password '$rolePassword'
  inherit nosuperuser nocreatedb nocreaterole nobypassrls;
grant app_user to "$appRole";
grant connect on database "$database" to "$appRole";
"@
    # -SuppressLogFiles und keine Ausgabe der Werkzeugmeldungen: psql gibt im
    # Fehlerfall die beanstandete Zeile samt Anweisungstext zurueck, und darin
    # staende das zufaellige Kennwort. Es darf weder in die Ausgabe noch in eine
    # Datei gelangen.
    $null = Invoke-Psql -Command $createRole -Label "psql_create_role" `
      -TimeoutSeconds 60 -SuppressLogFiles
    if ($script:LastPsqlExitCode -ne 0) {
      throw (("Die temporaere Anmelderolle konnte nicht angelegt werden (psql Exit {0}). Die " +
        "Werkzeugausgabe wird bewusst nicht gezeigt, weil sie das Kennwort enthalten kann.") -f
        $script:LastPsqlExitCode)
    }
    $roleCreated = $true

    $appUrl = "postgresql://{0}:{1}@{2}:{3}/{4}" -f $appRole, $rolePassword, $HostName, $Port, $database
    $adminUrl = if ($TemporaryCluster) {
      "postgresql://{0}@{1}:{2}/{3}" -f $PostgresUser, $HostName, $Port, $database
    } else {
      "postgresql://{0}:{1}@{2}:{3}/{4}" -f $PostgresUser, $env:PGPASSWORD, $HostName, $Port, $database
    }

    Write-Host "Fuehre Integrationstests des Anwendungscodes aus ..."
    # Ebenfalls ohne Pipeline: der Testprozess startet das Bootstrap-Werkzeug als
    # Kindprozess. Die Umleitung in Dateien haelt den Aufruf unabhaengig davon
    # handle-sicher und begrenzt ihn zeitlich. Die angeforderten 900 s bleiben
    # stehen; wirksam ist ohnehin das Minimum mit der Restzeit des
    # Gesamtbudgets.
    try {
      $env:AP14B_APP_DATABASE_URL = $appUrl
      $env:AP14B_ADMIN_DATABASE_URL = $adminUrl
      $nodeRun = Invoke-HandleSafeProcess -FilePath $NodeExe -Label "integration" `
        -TimeoutSeconds 900 -WorkingDirectory $appRoot `
        -Arguments @("--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
          "--import", "./test/integration/module-hooks.mjs",
          "./test/integration/ap14b-platform.int.mjs")
    }
    finally {
      Remove-Item Env:\AP14B_APP_DATABASE_URL -ErrorAction SilentlyContinue
      Remove-Item Env:\AP14B_ADMIN_DATABASE_URL -ErrorAction SilentlyContinue
    }
    $nodeRun.Output | ForEach-Object { Write-Host $_ }
    if ($nodeRun.ExitCode -ne 0) {
      throw ("Integrationstests fehlgeschlagen (Exit {0})." -f $nodeRun.ExitCode)
    }

    Write-Host ""
    Write-Host "Fuehre Integrationstests der Stammdaten- und Inventarmodule aus ..."
    # Zweiter, gleichartiger Aufruf mit derselben Auswertung. Er braucht eine
    # EIGENE Hooks-Datei: die Fachmodule verlangen ausserhalb von Next
    # zusaetzlich Ersatz fuer `next/cache` und `@/lib/auth`. Der Aufruf oben
    # bleibt dadurch unveraendert.
    try {
      $env:AP14B_APP_DATABASE_URL = $appUrl
      $env:AP14B_ADMIN_DATABASE_URL = $adminUrl
      $masterdataRun = Invoke-HandleSafeProcess -FilePath $NodeExe -Label "integration_masterdata" `
        -TimeoutSeconds 900 -WorkingDirectory $appRoot `
        -Arguments @("--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
          "--import", "./test/integration/module-hooks-app.mjs",
          "./test/integration/ap14b-masterdata-inventory.int.mjs")
    }
    finally {
      Remove-Item Env:\AP14B_APP_DATABASE_URL -ErrorAction SilentlyContinue
      Remove-Item Env:\AP14B_ADMIN_DATABASE_URL -ErrorAction SilentlyContinue
    }
    $masterdataRun.Output | ForEach-Object { Write-Host $_ }
    if ($masterdataRun.ExitCode -ne 0) {
      throw ("Integrationstests der Stammdaten- und Inventarmodule fehlgeschlagen (Exit {0})." -f
        $masterdataRun.ExitCode)
    }

    Write-Host ""
    Write-Host "Fuehre Integrationstests des Bildpfades aus ..."
    # Dritter, gleichartiger Aufruf mit derselben Auswertung. Er benutzt dieselbe
    # Hooks-Datei wie der Stammdatenlauf (module-hooks-app.mjs) und startet den
    # synthetischen S3-kompatiblen Testendpunkt IM TESTPROZESS: er lauscht auf
    # 127.0.0.1 und einem vom Betriebssystem zugewiesenen freien Port, haelt die
    # Objekte ausschliesslich im Arbeitsspeicher und wird am Ende des Laufs
    # geschlossen. Es bleibt kein Prozess, kein Port und kein Verzeichnis zurueck.
    # DAS IST KEIN MinIO UND KEIN MinIO-NACHWEIS (Begruendung und Abgrenzung im
    # Kopf von test/integration/s3-test-endpoint.mjs).
    try {
      $env:AP14B_APP_DATABASE_URL = $appUrl
      $env:AP14B_ADMIN_DATABASE_URL = $adminUrl
      $imagesRun = Invoke-HandleSafeProcess -FilePath $NodeExe -Label "integration_images" `
        -TimeoutSeconds 900 -WorkingDirectory $appRoot `
        -Arguments @("--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
          "--import", "./test/integration/module-hooks-app.mjs",
          "./test/integration/ap14b-images.int.mjs")
    }
    finally {
      Remove-Item Env:\AP14B_APP_DATABASE_URL -ErrorAction SilentlyContinue
      Remove-Item Env:\AP14B_ADMIN_DATABASE_URL -ErrorAction SilentlyContinue
    }
    $imagesRun.Output | ForEach-Object { Write-Host $_ }
    if ($imagesRun.ExitCode -ne 0) {
      throw ("Integrationstests des Bildpfades fehlgeschlagen (Exit {0})." -f
        $imagesRun.ExitCode)
    }

    Write-Host ""
    Write-Host "Fuehre Integrationstests der administrativen Benutzerverwaltung aus ..."
    # Vierter, gleichartiger Aufruf mit derselben Auswertung. Er benutzt
    # ausdruecklich module-hooks.mjs wie der erste Lauf und NICHT
    # module-hooks-app.mjs: geprueft werden die echten Modulfunktionen aus
    # src/lib/admin-users.ts ZUSAMMEN mit der echten Sitzungsauswertung aus
    # src/lib/auth-service.ts; ein Sitzungsstub wuerde genau den Nachweis
    # entwerten. Er steht bewusst NACH dem ersten Lauf: seine Administratorkonten
    # tragen einen echten Argon2id-Hash und wuerden die Bootstrap-Ausgangslage
    # des ersten Laufs (usableAdminCount) mitzaehlen. Der Test raeumt sie
    # vollstaendig ab.
    try {
      $env:AP14B_APP_DATABASE_URL = $appUrl
      $env:AP14B_ADMIN_DATABASE_URL = $adminUrl
      # Pflichtmodus auch lokal: fehlt eine der beiden Verbindungsvariablen,
      # bricht der Test ab, statt still zu ueberspringen. Ein lokaler Lauf soll
      # genauso wenig einen Nachweis vortaeuschen wie die CI, in der
      # run_db_tests.sh denselben Schalter setzt. Er wird wie die beiden
      # Verbindungsvariablen im finally wieder entfernt.
      $env:AP14B_REQUIRE_INTEGRATION = "1"
      $adminUsersRun = Invoke-HandleSafeProcess -FilePath $NodeExe -Label "integration_admin_users" `
        -TimeoutSeconds 900 -WorkingDirectory $appRoot `
        -Arguments @("--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
          "--import", "./test/integration/module-hooks.mjs",
          "./test/integration/ap14b-admin-users.int.mjs")
    }
    finally {
      Remove-Item Env:\AP14B_APP_DATABASE_URL -ErrorAction SilentlyContinue
      Remove-Item Env:\AP14B_ADMIN_DATABASE_URL -ErrorAction SilentlyContinue
      Remove-Item Env:\AP14B_REQUIRE_INTEGRATION -ErrorAction SilentlyContinue
    }
    $adminUsersRun.Output | ForEach-Object { Write-Host $_ }
    if ($adminUsersRun.ExitCode -ne 0) {
      throw ("Integrationstests der administrativen Benutzerverwaltung fehlgeschlagen (Exit {0})." -f
        $adminUsersRun.ExitCode)
    }

    Write-Host ""
    Write-Host "Fuehre Integrationstests der Dashboard-Statuskennzahlen aus (AP15-1) ..."
    # Fuenfter, gleichartiger Aufruf mit derselben Auswertung - ebenfalls ueber
    # Invoke-HandleSafeProcess und ausdruecklich NICHT ueber eine Pipeline
    # (Begruendung im Kopf dieser Datei, Zeilen zur Handle-Sicherheit, und in
    # Invoke-HandleSafeProcess selbst). Er benutzt module-hooks-app.mjs wie der
    # Stammdaten- und der Bildlauf: geprueft wird das Modul
    # src/lib/incident-metrics.ts, das ausserhalb von Next Ersatz fuer
    # `next/cache` und `@/lib/auth` braucht.
    #
    # Er steht bewusst NACH der Benutzerverwaltung: jene raeumt ihre
    # Administratorkonten selbst ab, und diese Suite legt keine an. Er ergaenzt
    # den SQL-Smoke 24 an genau der Stelle, die eine SQL-Datei nicht belegen
    # kann - der Uebereinstimmung von Anwendungsabfrage und TERMINAL_STATUS aus
    # src/lib/status.ts.
    try {
      $env:AP14B_APP_DATABASE_URL = $appUrl
      $env:AP14B_ADMIN_DATABASE_URL = $adminUrl
      # Pflichtmodus wie beim vierten Lauf: fehlt eine der beiden
      # Verbindungsvariablen, bricht der Test ab, statt still zu ueberspringen.
      $env:AP14B_REQUIRE_INTEGRATION = "1"
      $metricsRun = Invoke-HandleSafeProcess -FilePath $NodeExe -Label "integration_ap15_metrics" `
        -TimeoutSeconds 900 -WorkingDirectory $appRoot `
        -Arguments @("--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
          "--import", "./test/integration/module-hooks-app.mjs",
          "./test/integration/ap15-dashboard-metrics.int.mjs")
    }
    finally {
      Remove-Item Env:\AP14B_APP_DATABASE_URL -ErrorAction SilentlyContinue
      Remove-Item Env:\AP14B_ADMIN_DATABASE_URL -ErrorAction SilentlyContinue
      Remove-Item Env:\AP14B_REQUIRE_INTEGRATION -ErrorAction SilentlyContinue
    }
    $metricsRun.Output | ForEach-Object { Write-Host $_ }
    if ($metricsRun.ExitCode -ne 0) {
      throw ("Integrationstests der Dashboard-Statuskennzahlen fehlgeschlagen (Exit {0})." -f
        $metricsRun.ExitCode)
    }

    Write-Host ""
    Write-Host "Fuehre Integrationstests des Fehlalarmpfades und des Vollmengen-Exports aus (AP15-b) ..."
    # SECHSTER und LETZTER, gleichartiger Aufruf mit derselben Auswertung -
    # ebenfalls ueber Invoke-HandleSafeProcess und ausdruecklich NICHT ueber eine
    # Pipeline (Begruendung im Kopf dieser Datei und in
    # Invoke-HandleSafeProcess selbst). Er benutzt module-hooks-app.mjs wie der
    # Stammdaten-, der Bild- und der Kennzahllauf: geprueft werden die Module
    # src/lib/incidents.ts (Fehlalarmpfad) und src/lib/incident-list-actions.ts
    # (Vollmengen-Export), die ausserhalb von Next Ersatz fuer `next/cache` und
    # `@/lib/auth` brauchen.
    #
    # WARUM AN LETZTER STELLE - der echte Grund: die Suite legt zum Nachweis der
    # Vollmengengrenze INCIDENT_FULL_EXPORT_CAP + 1 Vorgaenge an (Faelle
    # L10/L11). Diese Zeilen und die daraus abgeleiteten Aufgabenzeilen
    # UEBERDAUERN den Lauf, weil public.incidents wegen der unbedingten
    # Loeschsperre trg_incident_tasks_no_delete (0011_ap13_tasks_bulk.sql:113-123)
    # nicht per DELETE aufgeraeumt werden kann - die Sperre greift auch im
    # Eigentuemerkontext und auch bei der Kaskade. Laeufe, die ueber die GESAMTE
    # sichtbare Menge zaehlen - namentlich der Kennzahllauf darueber -, wuerden
    # dadurch deutlich langsamer. Sachlich falsch wuerden sie nicht, aber sie
    # muessen diese Last nicht tragen. Aufgeraeumt wird die Menge mit der
    # temporaeren Testdatenbank am Laufende (siehe finally).
    try {
      $env:AP14B_APP_DATABASE_URL = $appUrl
      $env:AP14B_ADMIN_DATABASE_URL = $adminUrl
      # Pflichtmodus wie beim vierten und fuenften Lauf: fehlt eine der beiden
      # Verbindungsvariablen, bricht der Test ab, statt still zu ueberspringen.
      $env:AP14B_REQUIRE_INTEGRATION = "1"
      $ap15bRun = Invoke-HandleSafeProcess -FilePath $NodeExe -Label "integration_ap15b_incident_list" `
        -TimeoutSeconds 900 -WorkingDirectory $appRoot `
        -Arguments @("--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
          "--import", "./test/integration/module-hooks-app.mjs",
          "./test/integration/ap15b-incident-list.int.mjs")
    }
    finally {
      Remove-Item Env:\AP14B_APP_DATABASE_URL -ErrorAction SilentlyContinue
      Remove-Item Env:\AP14B_ADMIN_DATABASE_URL -ErrorAction SilentlyContinue
      Remove-Item Env:\AP14B_REQUIRE_INTEGRATION -ErrorAction SilentlyContinue
    }
    $ap15bRun.Output | ForEach-Object { Write-Host $_ }
    if ($ap15bRun.ExitCode -ne 0) {
      throw ("Integrationstests des Fehlalarmpfades und des Vollmengen-Exports fehlgeschlagen (Exit {0})." -f
        $ap15bRun.ExitCode)
    }
  }

  Write-Host ""
  Write-Host "ERGEBNIS: AP10/AP11/AP12/AP13/AP14B/AP15/AP15-b DATENBANKTESTS ERFOLGREICH." -ForegroundColor Green
}
finally {
  # Notbudget: ab hier gilt ausschliesslich die feste Aufraeumfrist, unabhaengig
  # davon, wie viel vom Gesamtbudget verbraucht wurde. Das ist die EINE Stelle,
  # an der umgeschaltet wird; Get-RemainingSeconds wertet den Schalter aus.
  $script:CleanupPhase = $true
  $script:CleanupDeadline = (Get-Date).AddSeconds($script:CleanupBudgetSeconds)

  # Zustaende der Abschlussbilanz. "entfaellt" heisst: in dieser Betriebsart
  # gab es nichts zu tun.
  $portFreeState = "entfaellt"
  $clusterDirRemovedState = "entfaellt"
  $workDirRemovedState = "entfaellt"

  # Jeder externe Aufruf im Aufraeumpfad ist gekapselt: ein Zeitlimit oder ein
  # erschoepftes Notbudget darf das restliche Aufraeumen nicht verhindern.
  if ($roleCreated) {
    Write-Host "Entferne temporaere Anmelderolle ..."
    try {
      Invoke-Psql -Command ("revoke connect on database ""{0}"" from ""{1}""" -f $database, $appRole) `
        -Label "psql_revoke_connect" -TimeoutSeconds 60 | Out-Null
    }
    catch {
      Write-Warning ("revoke connect liess sich nicht ausfuehren: {0}" -f $_.Exception.Message)
    }
  }
  if ($databaseCreated) {
    Write-Host "Entferne temporaere Testdatenbank $database ..."
    $drop = $null
    try {
      $drop = Invoke-HandleSafeProcess -FilePath $dropdb -Label "dropdb" -TimeoutSeconds 60 `
        -Arguments @("-h", $HostName, "-p", "$Port", "-U", $PostgresUser, "--if-exists", "--force", $database)
    }
    catch {
      Write-Warning ("dropdb liess sich nicht auswerten: {0}" -f $_.Exception.Message)
    }
    if ($null -eq $drop -or $drop.ExitCode -ne 0) {
      Write-Warning "Die temporaere Testdatenbank konnte nicht automatisch entfernt werden: $database"
    }
  }
  if ($roleCreated) {
    $dropRoleExit = $null
    try {
      $dropRole = Invoke-HandleSafeProcess -FilePath $psql -Label "psql_drop_role" -TimeoutSeconds 60 `
        -Arguments @("-X", "-h", $HostName, "-p", "$Port", "-U", $PostgresUser, "-d", "postgres",
          "-v", "ON_ERROR_STOP=1", "-c", ("drop role if exists ""{0}""" -f $appRole))
      $dropRoleExit = $dropRole.ExitCode
    }
    catch {
      Write-Warning ("drop role liess sich nicht auswerten: {0}" -f $_.Exception.Message)
    }
    if ($null -eq $dropRoleExit -or $dropRoleExit -ne 0) {
      Write-Warning "Die temporaere Anmelderolle konnte nicht entfernt werden: $appRole"
    }
  }
  if ($clusterStarted) {
    Write-Host "Stoppe temporaeres Cluster ..."
    # Im finally darf kein Aufruf das restliche Aufraeumen verhindern: ein
    # Zeitlimit oder ein unbestimmbarer Endzustand von pg_ctl bleibt hier eine
    # Warnung. Der Port-Nachweis und das Entfernen von Clusterverzeichnis,
    # Arbeitsverzeichnis und PGPASSWORD laufen danach in jedem Fall weiter.
    $stop = $null
    try {
      $stop = Invoke-HandleSafeProcess -FilePath $pgCtl -Label "pg_ctl_stop" `
        -TimeoutSeconds $ClusterStopTimeoutSeconds `
        -Arguments @("-D", $clusterDir, "-m", "immediate", "-w", "stop")
    }
    catch {
      Write-Warning ("pg_ctl stop liess sich nicht auswerten: {0}" -f $_.Exception.Message)
    }
    if ($null -ne $stop -and $stop.ExitCode -ne 0) {
      $stop.Output | Select-Object -Last 20 | ForEach-Object { Write-Host $_ }
      Write-Warning ("pg_ctl stop endete mit Exit {0}." -f $stop.ExitCode)
    }

    # Nachweis, dass der Port wieder frei ist. Ohne diese Pruefung bliebe offen,
    # ob ein Serverprozess den Stopp ueberlebt hat. Die Warteschleife wird
    # zusaetzlich am Notbudget gedeckelt; rund 15 s bleiben fuer das Entfernen
    # der Verzeichnisse reserviert.
    $deadline = (Get-Date).AddSeconds($ClusterStopTimeoutSeconds)
    $portWaitBudgetSeconds = (Get-RemainingSeconds) - 15
    if ($portWaitBudgetSeconds -lt 0) { $portWaitBudgetSeconds = 0 }
    $budgetDeadline = (Get-Date).AddSeconds($portWaitBudgetSeconds)
    if ($budgetDeadline -lt $deadline) { $deadline = $budgetDeadline }
    while (Test-TcpListening -TargetHost $HostName -TargetPort $Port) {
      if ((Get-Date) -gt $deadline) { break }
      Start-Sleep -Milliseconds 500
    }
    if (Test-TcpListening -TargetHost $HostName -TargetPort $Port) {
      Write-Warning ("Auf {0}:{1} lauscht nach dem Stopp weiterhin ein Dienst." -f $HostName, $Port)
      $portFreeState = "nein"
    }
    else {
      Write-Host ("Bestaetigt: {0}:{1} lauscht nicht mehr." -f $HostName, $Port)
      $portFreeState = "ja"
    }
  }
  if ($clusterDir) {
    if (Test-Path -LiteralPath $clusterDir) {
      Write-Host "Entferne temporaeres Clusterverzeichnis ..."
      # Windows gibt die Dateihandles eines gerade beendeten Servers nicht immer
      # sofort frei; deshalb wenige begrenzte Wiederholungen statt eines Versuchs.
      for ($attempt = 1; $attempt -le 10; $attempt += 1) {
        Remove-Item -LiteralPath $clusterDir -Recurse -Force -ErrorAction SilentlyContinue
        if (-not (Test-Path -LiteralPath $clusterDir)) { break }
        Start-Sleep -Milliseconds 500
      }
      if (Test-Path -LiteralPath $clusterDir) {
        Write-Warning "Das temporaere Clusterverzeichnis konnte nicht entfernt werden: $clusterDir"
        $clusterDirRemovedState = "nein"
      }
      else {
        Write-Host "Temporaeres Clusterverzeichnis entfernt."
        $clusterDirRemovedState = "ja"
      }
    }
    else {
      $clusterDirRemovedState = "ja"
    }
  }
  if ($workDir) {
    if (Test-Path -LiteralPath $workDir) {
      # Die Umleitungsdateien sind Hilfsdateien des Laufs und bleiben nicht zurueck.
      Remove-Item -LiteralPath $workDir -Recurse -Force -ErrorAction SilentlyContinue
      if (Test-Path -LiteralPath $workDir) {
        Write-Warning "Das temporaere Arbeitsverzeichnis konnte nicht entfernt werden: $workDir"
        $workDirRemovedState = "nein"
      }
      else {
        $workDirRemovedState = "ja"
      }
    }
    else {
      $workDirRemovedState = "ja"
    }
  }
  Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
  if ($passwordPtr -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPtr)
  }

  # Abschlussbilanz: der maschinenlesbare Aufraeumnachweis dieses Laufs.
  Write-Host ("AUFRAEUMBILANZ: port_lauscht_nicht_mehr={0}" -f $portFreeState)
  Write-Host ("AUFRAEUMBILANZ: clusterverzeichnis_entfernt={0}" -f $clusterDirRemovedState)
  Write-Host ("AUFRAEUMBILANZ: arbeitsverzeichnis_entfernt={0}" -f $workDirRemovedState)
}
