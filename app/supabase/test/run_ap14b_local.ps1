# Lokaler Windows-Lauf der vollstaendigen AP14/B-Kette (Arbeitspaket B, Auth-Basis).
#
# Reihenfolge gemaess ADR-011 / 2.10:
#   bootstrap/01-03  ->  migrations/0001-0011  ->  Smokes 15-18
#   ->  migrations/0012, 0013, 0014  ->  Smokes 19, 20
#   ->  Integrationstests des Anwendungscodes (test/integration)
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
  [int]$MaxTotalSeconds = 480
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
  (Join-Path $testRoot "21_ap14b_masterdata_inventory.sql")
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
if (-not $SkipIntegrationTests) {
  foreach ($file in @($integrationTest, $moduleHooks, $masterdataIntegrationTest, $moduleHooksApp)) {
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
  Write-Host "--- AP14/B-Pruefungen aus 19_ap14b_platform.sql, 19a_ap14b_grant_reset.sql, 20_ap14b_data.sql und 21_ap14b_masterdata_inventory.sql ---"
  # Die Ueberschrift nennt Smoke 21 ausdruecklich mit. Er benutzt aber eigene
  # Fallpraefixe (M fuer Stammdaten, N fuer Inventar) und wuerde vom bisherigen
  # Muster "SMOKE [PRD]\d+" nicht erfasst - der Auszug waere irrefuehrend, weil
  # er eine Datei ankuendigt, aus der keine Zeile erscheint. Deshalb die zweite
  # Bedingung.
  $allOutput |
    Where-Object {
      ($_ -match "(19_ap14b_platform|19a_ap14b_grant_reset|20_ap14b_data)" -and $_ -match "SMOKE [PRD]\d+") -or
      ($_ -match "21_ap14b_masterdata_inventory" -and $_ -match "SMOKE [MN]\d+")
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
  }

  Write-Host ""
  Write-Host "ERGEBNIS: AP10/AP11/AP12/AP13/AP14B DATENBANKTESTS ERFOLGREICH." -ForegroundColor Green
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
