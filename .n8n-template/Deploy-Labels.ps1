<#
.SYNOPSIS
Deploy the n8n-template Default-Label-Set to a GitHub repo. Idempotent.

.DESCRIPTION
Creates or updates 15 default labels in the target repo via `gh label create --force`.
Used by /onboard Phase 5.7.5b and /template-migrate Phase 8d. Can also be run
manually at any time — existing labels with matching name are updated (not duplicated).

Labels cover:
  - Kategorisierung: bug, enhancement, feature, qa-found
  - Routing:        origin:template, origin:project
  - Source:         source:ai-qa, source:ai-change, source:human
  - Priority:       priority:P0..P3
  - Triage:         needs-triage, blocked

Requires `gh` CLI authenticated. The repo must exist and the auth context must have
write access. No-op if `gh` is missing — exits with clear error.

.PARAMETER Repo
Full GitHub repo path (e.g. "Wagner-Emden-IT-Services/cc-project-batzenhof-mens-day").
If omitted, the script tries to read `target_repo` from `.template-version.json` in the
current working directory.

.EXAMPLE
pwsh .n8n-template/Deploy-Labels.ps1 -Repo "Wagner-Emden-IT-Services/cc-project-batzenhof-mens-day"

.EXAMPLE
pwsh .n8n-template/Deploy-Labels.ps1
# Reads .template-version.json -> target_repo
#>
[CmdletBinding()]
param(
    [string]$Repo
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

if (-not $Repo) {
    $versionFile = Join-Path (Get-Location) '.template-version.json'
    if (Test-Path $versionFile) {
        $v = Get-Content $versionFile -Raw -Encoding UTF8 | ConvertFrom-Json
        $targetRepo = $v.target_repo
        if ($targetRepo) {
            $Repo = $targetRepo -replace '^https?://github\.com/', '' -replace '\.git$', ''
        }
    }
}

if (-not $Repo) {
    throw "Kein Repo angegeben und kein .template-version.json -> target_repo gefunden. Verwende -Repo <org/name>."
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    throw "GitHub CLI (gh) nicht installiert. Bitte https://cli.github.com/ installieren."
}

$labels = @(
    @{ Name = 'bug';                Color = 'd73a4a'; Desc = 'Funktionaler Fehler' }
    @{ Name = 'enhancement';        Color = 'a2eeef'; Desc = 'Erweiterung bestehender Funktion' }
    @{ Name = 'feature';            Color = '0075ca'; Desc = 'Neue Funktion (nicht Erweiterung)' }
    @{ Name = 'qa-found';           Color = 'fbca04'; Desc = 'Aus QA-Run gefunden' }
    @{ Name = 'origin:template';    Color = '5319e7'; Desc = 'Template-Bug (im Project-Repo entdeckt, gehoert eigentlich ins n8n-template-Source-Repo)' }
    @{ Name = 'origin:project';     Color = '1d76db'; Desc = 'Project-spezifischer Bug' }
    @{ Name = 'source:ai-qa';       Color = 'c2e0c6'; Desc = 'Vom /qa-Skill auto-gefiled' }
    @{ Name = 'source:ai-change';   Color = 'c2e0c6'; Desc = 'Vom /change- oder /template-bugreport-Skill gefiled' }
    @{ Name = 'source:human';       Color = 'bfdadc'; Desc = 'Manuell von einem Menschen erstellt' }
    @{ Name = 'priority:P0';        Color = 'b60205'; Desc = 'Critical — Blocker / Production-down / Datenverlust / Security-CVE' }
    @{ Name = 'priority:P1';        Color = 'd93f0b'; Desc = 'High — Funktional gebrochen, kein Workaround' }
    @{ Name = 'priority:P2';        Color = 'fbca04'; Desc = 'Medium — UX-Issue, Workaround verfuegbar' }
    @{ Name = 'priority:P3';        Color = '0e8a16'; Desc = 'Low — Cosmetic, kein Funktionsverlust' }
    @{ Name = 'needs-triage';       Color = 'e4e669'; Desc = 'Noch nicht klassifiziert / priorisiert' }
    @{ Name = 'blocked';            Color = '000000'; Desc = 'Wartet auf externe Dependency' }
)

Write-Host "[n8n-template] Deploying $($labels.Count) Default-Labels nach $Repo ..." -ForegroundColor Cyan
Write-Host ""

$created = 0
$updated = 0
$failed  = 0

foreach ($l in $labels) {
    $name  = $l.Name
    $color = $l.Color
    $desc  = $l.Desc

    try {
        # --force updates existing labels with matching name (idempotent)
        $output = gh label create $name --color $color --description $desc --repo $Repo --force 2>&1
        $exitCode = $LASTEXITCODE

        if ($exitCode -eq 0) {
            if ($output -match 'updated|already exists') {
                Write-Host "  [updated]  $name" -ForegroundColor Yellow
                $updated++
            } else {
                Write-Host "  [created]  $name" -ForegroundColor Green
                $created++
            }
        } else {
            Write-Host "  [failed]   $name : $output" -ForegroundColor Red
            $failed++
        }
    } catch {
        Write-Host "  [failed]   $name : $_" -ForegroundColor Red
        $failed++
    }
}

Write-Host ""
Write-Host "[n8n-template] Label-Deploy fertig." -ForegroundColor Cyan
Write-Host "  Created : $created"
Write-Host "  Updated : $updated"
Write-Host "  Failed  : $failed"

if ($failed -gt 0) {
    Write-Host ""
    Write-Host "  Hinweis: Skript ist idempotent. Erneutes Ausfuehren ist safe." -ForegroundColor Yellow
    exit 1
}
exit 0
