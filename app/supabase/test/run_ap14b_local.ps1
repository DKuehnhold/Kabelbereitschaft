# Lokaler Windows-Lauf der vollstaendigen AP14/B-Kette (Arbeitspaket B, Auth-Basis).
#
# Reihenfolge gemaess ADR-011 / 2.10:
#   bootstrap/01-03  ->  migrations/0001-0011  ->  Smokes 15-18
#   ->  migrations/0012, 0013  ->  Smoke 19
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
# Integrationstests wird zufaellig erzeugt und nirgends ausgegeben.
#
# Hinweis: massgeblich ist allein der Prozess-Exitcode von psql. PostgreSQL
# schreibt auch harmlose NOTICE-Zeilen auf stderr; bei
# ErrorActionPreference=Stop wuerde PowerShell diese sonst faelschlich als
# terminierenden NativeCommandError behandeln.
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
# `Invoke-HandleSafeProcess`: `Start-Process` mit eigener, endlicher Umleitung
# von stdout und stderr in DATEIEN und mit begrenzter Wartezeit. Ein geerbtes
# Dateihandle hat keinen wartenden Leser und kann nicht blockieren.
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
  [int]$ClusterStopTimeoutSeconds = 60
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

$requiredTools = @($psql, $createdb, $dropdb)
if ($TemporaryCluster) { $requiredTools += @($initdb, $pgCtl, $pgIsReady) }
foreach ($tool in $requiredTools) {
  if (-not (Test-Path -LiteralPath $tool)) {
    throw "PostgreSQL-Werkzeug fehlt: $tool (Pfad ueber -BinPath anpassbar)"
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
  (Join-Path $testRoot "19_ap14b_platform.sql")
)
foreach ($file in $files) {
  if (-not (Test-Path -LiteralPath $file)) { throw "Testdatei fehlt: $file" }
}

$integrationTest = Join-Path $appRoot "test\integration\ap14b-platform.int.mjs"
$moduleHooks = Join-Path $appRoot "test\integration\module-hooks.mjs"
if (-not $SkipIntegrationTests) {
  foreach ($file in @($integrationTest, $moduleHooks)) {
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

  `Start-Process` mit `-RedirectStandardOutput`/`-RedirectStandardError`
  uebergibt stattdessen DATEIhandles. Ein geerbtes Dateihandle hat keinen
  wartenden Leser; der Aufruf endet mit dem Werkzeug selbst. Gewartet wird nur
  auf das gestartete Werkzeug, nicht auf dessen Nachkommen, und das mit
  endlichem Zeitlimit.
#>
function Invoke-HandleSafeProcess {
  param(
    [Parameter(Mandatory)][string]$FilePath,
    [string[]]$Arguments = @(),
    [Parameter(Mandatory)][string]$Label,
    [int]$TimeoutSeconds = 120,
    [string]$WorkingDirectory
  )

  $outFile = Join-Path $workDir ("{0}.out.log" -f $Label)
  $errFile = Join-Path $workDir ("{0}.err.log" -f $Label)

  $startArguments = @{
    FilePath               = $FilePath
    NoNewWindow            = $true
    PassThru               = $true
    RedirectStandardOutput = $outFile
    RedirectStandardError  = $errFile
  }
  if ($Arguments.Count -gt 0) {
    # Bewusst EINE fertige Zeichenkette und keine Liste: eine Liste wuerde von
    # Start-Process ungeklammert zusammengefuegt (siehe Format-NativeArgument).
    $startArguments.ArgumentList =
      (($Arguments | ForEach-Object { Format-NativeArgument $_ }) -join " ")
  }
  # Ausdruecklich gesetzt: das Arbeitsverzeichnis des PowerShell-PROZESSES muss
  # nicht mit der PowerShell-Position uebereinstimmen. Relative Argumente
  # (z. B. ./test/integration/...) wuerden sonst unzuverlaessig aufgeloest.
  if ($WorkingDirectory) { $startArguments.WorkingDirectory = $WorkingDirectory }

  $process = Start-Process @startArguments
  if (-not $process.WaitForExit($TimeoutSeconds * 1000)) {
    # Kein stilles Weiterlaufen: der Prozessbaum wird beendet, damit kein
    # verwaister Server zurueckbleibt.
    try { $process.Kill($true) } catch { }
    try { $process.WaitForExit(10 * 1000) | Out-Null } catch { }
    throw ("{0} hat das Zeitlimit von {1} s ueberschritten und wurde beendet." -f
      (Split-Path -Leaf $FilePath), $TimeoutSeconds)
  }
  $exitCode = $process.ExitCode

  $text = @()
  foreach ($file in @($outFile, $errFile)) {
    if (Test-Path -LiteralPath $file) {
      $content = Get-Content -LiteralPath $file -ErrorAction SilentlyContinue
      if ($content) { $text += $content }
    }
  }

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

function Invoke-Psql {
  param([string]$File, [string]$Command)

  $arguments = @("-X", "-h", $HostName, "-p", $Port, "-U", $PostgresUser, "-d", $database,
    "-v", "ON_ERROR_STOP=1")
  if ($File) { $arguments += @("-f", $File) } else { $arguments += @("-c", $Command) }

  $previous = $ErrorActionPreference
  try {
    $ErrorActionPreference = "Continue"
    $output = & $psql @arguments 2>&1
    $script:LastPsqlExitCode = $LASTEXITCODE
  }
  finally {
    $ErrorActionPreference = $previous
  }
  return $output
}

try {
  if ($TemporaryCluster) {
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
    $securePassword = if ($Password) {
      $Password
    } else {
      Read-Host "PostgreSQL-Kennwort fuer Benutzer '$PostgresUser'" -AsSecureString
    }
    $passwordPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPtr)
  }

  Write-Host "Erzeuge temporaere Testdatenbank $database ..."
  & $createdb -h $HostName -p $Port -U $PostgresUser $database
  if ($LASTEXITCODE -ne 0) { throw "Testdatenbank konnte nicht angelegt werden." }
  $databaseCreated = $true

  $allOutput = [System.Collections.Generic.List[string]]::new()
  foreach ($file in $files) {
    Write-Host ("Pruefe: {0}" -f (Split-Path -Leaf $file))
    $output = Invoke-Psql -File $file
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
  Write-Host "--- AP14/B-Pruefungen aus 19_ap14b_platform.sql ---"
  $allOutput |
    Where-Object { $_ -match "19_ap14b_platform" -and $_ -match "SMOKE P\d+" } |
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
    $output = Invoke-Psql -Command $createRole
    if ($script:LastPsqlExitCode -ne 0) {
      $output | ForEach-Object { Write-Host $_ }
      throw "Die temporaere Anmelderolle konnte nicht angelegt werden."
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
    # handle-sicher und begrenzt ihn zeitlich.
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
  }

  Write-Host ""
  Write-Host "ERGEBNIS: AP10/AP11/AP12/AP13/AP14B DATENBANKTESTS ERFOLGREICH." -ForegroundColor Green
}
finally {
  if ($roleCreated) {
    Write-Host "Entferne temporaere Anmelderolle ..."
    Invoke-Psql -Command "revoke connect on database ""$database"" from ""$appRole""" | Out-Null
  }
  if ($databaseCreated) {
    Write-Host "Entferne temporaere Testdatenbank $database ..."
    & $dropdb -h $HostName -p $Port -U $PostgresUser --if-exists --force $database
    if ($LASTEXITCODE -ne 0) {
      Write-Warning "Die temporaere Testdatenbank konnte nicht automatisch entfernt werden: $database"
    }
  }
  if ($roleCreated) {
    $previous = $ErrorActionPreference
    try {
      $ErrorActionPreference = "Continue"
      & $psql -X -h $HostName -p $Port -U $PostgresUser -d postgres `
        -v ON_ERROR_STOP=1 -c "drop role if exists ""$appRole""" 2>&1 | Out-Null
      $dropRoleExit = $LASTEXITCODE
    }
    finally { $ErrorActionPreference = $previous }
    if ($dropRoleExit -ne 0) {
      Write-Warning "Die temporaere Anmelderolle konnte nicht entfernt werden: $appRole"
    }
  }
  if ($clusterStarted) {
    Write-Host "Stoppe temporaeres Cluster ..."
    $stop = Invoke-HandleSafeProcess -FilePath $pgCtl -Label "pg_ctl_stop" `
      -TimeoutSeconds $ClusterStopTimeoutSeconds `
      -Arguments @("-D", $clusterDir, "-m", "immediate", "-w", "stop")
    if ($stop.ExitCode -ne 0) {
      $stop.Output | Select-Object -Last 20 | ForEach-Object { Write-Host $_ }
      Write-Warning ("pg_ctl stop endete mit Exit {0}." -f $stop.ExitCode)
    }

    # Nachweis, dass der Port wieder frei ist. Ohne diese Pruefung bliebe offen,
    # ob ein Serverprozess den Stopp ueberlebt hat.
    $deadline = (Get-Date).AddSeconds($ClusterStopTimeoutSeconds)
    while (Test-TcpListening -TargetHost $HostName -TargetPort $Port) {
      if ((Get-Date) -gt $deadline) { break }
      Start-Sleep -Milliseconds 500
    }
    if (Test-TcpListening -TargetHost $HostName -TargetPort $Port) {
      Write-Warning ("Auf {0}:{1} lauscht nach dem Stopp weiterhin ein Dienst." -f $HostName, $Port)
    }
    else {
      Write-Host ("Bestaetigt: {0}:{1} lauscht nicht mehr." -f $HostName, $Port)
    }
  }
  if ($clusterDir -and (Test-Path -LiteralPath $clusterDir)) {
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
    }
    else {
      Write-Host "Temporaeres Clusterverzeichnis entfernt."
    }
  }
  if ($workDir -and (Test-Path -LiteralPath $workDir)) {
    # Die Umleitungsdateien sind Hilfsdateien des Laufs und bleiben nicht zurueck.
    Remove-Item -LiteralPath $workDir -Recurse -Force -ErrorAction SilentlyContinue
    if (Test-Path -LiteralPath $workDir) {
      Write-Warning "Das temporaere Arbeitsverzeichnis konnte nicht entfernt werden: $workDir"
    }
  }
  Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
  if ($passwordPtr -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPtr)
  }
}
