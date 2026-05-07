# Runbook

## Neuer Workflow

1. `feature/<funktion>`-Branch von `main`
2. In Claude Code: `/check-naming` fuer gewaehlten Namen (kebab-case, kein Env-Prefix)
3. Mit Community-MCP nach passenden Nodes suchen / Template laden
4. Workflow bauen als `workflows/<funktion>.json` (env-agnostisch)
5. `config/env-mapping.yaml` um einen Eintrag erweitern (Credentials, Webhook-Suffix, Tags pro Env)
6. Lokal gegen Dev-Instanz deployen: `node scripts/n8n-cli.mjs deploy workflows/<funktion>.json --env=dev`
7. Test-Run gegen Dev-Instanz mit Pin-Daten aus `tests/pins/`
8. `/validate-workflow`, `/check-pagination`, `/check-idempotency`, `/audit-error-handling` lokal alle gruen
9. Commit, push, PR nach `staging`
10. Nach Merge: auto-deploy nach Staging mit `--auto-rollback`
11. PR `staging → main`, manuelle Approval, dann Prod-Deploy mit Pre-Deploy-Full-Backup-Artifact + `--auto-rollback`

## Bestehender Workflow aendern

1. **Backup zuerst:** `/backup-before-deploy <workflow-id>` oder `node scripts/n8n-cli.mjs backup --env=<env>`
2. Branch `feature/<funktion>-fix` von `main`
3. Bei kleineren Aenderungen: Community-MCP `n8n_update_partial_workflow` verwenden (surgical edit, schuetzt Credentials)
4. JSON in Repo aktualisieren, lokal validieren (`node scripts/n8n-cli.mjs validate <pfad>`)
5. Pre-Commit normalize-Hook erzwingt sauberen Diff automatisch
6. Commit mit `[STAGING] FIX: ...` oder `UPDATE`, PR nach `staging`
7. Nach Staging-Verifikation: PR nach `main`

## Workflow rollbacken

1. Backup-Datei aus `backups/<env>/<timestamp>/<id>.json` finden
2. Inhalt zurueck nach `workflows/<env>/<name>.json`
3. Commit `[ENV] ROLLBACK: <reason>`
4. Deploy via Standard-Pfad
5. Alternativ: Deploy-Script mit `--auto-rollback` Flag laeuft den Rollback selbst, wenn der Deploy scheitert

## Drift erkennen (Repo vs. Live-Instanz)

Automatisch: `.github/workflows/drift-check.yml` laeuft nightly und oeffnet ein Issue bei Drift.

Manuell:

```bash
node scripts/n8n-cli.mjs drift-check --env=prod --output=drift.md
# Oder Repo aus Live neu schreiben:
node scripts/n8n-cli.mjs export --env=prod --out=workflows
git diff workflows/
```

Drift sollte selten sein — wenn er auftritt, ist meist jemand direkt in der UI gelaufen. Klaeren, dann entweder Repo nachziehen oder Live-Instanz auf Repo-Stand zurueck deployen.

## Encryption Key Rotation

Detaillierter Pfad inkl. Backup-Verifikation und Rollback-Steps: **[docs/disaster-recovery.md](disaster-recovery.md)** — Praevention-Sektion + Szenario C.

Kurzfassung (NUR mit verifiziertem Backup ausfuehren):

1. Neuen Key in Vault generieren — alter Key bleibt parallel verfuegbar
2. `n8n export:credentials --all --decrypted --output=cred-old.json` (isolierte Maschine, kein Cloud-Sync)
3. Verifizieren: `cred-old.json` enthaelt erwartete Anzahl Credentials, ist parsbar
4. n8n stoppen, `N8N_ENCRYPTION_KEY` neu setzen, n8n starten
5. `n8n import:credentials --input=cred-old.json` — pro Credential testen, ob Workflow noch laeuft
6. **Erst nach Verifikation:** `cred-old.json` sicher loeschen (`shred` o. Ae.)
7. Backup-Pfad in `credentials/secrets-vault-map.yaml` aktualisieren
8. Alten Key in Vault rotieren/entfernen (frueheste 30 Tage spaeter — Rollback-Fenster)

## Incident: Workflow laeuft Amok / Endlosschleife

1. n8n UI → Executions → Running → "Stop"
2. Workflow deaktivieren via offiziellen MCP `deactivate_workflow`
3. Backup-Version restoren
4. Root-Cause analysieren bevor reaktivieren
