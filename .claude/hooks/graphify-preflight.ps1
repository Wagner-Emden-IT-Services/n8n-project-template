# UserPromptSubmit-Hook: graphify-Graph-Pre-Flight fuer /change-workflow, /next-recommend,
# /diagnosing-bugs
#
# Wird von .claude/settings.json via UserPromptSubmit-Hook aufgerufen. Liest stdin als JSON
# (`{ prompt: "...", ... }`), prueft ob der Prompt mit einem der Explorations-Slash-Commands
# beginnt. Bei Match (und wenn ein Graph existiert) wird ein Reminder als additionalContext
# injiziert: "erst den Code-Graphen fragen, dann greppen".
#
# graphify baut die Code-Anteile des Projekts (Scope via .graphifyignore — NUR scripts/,
# tests/, hooks/, .n8n-template-Engine; KEINE workflows/*.json) zu einem lokalen
# Knowledge-Graph (graphify-out/graph.json, tree-sitter-AST, kein LLM).
# Siehe CLAUDE.md Sektion "Graphify Knowledge Graph".
# Adaptiert aus golden-dev v1.14 (graphify-preflight.ps1), n8n-Command-Trigger angepasst.

$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# stdin lesen — robust gegen Console- und Pipeline-Modus.
$raw = ''
try {
    $stdinLines = @($input)
    if ($stdinLines.Count -gt 0) {
        $raw = ($stdinLines -join "`n")
    }
} catch {
    $raw = ''
}
if ([string]::IsNullOrWhiteSpace($raw)) {
    try {
        $raw = [Console]::In.ReadToEnd()
    } catch {
        $raw = ''
    }
}

if ([string]::IsNullOrWhiteSpace($raw)) {
    Write-Output '{}'
    exit 0
}

try {
    $input = $raw | ConvertFrom-Json -ErrorAction Stop
} catch {
    Write-Output '{}'
    exit 0
}

# Prompt-Feld holen (defensiv gegen mehrere moegliche Feldnamen)
$prompt = ''
foreach ($field in @('prompt', 'user_prompt', 'message', 'user_message')) {
    if ($input.PSObject.Properties.Name -contains $field) {
        $value = $input.$field
        if ($value -and -not [string]::IsNullOrWhiteSpace($value)) {
            $prompt = [string]$value
            break
        }
    }
}

if ([string]::IsNullOrWhiteSpace($prompt)) {
    Write-Output '{}'
    exit 0
}

# Match auf /change-workflow, /next-recommend, /diagnosing-bugs am Prompt-Anfang
if ($prompt -notmatch '(?im)^\s*/(change-workflow|next-recommend|diagnosing-bugs)\b') {
    Write-Output '{}'
    exit 0
}

# Graph nur bewerben, wenn er tatsaechlich existiert.
# Projekt-Dir aus CLAUDE_PROJECT_DIR ableiten — UserPromptSubmit-Hooks feuern ggf. aus einem
# fremden CWD, dann wuerde ein relativer Test-Path fehlschlagen. Fallback = aktuelles Verzeichnis.
$projectDir = if ($env:CLAUDE_PROJECT_DIR) { $env:CLAUDE_PROJECT_DIR } else { '.' }
if (-not (Test-Path (Join-Path $projectDir 'graphify-out/graph.json'))) {
    Write-Output '{}'
    exit 0
}

$reminder = @'
=== graphify Graph-Pre-Flight (Code-/Struktur-/Impact-Fragen) ===

Es existiert ein lokaler Code-Knowledge-Graph (graphify-out/graph.json, Scope via
.graphifyignore, tree-sitter-AST, kein LLM). Bei Fragen nach Code-Beziehungen im
CLI-/Script-/Test-Code ("was ruft X auf", "was bricht wenn ich Y aendere") ZUERST
den Graphen fragen statt breit zu greppen:

  graphify query "<frage>"        BFS-Kontext zu einem Thema
  graphify path "A" "B"           kuerzester Pfad zwischen zwei Konzepten/Funktionen
  graphify explain "X"            was ist X, woran haengt es (Nachbarschaft + Quellen)
  graphify affected "X"           Reverse-Impact: welche Nodes werden von X beeinflusst

- PATH: `graphify` liegt in ~/.local/bin (nicht auf Git-Bash-PATH). Im Bash-Tool voranstellen:
    export PATH="$HOME/.local/bin:$PATH"; graphify ...
  Alternative ohne PATH: `uv tool run --from graphifyy graphify ...`
- SCOPE: NUR Code (scripts/, tests/, hooks/, .n8n-template-Engine). workflows/*.json sind
  NICHT im Graphen — Workflow-Semantik (Nodes, Connections, Credentials, Webhooks)
  beantwortet der n8n-MCP (n8n_get_workflow, validate_workflow), nicht der AST-Graph.
- FRISCHE: Der Post-Commit-Hook baut den Graphen nach jedem Commit neu. Bei uncommitteten
  Code-Aenderungen vor der Abfrage einmal `graphify update .` laufen lassen.
- graphify-out/ ist committed (geteilte Map); nur cost.json/cache/ bleiben lokal.

Kein Zwang: Ist die Frage reine Workflow-/Doku-Sache oder trivial, ueberspringen —
eine Zeile Begruendung genuegt.
=== Ende graphify Pre-Flight ===
'@

$output = @{
    hookSpecificOutput = @{
        hookEventName     = 'UserPromptSubmit'
        additionalContext = $reminder
    }
} | ConvertTo-Json -Depth 5 -Compress

Write-Output $output
exit 0
