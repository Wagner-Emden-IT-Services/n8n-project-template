# WF-X: Workflow Name

> **Anleitung:** `cp spec-template.md WF-{nr}-{slug}.md`, dann ausfuellen.
> Die `<!-- ... -->`-Kommentare zeigen, wer welchen Abschnitt fuellt
> (Solo-Mode: alles selber).

**Status:** Planned | In Progress | Testing | Deployed | Failed
**Trigger:** Schedule | Webhook | Manual | Event
**Services:** [Liste der integrierten Services, z. B. Outlook, Planner, SharePoint]
**Workflow-File:** `workflows/<name>.json` <!-- nach Build vom Developer eingetragen -->

## Business-Prozess

[Klartextbeschreibung: Was wird automatisiert und warum? Geschaeftlicher Nutzen.
Kein Tech-Jargon. 3-8 Saetze.]

## Trigger

- **Typ:** [Schedule/Webhook/Manual/Event]
- **Input:** [Welche Daten kommen rein? Welches Schema?]
- **Frequenz:** [Wie oft / bei welchem Event? Bei Schedule: Cron-Expression]

## Datenfluesse

1. [Quelle] → [Aktion] → [Ziel]
2. [Quelle] → [Aktion] → [Ziel]
3. ...

## Acceptance Criteria

- [ ] Kriterium 1 (testbar! Nicht "funktioniert korrekt")
- [ ] Kriterium 2
- [ ] Kriterium 3

## Error Scenarios

- **[Szenario]:** [Erwartetes Verhalten — Retry / Skip / Notify / Halt]
- **[Szenario]:** [Erwartetes Verhalten]

---

## Technical Design

<!-- n8n-integration-architect fuellt diesen Abschnitt -->

### Node-Flow

```
[Trigger] → [Node 1] → [Node 2] → [Output]
                     ↘ [Error Trigger] → [Notification]
```

### Nodes

| # | Node-Typ | Operation | Input | Output |
|---|----------|-----------|-------|--------|
| 1 | n8n-nodes-base.scheduleTrigger | Cron | — | Trigger-Event |
| 2 | ... | ... | ... | ... |

### Auth-Strategie

- Credential: [Name] ([Typ])
- Scopes: [Liste der benoetigten Berechtigungen]
- Flow: [Authorization Code / Client Credentials / API Key]

### Error-Handling

- [Szenario]: [Strategie]

### Architektur-Entscheidungen

| Entscheidung | Begruendung |
|--------------|-------------|
| ... | ... |

---

## Security Review (Pre)

<!-- n8n-security-reviewer, nach Architektur-Phase -->

**Datum:** YYYY-MM-DD
**Status:** APPROVED | NEEDS CHANGES

### Findings

| # | Severity | Finding | Empfehlung |
|---|----------|---------|------------|
| ... | ... | ... | ... |

---

## Test Results

<!-- n8n-qa-engineer, nach Build -->

**Datum:** YYYY-MM-DD
**Status:** READY | NOT READY

### Acceptance Criteria
- [x] Kriterium 1 — Bestanden
- [ ] Kriterium 2 — Fehlgeschlagen (siehe Bug #1)

### Bugs

| # | Severity | Beschreibung | Steps to Reproduce |
|---|----------|--------------|-------------------|
| ... | ... | ... | ... |

### Error Path Tests

| Szenario | Erwartet | Tatsaechlich | Status |
|----------|----------|--------------|--------|
| ... | ... | ... | OK / FAIL |

---

## Security Review (Final)

<!-- n8n-security-reviewer, nach QA -->

**Datum:** YYYY-MM-DD
**Status:** APPROVED | NEEDS CHANGES

### Checkliste-Auszug

- [x] Credentials im Credential Store
- [x] Least Privilege Permissions
- [x] gitleaks gruen
- [ ] PII-Pruefung der Logs

### Entscheidung

[APPROVED — Workflow darf deployed werden]
[NEEDS CHANGES — siehe Findings, zurueck an n8n-workflow-developer]

---

## Deployment Record

<!-- n8n-deployment-engineer, nach Final-Review-APPROVED -->

**Datum:** YYYY-MM-DD
**Workflow ID:** [n8n ID nach Deploy]
**Environment:** staging | prod
**Status:** Active
**Deployed via:** GitHub Actions (deploy-prod.yml run #NN) | Direct MCP (Hotfix)
**Rollback-Plan:** Workflow deaktivieren via MCP, Restore aus pre-deploy-backup-artifact (90d Retention)
