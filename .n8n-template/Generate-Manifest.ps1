<#
.SYNOPSIS
Generate the .n8n-template/manifest.json from the current project tree.

.DESCRIPTION
Scans the project (relative to -Root) and produces a manifest with SHA-256
hashes for every file matched by .n8n-template/protection-rules.json. The
manifest is the source of truth for /template-update 3-way diffing and for
the protection-tier decisions during updates.

USER-GENERATED files are listed without a hash (sha256: null). They are
referenced so /template-update knows "do not touch", but no BASE comparison
is possible because the user is expected to edit them freely.

The script is non-destructive: it writes the manifest and nothing else.
Run from the template maintainer side OR by /template-update after a
successful install/update — never manually inside a customer project.

.PARAMETER Root
Project root that contains .n8n-template/ and the managed files. Defaults to
the parent directory of the script (i.e. the project root).

.PARAMETER OutputPath
Destination manifest path. Defaults to <Root>/.n8n-template/manifest.json.

.PARAMETER TemplateVersion
Version string to embed in the manifest header. If omitted, reads
.template-version.json -> version.

.EXAMPLE
pwsh .n8n-template/Generate-Manifest.ps1 -Root . -TemplateVersion 1.6.0
#>
[CmdletBinding()]
param(
    [string]$Root = (Split-Path -Parent $PSScriptRoot),
    [string]$OutputPath,
    [string]$TemplateVersion
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# Line-ending-agnostic SHA-256: all managed files are text, so decode as
# UTF-8, normalize CRLF -> LF, and hash the resulting UTF-8 bytes. Raw-byte
# hashing (Get-FileHash) would yield different hashes for identical content
# on autocrlf=true (CRLF) vs. LF checkouts -> false conflicts everywhere.
# Must stay byte-identical to the copy in Compute-Update-Plan.ps1.
function Get-NormalizedFileHash {
    param([string]$Path)
    $bytes = [System.IO.File]::ReadAllBytes($Path)
    $text = [System.Text.Encoding]::UTF8.GetString($bytes)
    $text = $text -replace "`r`n", "`n"
    $normBytes = [System.Text.Encoding]::UTF8.GetBytes($text)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $hashBytes = $sha.ComputeHash($normBytes)
    } finally {
        $sha.Dispose()
    }
    return ([System.BitConverter]::ToString($hashBytes) -replace '-', '').ToLower()
}

function Convert-GlobToRegex {
    param([string]$Glob)
    $escaped = [regex]::Escape($Glob)
    $escaped = $escaped -replace '\\\*\\\*', '__DOUBLESTAR__'
    $escaped = $escaped -replace '\\\*', '[^/]*'
    $escaped = $escaped -replace '__DOUBLESTAR__', '.*'
    $escaped = $escaped -replace '\\\?', '[^/]'
    return "^$escaped$"
}

function Resolve-Protection {
    param(
        [string]$RelPath,
        [array]$Rules
    )
    $normalized = $RelPath -replace '\\', '/'
    foreach ($rule in $Rules) {
        $pattern = Convert-GlobToRegex $rule.glob
        if ($normalized -match $pattern) {
            return $rule
        }
    }
    return $null
}

# GetFullPath kanonisiert 8.3-Kurzpfade (SRENWA~1) auf Langpfade — sonst matchen die
# per Substring gebildeten Relativpfade keine Regel und das Manifest wird still leer.
$Root = [System.IO.Path]::GetFullPath((Get-Item (Resolve-Path $Root).Path).FullName)
if (-not $OutputPath) {
    $OutputPath = Join-Path $Root '.n8n-template/manifest.json'
}

$rulesPath = Join-Path $Root '.n8n-template/protection-rules.json'
if (-not (Test-Path $rulesPath)) {
    throw "protection-rules.json not found at $rulesPath. Aborting."
}
$rulesJson = Get-Content $rulesPath -Raw -Encoding UTF8 | ConvertFrom-Json
$rules = $rulesJson.rules

if (-not $TemplateVersion) {
    $versionPath = Join-Path $Root '.template-version.json'
    if (Test-Path $versionPath) {
        $vJson = Get-Content $versionPath -Raw -Encoding UTF8 | ConvertFrom-Json
        $TemplateVersion = $vJson.version
    } else {
        $TemplateVersion = 'unknown'
    }
}
if (-not $TemplateVersion -or $TemplateVersion -eq '{{TEMPLATE_VERSION}}') {
    $TemplateVersion = 'unreleased'
}

Write-Host "[n8n-template] Scanning $Root" -ForegroundColor Cyan
Write-Host "[n8n-template] Template version: $TemplateVersion" -ForegroundColor Cyan

$skipDirs = @('node_modules', '.git', '.next', '.vercel', 'coverage', 'test-results', 'playwright-report', '.playwright-mcp')

$files = Get-ChildItem -Path $Root -Recurse -File -Force | Where-Object {
    $segments = ($_.FullName.Substring($Root.Length + 1)) -split '[\\/]'
    -not ($segments | Where-Object { $skipDirs -contains $_ })
}

$entries = [System.Collections.ArrayList]::new()
$counts = @{ FROZEN = 0; 'UPDATABLE-WITH-DIFF' = 0; 'MARKER-AWARE' = 0; 'USER-GENERATED' = 0; SKIPPED = 0 }

foreach ($file in $files) {
    $rel = $file.FullName.Substring($Root.Length + 1) -replace '\\', '/'
    $rule = Resolve-Protection -RelPath $rel -Rules $rules

    if ($null -eq $rule) {
        $counts.SKIPPED++
        continue
    }

    if ($rule.regenerate) {
        $counts.SKIPPED++
        continue
    }

    $protection = $rule.protection
    $counts[$protection]++

    $entry = [ordered]@{
        path       = $rel
        protection = $protection
    }

    if ($protection -eq 'USER-GENERATED') {
        $entry.sha256 = $null
    } else {
        try {
            $hash = Get-NormalizedFileHash -Path $file.FullName
            $entry.sha256 = $hash
        } catch {
            $entry.sha256 = $null
            Write-Warning "[n8n-template] Failed to hash $rel : $_"
        }
    }

    if ($protection -eq 'MARKER-AWARE' -and $rule.managed_blocks) {
        $entry.managed_blocks = $rule.managed_blocks
    }
    if ($rule.special) {
        $entry.special = $rule.special
    }

    [void]$entries.Add([pscustomobject]$entry)
}

$sortedEntries = $entries | Sort-Object -Property path

$manifest = [ordered]@{
    schema_version   = '1.0'
    template         = 'n8n-project'
    template_version = $TemplateVersion
    frozen_at        = (Get-Date -Format 'yyyy-MM-ddTHH:mm:ssZ' -AsUTC)
    rules_source     = '.n8n-template/protection-rules.json'
    counts           = [ordered]@{
        frozen             = $counts.FROZEN
        updatable_with_diff = $counts['UPDATABLE-WITH-DIFF']
        marker_aware       = $counts['MARKER-AWARE']
        user_generated     = $counts['USER-GENERATED']
        skipped            = $counts.SKIPPED
        total              = $sortedEntries.Count
    }
    files            = @($sortedEntries)
}

if ($sortedEntries.Count -eq 0) {
    throw "No files matched any protection rule (root: $Root). Refusing to write an empty manifest — an update plan against it would orphan every file. Check that -Root is a long path (not 8.3 short form) pointing at the project root."
}

$json = $manifest | ConvertTo-Json -Depth 8

$dir = Split-Path -Parent $OutputPath
if (-not (Test-Path $dir)) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
}
[System.IO.File]::WriteAllText($OutputPath, $json, [System.Text.UTF8Encoding]::new($false))

Write-Host ""
Write-Host "[n8n-template] Manifest written: $OutputPath" -ForegroundColor Green
Write-Host "[n8n-template] Files in manifest: $($sortedEntries.Count)" -ForegroundColor Green
Write-Host "  FROZEN              : $($counts.FROZEN)"
Write-Host "  UPDATABLE-WITH-DIFF : $($counts['UPDATABLE-WITH-DIFF'])"
Write-Host "  MARKER-AWARE        : $($counts['MARKER-AWARE'])"
Write-Host "  USER-GENERATED      : $($counts['USER-GENERATED'])"
Write-Host "  SKIPPED (unmanaged) : $($counts.SKIPPED)"
