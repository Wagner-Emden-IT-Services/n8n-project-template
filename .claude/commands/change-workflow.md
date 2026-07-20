<!-- Copyright (c) 2025-2026 Wagner-Emden IT Services. All rights reserved. -->
---
user-invocable: true
description: Universeller n8n-Workflow-Orchestrator — Pipeline-Default (Spec→Build→Test→Security→Deploy) + Issue-Mode (--issue/--issues) + Multi-Workflow-Batch (--workflows). Skills + Sub-Agents je Phase. Bugs ausschliesslich als GitHub-Issues.
argument-hint: "[--workflow WF-N] [--issue N] [--issues] [--workflows WF-1,WF-2] [--phase spec|build|test|security|deploy] [--priority P0,P1] [--milestone <name>] [--max-parallel <N>] (Default 2, max 3)"
allowed-tools: Bash(*), Bash(gh:*), Bash(git:*), Read, Write, Edit, Glob, Grep, AskUserQuestion, Agent, TeamCreate, mcp__n8n__search_nodes, mcp__n8n__get_node, mcp__n8n__validate_workflow, mcp__n8n__n8n_create_workflow, mcp__n8n__n8n_update_partial_workflow, mcp__n8n__n8n_test_workflow, mcp__n8n__n8n_activate_workflow
---

# /change-workflow — Universeller n8n-Workflow-Orchestrator

> **Bug-Tracking-Konvention (verbindlich seit n8n-template v0.6.0):**
> Bugs werden AUSSCHLIESSLICH als GitHub-Issues im Project-Repo gepflegt.
> KEINE Bug-Sektionen in WF-X-Specs. WF-X-Specs dokumentieren Workflows.
> Bug-Erstellung: `gh issue create` (Mensch) / `/qa-workflow` Auto-File P0/P1 / `/change-workflow --issue <N>` (Bug-Fix).
> Template-Bugs (Skill/Hook/Command): `/template-bugreport` (sanitisiert ins Source-Repo).

Einziger Einstiegspunkt fuer ALLE Workflow-Aenderungen — neuer Workflow, Bug-Fix, Refactor, Multi-Workflow-Batch. Orchestriert die **n8n-Pipeline** (Spec → Architecture → Build → Test → Security → Deploy) mit 6 Sub-Agents und 8 Skills, je nach Phase automatisch geladen.

## Eingabe

$ARGUMENTS

---

## Schritt -0.7: Argument-Parsing (vor allem anderen)

Parse `$ARGUMENTS` auf folgende Flags. Reste werden als freie User-Beschreibung interpretiert.

| Flag | Wirkung |
|---|---|
| `--workflow WF-N` | Single-Workflow-Mode auf WF-N (Default-Pipeline) |
| `--issue <N>` | Issue-Mode (Single) — Issue #N als Quelle |
| `--issues` | Multi-Issue-Mode — listet offene Issues, User waehlt |
| `--workflows WF-1,WF-2,WF-3` | Multi-Workflow-Batch (existing WF-X) |
| `--phase <spec\|build\|test\|security\|deploy>` | Direkt zu einer Phase springen (Quick-Fix) |
| `--priority P0,P1` | Filter fuer `--issues` (kombinierbar) |
| `--milestone <name>` | Alle Issues eines Milestones |
| `--max-parallel <N>` | Default 2, max 3 (n8n Credentials-Konflikt-Risiko) |
| `--bypass-security` | Skip security-audit-required (Audit-Log-Eintrag) |
| `--bypass-wfx-spec` | Skip wf-x-spec-required (Audit-Log-Eintrag) |

Setze Variablen:
- `$mode = "single-workflow" | "issue-single" | "multi-issue" | "multi-workflow"`
- `$skipToPhase`, `$priorityFilter`, `$milestone`, `$maxParallel`, `$bypassFlags`

## Schritt 0: Vorbedingungen

1. **Hard-Gate `onboard-required`**: pruefe `.template-version.json`. Falls fehlt oder Placeholder enthaelt: STOPP "Onboard zuerst durchlaufen: /onboard"
2. **`gh` CLI**: `gh --version` + `gh auth status` — bei Failure STOPP (Issue-Modes brauchen das)
3. **`.template-version.json` `target_repo`**: muss gesetzt sein wenn Issue-Mode aktiv
4. **`git status` sauber**: bei uncommitted Changes — User-Frage (analog golden-dev /change Schritt 0.5)

## Schritt 0.3: Plan-Dokument-Erkennung (Multi-Workflow / Multi-Session)

Pruefe `docs/specs/backlog/*.md`. Bei Treffer mit offenen Sessions: merken fuer Schritt 4 (Plan-Dokument-Update).

## Schritt 0.4: Issue/Workflow-Loading (nur Issue-/Workflow-Mode)

### Single-Issue-Mode (`--issue <N>`)

```bash
gh issue view <N> --json title,body,labels,assignees,milestone,url
```

- Wenn `origin:template`-Label: STOPP, frage AskUserQuestion "Issue ist Template-Bug — `/template-bugreport`?"
- Sonst: Issue-Body → User-Beschreibung, Title → ggf. neue WF-X-Spec-Heading
- Klassifizierung in Schritt 1.5: `bug`-Label → Bug-Fix-Phase (Skip Spec/Architecture wenn Workflow existiert)

### Multi-Issue-Mode (`--issues`)

```bash
gh issue list --state open --json number,title,labels --limit 50
```

Filter via `--priority` und `--milestone`. AskUserQuestion mit Liste. `origin:template`-Issues werden ausgeschlossen (Hinweis auf `/template-bugreport`).

Erzeuge Plan-Dokument `docs/specs/backlog/<datum>-issues-batch.md` mit Sessions-Tabelle (1 Row pro Issue: Issue-URL, Priority, Status, Branch-Name, PR-Link).

### Workflow-Mode (`--workflow WF-N` oder `--workflows ...`)

Lade `docs/specs/WF-N.md` Frontmatter (`status`, `phase`). Bei `--workflows WF-1,WF-2,WF-3`: alle laden + **Konflikt-Detection** (siehe Schritt 2.5).

## Schritt 1: Projekt-Kontext laden

- `docs/specs/INDEX.md` (alle WF-X mit Status)
- `docs/STATE.md` (aktuelle Position, aktive Phase, Open Loops)
- Plan-Dokument aus Schritt 0.3 (falls vorhanden)
- `.template-version.json` (Schema-Version, Hosting, Staging-Profile)

## Schritt 1.5: Klassifizierung (n8n-spezifisch)

Pro Eingabe (Issue-Body / WF-X-Spec / User-Text) bestimme **Phase**:

| Phase | Trigger-Signale | Sub-Agent | Auto-Skills |
|---|---|---|---|
| **Spec** | "Neuer Workflow", "Anforderung", noch keine WF-X | `n8n-workflow-analyst` | `n8n-prd-generator` |
| **Architecture** | WF-X existiert, kein Technical Design | `n8n-integration-architect` | `n8n-workflow-patterns`, `n8n-mcp-tools-expert` |
| **Build** | WF-X mit Design, kein Workflow-JSON | `n8n-workflow-developer` | `n8n-mcp-tools-expert`, `n8n-node-configuration`, `n8n-code-javascript`, `n8n-code-python`, `n8n-expression-syntax`, `n8n-workflow-reviewer` (Post-Build-Review) |
| **Test** | Workflow-JSON existiert, kein QA-Result | `n8n-qa-engineer` | `n8n-validation-expert`, `n8n-mcp-tools-expert` |
| **Security** | Vor Production-Deploy | `n8n-security-reviewer` | `/security-review-workflow` |
| **Deploy** | Security gruen, ready zum Activate | `n8n-deployment-engineer` | `n8n-mcp-tools-expert` |
| **Bug-Fix** | Issue mit `bug`-Label, oder QA-Failure | je nach betroffener Phase | je nach Phase |

Mit `--phase <name>`: direkt zur angegebenen Phase springen.

**Bei Bug-Fix-Phase**: Skip Spec + Architecture wenn der Workflow schon existiert. Direkt zur Build- oder Test-Phase mit Bug-Beschreibung als Context.

**Post-Build-Review**: Am Ende jeder Build-Phase (auch bei Bug-Fix) laeuft `n8n-workflow-reviewer` ueber den gebauten/geaenderten Workflow, bevor die Test-Phase startet — siehe `.claude/rules/general.md` "Post-Build-Review".

## Schritt 1.7: PR-Linking-Konvention (cross-cutting, ab v0.6.0)

| Typ | Pattern | Beispiel |
|---|---|---|
| Bug-Fix mit Issue | `fix/issue-<N>-<slug>` | `fix/issue-42-webhook-retry` |
| Aenderung mit Issue | `chore/issue-<N>-<slug>` | `chore/issue-58-rename-creds` |
| Feature mit Issue | `feat/issue-<N>-<slug>` | `feat/issue-91-stripe-sync` |
| Workflow ohne Issue | `feat/wf-<N>-<slug>` | `feat/wf-12-customer-sync` |

**Commit-Message** (Conventional Commits + Issue-Ref):

```
feat(WF-12): description (#N)
fix(WF-12): description (#N)
chore(WF-12): description (#N)
```

**PR-Body** — IMMER `Closes #<N>` enthalten (sonst greift Auto-Close nicht — `pr-issue-link-check.yml` erinnert).

## Schritt 2: Skill-Loading nach Phase

Lade automatisch die Skills aus der Tabelle in Schritt 1.5. Bei Build-Phase werden ggf. mehrere Skills parallel benoetigt (z.B. `n8n-code-javascript` UND `n8n-expression-syntax`).

## Schritt 2.5: Multi-Workflow-Konflikt-Detection (nur `--workflows`)

Pruefe **vor Spawn** ob mehrere Workflows auf den gleichen Ressourcen arbeiten:

1. Liste `docs/specs/WF-X.md` Frontmatter `credentials:` und `webhook_paths:`
2. Bei Overlap (gleiche Credential / gleicher Webhook-Path): markiere Workflows als "sequenziell statt parallel"
3. Ausgabe-Plan zeigen:
   ```
   PARALLEL: WF-1, WF-2 (keine geteilten Ressourcen)
   SEQUENZIELL nach Parallel-Batch: WF-3 (teilt Credential mit WF-1)
   ```
4. AskUserQuestion zur Bestaetigung

Max parallel: `$maxParallel` (Default 2, ueber `--max-parallel 3` bis 3).

## Schritt 3: Pipeline-Ausfuehrung

### Single-Workflow / Issue-Single

Sequenziell durch die Phasen mit User-Gates zwischen jeder Phase:
- Spec → User-Bestaetigung → Architecture → ... → Deploy
- Bei Bug-Fix: direkt zur betroffenen Phase

### Multi-Workflow-Batch / Multi-Issue

`TeamCreate` mit bis zu `$maxParallel` Agents. Jeder Agent bekommt:
- Eigenen Worktree (`git worktree add ../<branch> <branch>`)
- Eigene WF-X / Issue als Input
- Pipeline-Phase als Auftrag
- Orchestrator wartet auf Completion, sammelt PR-Links

Plan-Dokument wird laufend aktualisiert (Sessions-Tabelle, Status-Spalte).

## Schritt 4: Hard-Gate-Checks (vor Deploy)

Vor `n8n_activate_workflow` in Production-Profil:

1. **`wf-x-spec-required`**: Liest `docs/specs/WF-N.md`, prueft Pflichtfelder (Trigger, Datenfluss, Services, Error-Handling, Edge-Cases, Credentials, Webhook-Paths). Bei fehlenden Feldern: STOPP. `--bypass-wfx-spec` ueberspringt mit Audit-Log-Eintrag.
2. **`security-audit-required`**: `/security-review-workflow WF-N` ausfuehren. Bei rotem Status: STOPP. `--bypass-security` ueberspringt mit Audit-Log-Eintrag.
3. **`normalize-on-commit`**: Pre-Commit-Hook ist installiert (`.git/hooks/pre-commit` existiert). Bei Fehlen: Warnung "Onboard Phase 7 nachholen".
4. **`onboard-required`**: schon in Schritt 0 geprueft, hier nur Verifikation.

## Schritt 5: Spec-Update + Commit + PR

1. WF-X-Spec aktualisieren: Status-Feld (Planned → InProgress → Testing → Deployed), Implementation Notes, QA Results (mit Issue-Link `See #N` bei Bug-Fix).
2. `docs/STATE.md` aktualisieren: "Aktive Phase", "Aktiver Workflow", "Last Session Summary", "Open Loops" (Bug-Fix → Issue als Open Loop, Workflow-Deploy → Open-Loop entfernt).
3. Atomic Commit mit Conventional-Commits-Format + Issue-Ref.
4. Branch-Push + PR-Erstellung mit `Closes #N`.
5. Bei Multi-Workflow-Batch: jeder Sub-Agent macht seinen eigenen PR.

## Schritt 6: Plan-Dokument abschliessen (nur Multi-Workflow / Multi-Issue)

Falls Plan-Dokument aus Schritt 0.3: Session als ✅ DONE markieren, PR-Link eintragen.

---

## Anti-Patterns

- **Bug-Sektion in WF-X-Spec anlegen** — Konvention bricht. Stattdessen Issue + Cross-Reference.
- **`--bypass-security` ohne Audit-Log-Begruendung** — Hard-Gate ist da aus Grund. Default-Bypass kann zu Credential-Leaks fuehren.
- **Multi-Workflow ohne Konflikt-Check** — `--max-parallel 3` ohne Pruefung der Credentials/Webhook-Paths → Race-Condition wahrscheinlich.
- **Pipeline-Skip auf `--phase deploy` ohne Test-Run** — Test-Phase ist Voraussetzung, nur ueberspringen bei Hotfix mit User-OK.

## Bezug zu anderen Commands

- `/onboard` — Voraussetzung (Phase 5.7 setzt `target_repo`, Labels, ISSUE_TEMPLATEs)
- `/qa-workflow` — wird in Test-Phase aufgerufen (Severity-Heuristik + Auto-File)
- `/security-review-workflow` — wird in Security-Phase aufgerufen (Hard-Gate)
- `/template-bugreport` — bei `origin:template`-Bug
- `/help-workflow` — Hilfe zum Workflow + Phasen + Skills
- `/next-recommend` — "Was als naechstes?" — empfiehlt typischerweise `/change-workflow` mit konkreten Args
