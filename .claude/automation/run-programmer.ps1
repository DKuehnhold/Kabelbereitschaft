<#
.SYNOPSIS
  VERALTET. Weiterleitung auf run-orchestrator.ps1.

.DESCRIPTION
  Das frueher hier umgesetzte Modell "Claude ist nur Programmierer" ist durch
  die Entscheidung von Dennis vom 2026-07-30 ersetzt: Claude ist ausfuehrender
  Orchestrator (siehe AGENTS.md).

  Dieses Skript enthaelt bewusst KEINE eigene Orchestrator-, Sperr- oder
  Statuslogik mehr. Es leitet alle Parameter unveraendert an
  .\run-orchestrator.ps1 weiter und gibt dessen Exit-Code zurueck.

  Bitte kuenftig direkt run-orchestrator.ps1 aufrufen.
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

Write-Warning "run-programmer.ps1 ist VERALTET. Verwende .claude/automation/run-orchestrator.ps1. Leite weiter ..."

$orchestrator = Join-Path $PSScriptRoot "run-orchestrator.ps1"
if (-not (Test-Path -LiteralPath $orchestrator -PathType Leaf)) {
  throw "Orchestrator-Runner nicht gefunden: $orchestrator"
}

$forward = @{ TaskFile = $TaskFile }
if ($Name) { $forward.Name = $Name }
if ($DryRun) { $forward.DryRun = $true }
if ($CheckOnly) { $forward.CheckOnly = $true }

& $orchestrator @forward
exit $LASTEXITCODE
