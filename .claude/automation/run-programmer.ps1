param(
  [Parameter(Mandatory = $true)]
  [string]$TaskFile,
  [string]$Name = "claude-programmer"
)

$ErrorActionPreference = "Stop"

$vault = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$task = (Resolve-Path $TaskFile).Path
$runtime = Join-Path $PSScriptRoot "runtime"
$statePath = Join-Path $runtime "state.json"
$stdoutPath = Join-Path $runtime "result.json"
$stderrPath = Join-Path $runtime "stderr.log"
$claude = Join-Path $env:USERPROFILE ".local\bin\claude.exe"

New-Item -ItemType Directory -Force -Path $runtime | Out-Null

if (Test-Path $statePath) {
  try {
    $previous = Get-Content -Raw $statePath | ConvertFrom-Json
    if ($previous.status -eq "running" -and (Get-Process -Id $previous.pid -ErrorAction SilentlyContinue)) {
      throw "Claude-Programmierlauf $($previous.pid) ist bereits aktiv."
    }
  } catch {
    if ($_.Exception.Message -like "Claude-Programmierlauf*") {
      throw
    }
  }
}

if (-not (Test-Path $claude -PathType Leaf)) {
  throw "Claude Code wurde nicht gefunden: $claude"
}

$startedAt = Get-Date
[ordered]@{
  name = $Name
  status = "running"
  pid = $PID
  taskFile = $task
  startedAt = $startedAt.ToString("o")
  finishedAt = $null
  exitCode = $null
} | ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding utf8

try {
  Set-Location -LiteralPath $vault
  $prompt = Get-Content -Raw -LiteralPath $task
  & $claude `
    --print `
    --model opus `
    --effort high `
    --permission-mode auto `
    --output-format json `
    $prompt `
    1> $stdoutPath `
    2> $stderrPath
  $exitCode = $LASTEXITCODE
} catch {
  $_ | Out-String | Set-Content -LiteralPath $stderrPath -Encoding utf8
  $exitCode = 1
} finally {
  [ordered]@{
    name = $Name
    status = if ($exitCode -eq 0) { "completed" } else { "failed" }
    pid = $PID
    taskFile = $task
    startedAt = $startedAt.ToString("o")
    finishedAt = (Get-Date).ToString("o")
    exitCode = $exitCode
    resultFile = $stdoutPath
    errorFile = $stderrPath
  } | ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding utf8
}

exit $exitCode
