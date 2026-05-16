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
- Pre-built **Claude-Code Slash-Commands** fuer n8n (Validation, Backup, Deploy, Idempotenz, Pagination, Error-Handling, **Security-Review**)
- `.mcp.json` fuer **beide n8n-MCP-Server** (offiziell + Community parallel)
- GitHub Actions: Validate-on-PR, Deploy-Staging, Deploy-Prod, Drift-Check
- Pre-Commit + Pre-Push-Hooks
- Beispiel-Workflow `hello-world` zum Testen aller Slash-Commands

### Optional: Multi-Agent-Pipeline (seit v0.3.0)

- **6 Sub-Agents** unter `.claude/agents/` — analyst, architect, developer, qa, security-reviewer, deployment-engineer. Aktivierbar fuer Greenfield-Workflows mit Spec→Build→Test→Deploy-Gates.
- **WF-X Spec-System** unter `docs/specs/` — Workflow-Specs als versioniertes Markdown mit Lifecycle-Tracking. Optional, empfohlen ab 3+ Nodes oder Webhook/Schedule-Trigger.
- **M365-Pattern-Library** unter `docs/integrations/m365/` — Auth-Flows, Service-Patterns (Teams/SP/Outlook/OneDrive/Excel/Planner), Error-Handling (Rate-Limits/Pagination/Delta), 5 Reference-Architekturen. Opt-in fuer Microsoft-365-Workflows.

## Schnellstart (ab v0.5.0 — empfohlener Pfad)

1. **Repo via Template anlegen** — auf der Template-Repo-Seite oben rechts **"Use this template" → "Create a new repository"** klicken. GitHub legt einen frischen Repo unter deiner Org an.
2. **Lokal klonen** — `git clone https://github.com/<dein-account>/<dein-repo>.git mein-n8n-projekt && cd mein-n8n-projekt`
3. **Claude Code starten** — `claude`
4. **`/onboard` aufrufen** — der 8-Phasen-Wizard fuehrt durch Project-Identity, Staging-Auswahl (none/simple/full/custom), GitHub-Integration, n8n-Hosting, Credentials, Optionen, Erzeugung und PRD-Skeleton. Details: [docs/ONBOARDING.md](docs/ONBOARDING.md).
5. **PRD ausfuellen** — `docs/PRD.md` befuellen, Status auf `APPROVED` setzen (ab v1.0.0 via `/prd-generate`).
6. **Workflow bauen + deployen** — `/validate-workflow`, dann `/deploy-workflow workflows/<name>.json --env=<env>`.

> Voraussetzungen: Node.js 20+, `gh` CLI authentifiziert (fuer GitHub-Schritte), gitleaks (Pre-Commit-Hook).

### Manueller Setup (Fallback ohne `/onboard`)

Wer den Wizard nicht nutzen will (z.B. Probelauf, Air-gapped), kann das Setup auch klassisch nach folgenden Schritten machen:

#### 1. Eigenes Repo aus Template anlegen

**Empfohlener Pfad:** Auf der Template-Repo-Seite oben rechts **"Use this template" → "Create a new repository"** klicken. GitHub legt dir ein frisches Repo unter deinem Account/deiner Org an, mit eigener Git-Historie und ohne Verbindung zum Template. Anschliessend dein neues Repo lokal klonen:

```bash
git clone https://github.com/<dein-account>/<dein-repo>.git mein-n8n-projekt
cd mein-n8n-projekt
```

**Alternative (nur fuer Probelaeufe):** klassisches `git clone` direkt vom Template-Repo. Dabei zeigt `origin` aber auf das Template — vor dem ersten Push den Remote umbiegen.

```bash
# Falls als ZIP heruntergeladen statt geklont:
#   git init && git add . && git commit -m "initial"
```

#### 2. Setup-Schritte

```bash
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
```

> **Windows-Hinweis:** Nach `winget install` musst du die aktuelle Shell schliessen und neu oeffnen, sonst findet der Pre-Commit-Hook `gitleaks` nicht im PATH. Verifizieren mit `gitleaks version` in einer frischen Shell.

```bash
# 6. Pre-Commit-Hook installieren
# Linux/macOS/Git-Bash:
cp hooks/pre-commit .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
cp hooks/pre-push   .git/hooks/pre-push   && chmod +x .git/hooks/pre-push

# Windows (PowerShell): Hooks brauchen Bash-Runtime — Git for Windows liefert sie mit
Copy-Item hooks\pre-commit .git\hooks\pre-commit
Copy-Item hooks\pre-push   .git\hooks\pre-push

# 7. Smoke-Test (alle drei sollten gruen sein)
node scripts/n8n-cli.mjs --help              # CLI laedt
node scripts/n8n-cli.mjs validate workflows  # 2 Workflows valide
npm test                                     # 41 Unit + Integration Tests gruen

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

1. **`n8n`** — Built-in MCP-Server seit n8n 2.x ("Instance-level MCP"). Deploy, Execute, Test, Activate. Default-Endpoint `<base>/mcp-server/http`, Token aus `Settings → Instance-level MCP → Connection details → Access Token`.
2. **`n8n-mcp`** — [czlonkowski/n8n-mcp](https://github.com/czlonkowski/n8n-mcp) (MIT). Composition, Validation, surgical Partial-Updates (`n8n_update_partial_workflow`), AutoFix, Node-Doku, 2.700+ Templates. Laeuft als Docker-Container im stdio-Mode mit Tag `:latest` — immer aktuell, dafuer keine Reproduzierbarkeit. Bei Breaking Change upstream kann auf konkrete Version gepinnt werden.

> **Pflicht-Setup:** Ohne `.env` (mindestens `N8N_ACTIVE_MCP_URL` + `N8N_ACTIVE_MCP_TOKEN` + `N8N_ACTIVE_API_URL` + `N8N_ACTIVE_API_KEY`) startet keiner der beiden MCP-Server. **Vor erstem Claude-Code-Start:** `cp .env.example .env`, Werte fuellen.

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

## Template benutzen (in deinem Projekt)

Dieses Repo ist als **GitHub Repository Template** markiert. Auf der Repo-Seite oben rechts auf **"Use this template" → "Create a new repository"** klicken — GitHub legt dir einen frischen Git-Verlauf in deinem Account/deiner Org an. Alternativ klassisch klonen oder forken.

**Was nach dem Use-Template automatisch passiert:**

- Die Deploy- und Drift-Check-Workflows (`deploy-prod.yml`, `deploy-staging.yml`, `drift-check.yml`) tragen einen Repo-Guard `if: github.repository != 'Wagner-Emden-IT-Services/n8n-project-template'`. In deinem neuen Repo aendert sich `github.repository` automatisch — die Workflows werden aktiv.
- `validate-on-pr.yml` (Tests + Schema-Validation + gitleaks) laeuft sofort und ohne Secrets — auch im Template selbst, damit Code-Bugs gefangen werden.

**Was du nach dem Use-Template einmalig anpassen musst:**

1. `LICENSE` Copyright-Halter ggf. anpassen (steht aktuell auf Wagner-Emden IT Services).
2. `.github/ISSUE_TEMPLATE/config.yml` — `Wagner-Emden-IT-Services/n8n-project-template` durch deinen Org/Repo-Pfad ersetzen.
3. `cp .env.example .env` und Werte ausfuellen (mind. `N8N_ACTIVE_*`).
4. `cp config/env-mapping.yaml.example config/env-mapping.yaml` und Credentials/Suffixe pro Workflow eintragen.
5. **GitHub Secrets** anlegen fuer CI: `N8N_PROD_API_URL`, `N8N_PROD_API_KEY`, `N8N_STAGING_API_URL`, `N8N_STAGING_API_KEY`, optional `SLACK_WEBHOOK_URL`. Settings → Secrets and variables → Actions.
6. Branch-Protection + GitHub Environment `production` aktivieren (Block Section 8 oben).

## Beitragen

Issues und PRs sind willkommen — siehe [CONTRIBUTING.md](CONTRIBUTING.md). Wir nutzen [Conventional Commits](https://www.conventionalcommits.org) (`feat:`, `fix:`, `docs:`, ...). Fuer Sicherheits-Themen bitte den Pfad in [SECURITY.md](SECURITY.md) nutzen.

## Lizenz

MIT — siehe [LICENSE](LICENSE).

---

Maintained by **Wagner-Emden IT Services**. Built with [Claude Code](https://claude.com/claude-code).
