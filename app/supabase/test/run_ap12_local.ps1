[CmdletBinding()]
param(
  [string]$PostgresUser = "postgres",
  [string]$HostName = "localhost",
  [int]$Port = 5432,
  [Security.SecureString]$Password
)

$ErrorActionPreference = "Stop"
$psql = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
$createdb = "C:\Program Files\PostgreSQL\18\bin\createdb.exe"
$dropdb = "C:\Program Files\PostgreSQL\18\bin\dropdb.exe"
$testRoot = Split-Path -Parent $PSCommandPath
$supabaseRoot = Split-Path -Parent $testRoot
$migrationRoot = Join-Path $supabaseRoot "migrations"
$database = "kabelbereitschaft_ap12_test_{0}" -f (Get-Date -Format "yyyyMMdd_HHmmss")

foreach ($tool in @($psql, $createdb, $dropdb)) {
  if (-not (Test-Path -LiteralPath $tool)) {
    throw "PostgreSQL-Werkzeug fehlt: $tool"
  }
}

$files = @(
  (Join-Path $testRoot "00_stub_auth_storage.sql"),
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
  (Join-Path $testRoot "15_ap10_smoke.sql"),
  (Join-Path $testRoot "16_ap11_list.sql"),
  (Join-Path $testRoot "17_ap12_details.sql")
)
foreach ($file in $files) {
  if (-not (Test-Path -LiteralPath $file)) {
    throw "Testdatei fehlt: $file"
  }
}

$securePassword = if ($Password) {
  $Password
} else {
  Read-Host "PostgreSQL-Kennwort fuer Benutzer '$PostgresUser'" -AsSecureString
}
$passwordPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
$databaseCreated = $false

try {
  $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPtr)
  Write-Host "Erzeuge temporaere Testdatenbank $database ..."
  & $createdb -h $HostName -p $Port -U $PostgresUser $database
  if ($LASTEXITCODE -ne 0) { throw "Testdatenbank konnte nicht angelegt werden." }
  $databaseCreated = $true

  $allOutput = [System.Collections.Generic.List[string]]::new()
  foreach ($file in $files) {
    Write-Host ("Pruefe: {0}" -f (Split-Path -Leaf $file))
    # PostgreSQL schreibt auch harmlose NOTICE-/HINWEIS-Zeilen auf stderr.
    # Bei ErrorActionPreference=Stop wuerde PowerShell diese faelschlich als
    # terminierenden NativeCommandError behandeln. Fuer den nativen Aufruf ist
    # deshalb allein der Prozess-Exitcode massgeblich.
    $previousErrorActionPreference = $ErrorActionPreference
    try {
      $ErrorActionPreference = "Continue"
      $output = & $psql -X -h $HostName -p $Port -U $PostgresUser -d $database `
        -v ON_ERROR_STOP=1 -f $file 2>&1
      $psqlExitCode = $LASTEXITCODE
    }
    finally {
      $ErrorActionPreference = $previousErrorActionPreference
    }
    foreach ($line in $output) {
      $text = [string]$line
      $allOutput.Add($text)
      Write-Host $text
    }
    if ($psqlExitCode -ne 0) {
      throw "SQL-Lauf fehlgeschlagen: $file"
    }
  }

  $failures = @($allOutput | Where-Object { $_ -match "SMOKE\s+\S+\s+FAIL" })
  if ($failures.Count -gt 0) {
    throw ("Smoke-Tests enthalten {0} FAIL-Meldung(en)." -f $failures.Count)
  }

  Write-Host ""
  Write-Host "ERGEBNIS: AP10/AP11/AP12 DATENBANKTESTS ERFOLGREICH." -ForegroundColor Green
}
finally {
  if ($databaseCreated) {
    Write-Host "Entferne temporaere Testdatenbank $database ..."
    & $dropdb -h $HostName -p $Port -U $PostgresUser --if-exists --force $database
    if ($LASTEXITCODE -ne 0) {
      Write-Warning "Die temporaere Testdatenbank konnte nicht automatisch entfernt werden: $database"
    }
  }
  Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
  if ($passwordPtr -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPtr)
  }
}
