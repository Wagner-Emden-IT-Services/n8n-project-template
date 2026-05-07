---
description: Deployt einen Workflow gegen die Ziel-Instanz via offiziellen MCP oder Node-CLI. Mit Sanitize, Pre-Deploy-Backup, optionalem Auto-Rollback inkl. Verifikation.
allowed-tools: Read, Bash, Edit
---

# /deploy-workflow

Deployt eine lokale Workflow-JSON gegen die gewuenschte n8n-Instanz.

**Argumente:**

- `<pfad>` — Pfad zur Workflow-JSON (z. B. `workflows/exchange-sync.json`)
- `[env]` — `prod` | `staging` | `dev` (default: `N8N_ACTIVE_ENV` aus `.env`)
- `[--auto-rollback]` — bei HTTP-Fehler im PUT automatisch Backup zurueckspielen UND Rollback-Status verifizieren

## Vorbedingungen (Pflicht-Checks)

Bevor du irgendetwas deployst:

1. **Validation gruen?** `/validate-workflow <pfad>` aufrufen. Bei Fehlern: STOPP.
2. **Idempotency-Check?** `/check-idempotency <pfad>` aufrufen.
3. **Pagination-Check?** `/check-pagination <pfad>` aufrufen.
4. **Error-Handling?** `/audit-error-handling <pfad>`.
5. **Naming-Convention?** `/check-naming <pfad>`.

Wenn IRGENDEIN Check rot ist: STOPP, User informieren, **nicht** deployen.

## Deploy-Schritte

1. **Bevorzugt offiziellen MCP-Server nutzen:**
   - Workflow vorhanden? → `update_workflow(id, code)`
   - Neu? → `create_workflow(code)`
2. **Fallback Node-CLI:**

   ```bash
   node scripts/n8n-cli.mjs deploy <pfad> --env=<env> [--auto-rollback]
   ```

   - Sanitiziert read-only Felder (Liste in `docs/sanitize-fields.md`)
   - Wendet `config/env-mapping.yaml` auf den Workflow an (Credentials, Webhook-Suffix, Tags)
   - Pre-Deploy-Backup unter `backups/<env>/pre-deploy-<ts>/<id>.json`
   - Cursor-paginierter Name-Lookup (n8n-API hat kein Server-Filter `?name=`)

3. **Test-Run:** `test_workflow(id)` mit Pin-Daten aus `tests/pins/<workflow-name>.json` falls vorhanden.

## Rollback

- **Auto-Rollback (Node-CLI):** `--auto-rollback` Flag. Bei nicht-2xx PUT spielt das Script das Pre-Deploy-Backup zurueck **und** verifiziert den Rollback-PUT (kein silent fail mehr).
- **Manueller Rollback:**
  ```bash
  cp backups/<env>/pre-deploy-<ts>/<id>.json workflows/<name>.json
  node scripts/n8n-cli.mjs deploy workflows/<name>.json --env=<env>
  ```

## Aktivierung

Workflow NICHT automatisch aktivieren. User muss explizit `activate_workflow` triggern (z. B. `/activate-workflow <id>` oder UI).

## Output

- Status pro Schritt (OK/✗)
- Workflow-ID nach Deploy
- Bei Fehler: Response-Body + Rollback-Status (wenn `--auto-rollback`) oder manuelle Rollback-Anleitung
