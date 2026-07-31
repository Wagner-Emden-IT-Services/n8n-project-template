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

## Adoptierter PRD-Skill (seit v1.0.0)

- `n8n-prd-generator/` — strukturiertes 3-Phasen-Interview zur PRD-Erstellung (Initial
  Understanding -> Clarifying Questions -> Generierung). Wird vom Command `/prd-generate`
  gewrappt (Output: projekt-weite `docs/PRD.md` im 12-Sektionen-Format). **Pflicht vor
  Build/Deploy** (Hard-Gate `prd-required`, siehe `.claude/rules/prd-required.md`).

## Adoptierte Prozess-Skills (seit v1.1.0)

Aus [mattpocock/skills](https://github.com/mattpocock/skills) (MIT, Upstream-Commit `2ab9580`
vom 2026-07-28, Plugin v1.2.0) uebernommen und **fuer dieses Template adaptiert** — Lizenz +
Provenienz: `_LICENSE-mattpocock.md`:

- `grilling/` — Kern-Primitiv: unerbittliches Interview zu Plan/Entscheidung, eine Frage pro
  Turn mit Empfehlung; Fakten schlaegt der Agent selbst nach, Entscheidungen beim User.
  **Standard-Pass in `/prd-generate`** vor `Status: APPROVED`.
- `grill-me/` — User-Command-Wrapper: startet eine `/grilling`-Session (stateless).
- `grill-with-docs/` — Grilling + Domain-Modeling: Interview, das nebenbei `CONTEXT.md`/ADRs
  aufbaut. **Einstieg der Spec-Phase** (n8n-workflow-analyst) bei unklaren Anforderungen.
  Adaption: model-invoked (upstream user-only), damit die Pipeline sie laden kann.
- `domain-modeling/` — Ubiquitous Language pflegen: `CONTEXT.md` (Root) + `docs/adr/`;
  speist WF-X-Specs und PRD mit konsistenter Terminologie.
- `handoff/` — Session-Uebergabe: kompaktiert die Konversation nach
  `docs/sessions/<datum>-<kurzname>.md` + aktualisiert `docs/STATE.md` (Write-Then-Verify).
  Adaption: committete Ablage statt OS-Temp, verschaerfte Secret-/PII-Redaktion (gitleaks),
  model-invoked (upstream user-only), damit Session-Ende-Check und Phasen-Gates ihn ausfuehren koennen.
- `diagnosing-bugs/` — 6-Phasen-Diagnose-Loop (Feedback-Loop zuerst, Repro, gerankte
  Hypothesen, Regression-Test vor Fix). Adaption: n8n-Feedback-Loops (curl-gegen-Webhook,
  Execution-Replay, Pin-Daten-Testlauf), Post-Mortem als GitHub-Issue statt
  improve-codebase-architecture. **Pflicht-Phase in `/change-workflow --issue`.**
- `research/` — belegte Recherche gegen Primaerquellen; Backends Perplexity/Context7-MCP
  (Fallback WebFetch), Ablage `docs/research/` bzw. `docs/integrations/<service>/`,
  Zitierpflicht (URL + Datum). **Verankert in der Architecture-Phase.**

**Achtung Doppel-Trigger:** Ist das Plugin `mattpocock-skills` global installiert, existieren
die Originale zusaetzlich als `mattpocock-skills:<name>`. Die model-invoked Skills (grilling,
domain-modeling, diagnosing-bugs, research) koennen dann doppelt matchen. In Template-Projekten
gilt: projekt-lokale (adaptierte) Variante nutzen — Plugin fuer dieses Projekt deaktivieren
(`/plugin` → disable). "Ignorieren" reicht nicht: die model-invoked Skills (grilling,
domain-modeling, diagnosing-bugs, research) matchen sonst automatisch doppelt.

**Re-Sync-Warnung:** Anders als die czlonkowski-Skills sind diese Skills ADAPTIERT — ein
blindes Kopieren einer neuen Upstream-Version ueberschreibt die n8n-Anpassungen. Upstream-Diff
(github.com/mattpocock/skills, Matt released schnell und mit Breaking-Umbauten) manuell
sichten und Aenderungen gezielt einpflegen; Quell-Commit in `_LICENSE-mattpocock.md` nachziehen.

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

## Update / Re-Sync (nur czlonkowski-Skills)

Wenn upstream eine neue czlonkowski-Version draussen ist (fuer die adaptierten
Prozess-Skills gilt dieser Blind-Copy-Weg NICHT — siehe Re-Sync-Warnung oben):

```powershell
git clone --depth=1 https://github.com/czlonkowski/n8n-skills.git $env:TEMP\n8n-skills
Copy-Item -Path "$env:TEMP\n8n-skills\skills\*" -Destination ".\.claude\skills\" -Recurse -Force
Remove-Item -Path "$env:TEMP\n8n-skills" -Recurse -Force
```
