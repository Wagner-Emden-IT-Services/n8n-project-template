# Required GitHub Repo-Secrets

> Liste der Secrets, die im neuen Customer-Repo unter
> **Settings -> Secrets and variables -> Actions** gesetzt werden muessen,
> bevor die CI-Workflows arbeiten koennen. Wird vom `/onboard`-Wizard nach
> Phase 4 generiert / ergaenzt — diese Datei ist initial leer und wird mit
> jedem `/onboard`-Lauf um die in Phase 0.6 + Phase 4 ermittelten Services
> erweitert.

## Basis (immer noetig)

Abhaengig vom gewaehlten Staging-Profil:

| Profil | N8N_PROD_API_URL | N8N_PROD_API_KEY | N8N_STAGING_API_URL | N8N_STAGING_API_KEY |
|--------|------------------|------------------|---------------------|---------------------|
| none   | -                | -                | -                   | -                   |
| simple | erforderlich     | erforderlich     | -                   | -                   |
| full   | erforderlich     | erforderlich     | erforderlich        | erforderlich        |
| custom | je nach Env-Liste| je nach Env-Liste| je nach Env-Liste   | je nach Env-Liste   |

## Optional (nur bei aktiver Funktion)

- `SLACK_WEBHOOK_URL` — wenn Slack-Notifications in `deploy-staging.yml` / `deploy-prod.yml` aktiv

## Service-spezifische Secrets

> Wird vom /onboard-Wizard Phase 4 pro gewaehltem Service angehaengt.

_(noch keine Services konfiguriert — Wizard ergaenzt nach Phase 0.6 / 4)_

## Pflege

- Wenn ein neuer Service nach dem Onboard zur Workflow-Landschaft hinzukommt:
  - Manuell in dieser Liste ergaenzen
  - Secret in GitHub anlegen
  - Vault-Slot in `config/secrets-vault-map.json` eintragen
  - Service-Block in `.env.example` ergaenzen
- `gitleaks` blockt das Committen von Werten — die Secrets gehoeren AUSSCHLIESSLICH in `.env` (lokal) oder in GitHub Secrets (CI).

## GitHub Environment "production"

Bei Staging-Profil **simple** oder **full** zusaetzlich:

- GitHub Environment `production` anlegen (Settings -> Environments)
- Required Reviewers konfigurieren (1+ Reviewer)
- Optional: Deployment-Branch-Rule auf `main`
- Environment-Secrets `N8N_PROD_API_URL` / `N8N_PROD_API_KEY` zusaetzlich dort hinterlegen (ueberschreibt Repo-Secrets fuer Production-Deploys)

Das Environment-Gate ist die manuelle Approval-Schicht zwischen Merge-zu-main
und tatsaechlichem Deploy gegen die Prod-Instanz. Pflicht fuer alle echten
Customer-Setups.
