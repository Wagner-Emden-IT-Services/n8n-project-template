# Skills

## Projekt-lokale Skills (in diesem Verzeichnis)

Aus [czlonkowski/n8n-skills](https://github.com/czlonkowski/n8n-skills) ins Repo kopiert (Version 1.9.0), damit das Template ohne Plugin-Install nutzbar ist:

- `n8n-code-javascript/` — JS in Code-Nodes (`$input`/`$json`/`$node`, SplitInBatches-Patterns, $helpers)
- `n8n-code-python/` — Python in Code-Nodes (`_input`/`_json`/`_node`, Standard-Library-Limits)
- `n8n-expression-syntax/` — `{{ }}`-Expressions, Daten-Mapping zwischen Nodes
- `n8n-mcp-tools-expert/` — Best-Practices fuer n8n-mcp MCP-Tool-Calls
- `n8n-node-configuration/` — operation-aware Node-Properties, displayOptions, patchNodeField
- `n8n-validation-expert/` — Validation-Errors interpretieren, False-Positives, Auto-Fix-Loop
- `n8n-workflow-patterns/` — Architektur-Patterns: Webhook, HTTP-API, DB, AI-Agent, Batch, Scheduled

## Adoptierter Review-Skill (nicht aus czlonkowski)

- `n8n-workflow-reviewer/` — statischer 5-Kategorien-Review-Audit (Errors, Error-Handling,
  Performance, Struktur, Score). **Laeuft nach jedem Build/Edit** eines Workflows
  (Post-Build-Review, VOR Validate/Deploy) — verankert in `CLAUDE.md` Section 4 und
  `.claude/rules/general.md` "Post-Build-Review". Ergaenzt das WE-eigene `qa-workflow/`
  (Reviewer = statischer Review zuerst, QA = Test-Ausfuehrung danach).

## Skills triggern automatisch

Du musst Skills nicht explizit aufrufen — Claude Code laedt die Descriptions in jede Session
und feuert den passenden Skill, sobald dein Prompt zum Trigger-Match passt. Beispiel: *"Bau
mir einen Workflow der eine API paginiert abfragt"* → `n8n-workflow-patterns` und
`n8n-mcp-tools-expert` triggern automatisch.

Slash-Commands in `../commands/` sind dagegen **immer explizit** — `/validate-workflow`,
`/deploy-workflow`, `/check-pagination` etc. werden eingetippt.

## Quelle: nur lokal — Plugin nicht parallel installieren

Wenn `czlonkowski/n8n-skills` **gleichzeitig** als Plugin (`/plugin install`) UND projekt-lokal
vorhanden ist, erscheinen alle Skills doppelt — einmal mit Prefix `n8n-mcp-skills:<name>`
(Plugin) und einmal ohne (Projekt). Das fuehrt zu unklarem Verhalten.

**Dieses Template setzt auf projekt-lokal.** `.claude/settings.json` aktiviert das Plugin
nicht. Falls du es global aktiviert hast: `/plugin uninstall n8n-mcp-skills`.

## Update / Re-Sync

Wenn upstream eine neue Version draussen ist:

```powershell
git clone --depth=1 https://github.com/czlonkowski/n8n-skills.git $env:TEMP\n8n-skills
Copy-Item -Path "$env:TEMP\n8n-skills\skills\*" -Destination ".\.claude\skills\" -Recurse -Force
Remove-Item -Path "$env:TEMP\n8n-skills" -Recurse -Force
```
