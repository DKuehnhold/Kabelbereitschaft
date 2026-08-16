<#
.SYNOPSIS
  Primaerer nicht-interaktiver Startpunkt der Kabelbereitschaft-App.

.DESCRIPTION
  Startet genau EINEN Claude-Hauptprozess im bestehenden Vault. Dieser
  Hauptprozess ist der ausfuehrende Orchestrator und delegiert Teilaufgaben an
  die Profile unter .claude/agents/ (siehe AGENTS.md).

  Status und Nachweise werden nach .claude/automation/runtime/ geschrieben.
  Dieses Verzeichnis ist in .gitignore ausgeschlossen und gehoert nicht in die
  Versionsgeschichte.

  Ein aktiver Lauf blockiert einen zweiten Start. Ein verwaister Status
  (Prozess beendet, PID neu vergeben oder Statusdatei unlesbar) blockiert nicht.

.PARAMETER TaskFile
  Auftragsdatei, in der Regel unter .claude/automation/tasks/.

.PARAMETER Name
  Laufbezeichnung fuer die Runtime-Dateien. Standard: Dateiname des Auftrags.

.PARAMETER DryRun
  Ersetzt den Fachauftrag durch einen read-only Selbsttest. Beweist Rolle,
  erkannte Agentenprofile und Einzelschreiberregel, ohne den Vault zu aendern.
  Erzwingt Planmodus und entzieht alle Schreibwerkzeuge.

.PARAMETER CheckOnly
  Prueft ausschliesslich die Laufsperre und beendet sich. Kein Claude-Start,
  keine Statusaenderung.

.OUTPUTS
  Exit 0 = Lauf erfolgreich bzw. Sperre frei.
  Exit 2 = durch aktiven Lauf blockiert.
  Exit 1 = sonstiger Fehler oder fehlgeschlagener Lauf.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$TaskFile,
  [string]$Name,
  [switch]$DryRun,
  [switch]$CheckOnly
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$EXIT_BLOCKED = 2

$vault = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$runtime = Join-Path $PSScriptRoot "runtime"
$statePath = Join-Path $runtime "state.json"
$lockFilePath = Join-Path $runtime "run.lock"
$agentsDir = Join-Path $vault ".claude\agents"
$claude = Join-Path $env:USERPROFILE ".local\bin\claude.exe"

if (-not (Test-Path -LiteralPath $TaskFile -PathType Leaf)) {
  throw "Auftragsdatei nicht gefunden: $TaskFile"
}
$task = (Resolve-Path -LiteralPath $TaskFile).Path

if (-not $Name) {
  $Name = [System.IO.Path]::GetFileNameWithoutExtension($task)
}
$safeName = ($Name -replace '[^A-Za-z0-9._-]', '-')

New-Item -ItemType Directory -Force -Path $runtime | Out-Null

$stdoutPath = Join-Path $runtime "$safeName.result.json"
$stderrPath = Join-Path $runtime "$safeName.stderr.log"
$promptPath = Join-Path $runtime "$safeName.prompt.txt"

# ---------------------------------------------------------------------------
# Laufsperre: aktiver Lauf blockiert, verwaister Status blockiert nicht.
# Ein Status gilt nur als aktiv, wenn PID, Prozessname UND Startzeitpunkt
# zusammenpassen. So wird eine neu vergebene PID nicht als aktiver Lauf gewertet.
# ---------------------------------------------------------------------------
function Test-ActiveRun {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    return [pscustomobject]@{ Active = $false; Reason = "keine Statusdatei"; Pid = $null }
  }

  $previous = $null
  try {
    $previous = Get-Content -Raw -LiteralPath $Path | ConvertFrom-Json
  } catch {
    return [pscustomobject]@{ Active = $false; Reason = "Statusdatei unlesbar (verwaist)"; Pid = $null }
  }
  if ($null -eq $previous) {
    return [pscustomobject]@{ Active = $false; Reason = "Statusdatei leer (verwaist)"; Pid = $null }
  }

  $status = if ($previous.PSObject.Properties['status']) { $previous.status } else { $null }
  if ($status -ne "running") {
    return [pscustomobject]@{ Active = $false; Reason = "letzter Lauf abgeschlossen (status=$status)"; Pid = $null }
  }

  $recordedPid = if ($previous.PSObject.Properties['pid']) { $previous.pid } else { $null }
  if (-not $recordedPid) {
    return [pscustomobject]@{ Active = $false; Reason = "status=running ohne PID (verwaist)"; Pid = $null }
  }

  $proc = Get-Process -Id $recordedPid -ErrorAction SilentlyContinue
  if (-not $proc) {
    return [pscustomobject]@{ Active = $false; Reason = "PID $recordedPid laeuft nicht mehr (verwaist)"; Pid = $recordedPid }
  }

  $recordedName = if ($previous.PSObject.Properties['processName']) { $previous.processName } else { $null }
  if ($recordedName -and $proc.ProcessName -ne $recordedName) {
    return [pscustomobject]@{ Active = $false; Reason = "PID $recordedPid neu vergeben ($($proc.ProcessName) statt $recordedName, verwaist)"; Pid = $recordedPid }
  }

  $recordedStart = $null
  if ($previous.PSObject.Properties['processStartedAt'] -and $previous.processStartedAt) {
    try {
      $recordedStart = [datetime]::Parse(
        $previous.processStartedAt,
        [cultureinfo]::InvariantCulture,
        [System.Globalization.DateTimeStyles]::RoundtripKind)
    } catch { $recordedStart = $null }
  }
  if ($recordedStart) {
    $actualStart = $null
    try { $actualStart = $proc.StartTime } catch { $actualStart = $null }
    if ($actualStart -and [math]::Abs(($actualStart - $recordedStart).TotalSeconds) -gt 2) {
      return [pscustomobject]@{ Active = $false; Reason = "PID $recordedPid neu vergeben (abweichende Startzeit, verwaist)"; Pid = $recordedPid }
    }
  }

  return [pscustomobject]@{ Active = $true; Reason = "Lauf $recordedPid ($($proc.ProcessName)) ist aktiv"; Pid = $recordedPid }
}

function Block-Run {
  param([string]$Reason)
  # -ErrorAction Continue ist notwendig: unter $ErrorActionPreference = "Stop"
  # wuerde Write-Error terminieren und den Exit-Code 2 nie erreichen.
  Write-Error -ErrorAction Continue -Message "Blockiert: $Reason. Einzelschreiberregel - kein zweiter Lauf im selben Vault."
}

# Stufe 1: Statusdatei auswerten (Diagnose, Kompatibilitaet mit Altlaeufen ohne
# Sperrdatei). Ein aktiver Lauf blockiert, ein verwaister Status nicht.
$lock = Test-ActiveRun -Path $statePath
if ($lock.Active) {
  Block-Run -Reason $lock.Reason
  exit $EXIT_BLOCKED
}

# Stufe 2: atomare Sperre. Die Statuspruefung allein ist ein Pruefen-dann-
# Schreiben und damit bei echt gleichzeitigem Start eine Race Condition. Ein
# exklusiv geoeffnetes Handle (FileShare::None) ist vom Betriebssystem
# serialisiert und wird beim Prozessende automatisch freigegeben - ein
# abgestuerzter Lauf sperrt daher nicht dauerhaft aus.
$lockStream = $null
try {
  $lockStream = [System.IO.File]::Open(
    $lockFilePath,
    [System.IO.FileMode]::OpenOrCreate,
    [System.IO.FileAccess]::ReadWrite,
    [System.IO.FileShare]::None)
} catch [System.IO.IOException] {
  Block-Run -Reason "Sperrdatei $lockFilePath ist von einem anderen Lauf exklusiv belegt"
  exit $EXIT_BLOCKED
}

try {
  $lockStream.SetLength(0)
  $marker = [System.Text.Encoding]::UTF8.GetBytes("pid=$PID name=$Name")
  $lockStream.Write($marker, 0, $marker.Length)
  $lockStream.Flush()
} catch {
  # Der Sperrmarker ist nur Diagnose. Die Sperre selbst ist das Handle.
}

Write-Host "Laufsperre frei: $($lock.Reason). Exklusive Sperre gehalten."

if ($CheckOnly) {
  Write-Host "CheckOnly: kein Claude-Start, kein Statusschreiben."
  $lockStream.Dispose()
  exit 0
}

if (-not (Test-Path -LiteralPath $claude -PathType Leaf)) {
  throw "Claude Code wurde nicht gefunden: $claude"
}

# ---------------------------------------------------------------------------
# Prompt: Orchestratorpflicht und Einzelschreiberregel sind Teil des Auftrags.
# ---------------------------------------------------------------------------
$profiles = @()
if (Test-Path -LiteralPath $agentsDir -PathType Container) {
  $profiles = @(Get-ChildItem -LiteralPath $agentsDir -Filter *.md -File |
    ForEach-Object { [System.IO.Path]::GetFileNameWithoutExtension($_.Name) })
}
$profileList = if ($profiles.Count -gt 0) { $profiles -join ", " } else { "(keine gefunden)" }
Write-Host "Erkannte Agentenprofile in .claude/agents/: $profileList"

$preamble = @"
Du bist der ausfuehrende ORCHESTRATOR der Kabelbereitschaft-App (Rollenmodell
nach AGENTS.md, Entscheidung Dennis vom 2026-07-30). Du bist der einzige
Orchestrator und der einzige Mediator.

Verbindlich fuer diesen Lauf:

1. Lies zuerst vollstaendig AGENTS.md und CLAUDE.md und halte dich daran.
2. Zerlege den folgenden Auftrag in Teil-Scopes und delegiere geeignete
   Teilaufgaben mit dem Agent-Werkzeug an die Profile unter .claude/agents/
   (verfuegbar in diesem Lauf: $profileList).
3. Jeder Agentenauftrag enthaelt ausdruecklich Positivliste, Negativliste,
   Definition of Done und Stopppunkt.
4. EINZELSCHREIBERREGEL: Es schreibt zu jedem Zeitpunkt hoechstens EIN Agent
   oder du selbst im Vault. Schreibende Agents laufen strikt sequenziell.
   Read-only Analyse- und Pruefagents duerfen parallel laufen.
5. Mindestens eine read-only Analyse und eine davon unabhaengige read-only
   Validierung werden delegiert.
6. Kein Agent startet weitere Agents. Keine direkte Agent-zu-Agent-
   Kommunikation. Kein Agent erweitert seinen Scope selbst.
7. Du pruefst jedes Agentenergebnis und den vollstaendigen Gesamt-Diff selbst,
   bevor du uebergibst. Agentenaussagen sind ohne deine Pruefung kein Nachweis.
8. Keine Selbstfreigabe: kein Commit, Push, Merge, Tag oder Release durch dich
   oder einen Agenten.
9. CIRCUIT BREAKER: dreimal derselbe Fehler in derselben Teilaufgabe -> stoppen
   und mit Rohbefund an Codex melden. Kein vierter Versuch.
10. Arbeite ausschliesslich in diesem bestehenden Vault. Keine Clones,
    Ersatzordner oder fremden Dienste. Keine ManagementOS-Datei aendern.
11. Nenne ausschliesslich tatsaechlich erhobene Ergebnisse mit Exit-Code bzw.
    exakter Ausgabe. Keine erfundenen Nachweise.
12. Lies zu Laufbeginn .claude/automation/status/fortschritt.json. Sie ist die
    operative Datenquelle des Fortschritts-Dashboards, aber keine fachliche
    Projektwahrheit; fuehrend bleiben PROJEKT_WISSEN.md und PROJEKTSTATUS.md.
    Aktualisiere genau diese eine Datei vor deiner Abschlussuebergabe
    wahrheitsgemaess (Staffelstab, aktuelles Todo, Blocker) und ebenso bei
    Teilfortschritt und bei einem Blocker. Bestehende Feldnamen bleiben
    unveraendert; keine erfundenen Prozentwerte oder Nachweise. Es gibt keine
    zweite Statusdatei und keine parallele Schreiblogik. Im read-only Dry-Run
    entfaellt diese Aktualisierung.
13. Beende den Lauf mit dem Uebergabeformat aus CLAUDE.md, einschliesslich der
    eingesetzten Agentenprofile mit ihrem jeweiligen Teil-Scope.

--- AUFTRAG ($([System.IO.Path]::GetFileName($task))) ---
"@

$dryRunTask = @"
SYNTHETISCHER DRY-RUN - SELBSTTEST DES ORCHESTRATORS. READ-ONLY.

Aendere, erstelle oder loesche in diesem Lauf KEINE Datei. Fuehre kein Git-
Kommando aus, das etwas veraendert. Delegiere in diesem Selbsttest keinen Agenten.

Berichte knapp und ausschliesslich anhand dessen, was du tatsaechlich siehst:

1. Deine Rolle in einem Satz, wie sie AGENTS.md festlegt.
2. Die Namen aller Agentenprofile, die dir in diesem Lauf als Agent-Typen
   tatsaechlich zur Verfuegung stehen, und ob die vier Profile
   kb-implementierung, kb-tests-evidence, kb-sicherheit-rls und
   kb-dokumentation darunter sind.
3. Die Einzelschreiberregel in einem Satz.
4. Ob du Commit, Push, Merge oder Tag ausfuehren darfst.

Schliesse mit der Zeile: DRYRUN-OK
"@

if ($DryRun) {
  $prompt = $preamble + "`n" + $dryRunTask
} else {
  $prompt = $preamble + "`n" + (Get-Content -Raw -LiteralPath $task)
}

Set-Content -LiteralPath $promptPath -Value $prompt -Encoding utf8

$startedAt = Get-Date
$self = Get-Process -Id $PID
[ordered]@{
  name = $Name
  status = "running"
  mode = if ($DryRun) { "dry-run" } else { "task" }
  pid = $PID
  processName = $self.ProcessName
  processStartedAt = $self.StartTime.ToString("o")
  taskFile = $task
  agentProfiles = $profiles
  startedAt = $startedAt.ToString("o")
  finishedAt = $null
  exitCode = $null
} | ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding utf8

$exitCode = 1
try {
  Set-Location -LiteralPath $vault

  $claudeArgs = @(
    "--print",
    # Kostensparender Standardlauf: Claude Haiku (Mini-Modell) genügt für die
    # begrenzten Implementierungs-/Prüfaufträge. Architekturgrenzen und
    # unabhängige Codex-Prüfung bleiben unverändert.
    "--model", "haiku",
    "--effort", "low",
    "--output-format", "json"
  )
  if ($DryRun) {
    $claudeArgs += @("--permission-mode", "plan")
    # Kommaform ist zwingend: --disallowed-tools ist variadisch und wuerde bei
    # Leerzeichentrennung weitere Argumente einsammeln.
    # Bash gehoert dazu: sonst waere der Dry-Run nicht technisch schreibfrei.
    $claudeArgs += @("--disallowed-tools", "Edit,Write,NotebookEdit,Bash")
  } else {
    $claudeArgs += @("--permission-mode", "auto")
  }

  Write-Host "Starte genau einen Claude-Hauptprozess (Orchestrator), Modus: $(if ($DryRun) { 'dry-run' } else { 'task' })."

  # Der Prompt geht ueber stdin, nicht als Argument: das umgeht die
  # Kommandozeilenlaengengrenze von Windows und verhindert, dass ein
  # variadischer Schalter den Prompt einsammelt.
  $OutputEncoding = [System.Text.UTF8Encoding]::new($false)
  $prompt | & $claude @claudeArgs 1> $stdoutPath 2> $stderrPath
  $exitCode = $LASTEXITCODE
} catch {
  $_ | Out-String | Set-Content -LiteralPath $stderrPath -Encoding utf8
  $exitCode = 1
} finally {
  [ordered]@{
    name = $Name
    status = if ($exitCode -eq 0) { "completed" } else { "failed" }
    mode = if ($DryRun) { "dry-run" } else { "task" }
    pid = $PID
    processName = $self.ProcessName
    processStartedAt = $self.StartTime.ToString("o")
    taskFile = $task
    agentProfiles = $profiles
    startedAt = $startedAt.ToString("o")
    finishedAt = (Get-Date).ToString("o")
    exitCode = $exitCode
    promptFile = $promptPath
    resultFile = $stdoutPath
    errorFile = $stderrPath
  } | ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding utf8

  if ($lockStream) { $lockStream.Dispose() }
}

exit $exitCode
