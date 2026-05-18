<#
.SYNOPSIS
Apply a previously-computed update plan to the local project.

.DESCRIPTION
Reads the JSON plan produced by Compute-Update-Plan.ps1 and writes/updates
files according to the plan. Backs up locally-modified FROZEN files with
.bak.<timestamp>. MARKER-AWARE files are merged block-by-block.

Honors -DecisionMap (JSON) to override per-path actions (used for
CONFLICT/ORPHAN resolution): { "<path>": "ACCEPT-REMOTE" | "KEEP-LOCAL" | "DELETE" }

Refuses to run without -Confirm — Dry-Run is enforced by /template-update
NOT calling this script.

.PARAMETER PlanPath
Path to the JSON plan written by Compute-Update-Plan.ps1.

.PARAMETER LocalRoot
Project root.

.PARAMETER RemoteRoot
Cloned template root (source of file contents).

.PARAMETER DecisionsPath
Optional JSON file with per-path overrides. See above.

.PARAMETER Confirm
Required. Without this switch the script aborts.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$PlanPath,
    [Parameter(Mandatory=$true)][string]$LocalRoot,
    [Parameter(Mandatory=$true)][string]$RemoteRoot,
    [string]$DecisionsPath,
    [switch]$Confirm
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

if (-not $Confirm) {
    throw "Apply-Update.ps1 refuses to run without -Confirm. Dry-Run only."
}

$plan = Get-Content $PlanPath -Raw -Encoding UTF8 | ConvertFrom-Json

$decisions = @{}
if ($DecisionsPath -and (Test-Path $DecisionsPath)) {
    $dJson = Get-Content $DecisionsPath -Raw -Encoding UTF8 | ConvertFrom-Json
    foreach ($prop in $dJson.PSObject.Properties) {
        $decisions[$prop.Name] = $prop.Value
    }
}

$timestamp = Get-Date -Format 'yyyy-MM-ddTHH-mm-ss'
$results = @{
    written  = [System.Collections.ArrayList]::new()
    backed_up = [System.Collections.ArrayList]::new()
    skipped  = [System.Collections.ArrayList]::new()
    deleted  = [System.Collections.ArrayList]::new()
    errors   = [System.Collections.ArrayList]::new()
}

function Write-AtomicFile {
    param([string]$Dest, [byte[]]$Bytes)
    $dir = Split-Path -Parent $Dest
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    [System.IO.File]::WriteAllBytes($Dest, $Bytes)
}

function Merge-MarkerAware {
    param([string]$LocalPath, [string]$RemotePath, [array]$ManagedBlocks)
    $localText  = if (Test-Path $LocalPath) { [System.IO.File]::ReadAllText($LocalPath) } else { '' }
    $remoteText = [System.IO.File]::ReadAllText($RemotePath)

    if (-not $localText) {
        return $remoteText
    }

    $result = $localText
    foreach ($blockId in $ManagedBlocks) {
        $startRx = "<!--\s*N8N-TEMPLATE:START\s+id=`"$([regex]::Escape($blockId))`"[^>]*-->"
        $endRx   = "<!--\s*N8N-TEMPLATE:END\s+id=`"$([regex]::Escape($blockId))`"\s*-->"
        $blockRx = "(?s)$startRx.*?$endRx"

        $remoteMatch = [regex]::Match($remoteText, $blockRx)
        if (-not $remoteMatch.Success) { continue }
        $newBlock = $remoteMatch.Value

        $localMatch = [regex]::Match($result, $blockRx)
        if ($localMatch.Success) {
            $result = $result.Substring(0, $localMatch.Index) + $newBlock + $result.Substring($localMatch.Index + $localMatch.Length)
        } else {
            $result = $result.TrimEnd() + "`n`n" + $newBlock + "`n"
        }
    }
    return $result
}

foreach ($item in $plan.items) {
    $rel = $item.path
    $action = $item.action
    if ($decisions.ContainsKey($rel)) {
        $action = $decisions[$rel]
    }

    $localAbs  = Join-Path $LocalRoot $rel
    $remoteAbs = Join-Path $RemoteRoot $rel

    try {
        switch ($action) {
            'NO-OP'        { [void]$results.skipped.Add($rel) }
            'KEEP-LOCAL'   { [void]$results.skipped.Add($rel) }
            'CREATE'       {
                if (-not (Test-Path $remoteAbs)) {
                    [void]$results.errors.Add(@{ path=$rel; reason="remote missing"})
                    continue
                }
                $bytes = [System.IO.File]::ReadAllBytes($remoteAbs)
                Write-AtomicFile -Dest $localAbs -Bytes $bytes
                [void]$results.written.Add($rel)
            }
            'CREATE-FROM-REMOTE' {
                $bytes = [System.IO.File]::ReadAllBytes($remoteAbs)
                Write-AtomicFile -Dest $localAbs -Bytes $bytes
                [void]$results.written.Add($rel)
            }
            'SAFE-UPDATE' {
                $bytes = [System.IO.File]::ReadAllBytes($remoteAbs)
                Write-AtomicFile -Dest $localAbs -Bytes $bytes
                [void]$results.written.Add($rel)
            }
            'OVERWRITE-WITH-BACKUP' {
                $bak = "$localAbs.bak.$timestamp"
                if (Test-Path $localAbs) { Copy-Item -Path $localAbs -Destination $bak -Force }
                $bytes = [System.IO.File]::ReadAllBytes($remoteAbs)
                Write-AtomicFile -Dest $localAbs -Bytes $bytes
                [void]$results.written.Add($rel)
                [void]$results.backed_up.Add(@{ path=$rel; backup=$bak })
            }
            'ACCEPT-REMOTE' {
                $bak = "$localAbs.bak.$timestamp"
                if (Test-Path $localAbs) { Copy-Item -Path $localAbs -Destination $bak -Force }
                $bytes = [System.IO.File]::ReadAllBytes($remoteAbs)
                Write-AtomicFile -Dest $localAbs -Bytes $bytes
                [void]$results.written.Add($rel)
                [void]$results.backed_up.Add(@{ path=$rel; backup=$bak })
            }
            'MARKER-MERGE' {
                $merged = Merge-MarkerAware -LocalPath $localAbs -RemotePath $remoteAbs -ManagedBlocks $item.managed_blocks
                $utf8 = [System.Text.UTF8Encoding]::new($false)
                $bytes = $utf8.GetBytes($merged)
                Write-AtomicFile -Dest $localAbs -Bytes $bytes
                [void]$results.written.Add($rel)
            }
            'DELETE' {
                if (Test-Path $localAbs) {
                    $bak = "$localAbs.bak.$timestamp"
                    Copy-Item -Path $localAbs -Destination $bak -Force
                    Remove-Item -Path $localAbs -Force
                    [void]$results.deleted.Add(@{ path=$rel; backup=$bak })
                }
            }
            'ORPHAN' {
                # No explicit decision — keep local. /template-update asks the user; if it
                # ends up here we default to KEEP.
                [void]$results.skipped.Add($rel)
            }
            'CONFLICT' {
                # Same: default keep without explicit decision.
                [void]$results.skipped.Add($rel)
            }
            default {
                [void]$results.errors.Add(@{ path=$rel; reason="unknown action $action"})
            }
        }
    } catch {
        [void]$results.errors.Add(@{ path=$rel; reason=$_.ToString() })
    }
}

$report = [ordered]@{
    applied_at   = (Get-Date -Format 'yyyy-MM-ddTHH:mm:ssZ' -AsUTC)
    from_version = $plan.from_version
    to_version   = $plan.to_version
    counts       = @{
        written   = $results.written.Count
        skipped   = $results.skipped.Count
        backed_up = $results.backed_up.Count
        deleted   = $results.deleted.Count
        errors    = $results.errors.Count
    }
    written      = @($results.written)
    backed_up    = @($results.backed_up)
    skipped      = @($results.skipped)
    deleted      = @($results.deleted)
    errors       = @($results.errors)
}

$report | ConvertTo-Json -Depth 8

Write-Host ""
Write-Host "[n8n-template] Apply complete." -ForegroundColor Green
Write-Host "  Written  : $($results.written.Count)"
Write-Host "  Backed-up: $($results.backed_up.Count)"
Write-Host "  Skipped  : $($results.skipped.Count)"
Write-Host "  Deleted  : $($results.deleted.Count)"
Write-Host "  Errors   : $($results.errors.Count)"
