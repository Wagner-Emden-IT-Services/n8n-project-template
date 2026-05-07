# Contributing

Vielen Dank fuer dein Interesse, zu diesem Template beizutragen. Es richtet sich an kleine Teams (1-3 Entwickler), die n8n-Workflows als Code in Git pflegen wollen. PRs und Issues sind willkommen.

## Bevor du startest

- Bitte erst ein **Issue** oeffnen, wenn du eine groessere Aenderung planst (neues Feature, Refactoring, Breaking Change). Bug-Fixes und kleinere Doku-Verbesserungen koennen direkt als PR kommen.
- Lies [CLAUDE.md](CLAUDE.md) — dort stehen die Architektur-Entscheidungen, die das Template traegt (Hybrid-Naming, MCP-Strategie, Hard-Earned Lessons).
- Halte dich an den [Code of Conduct](CODE_OF_CONDUCT.md).

## Setup

```bash
git clone <fork-url>
cd n8n-project-template
npm install

# Pre-Commit-Hook installieren (Linux/macOS/Git-Bash)
cp hooks/pre-commit .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
cp hooks/pre-push   .git/hooks/pre-push   && chmod +x .git/hooks/pre-push
```

Auf Windows: siehe README-Schnellstart fuer die PowerShell-Variante.

## Lokal testen

Vor jedem Commit lokal gruen bekommen:

```bash
npm test                  # Vitest-Suite (Units + HTTP-Mock)
npm run validate          # Schema + Naming-Check fuer workflows/
npm run normalize -- workflows --check   # deterministische Diffs
npm run format:check      # Prettier-Konformitaet
```

Optional, aber empfohlen:

```bash
gitleaks detect --source . --config .gitleaks.toml   # Secret-Scan
```

## Branch-Flow

```
feature/<funktion>  →  staging  →  main
```

- **`feature/*`** — von `main` abzweigen, lokal gegen Dev-n8n testen.
- **`staging`** — PR-Ziel fuer Reviews. Auto-Deploy nach Staging-Instanz nach Merge.
- **`main`** — produktionsreif. Manuelle Approval ueber GitHub Environment `production` erforderlich.

Direkter Push auf `main` oder `staging` ist durch Branch-Protection gesperrt — bitte nicht versuchen, das zu umgehen.

## Commit-Messages

Format aus [CLAUDE.md §10](CLAUDE.md):

```
[ENV] [ACTION]: kurze Beschreibung

- Detail 1
- Detail 2
```

`ACTION` = `DEPLOY` | `UPDATE` | `FIX` | `REFACTOR` | `BACKUP` | `EXPERIMENT`

Beispiele:

- `[STAGING] FIX: Pagination-Bug in exchange-sync (.first → .all)`
- `[REPO] REFACTOR: env-mapper Tags-Comment klarstellen`

## Workflow-PRs

Wenn dein PR `workflows/**/*.json` aendert:

1. **Validation lokal gruen?** `npm run validate`
2. **Normalize lief?** Pre-Commit-Hook macht das automatisch — falls du den Hook nicht installiert hast: `npm run normalize -- workflows`. Sonst zerschiesst die CI deinen Diff.
3. **Beispiel-Workflows muessen die eigenen Regeln einhalten** — Error-Workflow referenziert (`settings.errorWorkflow`), keine generischen Knotennamen (`If 1`, `Code 2` sind verboten — das Schema lehnt sie ab).
4. **Pin-Daten fuer Tests** unter `tests/pins/<workflow-name>.json` mitliefern, wenn der Workflow nicht-trivial ist.

## Keine Secrets im Repo

- `.env`, `credentials/*.json` (ausser `.example`-Files), Backups → nicht committen. `.gitignore` und `.gitleaks.toml` sind so konfiguriert, dass Pre-Commit das blockt.
- API-Keys, Encryption-Keys, Slack-Webhooks: NIEMALS in Doku, Tests oder Beispielen. Selbst in `*.example`-Files keine echten Werte — nur Platzhalter.
- Wenn du versehentlich ein Secret committet hast: **sofort rotieren** (alter Key ist kompromittiert), dann via `git filter-repo` aus der History entfernen. Details in [docs/disaster-recovery.md](docs/disaster-recovery.md).

## CHANGELOG

Aenderungen mit User-sichtbarem Effekt (neue Features, Breaking Changes, Bug-Fixes) gehoeren in `CHANGELOG.md` unter `## [Unreleased]`. Format folgt [Keep a Changelog](https://keepachangelog.com/de/1.1.0/).

## Fragen?

Issue oeffnen, oder direkt an den Maintainer: [SECURITY.md](SECURITY.md) hat den Email-Kontakt fuer security-relevantes, fuer alles andere reicht ein Issue.
