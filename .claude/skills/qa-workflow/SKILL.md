---
name: qa-workflow
description: QA-Verifikation fuer n8n-Workflows — Test-Run via mcp__n8n__validate_workflow + manuell, Severity-Heuristik P0-P3, Auto-File P0/P1 als GitHub-Issues, User-Choice P2/P3.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Bash(gh:*), AskUserQuestion, mcp__n8n__validate_workflow, mcp__n8n__n8n_test_workflow, mcp__n8n__get_node
---

# Skill: qa-workflow

> **Bug-Tracking-Konvention (verbindlich seit n8n-template v0.6.0):**
> Bug-Findings aus QA-Runs gehen ausschliesslich als GitHub-Issues ins Project-Repo. KEINE "Known Bugs"-Sektionen in WF-X-Specs. Statt dessen: Issue erstellen, im WF-X auf den Issue verweisen (`See #N`).

## Wann laden

- `/change-workflow` Test-Phase
- Pre-Merge-Check fuer einen Workflow
- Bug-Reproduktion vor Triage
- Manueller QA-Run vor Production-Deploy

## Was tun

1. **WF-X-Spec lesen** (Trigger, Acceptance Criteria, Edge-Cases, Credentials, Webhook-Paths)
2. **Validation via MCP**: `mcp__n8n__validate_workflow` mit Profil `runtime` oder `strict`
3. **Test-Run (wenn ueberhaupt moeglich)**: `mcp__n8n__n8n_test_workflow` mit Mock-Daten oder Sandbox-Credentials
4. **Manueller Walkthrough**: jeden Node durchgehen, Edge-Cases pruefen
5. **Failures sammeln** in JSON-Struktur (1 Object pro Finding):
   ```json
   {
     "workflow_id": "WF-12",
     "failed_ac": "AC-3",
     "description": "Webhook reagiert nicht auf POST mit content-type=text/plain",
     "severity": "P1",
     "repro": "1. POST an /webhook/sync mit text/plain 2. Beobachte 500",
     "expected": "200 OK mit normalisierter Payload",
     "actual": "500 Internal Server Error",
     "node_name": "Webhook (Sync Trigger)",
     "execution_id": "abc123",
     "n8n_version": "1.65.2"
   }
   ```
6. **Severity bestimmen** (s. Heuristik unten)
7. **Auto-File-Workflow** ausfuehren (s. unten)
8. **WF-X-Spec aktualisieren**: Sektion "QA Test Results" mit Date + Pass/Fail-Marker + Issue-Link (`See #N`). Status bleibt `In Review` solang P0/P1 offen sind.

## Severity-Heuristik (deterministisch, dokumentiert fuer Konsistenz)

| Severity | Trigger-Beispiele (mind. 1 zutreffend) |
|---|---|
| **P0 Critical** | Credential-Leak im Output / Data-Loss-Path / Production-Webhook fail / Authentication-Bypass / Plain-Text Secret in Logs |
| **P1 High** | Workflow bricht ab in der ersten Execution / Aktivierung schlaegt fehl / falsche Daten an Downstream-System / Race-Condition |
| **P2 Medium** | Retry-Loop ohne Backoff / Performance-Issue (Timeout-Naehe) / falscher Cron-Trigger / Idempotenz-Verletzung |
| **P3 Low** | Cosmetic (Node-Naming, Description-Typo) / unsaubere Error-Message / fehlende Log-Annotation |

Bei Mehrdeutigkeit: hoehere Schwere annehmen.

## Auto-File-Workflow (PFLICHT seit v0.6.0)

Voraussetzungen:
- `gh --version` + `gh auth status` OK
- `.template-version.json` → `target_repo` befuellt
- ISSUE_TEMPLATE `02-workflow-bug.yml` existiert im Project-Repo

### P0 / P1 — Auto-File

Fuer jedes P0/P1-Finding:

```bash
gh issue create \
  --template 02-workflow-bug.yml \
  --title "[WF-X] {{description}}" \
  --label "bug,workflow-bug,source:ai-qa,needs-triage,priority:{{severity}}" \
  --body-file /tmp/qa-finding-{{N}}.md
```

Body enthaelt JSON-Struktur formatiert nach `02-workflow-bug.yml` (workflow_id, failed_ac, severity, repro, expected, actual, node_name, execution_id, n8n_version).

Output: "✅ Issue #N angelegt fuer P0/P1-Finding: <description>"

### P2 / P3 — Batch-User-Choice

Liste am Ende:

```
P2/P3 Findings (Severity: Medium/Low) — welche als Issue anlegen?

[1] P2 — Retry ohne Backoff im Webhook-Trigger
[2] P3 — Node-Description fehlt
[3] P2 — Idempotenz-Key wird nicht logged

Pro Finding: [a]nlegen, [s]kippen, [r]edraft
```

AskUserQuestion. Bei `[a]nlegen`: analog zu P0/P1.

## Routing-Heuristik (Template-Bug-Erkennung)

Wenn ein Finding auf bundled n8n-template-Files deutet (`.claude/hooks/*.ps1`, `.claude/skills/*/SKILL.md`, `.claude/commands/<bundled>.md`, `.n8n-template/*`, `scripts/n8n-cli.mjs`):

- AskUserQuestion "Finding deutet auf Template-Bug (Pfad: `<file>`). `/template-bugreport` aufrufen (sanitiert ins n8n-project-template Source-Repo)?"
- Bei Ja: keinen Project-Issue, stattdessen `/template-bugreport`
- Bei Nein: Project-Issue mit zusaetzlichem Label `origin:template` (manueller Cluster spaeter)

## Pflicht-Checks

- [ ] Alle AC der WF-X-Spec durchgegangen (PASS/FAIL annotiert)
- [ ] Validation via MCP `runtime`- oder `strict`-Profil gruen
- [ ] Credentials NICHT in Logs / Outputs (Pflicht-Test wegen Privacy)
- [ ] Webhook-Auth funktioniert (HMAC / Bearer / Basic je nach Setup)
- [ ] Error-Path: was wenn Downstream-API 500 zurueckgibt?
- [ ] Idempotenz: 2x dieselbe Eingabe → gleiches Ergebnis?
- [ ] Rate-Limits respektiert (Retry mit Backoff)

## MCP-Tools

- `mcp__n8n__validate_workflow` (Profile: `runtime`, `strict`, `ai-friendly`)
- `mcp__n8n__n8n_test_workflow` (mit Mock-Input)
- `mcp__n8n__get_node` (Read-only, fuer Node-Details bei Bug-Reproduktion)

## Hard-Gate vor WF-Status "Deployed"

- Alle AC haben PASS-Marker im Spec
- **KEINE offenen P0/P1-Issues** (gefiled in QA-Run dieses Workflows)
- `git diff` zeigt keine ungetrackten Aenderungen
- WF-X-INDEX.md auf aktuellem Status
- `/security-review-workflow WF-N` Status gruen

## Anti-Patterns

- **Bug in "Known Bugs"-Sektion einer WF-X-Spec aufschreiben** — seit v0.6.0 verboten. Issue + `See #N`.
- **P0/P1 als "spaeter fixen" merken** — Auto-File ist Pflicht, Triage-Label spaeter aendern.
- **MCP-Validate ueberspringen** — Hand-Check ist nicht ausreichend, Tool findet strukturelle Probleme.
