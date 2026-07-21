# Onboard Log

> Append-only Audit-Trail des `/onboard`-Wizard-Laufs. Wird vom Wizard
> Phase fuer Phase befuellt. Wenn dieser Log leer ist: `/onboard` wurde
> noch nicht ausgefuehrt. Kontaktdaten (Name/E-Mail/Telefon) gehoeren
> **nicht** hierher, sondern ausschliesslich nach `.claude/customer.json`.

## Phase 0 — Project Identity

_(wird vom Wizard befuellt)_

- Zeitpunkt:
- Projekt-Typ: customer | internal
- Customer-Slug:
- Project-Slug:
- Kurzbeschreibung:
- Verantwortliche(r): _(Name + Rolle, ohne Kontaktdaten — die liegen in .claude/customer.json)_
- Zielsysteme/APIs:

## Phase 1 — Staging-Auswahl

_(wird vom Wizard befuellt)_

- Gewaehltes Profil: none | simple | full | custom
- Branches:
- Instanzen:
- CI-Workflows aktiv:

## Phase 2 — GitHub-Integration

_(wird vom Wizard befuellt)_

- gh-CLI vorhanden: ja | nein
- Repo-Sichtbarkeit: private | public
- Branch-Strategie:
- Branch-Protection: aktiv | uebersprungen (Begruendung)
- PR-/Issue-Templates ausgerollt: ja | nein
- CODEOWNERS: ja | nein

## Phase 3 — n8n-Hosting / Instanz

_(wird vom Wizard befuellt)_

- Hosting-Variante: n8n-cloud | self-hosted-docker | self-hosted-k8s | desktop
- Pro Env Base-URL gesetzt: dev | staging | prod
- Smoke-Test: passed | failed | skipped
- docker-compose.dev.yml: ja | nein
- Worker-Mode: ja | nein

## Phase 4 — Credentials / Secrets

_(wird vom Wizard befuellt)_

- Secret-Strategie:
- Services mit Credential-Plan:
- secrets-vault-map.json befuellt: ja | nein
- gitleaks-Rules aktiv: ja | nein
- context7-Lookups durchgefuehrt fuer Services: _(Liste, wenn context7 verfuegbar war)_

## Phase 5 — Optionen

_(wird vom Wizard befuellt)_

- hello-world installiert: ja | nein
- Multi-Agent-Pipeline aktiv: ja | nein
- M365-Pattern-Library: behalten | entfernt
- Nightly Backup + Drift-Check: ja | nein
- Health-Check-Workflow: ja | nein
- Logging-Level: minimal | standard | verbose

## Phase 6 — Erzeugung + Bootstrap

_(wird vom Wizard befuellt)_

- Files geschrieben:
- npm install: ok | failed
- git init / gh repo create: ok | skipped
- Initial-Commit-SHA:
- Push: ok | skipped
- Branch-Protection-API: ok | failed (Begruendung)

## Phase 7 — PRD-Schritt

_(wird vom Wizard befuellt)_

- PRD-Status: NOT_STARTED | DRAFT | APPROVED
- `/prd-generate` ausgefuehrt: ja | nein
- Reminder gesetzt: ja | nein

## Nacharbeiten

_(manuelle TODOs aus den Phasen, sortiert nach Prioritaet)_

- [ ]
