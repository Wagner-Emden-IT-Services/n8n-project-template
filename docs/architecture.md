# Architektur

## Repo-as-Code-Modell

Workflows leben als JSON in Git. n8n-Instanzen sind nur Runtime — die Wahrheit liegt im Repo.

```
Repo (Git)  ──[CI/CD]──▶  n8n-Instanz (Runtime)
   ▲                              │
   │                              │
   └──[node scripts/n8n-cli.mjs export]────┘
        (Notfall: Drift erkennen, oder
         scheduled: drift-check.yml nightly)
```

Drift wird zusaetzlich durch eine nightly GitHub-Action erkannt — bei Drift wird automatisch ein Issue mit Label `drift` geoeffnet.

## Branch-Strategie

```
main (prod, protected)
  ▲
  │ PR + manual approval
  │
staging (auto-deploy zu staging-instanz)
  ▲
  │ PR
  │
feature/* (lokal — Dev-Deploy via ./scripts/deploy-workflow.sh <file> dev)
```

Zwei-stufig: kein `develop`-Branch, keine eigene Dev-CI. Dev-Instanz wird lokal von der Maschine gefuettert (`node scripts/n8n-cli.mjs deploy <file> --env=dev`). Erst der PR von `feature/*` nach `staging` triggert die erste CI-getriebene Pipeline.

## Branch-Protection — Pflicht-Setup

Ohne Branch-Protection ist der ganze PR-Pfad nur Konvention, nicht erzwungen. Direkt nach dem Klonen aktivieren:

```bash
# main: 1 Reviewer + Required Status Check
gh api -X PUT repos/:owner/:repo/branches/main/protection \
  -f required_pull_request_reviews.required_approving_review_count=1 \
  -F enforce_admins=true \
  -f required_status_checks.strict=true \
  -f 'required_status_checks.contexts[]=validate' \
  -F restrictions=null

# staging: 1 Reviewer (oder 0, wenn Solo-Dev), Required Status Check
gh api -X PUT repos/:owner/:repo/branches/staging/protection \
  -f required_pull_request_reviews.required_approving_review_count=1 \
  -F enforce_admins=false \
  -f required_status_checks.strict=true \
  -f 'required_status_checks.contexts[]=validate' \
  -F restrictions=null
```

Required Status Check `validate` = der Job-Name aus `.github/workflows/validate-on-pr.yml`.

Zusaetzlich GitHub Environment `production` mit Required Reviewers konfigurieren (Settings → Environments) — das erzwingt manuelle Approval beim Prod-Deploy zusaetzlich zur Branch-Protection.

## Deployment-Pfad

1. Entwicklung gegen `dev`-Instanz auf `feature/*`-Branch — Workflows lokal via `node scripts/n8n-cli.mjs deploy <file> --env=dev` testen
2. PR nach `staging` → CI-Validate (Schema + Normalize + gitleaks), nach Merge auto-deploy nach Staging mit `--auto-rollback`
3. PR nach `main` → manuelle Approval (GitHub Environment), Pre-Deploy-Full-Backup als Artifact, dann Deploy nach Prod mit `--auto-rollback`
4. Drift-Detection laeuft nightly (`drift-check.yml`) und oeffnet bei Drift automatisch ein Issue

## MCP-Server-Setup

Zwei MCP-Server in `.mcp.json`:

| Server              | Transport      | Wann                                                          |
| ------------------- | -------------- | ------------------------------------------------------------- |
| `n8n-mcp-official`  | HTTP           | Live-Operationen: Deploy, Execute, Test, Activate             |
| `n8n-mcp-community` | stdio (Docker) | Composition: Validation, Surgical Updates, AutoFix, Node-Doku |

Beide laufen parallel und ergaenzen sich. Beide routen auf das in `.env` aktive Environment via `N8N_ACTIVE_*`-Variablen — Default `dev`. Nach jedem Wechsel: Claude Code neu starten.

## Secret-Handling

- n8n Encryption Key: in **3 Locations** (Primary-Vault, Secondary-Vault, Off-Site-Backup) — siehe [docs/disaster-recovery.md](disaster-recovery.md). Ohne Key sind alle gespeicherten Credentials wertlos.
- Credential-Werte: External Secrets Feature von n8n nutzen wo moeglich
- API-Keys fuer CI/CD: GitHub Secrets pro Environment
- Lokale Dev: `.env` (gitignored)
- Pre-Commit + CI: gitleaks-Scan mit n8n-spezifischen Custom-Rules (`.gitleaks.toml`)

## Disaster Recovery

Pflicht-Lektuere: [docs/disaster-recovery.md](disaster-recovery.md) — 4 Szenarien, RTO/RPO-Targets, quartalsweiser Recovery-Drill.
