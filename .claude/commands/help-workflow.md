<!-- Copyright (c) 2025-2026 Wagner-Emden IT Services. All rights reserved. -->
---
user-invocable: true
description: Erklaert das n8n-Template und seine Funktionen kontextabhaengig. Standard-Uebersicht + Detail-Modi pro Command/Phase/Skill/Konzept. Read-only.
argument-hint: "[--command <name>] [--phase spec|build|test|security|deploy] [--skill <name>] [--concept wf-x|prd|staging-profile|hard-gate|...] [--first-steps]"
allowed-tools: Read, Glob, Grep, AskUserQuestion
---

# /help-workflow — Template-Erklaerer

Erklaert das n8n-Template (v0.6.0+) und seine Funktionen kontextabhaengig. Read-only, keine Side-Effects.

## Modi

| Argument | Wirkung |
|---|---|
| `/help-workflow` | Standard-Uebersicht: Cheatsheet + aktueller Stand aus STATE.md |
| `/help-workflow --command <name>` | Detail eines Slash-Commands (`/change-workflow`, `/template-update`, ...) |
| `/help-workflow --phase <name>` | Phase-Detail (Sub-Agents, Skills, Hard-Gates) |
| `/help-workflow --skill <name>` | Skill-Erklaerung (welche der n8n-Skills macht was) |
| `/help-workflow --concept <name>` | Konzept-Erklaerung (`wf-x`, `prd`, `staging-profile`, `hard-gate`, `marker-konvention`, `pipeline`, ...) |
| `/help-workflow --first-steps` | Erste-Schritte-Tour fuer neue User |

## Workflow

### Standard-Modus (`/help-workflow` ohne Args)

1. **Stand laden** aus:
   - `.template-version.json` (Version + Onboard-Status)
   - `docs/STATE.md` (aktuelle Position) falls vorhanden
   - `docs/specs/INDEX.md` (Workflow-Liste)
   - `gh issue list --state open --json number,labels` (Open Issues, wenn target_repo set)
   - `git log -3 --oneline` (Last Activity)

2. **Cheatsheet ausgeben:**

```
═══════════════════════════════════════════════
n8n-template v<version> — Quick-Reference
═══════════════════════════════════════════════

Aktueller Stand:
  Onboard:        <status>
  Workflows:      <Liste WF-X mit Status>
  Offene Issues:  <count> (<priority breakdown>)
  Last Activity:  <git log letzter Eintrag>

Pipeline-Phasen:
  Spec      → /change-workflow --phase spec     [Sub-Agent: n8n-workflow-analyst]
  Architecture → /change-workflow --phase architecture [Sub-Agent: n8n-integration-architect]
  Build     → /change-workflow --phase build    [Skills: mcp-tools-expert, node-configuration, code-js/py, expression-syntax]
  Test      → /change-workflow --phase test     [Sub-Agent: n8n-qa-engineer, Skill: validation-expert]
  Security  → /security-review-workflow         [Hard-Gate vor Deploy]
  Deploy    → /change-workflow --phase deploy   [Sub-Agent: n8n-deployment-engineer]

Hauptcommands:
  /onboard                       — Erstinstallation (8-Phasen-Wizard, einmalig)
  /change-workflow [args]        — Workflow-Pipeline (Single oder Multi)
  /qa-workflow                   — QA mit Auto-File P0/P1
  /security-review-workflow      — Security-Audit (Hard-Gate vor Production-Deploy)
  /template-check                — Update verfuegbar?
  /template-update [--apply]     — Template aktualisieren (Dry-Run default)
  /template-migrate              — Fremd-Template oder no-Template → n8n-template
  /template-bugreport            — Template-Bug sanitisiert ins Source-Repo
  /next-recommend                — "Was soll ich als naechstes machen?"
  /help-workflow [args]          — Diese Hilfe

Hard-Gates (Pflicht-Checks):
  onboard-required          → /onboard vor erster Aktion
  wf-x-spec-required        → WF-X mit Pflichtfeldern vor Deploy
  security-audit-required   → /security-review-workflow vor Production-Deploy (gruener Status)
  normalize-on-commit       → Pre-Commit-Hook normalisiert Workflow-JSON

Naechster Schritt (aus /next-recommend):
  → <empfehlung>

Doku:
  UPDATING.md          — Template-Lebenszyklus (Install, Update, Migrate, Marker)
  docs/PRD.template.md — PRD-Skeleton (12 Sektionen)
  docs/specs/INDEX.md  — Workflow-Tracking
═══════════════════════════════════════════════
```

3. Wenn Onboard noch nicht durch: ausschliesslich Hinweis "Du bist nicht onboarded — Run `/onboard` zuerst." und kurz beschreiben was das macht.

### `--command <name>`

Lies die Frontmatter und Body des angegebenen Commands aus `.claude/commands/<name>.md`. Fasse zusammen:
- Argumente (aus `argument-hint`)
- Allowed-Tools (aus YAML)
- Workflow-Schritte (extrahiere ## Schritt-Header)
- Typische Verwendung (Beispiele aus Doku)

### `--phase <name>`

Phase-Detail aus `/change-workflow`-Tabelle (Schritt 1.5). Zeige:
- Sub-Agent (Pfad in `.claude/agents/`)
- Auto-Skills (Pfade in `.claude/skills/`)
- Pflicht-Outputs der Phase (z.B. Build → Workflow-JSON in `workflows/`)
- Hard-Gates die in dieser Phase greifen

### `--skill <name>`

Lese die SKILL.md des angegebenen Skills. Bei lokalen Skills: aus `.claude/skills/<name>/SKILL.md`. Bei Ecosystem-Skills (z.B. `n8n-mcp-tools-expert`): Verweis auf Ecosystem-Doku + lokalen Adaption-Hinweis.

**Prozess-Skills** (lokal in `.claude/skills/`, phasen-uebergreifend):

| Skill | Zweck |
|---|---|
| `grilling` | grillt den User zu Plan/Entscheidung/Idee, bis geteiltes Verstaendnis erreicht ist |
| `grill-me` | Kurz-Trigger fuer eine `/grilling`-Session |
| `grill-with-docs` | `/grilling`-Session, die nebenbei ADRs + Glossar via `/domain-modeling` pflegt |
| `domain-modeling` | haelt Domaenen-Begriffe und Architektur-Entscheidungen des Projekts fest |
| `handoff` | kompaktiert den Session-Kontext nach `docs/sessions/` + aktualisiert `docs/STATE.md` |
| `diagnosing-bugs` | Diagnose-Loop fuer harte Bugs: Feedback-Loop, Repro, gerankte Hypothesen vor dem Fix |
| `research` | recherchiert eine Frage gegen Primaerquellen, Ergebnis als Markdown im Repo |

### `--concept <name>`

Konzept-Erklaerungen:

| Konzept | Erklaerung |
|---|---|
| `wf-x` | Workflow-Spec-System mit sequentiellen IDs (WF-1, WF-2, ...). Lifecycle Planned → InProgress → Testing → Deployed. Format: `docs/specs/WF-X.md`. |
| `prd` | Product Requirements Document, n8n-erweitert um Workflow-Inventur, Deployment-Strategie, DR-Bezug. Skeleton: `docs/PRD.template.md`. |
| `staging-profile` | Drei Profile (none, simple, full) definieren Branch → Env-Mapping. Konfiguriert in /onboard Phase 2. |
| `hard-gate` | Pflicht-Pruefung, die bestimmte Operationen verhindert wenn Bedingung nicht erfuellt. Beispiele: onboard-required, wf-x-spec-required, security-audit-required, normalize-on-commit. |
| `marker-konvention` | `<!-- N8N-TEMPLATE:START id="..." version="..." -->` / `<!-- PROJECT:START -->` fuer MARKER-AWARE-Files (CLAUDE.md). Siehe UPDATING.md Sektion "Marker-Konvention". |
| `pipeline` | Spec → Architecture → Build → Test → Security → Deploy. 6 Sub-Agents, je nach Phase aufgerufen. Hard-Gates greifen vor Deploy. |
| `pre-commit-hook` | `.git-hooks/pre-commit` normalisiert workflows/*.json vor jedem Commit (Pflicht-Hook, in /onboard Phase 7 installiert). |

### `--first-steps`

Tour fuer neue User:

```
1. /onboard — Erstinstallation (Project Identity, Staging, GitHub, n8n-Hosting, Credentials, Options, Erzeugung, PRD)
2. Nach Onboard: /help-workflow zeigt aktuellen Stand
3. Erstes Feature: /change-workflow "Ich moechte X workflow" → fuehrt durch Spec-Phase
4. Bug entdeckt? gh issue create (Template-Picker zeigt 01-bug.yml) ODER /change-workflow --issue <N>
5. Multi-Workflow-Batch: /change-workflow --workflows WF-1,WF-2 oder /change-workflow --issues --priority P0,P1
6. Verwirrt was als naechstes? /next-recommend
7. Template-Update verfuegbar? /template-check, dann /template-update --apply
8. Prozess-Skills bei Bedarf: /grilling bzw. /grill-me (Plan/Idee stress-testen),
   /grill-with-docs (Interview + ADRs/Glossar), /domain-modeling (Begriffe + Entscheidungen
   festhalten), /diagnosing-bugs (Root-Cause vor Bug-Fix), /research (Quellen-Recherche
   als Markdown im Repo), /handoff (Session-Uebergabe: docs/sessions/ + STATE.md)
```

## Tools

Read, Glob, Grep, AskUserQuestion (fuer Multi-Choice-Erklaerungen). Keine Schreiboperationen.
