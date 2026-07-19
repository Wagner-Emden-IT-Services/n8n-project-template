# General Project Rules — n8n-template v0.6.0

> Stack-agnostische Konventionen fuer n8n-Workflow-Projekte. Spezifika zu n8n-Nodes,
> Expressions, Code-Nodes etc. sind in den jeweiligen Skills.

## Onboard-Required (HARD GATE)

Siehe `.claude/rules/onboard-required.md`. Slash-Commands brechen ab wenn `.template-version.json` fehlt oder Placeholder enthaelt.

## Post-Build-Review (verbindlich seit n8n-template v0.7.0)

**Nach jedem Build/Edit eines Workflow-JSONs (`workflows/*.json`) laeuft der Skill
`n8n-workflow-reviewer` als statischer Review — VOR `validate_workflow`,
`/security-review-workflow` und Deploy.**

- **5 Kategorien:** Errors & Breaks, Missing Error Handling, Performance & Efficiency,
  Structure & Maintainability, Summary + Score.
- **Blocker** (Errors-&-Breaks-Findings) werden vor dem naechsten Schritt (Validate) behoben.
- **Abgrenzung zu `qa-workflow`:** Reviewer = statischer Code-Review (billig, kein Test-Run).
  `qa-workflow` = anschliessende Test-Ausfuehrung + Severity-Heuristik + Auto-File von
  P0/P1-Issues. Reihenfolge: erst Reviewer, dann QA.
- **Sticky-Notes / Naming / Struktur** werden von Kategorie 4 mit-geprueft (relates to #19).
- **Bugs** landen nicht in WF-X-Specs, sondern als GitHub-Issue (siehe Bug-Tracking-Konvention unten).
- **In der Pipeline (`/change-workflow`):** Reviewer laeuft am Ende der Build-Phase, bevor
  `n8n-qa-engineer` (Test-Phase) uebernimmt.

## Bug-Tracking-Konvention (verbindlich seit n8n-template v0.6.0)

**Bugs werden AUSSCHLIESSLICH als GitHub-Issues im Project-Repo gepflegt.**

- `docs/specs/WF-X.md`-Specs dokumentieren WORKFLOWS, nicht Bugs.
- Verbotene Anti-Pattern-Sektionen in Specs: "Known Bugs", "Bekannte Fehler", "TODO: Fix", "BUG:".
- Bug-Fixes referenzieren das Issue in der Spec via `See #N` (Sektion "QA Test Results") oder `Bug-Fix: #N (PR #M)` (Sektion "Implementation Notes").

**Bug-Erstellung:**
- Mensch direkt: `gh issue create` (Template-Picker zeigt `01-bug.yml`)
- Via `/change-workflow` mit `--issue <N>`: Issue-Body wird zur User-Beschreibung
- Via `/qa-workflow`-Skill: Auto-File bei P0/P1, User-Choice-Liste bei P2/P3
- Template-Bug (Skill/Hook/Command, `.n8n-template/`): `/template-bugreport` (sanitisiert ins n8n-project-template Source-Repo)

**Bug-Abarbeitung:**
- Einzeln: `/change-workflow --issue <N>` → Branch `fix/issue-N-<slug>` → PR-Body `Closes #N` → Auto-Close beim Merge
- Multi-Batch: `/change-workflow --issues [--priority P0,P1] [--milestone <name>]` → Multi-Agent-Teams via TeamCreate (max 2 parallel, Default; bis 3 mit `--max-parallel 3` — n8n-Credentials-Konflikte erfordern Vorsicht)
- Bei Konflikt: Konflikt-Detection im /change-workflow Schritt 2.5 — Workflows mit shared Credentials werden sequenziell statt parallel

**Branch-Naming:** `fix/issue-<N>-<slug>` / `chore/issue-<N>-<slug>` / `feat/issue-<N>-<slug>` (alle mit Issue-Ref).

**PR-Body Hard-Rule:** IMMER `Closes #<N>` enthalten (sonst greift Auto-Close nicht — der `pr-issue-link-check.yml`-Workflow erinnert).

Details: `.claude/commands/change-workflow.md` (Schritt 0.4 + 1.7) und `.claude/skills/qa-workflow/SKILL.md`.

## Workflow-Spec-Tracking

- Workflows >= 3 Nodes oder mit Webhook/Schedule **MUESSEN** eine WF-X-Spec haben (`docs/specs/WF-X.md`)
- WF-X-IDs sind sequenziell — siehe `docs/specs/INDEX.md` fuer naechste freie Nummer
- Lifecycle: `Planned` → `InProgress` → `Testing` → `Deployed`
- Cross-cutting (mehrere Workflows betroffen) bekommen eigene WF-X mit "Affected by: WF-Y" Cross-Reference
- Spec-Template: `docs/specs/spec-template.md`

## Git-Konventionen

- Commit-Format: `type(WF-X): description` ODER `type(scope): description (#<issue-N>)` bei Issue-getriebener Arbeit
- Types: `feat`, `fix`, `refactor`, `test`, `docs`, `deploy`, `chore`
- **Atomare Commits**: ein logischer Change pro Commit (ermoeglicht git bisect)
- **Pre-Commit-Hook**: `.git-hooks/pre-commit` normalisiert workflows/*.json automatisch (normalize-on-commit Hard-Gate)
- **Niemals** `--no-verify` bei Pre-Commit-Hooks

## Hard-Gates (Pflicht-Pruefungen)

1. `onboard-required` — `/onboard` vor jeder Aktion
2. `wf-x-spec-required` — WF-X-Spec mit Pflichtfeldern (Trigger, Datenfluss, Services, Error-Handling, Edge-Cases, Credentials, Webhook-Paths) vor `n8n_activate_workflow`
3. `security-audit-required` — `/security-review-workflow` gruener Status vor Production-Deploy
4. `normalize-on-commit` — Pre-Commit-Hook normalisiert Workflow-JSON automatisch

Bypass nur via expliziter `--bypass-<gate>`-Flag mit Audit-Log-Eintrag.

## Human-in-the-Loop

- User-Bestaetigung vor finalen Deliverables (Production-Deploy, neuer Branch, neuer Workflow live)
- Optionen klar darstellen (kein offenes "was meinst du")
- Niemals Auto-Commit/Auto-Push ohne explizite Bestaetigung
- Niemals naechste Phase ohne User-OK

## Status-Updates (MANDATORY — Write-Then-Verify)

Nach Abschluss einer Pipeline-Phase MUSS:

1. WF-X-Spec aktualisiert werden (Status, Implementation Notes, QA Test Results)
2. `docs/specs/INDEX.md` aktualisiert werden (Status-Spalte synchron mit Spec-Header)
3. `docs/STATE.md` aktualisiert werden ("Aktive Phase", "Aktiver Workflow", "Last Session Summary")
4. **Niemals** "Ich habe die Spec aktualisiert" sagen ohne Edit-Tool-Aufruf
5. **Niemals** Zusammenfassung im Chat statt File-Update

## File-Handling

- File IMMER lesen bevor editieren (`Read`-Tool)
- Nach Context-Compaction: relevante Files neu laden
- `git diff` pruefen um zu sehen was schon geaendert ist
- Niemals Pfade/Component-Namen erraten

## Session-Ende Check

Bevor eine Session endet:
- `git diff --name-only` — keine uncommitted Aenderungen darf uebrig sein
- Falls doch: User informieren + klaeren (commit / stash / verwerfen)
- Niemals Session beenden mit uncommitteten Aenderungen ohne explizites OK
