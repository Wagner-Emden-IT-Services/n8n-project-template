# Onboard-Required Rule

> Diese Rule ist VERBINDLICH. Hard-Gate fuer `/deploy-workflow`,
> `/backup-before-deploy`, `/template-check`, `/template-update`,
> `/template-migrate`. Auch wirksam in den 6 Sub-Agents
> (workflow-analyst, integration-architect, workflow-developer,
> qa-engineer, security-reviewer, deployment-engineer).

## Hard-Gate

Bevor produktive Commands gegen eine n8n-Instanz laufen oder
Workflow-Files erzeugt werden, muss `.template-version.json` existieren
und ein gueltiges Schema-1.1-Dokument sein.

## Check-Logik

```bash
test -f .template-version.json || {
  echo "[onboard-required] .template-version.json fehlt."
  echo "Run /onboard zuerst (oder /template-migrate, wenn das Projekt von v0.4.0 stammt)."
  exit 1
}

# Schema-Sanity: hat customer_slug + project_slug + staging_profile gesetzt?
node -e "
  const v = require('./.template-version.json');
  const required = ['schema_version','template','version','customer_slug','project_slug','staging_profile'];
  const missing = required.filter(k => !v[k] || String(v[k]).startsWith('{{'));
  if (missing.length) {
    console.error('[onboard-required] .template-version.json unvollstaendig:', missing.join(','));
    process.exit(1);
  }
"
```

## Verstoss-Verhalten

- Slash-Commands: brechen ab mit Hinweis "Run /onboard first."
- Sub-Agents: brechen mit Begruendung ab und schreiben in ONBOARD_LOG.md einen Block "Aborted by onboard-required".

## Ausnahmen

- `/onboard` selbst (das ist der Bootstrapper)
- `/template-migrate` (legt die Datei retroaktiv an)
- `/validate-workflow`, `/check-naming`, `/check-idempotency`, `/check-pagination`, `/audit-error-handling`, `/security-review-workflow` — alles read-only-Lints, koennen ohne Stempel laufen

## Quelle

Eingefuehrt mit n8n-project-template v0.5.0 (Onboard-Wizard).
