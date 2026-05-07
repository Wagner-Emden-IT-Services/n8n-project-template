# n8n Project Template

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](package.json)
[![gitleaks](https://img.shields.io/badge/protected%20by-gitleaks-blue)](.gitleaks.toml)
[![n8n](https://img.shields.io/badge/n8n-2.x-EA4B71)](https://n8n.io)

Wiederverwendbares Repo-Template fuer n8n-Workflow-Projekte mit Hybrid-Naming, Cross-Platform Node-CLI und Production-Grade-Pipeline. Optimiert fuer **Claude Code** als Development-Assistent. Zielgruppe: 1-3 Entwickler-Teams, die n8n-Workflows als Code in Git pflegen.

## Was drin ist

- **Eine Cross-Platform Node-CLI** (`scripts/n8n-cli.mjs`) fuer Deploy / Backup / Export / Validate / Normalize / Drift-Check — kein Bash/PowerShell-Asymmetrie-Risiko mehr
- **Hybrid-Naming**: ein Workflow-File pro Funktion in `workflows/`, Env-Differenzen ueber `config/env-mapping.yaml` (kein 3x-Duplizieren mehr)
- **Workflow-Normalize** stripped volatile Felder (`versionId`, `position`, `instanceId`) — saubere PR-Diffs
- **Drift-Detection** als nightly GitHub-Action — oeffnet Issue bei Repo↔Live-Drift
- **gitleaks** Secret-Scanning im Pre-Commit + CI (n8n-spezifische Custom-Rules)
- **Disaster-Recovery-Runbook** (`docs/disaster-recovery.md`) mit 4 Szenarien + Drill-Checklist
- Pre-built **Claude-Code Slash-Commands** fuer n8n (Validation, Backup, Deploy, Idempotenz, Pagination, Error-Handling)
- `.mcp.json` fuer **beide n8n-MCP-Server** (offiziell + Community parallel)
- GitHub Actions: Validate-on-PR, Deploy-Staging, Deploy-Prod, Drift-Check
- Pre-Commit + Pre-Push-Hooks
- Beispiel-Workflow `hello-world` zum Testen aller Slash-Commands

## Schnellstart

```bash
# 1. Repo klonen / Template forken
git clone <dein-repo>.git mein-n8n-projekt
cd mein-n8n-projekt
# Falls als ZIP heruntergeladen statt geklont:
#   git init && git add . && git commit -m "initial"

# 2. Env-Datei aus Vorlage
cp .env.example .env
# Werte ausfuellen — mindestens N8N_ACTIVE_* (Default: dev/localhost:5678)
# WICHTIG: N8N_ACTIVE_MCP_URL aus n8n-UI kopieren (Settings -> Instance-level MCP)

# 3. Env-Mapping aus Vorlage
cp config/env-mapping.yaml.example config/env-mapping.yaml
# Pro Workflow Credentials/Webhook-Suffix/Tags pro Env eintragen

# 4. Node-Dependencies installieren
npm install

# 5. gitleaks installieren (Secret-Scan)
# Windows:  winget install gitleaks
# macOS:    brew install gitleaks
# Linux:    siehe https://github.com/gitleaks/gitleaks#installing

# 6. Pre-Commit-Hook installieren
# Linux/macOS/Git-Bash:
cp hooks/pre-commit .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
cp hooks/pre-push   .git/hooks/pre-push   && chmod +x .git/hooks/pre-push

# Windows (PowerShell): Hooks brauchen Bash-Runtime — Git for Windows liefert sie mit
Copy-Item hooks\pre-commit .git\hooks\pre-commit
Copy-Item hooks\pre-push   .git\hooks\pre-push

# 7. Smoke-Test
node scripts/n8n-cli.mjs --help
node scripts/n8n-cli.mjs validate workflows

# 8. Branch-Protection aktivieren (Pflicht — ohne ist der PR-Pfad nur Konvention)
# Vorab: Initial-Commit pushen, damit die Branches existieren.
# Wegen verschachteltem Body: per JSON-File und gh api --input.

# --- Linux / macOS / Git-Bash ---
cat > /tmp/main-protection.json <<'JSON'
{
  "required_status_checks": { "strict": true, "contexts": ["validate"] },
  "enforce_admins": true,
  "required_pull_request_reviews": { "required_approving_review_count": 1 },
  "restrictions": null
}
JSON
gh api -X PUT repos/:owner/:repo/branches/main/protection --input /tmp/main-protection.json

cat > /tmp/staging-protection.json <<'JSON'
{
  "required_status_checks": { "strict": true, "contexts": ["validate"] },
  "enforce_admins": false,
  "required_pull_request_reviews": { "required_approving_review_count": 1 },
  "restrictions": null
}
JSON
gh api -X PUT repos/:owner/:repo/branches/staging/protection --input /tmp/staging-protection.json

# Plus GitHub Environment "production" mit Required Reviewers (Settings -> Environments)

# 9. Claude Code im Projekt-Root starten
claude
```

**Windows (PowerShell)** — gleiche Branch-Protection ohne Heredocs:

```powershell
$mainProtection = @'
{
  "required_status_checks": { "strict": true, "contexts": ["validate"] },
  "enforce_admins": true,
  "required_pull_request_reviews": { "required_approving_review_count": 1 },
  "restrictions": null
}
'@
$mainProtection | gh api -X PUT repos/:owner/:repo/branches/main/protection --input -

$stagingProtection = @'
{
  "required_status_checks": { "strict": true, "contexts": ["validate"] },
  "enforce_admins": false,
  "required_pull_request_reviews": { "required_approving_review_count": 1 },
  "restrictions": null
}
'@
$stagingProtection | gh api -X PUT repos/:owner/:repo/branches/staging/protection --input -
```

## Node-CLI Cheatsheet

```bash
# Workflow deployen (mit Env-Mapping + Pre-Deploy-Backup + verifiziertem Auto-Rollback)
node scripts/n8n-cli.mjs deploy workflows/exchange-sync.json --env=staging --auto-rollback

# Vollbackup einer Instanz (Cursor-paginiert — keine silent-loss-Bugs)
node scripts/n8n-cli.mjs backup --env=prod

# Live-Instanz nach workflows/ exportieren (normalized)
node scripts/n8n-cli.mjs export --env=dev

# Schema-Validation (offline, ohne n8n)
node scripts/n8n-cli.mjs validate workflows

# Volatile Felder strippen, deterministische Diffs
node scripts/n8n-cli.mjs normalize workflows
node scripts/n8n-cli.mjs normalize workflows --check   # exit 1 bei Diff

# Drift Repo vs Live
node scripts/n8n-cli.mjs drift-check --env=prod --output=drift.md
```

## Hybrid-Naming

Ein File pro Funktion, env-agnostisch, in `workflows/`:

```
workflows/
├── exchange-sync.json         # Source-of-Truth fuer alle Envs
├── invoice-export.json
└── shared/
    └── error-handler.json
```

Env-Differenzen kommen aus `config/env-mapping.yaml`:

```yaml
exchange-sync:
  staging:
    credentials:
      slackApi: { id: 'def456', name: 'slack-api-staging' }
    webhook_path_suffix: '-staging'
    tags: [staging]
  prod:
    credentials:
      slackApi: { id: 'ghi789', name: 'slack-api-prod' }
    tags: [prod]
```

`deploy --env=staging` wendet das Mapping VOR dem PUT auf den Workflow an. Source bleibt env-agnostisch — keine 3x-Duplizierung mehr.

> **Backward-Compat:** Die `workflows/dev/`, `workflows/staging/`, `workflows/prod/`-Verzeichnisse existieren weiter (mit `.gitkeep`). Bestehende Workflows lassen sich schrittweise nach `workflows/` flachziehen.

## MCP-Server-Strategie

Zwei MCP-Server parallel in `.mcp.json`:

1. **Offiziell** (`n8n-mcp-official`) — built-in seit n8n 2.x — Deploy, Execute, Test, Activate. **N8N_ACTIVE_MCP_URL** MUSS der vollstaendige Endpoint aus der n8n-UI sein (nicht raten).
2. **Community czlonkowski** (`n8n-mcp-community`) — Composition, Validation, surgical Partial-Updates, AutoFix, Node-Doku, Templates.

Vor jedem Env-Wechsel: `.env` aktualisieren, **Claude Code neu starten**.

## Branch-Strategie (zwei-stufig)

```
main (prod, protected)
  ▲
  │ PR + manual approval (GitHub Environment "production")
  │
staging (protected, auto-deploy zu staging-instanz)
  ▲
  │ PR + Status-Check "validate"
  │
feature/* (lokal — Dev-Deploy via `node scripts/n8n-cli.mjs deploy <file> --env=dev`)
```

Kein `develop`-Branch. Dev-Instanz wird lokal von der Maschine aus gefuettert.

## Verfuegbare Slash-Commands

| Command                 | Zweck                                                           |
| ----------------------- | --------------------------------------------------------------- |
| `/validate-workflow`    | Schema-Check, Knoten-Verbindungen, Credential-Refs              |
| `/check-naming`         | Naming-Convention, generische Knotennamen                       |
| `/backup-before-deploy` | REST-API-Backup                                                 |
| `/deploy-workflow`      | Deploy mit Sanitize + Env-Mapping + verifiziertem Auto-Rollback |
| `/check-idempotency`    | INSERT/POST-Idempotenz                                          |
| `/check-pagination`     | `.all()`, Done-Output-Trap, Cursor-Logik                        |
| `/audit-error-handling` | Error-Workflow + Retry-Settings                                 |

## Voraussetzungen

- n8n 2.x mit aktiviertem Instance-level MCP (Settings → MCP)
- Claude Code (CLI)
- **Node.js 20+** (fuer `scripts/n8n-cli.mjs`)
- **gitleaks** (fuer Secret-Scan im Pre-Commit + CI)
- Docker (fuer Community-MCP-Server, optional)
- `gh` CLI (fuer Branch-Protection-Setup)
- Bash-Runtime (Git for Windows / WSL unter Windows) — fuer Hooks

## Disaster Recovery

Siehe **[docs/disaster-recovery.md](docs/disaster-recovery.md)** — Praevention + 4 Szenarien (Workflow-Korruption, Instanz-Verlust, Encryption-Key-Verlust, Repo-Korruption) + Drill-Checklist.

**Pflicht-Lektion:** Encryption-Key in 3 Locations. Ohne Key sind alle gespeicherten Credentials wertlos.

## Beitragen

Issues und PRs sind willkommen — siehe [CONTRIBUTING.md](CONTRIBUTING.md). Fuer Sicherheits-Themen bitte den Pfad in [SECURITY.md](SECURITY.md) nutzen.

## Lizenz

MIT — siehe [LICENSE](LICENSE).

---

Maintained by **Wagner-Emden IT Services**. Built with [Claude Code](https://claude.com/claude-code).
