<#
.SYNOPSIS
Compute a 3-way-diff plan between BASE (local manifest) and REMOTE (cloned
template repo). Emits a JSON plan that /template-update consumes.

.DESCRIPTION
For each file in the REMOTE manifest:
  - BASE   = sha256 from LOCAL .n8n-template/manifest.json (what was delivered
             on the last install/update)
  - LOCAL  = sha256 of the file currently in the project (or null if missing)
  - REMOTE = sha256 from the REMOTE manifest (what we would install)

The protection tier from the REMOTE manifest decides the action:

  FROZEN
    LOCAL == REMOTE       → NO-OP
    LOCAL == BASE         → SAFE-UPDATE
    LOCAL != BASE         → OVERWRITE-WITH-BACKUP (local edits get .bak)
    LOCAL missing         → CREATE

  UPDATABLE-WITH-DIFF
    LOCAL == REMOTE       → NO-OP
    LOCAL == BASE         → SAFE-UPDATE
    LOCAL != BASE         → CONFLICT (user decides)
    LOCAL missing         → CREATE

  MARKER-AWARE
    Always emits MARKER-MERGE — actual block-by-block merge happens in
    Apply-Update.ps1 because it needs to read file contents, not just hashes.

  USER-GENERATED
    LOCAL missing         → CREATE-FROM-REMOTE (initial stub)
    LOCAL exists          → KEEP-LOCAL (never touched)

Files only in BASE (gone from REMOTE) → ORPHAN (user asked at apply time).

.OUTPUTS
JSON plan to -OutputPath. Schema:
{
  "schema_version": "1.0",
  "from_version": "...",
  "to_version": "...",
  "items": [
    { "path": "...", "tier": "FROZEN|...", "action": "...",
      "base_sha": "...|null", "local_sha": "...|null", "remote_sha": "...|null",
      "managed_blocks": [ ... ]   (only for MARKER-AWARE)
    },
    ...
  ],
  "stats": { "no_op": N, "safe_update": N, "create": N, "overwrite": N,
             "conflict": N, "marker_merge": N, "orphan": N, "keep_local": N }
}
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$LocalRoot,
    [Parameter(Mandatory=$true)][string]$RemoteRoot,
    [Parameter(Mandatory=$true)][string]$OutputPath
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

function Read-Manifest {
    param([string]$Root)
    $p = Join-Path $Root '.n8n-template/manifest.json'
    if (-not (Test-Path $p)) {
        throw "manifest.json not found at $p"
    }
    return Get-Content $p -Raw -Encoding UTF8 | ConvertFrom-Json
}

function Get-LocalSha {
    param([string]$Root, [string]$RelPath)
    $abs = Join-Path $Root $RelPath
    if (-not (Test-Path $abs)) { return $null }
    return (Get-FileHash -Path $abs -Algorithm SHA256).Hash.ToLower()
}

$localManifest  = Read-Manifest -Root $LocalRoot
$remoteManifest = Read-Manifest -Root $RemoteRoot

# Build BASE-hash lookup (path -> sha256 from local manifest)
$baseByPath = @{}
foreach ($f in $localManifest.files) {
    $baseByPath[$f.path] = $f
}

# Build REMOTE lookup
$remoteByPath = @{}
foreach ($f in $remoteManifest.files) {
    $remoteByPath[$f.path] = $f
}

$items = [System.Collections.ArrayList]::new()
$stats = @{
    no_op = 0; safe_update = 0; create = 0; overwrite = 0;
    conflict = 0; marker_merge = 0; orphan = 0; keep_local = 0
}

# Pass 1: every file in REMOTE
foreach ($r in $remoteManifest.files) {
    $path     = $r.path
    $tier     = $r.protection
    $remoteSha = $r.sha256
    $baseSha  = if ($baseByPath.ContainsKey($path)) { $baseByPath[$path].sha256 } else { $null }
    $localSha = Get-LocalSha -Root $LocalRoot -RelPath $path

    $action = $null

    switch ($tier) {
        'USER-GENERATED' {
            if ($null -eq $localSha) {
                $action = 'CREATE-FROM-REMOTE'
                $stats.create++
            } else {
                $action = 'KEEP-LOCAL'
                $stats.keep_local++
            }
        }
        'MARKER-AWARE' {
            if ($null -eq $localSha) {
                $action = 'CREATE-FROM-REMOTE'
                $stats.create++
            } elseif ($localSha -eq $remoteSha) {
                $action = 'NO-OP'
                $stats.no_op++
            } else {
                $action = 'MARKER-MERGE'
                $stats.marker_merge++
            }
        }
        'FROZEN' {
            if ($null -eq $localSha) {
                $action = 'CREATE'
                $stats.create++
            } elseif ($localSha -eq $remoteSha) {
                $action = 'NO-OP'
                $stats.no_op++
            } elseif ($null -ne $baseSha -and $localSha -eq $baseSha) {
                $action = 'SAFE-UPDATE'
                $stats.safe_update++
            } else {
                $action = 'OVERWRITE-WITH-BACKUP'
                $stats.overwrite++
            }
        }
        'UPDATABLE-WITH-DIFF' {
            if ($null -eq $localSha) {
                $action = 'CREATE'
                $stats.create++
            } elseif ($localSha -eq $remoteSha) {
                $action = 'NO-OP'
                $stats.no_op++
            } elseif ($null -ne $baseSha -and $localSha -eq $baseSha) {
                $action = 'SAFE-UPDATE'
                $stats.safe_update++
            } else {
                $action = 'CONFLICT'
                $stats.conflict++
            }
        }
        default {
            $action = 'UNKNOWN-TIER'
        }
    }

    $entry = [ordered]@{
        path       = $path
        tier       = $tier
        action     = $action
        base_sha   = $baseSha
        local_sha  = $localSha
        remote_sha = $remoteSha
    }
    if ($tier -eq 'MARKER-AWARE' -and $r.managed_blocks) {
        $entry.managed_blocks = $r.managed_blocks
    }
    [void]$items.Add([pscustomobject]$entry)
}

# Pass 2: orphans (in BASE but not in REMOTE — file was removed from template)
foreach ($b in $localManifest.files) {
    if (-not $remoteByPath.ContainsKey($b.path)) {
        $localSha = Get-LocalSha -Root $LocalRoot -RelPath $b.path
        [void]$items.Add([pscustomobject]([ordered]@{
            path       = $b.path
            tier       = $b.protection
            action     = 'ORPHAN'
            base_sha   = $b.sha256
            local_sha  = $localSha
            remote_sha = $null
        }))
        $stats.orphan++
    }
}

$plan = [ordered]@{
    schema_version = '1.0'
    from_version   = $localManifest.template_version
    to_version     = $remoteManifest.template_version
    generated_at   = (Get-Date -Format 'yyyy-MM-ddTHH:mm:ssZ' -AsUTC)
    local_root     = $LocalRoot
    remote_root    = $RemoteRoot
    stats          = $stats
    items          = @($items | Sort-Object -Property path)
}

$json = $plan | ConvertTo-Json -Depth 10
$dir = Split-Path -Parent $OutputPath
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
[System.IO.File]::WriteAllText($OutputPath, $json, [System.Text.UTF8Encoding]::new($false))

Write-Host "[n8n-template] Update plan written: $OutputPath" -ForegroundColor Green
Write-Host "[n8n-template] $($localManifest.template_version) -> $($remoteManifest.template_version)"
Write-Host "  NO-OP                : $($stats.no_op)"
Write-Host "  SAFE-UPDATE          : $($stats.safe_update)"
Write-Host "  CREATE               : $($stats.create)"
Write-Host "  OVERWRITE-WITH-BACKUP: $($stats.overwrite)"
Write-Host "  CONFLICT             : $($stats.conflict)"
Write-Host "  MARKER-MERGE         : $($stats.marker_merge)"
Write-Host "  KEEP-LOCAL           : $($stats.keep_local)"
Write-Host "  ORPHAN               : $($stats.orphan)"
