# Workflow-Specs (WF-X System)

## ABGRENZUNG: Workflow-Specs vs. Bugs (verbindlich seit n8n-template v0.6.0)

**WF-X-Specs dokumentieren WORKFLOWS, NICHT Bugs.**

| Was | Wohin |
|---|---|
| Neuer Workflow | `docs/specs/WF-X-*.md` Spec |
| Workflow-Aenderung (Scope-Erweiterung) | bestehende WF-X-Spec ergaenzen |
| **Bug** (Funktionsfehler, Workflow-Failure, falsche Daten) | **GitHub-Issue** im Project-Repo (Label `bug` oder `workflow-bug`) |
| QA-Failure aus `/qa-workflow` | **GitHub-Issue** (Label `workflow-bug, source:ai-qa`, Auto-File durch /qa-workflow) |
| Template-Bug (Skill/Hook/Command in `.n8n-template/` etc.) | **GitHub-Issue im n8n-project-template Source-Repo** via `/template-bugreport` |

**Verbotene Anti-Patterns** in WF-X-Specs:
- Sektion "Known Bugs", "Bekannte Fehler", "Open Issues"
- Bullet-Liste "TODO: Fix X", "BUG: Y funktioniert nicht"

Wenn ein Workflow einen offenen Bug hat, gehoert das so dokumentiert:
- Sektion "QA Test Results" mit FAIL-Marker + `See #N` (Issue-Link)
- Sektion "Implementation Notes" mit `Bug-Fix: #N (PR #M, <datum>, Branch fix/issue-N-...)` als Cross-Reference

Bei Migration v0.5.0 → v0.6.0: `/template-update` scant automatisch nach diesen Anti-Pattern-Sektionen und schlaegt Issue-Migration vor (Schritt 1b-v06).

---

## Was sind Workflow-Specs?

Workflow-Specs sind das Pendant zu Feature-Specs in klassischer Software-
Entwicklung. **Eine Spec beschreibt einen automatisierten Workflow** — von der
Anforderung bis zum Deployment. Sie dient als Single Source of Truth fuer alles,
was zum Workflow gehoert: Anforderung, Architektur, Tests, Security-Review,
Deployment-Record.

Specs sind **optional**. Fuer Hello-World-Workflows oder triviale Anpassungen
nicht noetig. Pflicht bei:
- Workflows mit ≥ 3 Nodes
- Workflows mit Webhook-Trigger oder Schedule
- Workflows die externe Services schreiben (Mail senden, Tasks anlegen, ...)
- Workflows mit Credentials, die nicht trivial sind
- Allem was im Multi-Agent-Mode (siehe `.claude/agents/`) entwickelt wird

## Namenskonvention

```
docs/specs/WF-{nummer}-{kebab-case-name}.md
```

Beispiele:
- `docs/specs/WF-1-daily-report-email.md`
- `docs/specs/WF-2-webhook-order-processing.md`
- `docs/specs/WF-3-sharepoint-document-approval.md`

Nummern werden fortlaufend vergeben, nicht recycled. Beim Anlegen einer neuen
Spec: `ls docs/specs/ | grep -E 'WF-[0-9]+' | sort -V | tail -1` zeigt die hoechste
vergebene Nummer.

## Spec-Lifecycle

```
Planned → In Progress → Testing → Deployed
                ↓
          Failed → zurueck zu In Progress
```

| Status | Bedeutung |
|--------|-----------|
| Planned | Spec geschrieben, noch nicht implementiert |
| In Progress | Workflow wird gebaut |
| Testing | QA-Phase laeuft |
| Deployed | Workflow aktiv auf n8n-Instanz |
| Failed | Test oder Security Review fehlgeschlagen |

## Wer schreibt was?

Bei Multi-Agent-Mode (`.claude/agents/`):

| Abschnitt | Agent | Phase |
|-----------|-------|-------|
| Business-Prozess, Trigger, Datenfluesse, Acceptance Criteria, Error Scenarios | `n8n-workflow-analyst` | 1 |
| Technical Design | `n8n-integration-architect` | 2 |
| Security Review (Pre) | `n8n-security-reviewer` | 3 |
| (Build des Workflows) | `n8n-workflow-developer` | 4 |
| Test Results | `n8n-qa-engineer` | 5 |
| Security Review (Final) | `n8n-security-reviewer` | 6 |
| Deployment Record | `n8n-deployment-engineer` | 7 |

Solo-Mode: Du fuellst die Sections selbst aus, in der gleichen Reihenfolge.

## Best Practices

- **Ein Workflow = Eine Spec.** Keine Multi-Workflow-Specs.
- **Acceptance Criteria muessen testbar sein.** "Funktioniert korrekt" ist kein Kriterium.
- **Error Scenarios sind Pflicht.** Jeder Workflow kann fehlschlagen.
- **Status immer aktuell halten.** Jeder Schritt aktualisiert den Status.
- **Spec lebt im Repo, nicht im Wiki.** PR-Reviews greifen auf die Spec zu.
- **Spec bleibt nach Deployment.** Reference fuer spaetere Aenderungen, Audit-Trail.

## Template

Siehe `docs/specs/spec-template.md` — Kopier-Vorlage zum Anlegen neuer Specs.

## Verhaeltnis zu n8n-Workflow-JSON

- Spec lebt unter `docs/specs/WF-X-*.md` (versioniert, PR-reviewed)
- Workflow-JSON lebt unter `workflows/<name>.json` (versioniert, normalized)
- Beide referenzieren sich gegenseitig — Spec im Header verlinkt das JSON, JSON-
  Workflow-Description verweist auf die Spec-ID.
