<#
.SYNOPSIS
Scan project for legacy bug-tracking spots (WF-X specs, memory files, docs)
and emit a JSON inventory of findings ready for migration to GitHub Issues.

.DESCRIPTION
Called by /template-update (when upgrading v1.6.x -> v1.7.x) and by
/template-migrate (during migration of foreign-template projects). Read-only —
does NOT create any issues. The calling skill iterates the findings and asks
the user per item via AskUserQuestion before invoking `gh issue create`.

Detected anti-patterns:
  - docs/specs/*.md sections titled "Known Bugs", "Bekannte Fehler", "Open Bugs",
    "Open Issues", "TODO: Fix"
  - docs/specs/*.md bullets starting with "BUG:", "FIXME:", "TODO: fix"
  - .claude/memory/**/*.md files with frontmatter `type: bug` (legacy schema)
  - .claude/memory/**/*.md content blocks with `**BUG:**` marker
  - docs/**/*.md files with TODO/FIXME/BUG bullets (filtered to ignore the
    explicit Issue-references like `See #N`)

Output JSON schema:
{
  "scanned_at": "2026-05-18T...",
  "project_root": "...",
  "findings": [
    {
      "source_file": "docs/specs/WF-13-matchplay.md",
      "source_kind": "spec-section" | "spec-bullet" | "memory-frontmatter" | "memory-marker" | "docs-bullet",
      "line_start": 42,
      "line_end": 58,
      "raw": "...",
      "title_suggestion": "...",
      "body_draft": "...",
      "feature_id": "WF-13" | null
    }
  ],
  "stats": { "specs_scanned": N, "memory_scanned": N, "docs_scanned": N, "findings_total": N }
}
#>
[CmdletBinding()]
param(
    [string]$Root = (Get-Location).Path,
    [string]$OutputPath = ".n8n-template/_bug-migration-scan.json"
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$Root = (Resolve-Path $Root).Path
$findings = [System.Collections.ArrayList]::new()
$stats = @{ specs_scanned = 0; memory_scanned = 0; docs_scanned = 0; findings_total = 0 }

function Add-Finding {
    param($SourceFile, $SourceKind, $LineStart, $LineEnd, $Raw, $TitleSuggestion, $BodyDraft, $FeatureId)
    [void]$findings.Add([pscustomobject]@{
        source_file       = $SourceFile
        source_kind       = $SourceKind
        line_start        = $LineStart
        line_end          = $LineEnd
        raw               = $Raw
        title_suggestion  = $TitleSuggestion
        body_draft        = $BodyDraft
        feature_id        = $FeatureId
    })
}

function Get-FeatureIdFromPath {
    param([string]$Path)
    if ($Path -match 'WF-(\d+)') { return "WF-$($Matches[1])" }
    return $null
}

# === Scan docs/specs/*.md ===
$featuresDir = Join-Path $Root 'features'
if (Test-Path $featuresDir) {
    Get-ChildItem -Path $featuresDir -Filter '*.md' -File | ForEach-Object {
        $stats.specs_scanned++
        $stats.specs_scanned = $stats.specs_scanned
        $file = $_
        $rel = $file.FullName.Substring($Root.Length + 1) -replace '\\','/'
        $lines = Get-Content $file.FullName -Encoding UTF8
        $featureId = Get-FeatureIdFromPath -Path $rel

        # Section-Heading-Pattern
        $sectionHeaders = @('Known Bugs', 'Bekannte Fehler', 'Open Bugs', 'Open Issues', 'TODO: Fix', 'Bugs', 'Issues')
        for ($i = 0; $i -lt $lines.Count; $i++) {
            $line = $lines[$i]
            foreach ($hdr in $sectionHeaders) {
                if ($line -match "^##\s+$([regex]::Escape($hdr))\b") {
                    # Section gefunden — sammle bis naechste H2 oder EOF
                    $start = $i
                    $end = $lines.Count - 1
                    for ($j = $i + 1; $j -lt $lines.Count; $j++) {
                        if ($lines[$j] -match '^##\s') { $end = $j - 1; break }
                    }
                    $sectionText = ($lines[$start..$end] -join "`n").Trim()
                    if ($sectionText.Length -gt 50) {
                        Add-Finding -SourceFile $rel -SourceKind 'spec-section' `
                            -LineStart ($start + 1) -LineEnd ($end + 1) -Raw $sectionText `
                            -TitleSuggestion "[BUG] $featureId : $hdr (migrated from spec)" `
                            -BodyDraft $sectionText -FeatureId $featureId
                    }
                    break
                }
            }
        }

        # Bullet-Pattern
        for ($i = 0; $i -lt $lines.Count; $i++) {
            $line = $lines[$i]
            if ($line -match '^\s*-\s*(?:\[ \]\s*)?(BUG|FIXME|TODO:\s*[Ff]ix)\b[:\s]*(.+)$') {
                $bullet = $Matches[2].Trim()
                # Skip if it references an issue already
                if ($bullet -match '#\d+|See\s+#') { continue }
                Add-Finding -SourceFile $rel -SourceKind 'spec-bullet' `
                    -LineStart ($i + 1) -LineEnd ($i + 1) -Raw $line.Trim() `
                    -TitleSuggestion "[BUG] $featureId : $($bullet.Substring(0, [Math]::Min(50, $bullet.Length)))" `
                    -BodyDraft "From $rel`:$($i+1)`n`n$($line.Trim())" -FeatureId $featureId
            }
        }
    }
}

# === Scan .claude/memory/**/*.md ===
$memoryDir = Join-Path $Root '.claude/memory'
if (Test-Path $memoryDir) {
    Get-ChildItem -Path $memoryDir -Filter '*.md' -File -Recurse | ForEach-Object {
        $stats.memory_scanned++
        $file = $_
        $rel = $file.FullName.Substring($Root.Length + 1) -replace '\\','/'
        $content = Get-Content $file.FullName -Raw -Encoding UTF8
        $lines = $content -split "`n"

        # Frontmatter `type: bug`
        if ($content -match '(?m)^---\s*$.*?^type:\s*bug\s*$.*?^---\s*$') {
            Add-Finding -SourceFile $rel -SourceKind 'memory-frontmatter' `
                -LineStart 1 -LineEnd $lines.Count -Raw $content.Substring(0, [Math]::Min(500, $content.Length)) `
                -TitleSuggestion "[BUG] Memory-Migration: $($file.BaseName)" `
                -BodyDraft "Migriert aus Memory-File `$rel` (Frontmatter type: bug)`n`n$content" `
                -FeatureId $null
        }

        # **BUG:**-Marker im Content
        for ($i = 0; $i -lt $lines.Count; $i++) {
            $line = $lines[$i]
            if ($line -match '\*\*BUG:\*\*\s*(.+)$') {
                $bullet = $Matches[1].Trim()
                if ($bullet -match '#\d+|See\s+#') { continue }
                Add-Finding -SourceFile $rel -SourceKind 'memory-marker' `
                    -LineStart ($i + 1) -LineEnd ($i + 1) -Raw $line.Trim() `
                    -TitleSuggestion "[BUG] Memory: $($bullet.Substring(0, [Math]::Min(50, $bullet.Length)))" `
                    -BodyDraft "From $rel`:$($i+1)`n`n$($line.Trim())" -FeatureId $null
            }
        }
    }
}

# === Scan docs/**/*.md (only BUG/FIXME/TODO bullets, ignore explicit Issue-refs) ===
$docsDir = Join-Path $Root 'docs'
if (Test-Path $docsDir) {
    Get-ChildItem -Path $docsDir -Filter '*.md' -File -Recurse | ForEach-Object {
        $stats.docs_scanned++
        $file = $_
        $rel = $file.FullName.Substring($Root.Length + 1) -replace '\\','/'
        # Skip generated docs that we know are safe
        if ($rel -match '^docs/(PRD|PROJECT_CONTEXT|ONBOARD_LOG|RESEARCH|STACK-DECISIONS|ARCHITECTURE)\.md$') { return }
        $lines = Get-Content $file.FullName -Encoding UTF8

        for ($i = 0; $i -lt $lines.Count; $i++) {
            $line = $lines[$i]
            if ($line -match '^\s*-\s*(?:\[ \]\s*)?(BUG|FIXME|TODO:\s*[Ff]ix)\b[:\s]*(.+)$') {
                $bullet = $Matches[2].Trim()
                if ($bullet -match '#\d+|See\s+#') { continue }
                Add-Finding -SourceFile $rel -SourceKind 'docs-bullet' `
                    -LineStart ($i + 1) -LineEnd ($i + 1) -Raw $line.Trim() `
                    -TitleSuggestion "[BUG] Doc-Migration: $($bullet.Substring(0, [Math]::Min(50, $bullet.Length)))" `
                    -BodyDraft "From $rel`:$($i+1)`n`n$($line.Trim())" -FeatureId $null
            }
        }
    }
}

$stats.findings_total = $findings.Count

$report = [ordered]@{
    schema_version = '1.0'
    scanned_at     = (Get-Date -Format 'yyyy-MM-ddTHH:mm:ssZ' -AsUTC)
    project_root   = $Root
    stats          = $stats
    findings       = @($findings)
}

$json = $report | ConvertTo-Json -Depth 10
$dir = Split-Path -Parent $OutputPath
if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
[System.IO.File]::WriteAllText($OutputPath, $json, [System.Text.UTF8Encoding]::new($false))

Write-Host "[bug-migration] Scan abgeschlossen." -ForegroundColor Green
Write-Host "  Specs gescannt   : $($stats.specs_scanned)"
Write-Host "  Memory gescannt  : $($stats.memory_scanned)"
Write-Host "  Docs gescannt    : $($stats.docs_scanned)"
Write-Host "  Funde gesamt     : $($stats.findings_total)"
Write-Host "  Output           : $OutputPath"
