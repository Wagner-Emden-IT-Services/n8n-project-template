---
description: Holt aktuellen Workflow vor jeder Änderung über REST-API und speichert Timestamp-JSON in backups/.
allowed-tools: Read, Bash, Write
---

# /backup-before-deploy

Sichert die aktuell laufende Version eines Workflows BEVOR du ihn änderst. **IMMER vor `/deploy-workflow` oder vor manuellem Update aufrufen.**

**Argumente:**

- `<workflow-id>` — n8n-interne ID
- `[env]` — `prod` | `staging` | `dev` (default: `$N8N_ACTIVE_ENV`)

## Schritte

1. Lese `.env` für API-URL/Key der gewünschten Umgebung.
2. Bevorzugt: nutze Built-in MCP-Server (`n8n`) → `get_workflow_details(id)`. Fallback: `node scripts/n8n-cli.mjs backup --env=<env>` (sichert paginiert alle Workflows der Instanz).
3. Bei Single-Workflow-Backup landet die Datei automatisch unter `backups/<env>/pre-deploy-<YYYY-MM-DD-HHMM>/<id>.json` (vom `deploy`-Subcommand erzeugt).
4. **Worklog-Eintrag** generieren:
   - Datei: `backups/<env>/pre-deploy-<YYYY-MM-DD-HHMM>/REASON.md`
   - Inhalt: aktueller Branch, geplante Änderung (vom User abfragen!), Workflow-Name, ID, Backup-Pfad
5. **Git-Commit-Vorschlag** ausgeben (nicht selbst committen):

   ```
   [<ENV>] BACKUP: <workflow-name> vor <reason>

   Backup: backups/<env>/pre-deploy-<...>/<id>.json
   ```

## Output

- Pfad zur Backup-Datei
- Pfad zum Worklog-Eintrag
- Vorgeschlagene Commit-Message
- Reminder: erst nach Bestätigung des Users die Änderung am Workflow durchführen
