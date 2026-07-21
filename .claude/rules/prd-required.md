# PRD-Required Rule

> Diese Rule ist VERBINDLICH ab n8n-project-template v1.0.0. Hard-Gate fuer
> `/deploy-workflow`, die **Build-Phase** von `/change-workflow` und die 6 Sub-Agents
> (workflow-analyst, integration-architect, workflow-developer, qa-engineer,
> security-reviewer, deployment-engineer). Ergaenzt `onboard-required` — beide muessen
> erfuellt sein.

## Hard-Gate

Bevor ein Workflow **gebaut** (Build-Phase) oder gegen eine Instanz **deployt** wird,
muss `docs/PRD.md` existieren, `Status: APPROVED` tragen und **frei von
`{{`-Placeholdern** sein.

## Check-Logik

```bash
test -f docs/PRD.md || {
  echo "[prd-required] docs/PRD.md fehlt. Run /prd-generate zuerst."
  exit 1
}

# Status muss APPROVED sein
grep -qE '^[*]{0,2}Status:[*]{0,2}[[:space:]]*APPROVED' docs/PRD.md || \
grep -qE '^status:[[:space:]]*APPROVED' docs/PRD.md || {
  echo "[prd-required] docs/PRD.md ist nicht APPROVED. Review + Status auf APPROVED setzen (oder /prd-generate)."
  exit 1
}

# Keine unersetzten Template-Placeholder mehr
if grep -q '{{' docs/PRD.md; then
  echo "[prd-required] docs/PRD.md enthaelt noch {{}}-Placeholder. PRD vollstaendig ausfuellen."
  exit 1
fi
```

## Verstoss-Verhalten

- **`/deploy-workflow`, `/change-workflow` (Build-Phase):** brechen ab mit
  "Run /prd-generate first (oder PRD auf APPROVED setzen)."
- **Sub-Agents:** brechen mit Begruendung ab und schreiben in `docs/ONBOARD_LOG.md`
  einen Block "Aborted by prd-required".

## Override

`--bypass-prd` ueberspringt das Gate (analog `--bypass-security` / `--bypass-wfx-spec`),
schreibt aber einen **Audit-Log-Eintrag** in `docs/ONBOARD_LOG.md` mit Zeitstempel und
Begruendung. Nur fuer Hotfixes gedacht — Default-Bypass ist ein Anti-Pattern.

## Ausnahmen (Gate greift NICHT)

- `/onboard` (legt `docs/PRD.md` mit `Status: NOT_STARTED` an) und `/prd-generate`
  (erzeugt/verfeinert die Datei) selbst.
- Read-only-Lints: `/validate-workflow`, `/check-naming`, `/check-idempotency`,
  `/check-pagination`, `/audit-error-handling`, `/security-review-workflow`.
- Template-Lifecycle: `/template-check`, `/template-update`, `/template-migrate`,
  `/template-bugreport`.
- Bug-Fix-Phase mit `--issue <N>` an einem **bestehenden** Workflow (kein neuer Build):
  Gate greift nur fuer neu gebaute Workflows; Hotfixes an Live-Workflows laufen mit
  `--bypass-prd` + Audit-Log.

## Bezug PRD vs. WF-X-Spec

- **PRD (`docs/PRD.md`, Projekt-Ebene):** dieses Gate. Ein Dokument pro Projekt.
- **WF-X-Spec (`docs/specs/WF-*.md`, pro Workflow):** separates Gate `wf-x-spec-required`.
  Beide sind unabhaengig und beide Pflicht vor Production-Deploy.

## Im Template-Repo selbst

Im Source-Repo (`Wagner-Emden-IT-Services/n8n-project-template`) ist das Gate kosmetisch —
produktive Commands werden hier nie ausgefuehrt, `docs/PRD.md` existiert nicht (nur
`docs/PRD.template.md`). GitHub-Actions sind via Template-Guard blockiert.

## Quelle

Eingefuehrt mit n8n-project-template v1.0.0 (PRD-First-Workflow). Loest die
"ab v1.0.0"-Vermerke in CLAUDE.md Section 0, ONBOARDING.md und README ab.
