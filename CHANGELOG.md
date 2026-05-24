# Changelog

Format folgt [Keep a Changelog](https://keepachangelog.com/de/1.1.0/), Versionierung nach [Semantic Versioning](https://semver.org/lang/de/).

## 2026-05-24 — v0.6.1 (CI-Hotfix + Test-Haerten + CLI-Reference)

Behebt zwei CI-Bugs in v0.6.0 die jeden PR in Konsumenten-Projekten blockierten. Plus praeventive CLI-Doku, damit sich der Fehler-Typ nicht wiederholt.

### Fixed

- **`normalize-check.yml` + `validate-workflows.yml`** riefen die CLI mit `--in`/`--out` Flags auf, die `scripts/n8n-cli.mjs` nicht kennt (positional `<target>` + `--check`). Jeder PR in v0.6.0-Konsumenten-Projekten failte mit `error: unknown option '--in'`. **Fix #22** (HIGH): File-Loops ersetzt durch direkten Verzeichnis-Call — `node scripts/n8n-cli.mjs normalize workflows --check` bzw. `validate workflows`. Entdeckt im Konsumenten-Repo `monatliche-azure-abrechnung` PR #1.
- **`tests/unit/normalize.test.mjs` Test A** war implizit von der `fixture()`-Default-Form abhaengig (musste `customField:'keep'` enthalten, sonst kollidierten Test A und Test B). **Fix #23** (MEDIUM): Test A schreibt jetzt seine eigene `meta`-Fixture mit `customField:'keep'` explizit, statt auf den Shared-Default zu vertrauen. Test ist damit selbstisolierend, kann nicht durch Aenderungen an `fixture()` brechen.

### Added

- **`docs/cli-reference.md`** — Single Source of Truth fuer alle `scripts/n8n-cli.mjs`-Sub-Commands mit Signaturen (deploy/backup/export/validate/normalize/drift-check). Cross-Check-Empfehlung fuer PRs die CI-Workflows aendern. **Fix #24** (LOW, praeventiv).
- **`package.json` version** auf `0.6.1` synchronisiert (war seit v0.4.0 nicht mit-bumped).

### Why

- Issue #22 hat alle Konsumenten-Projekte beim CI-Check gebrochen, Severity HIGH — kann nicht auf v0.7.0 warten.
- Issue #23 hatte im Source-Repo selbst keinen sichtbaren Effekt (Tag v0.6.0 hatte bereits `customField:'keep'`), aber das Konsumenten-Projekt scheint einen aelteren Zwischenstand der Test-Datei zu haben. Test-Haertung verhindert kuenftige Drift.
- Issue #24 verhindert die Wiederholung von #22: jede CI-Workflow-Aenderung muss gegen `docs/cli-reference.md` gepruefft werden.

### Out-of-Scope (geplant fuer v0.7.0)

- Lint-Skript `npm run cli:doc-check` (statische Verifikation Workflow-YAML <-> CLI-Reference)
- Auto-Generation der CLI-Reference aus `commander --help`

Konsumenten-Projekte sollten v0.6.1 via `/template-update` ziehen.


## 2026-05-18 — v0.6.0 (Big-Bang: Update-Mechanik + /change-workflow + GitHub-Issues + GSD-Style Help)

Hash-Manifest-Update-System portiert aus golden-dev v1.7.0 mit n8n-Adaptionen. `/change-workflow` als Hybrid (Pipeline-Default + Issue-Mode + Multi-Workflow-Batch). `/qa-workflow` mit Severity-Heuristik + Auto-File P0/P1. GitHub-Issue-Integration als first-class Bug-Tracker. `/help-workflow` (Template-Erklaerer) + `/next-recommend` (GSD-Style "Was als naechstes?") + `docs/STATE.md` (Living-State, GSD-Pattern). Pre-Commit-Hook fuer Workflow-Normalisierung (Hard-Gate `normalize-on-commit`).

### Added

- **`.n8n-template/`-Verzeichnis** (analog `.golden-dev/` aus golden-dev v1.7.0):
  - `manifest.json` (Hash-Manifest, SHA-256 + 4-Tier-Schutz, 106 Files erfasst)
  - `protection-rules.json` (77 Glob-Regeln, n8n-Pfade inkl. `workflows/`, `docs/specs/`, `config/staging-profiles/`)
  - `Generate-Manifest.ps1` (1:1 portiert; TODO v0.6.1: Workflow-JSON-Normalize-Hook vor Hash)
  - `Compute-Update-Plan.ps1` (1:1 portiert, 3-Wege-Diff BASE/LOCAL/REMOTE)
  - `Apply-Update.ps1` (1:1 portiert, Backup-Strategie `.bak.<ts>`)
  - `Deploy-Labels.ps1` (1:1 + n8n-Labels `workflow-bug`, `n8n-version-issue`)
  - `Scan-Workflow-Bugs-In-Project.ps1` (n8n-adaptiert: scant `docs/specs/WF-*.md`)
  - `README.md` (Doku der Update-Mechanik)
- **4 Slash-Commands** unter `.claude/commands/`: `template-check.md`, `template-update.md`, `template-migrate.md`, `template-bugreport.md`
- **`/change-workflow`-Command** (NEU, n8n-spezifisch): Hybrid Pipeline + Issue-Mode, 6 Sub-Agents + 8 Skills je Phase auto-geladen, Multi-Workflow-Batch via TeamCreate (max 2-3 parallel mit Credentials-Konflikt-Detection), Hard-Gate-Checks vor Deploy
- **`/qa-workflow` Skill** (NEU): Severity-Heuristik P0-P3, Auto-File via `gh issue create --template 02-workflow-bug.yml`, User-Choice P2/P3
- **`/help-workflow`-Command** (NEU): Template-Erklaerer kontextabhaengig — Standard-Cheatsheet + Modi `--command`, `--phase`, `--skill`, `--concept`, `--first-steps`
- **`/next-recommend`-Command** (NEU, GSD-Style, inspiriert von https://github.com/gsd-build/get-shit-done): 10-stufige Priorisierungs-Heuristik, empfiehlt eine konkrete Aktion mit Begruendung
- **`docs/STATE.md`** (NEU, USER-GENERATED): Living-State mit Position, Workflow-Pipeline, Open Loops, Last Session Summary
- **Pre-Commit-Hook** `.git-hooks/pre-commit`: normalisiert `workflows/*.json` vor jedem Commit
- **4 ISSUE_TEMPLATEs**: `01-bug.yml`, `02-workflow-bug.yml`, `03-template-bug.yml`, `config.yml`
- **2 CI-Workflows neu**: `validate-workflows.yml` (n8n-Schema-Validierung), `normalize-check.yml` (Pre-Merge-Check). Plus portierte `issue-triage.yml`, `pr-issue-link-check.yml`
- **`.claude/rules/general.md`** (NEU): Stack-agnostische Konventionen, Bug-Tracking-Konvention v0.6.0, Hard-Gates-Uebersicht
- **`UPDATING.md`** (NEU): Template-Lebenszyklus (Install, Update, Migrate, Marker-Konvention, Konflikt-Aufloesung)

### Changed

- **`.template-version.json`** Schema 1.1 → 1.2 (neue Felder `installed_via`, `manifest_path`, `last_update_at`, `last_update_from_version`); version 0.5.0 → 0.6.0
- **`CLAUDE.md`**: Zwei MARKER-Bloecke ergaenzt (`bug-tracking`, `n8n-pipeline`). Bestehender Inhalt unangetastet.
- **`docs/specs/README.md`**: Sektion "ABGRENZUNG: Workflow-Specs vs. Bugs" am Anfang ergaenzt.

### Bug-Tracking-Konvention (HARD-RULE seit v0.6.0)

Bugs werden AUSSCHLIESSLICH als GitHub-Issues im Project-Repo gepflegt. Keine Bug-Sektionen in WF-X-Specs, keine TODO-Listen in docs/. Specs dokumentieren Workflows; Bugs sind Issues.

### Migration v0.5.x → v0.6.0

`/template-update` ist self-bootstrapping:
1. Erkennt Schema 1.1 → Auto-Upgrade auf 1.2.
2. NEUER Schritt 1b-v06: scant Legacy-Bug-Pflegestellen, User-Choice, `gh issue create`, `(See #N)`-Cross-References.
3. Normaler 3-Wege-Diff zieht die ~30 neuen Files als CREATE-Aktionen.

### Bewusst NICHT in v0.6.0 (kommt in v0.6.1 / v1.0.0)

- **`/onboard` Phase 5.7.5b/5.7.5c/5.7.5d** (Hart-Pflicht, Labels-Deploy, Bug-Tracking-Banner) — `/onboard` ist gross + komplex, gezielter Refactor in v0.6.1
- **`/onboard` Phase 7.8** (STATE.md-Init) — manuell anlegen reicht (Template kommt mit STATE.md-Placeholder)
- **Workflow-JSON-Normalize-Hook im Generate-Manifest.ps1** — aktuell wird JSON roh gehasht; kommt in v0.6.1
- **PRD-Generator `/prd-generate`** + Hard-Gate `prd-required` — v1.0.0

### Verifikation

- Generate-Manifest.ps1: 106 Files erfasst (31 FROZEN, 14 UPDATABLE-WITH-DIFF, 1 MARKER-AWARE, 60 USER-GENERATED, 45 SKIPPED — letztere sind nicht-template-verwaltete Repo-Files wie package.json, node_modules etc.)
- Compute-Update-Plan.ps1 Self-Test: 46 NO-OP + 60 KEEP-LOCAL = 106 Total, 0 Drift
- PowerShell-Syntax-Check fuer alle 5 Skripte: OK

## 2026-05-16 — v0.5.0 (Onboard-Wizard)

### Added

- **`/onboard` Slash-Command** — 8-Phasen-Wizard, der ein frisch via "Use this template" geklontes Projekt in einen produktionsfaehigen Zustand bringt. Project Identity, Staging-Auswahl, GitHub-Integration, n8n-Hosting, Credentials, Optionen, Erzeugung, PRD-Pflicht. Jede Phase mit Bestaetigungs-Gate; Phase 6 zeigt vollstaendigen Plan vor jeder Datei-Aenderung. Re-run-sicher, idempotent, mit Backup-bei-Konflikt.
- **`.template-version.json` Schema 1.1** — Stempel pro Projekt-Instanz mit `customer_slug`, `project_slug`, `staging_profile`, `hosting`, `options.*`. Voraussetzung fuer `/template-check` und `/template-update` ab v0.6.0.
- **Staging-Profile** unter `config/staging-profiles/{none,simple,full}.yaml` — drei vordefinierte env-mapping-Varianten:
  - `none`: Single-Env (nur Prod)
  - `simple`: `feature/* -> main`, Dev (lokal) + Prod
  - `full`: `feature/* -> staging -> main`, Dev + Staging + Prod (bisheriger Default)
- **Workflow-Template** `.github/workflow-templates/deploy-simple.yml` — Variante fuer Profil "simple" (Trigger direkt auf `main`, kein staging-Layer).
- **`docs/PRD.template.md`** — Pflicht-PRD-Skeleton mit 12 Sektionen (n8n-erweitert um Workflow-Inventur, Deployment-Strategie, DR-Bezug). Status: NOT_STARTED bis User-Approval.
- **`docs/ONBOARDING.md`** und **`docs/ONBOARD_LOG.md`** — User-Doku des Wizards + append-only Audit-Trail des Onboarding-Verlaufs.
- **`.claude/rules/onboard-required.md`** — Hard-Gate: `/deploy-workflow`, `/backup-before-deploy` und 6 Sub-Agents brechen ab, wenn `.template-version.json` fehlt oder Placeholder enthaelt. Ausnahmen: read-only-Lints und `/onboard` / `/template-migrate` selbst.
- **`.claude/rules/template-version-pinning.md`** — definiert drei Datei-Klassen (Protected / Always-Overwrite / Diff-Check) als Vorbereitung fuer den Update-Mechanismus in v0.6.0.
- **`.github/secrets-required.md`** — Liste der manuell zu setzenden GitHub-Repo-Secrets, vom Wizard pro Service ergaenzt.
- **`config/secrets-vault-map.json.example`** — Mapping-Doku Service -> Vault-Slot (ohne Werte).

### Changed

- **`.env.example`** — Hinweis ergaenzt, dass die Datei normalerweise vom `/onboard`-Wizard gepflegt wird.
- **`config/env-mapping.yaml.example`** — Hinweis ergaenzt, dass die Datei vom Wizard aus dem gewaehlten Staging-Profil generiert wird. Naming-Konvention `{Service} - {Environment}` dokumentiert.
- **`.gitignore`** — `.claude/customer.json` (DSGVO: Kontaktdaten lokal-only) und `.template-backup/` (fuer den Update-Mechanismus ab v0.6.0) ergaenzt.

### Notes

- **Stub-Pattern bleibt:** Source-Repo ist `Wagner-Emden-IT-Services/n8n-project-template`. Im cc-ecosystem-MPC-Manager existiert nur `TEMPLATE.md` + `.git-source.json` als Stub.
- **Update-Mechanismus (`/template-check`, `/template-update`, `/template-migrate`)** kommt in v0.6.0.
- **PRD-Generator (`/prd-generate`)** und Hard-Gate `prd-required` kommen in v1.0.0 — bis dahin manuell ueber `docs/PRD.template.md`.
- **Best-Practice-Quellen (Perplexity Deep-Research, Mai 2026):** 3-Tier-Staging als Default empfohlen; Branch-pro-Env mit n8n Source Control ist die Marktempfehlung, aber Source Control braucht n8n Business-Lizenz (~667 EUR/mo) — Workaround via JSON-Repo-Pattern bleibt fuer Community-Edition-User die pragmatische Wahl.

## 2026-05-11 — v0.4.0 (Community-MCP: docker → npx)

### Changed

- **`.mcp.json`** Community-MCP-Server (`n8n-mcp`, czlonkowski) auf `npx n8n-mcp@latest` umgestellt (vorher `ghcr.io/czlonkowski/n8n-mcp:latest` via Docker stdio). Vorteile: schnellerer Start ohne Container-Overhead, keine Docker-Dependency mehr, Node-only Setup reicht. ENV-Vars (`MCP_MODE`, `LOG_LEVEL`, `N8N_API_URL`, `N8N_API_KEY`) bleiben strukturell unveraendert.
- **`.github/dependabot.yml`** Docker-Kommentar aktualisiert — verweist nun auf npx-Pfad. npx-Aufrufe sind nicht in `package.json` und damit Dependabot-untrackbar (bewusste Wahl: Komfort > Reproduzierbarkeit). Bei Bedarf konkret pinnen: `n8n-mcp@2.51.1`.

### Unchanged

- **Offizieller MCP-Server (`n8n`)** bleibt unveraendert: HTTP-Type, Bearer-Auth-Header, `${N8N_ACTIVE_MCP_URL}`/`${N8N_ACTIVE_MCP_TOKEN}` Env-Vars fuer Portabilitaet im Template (nicht hardcoded).
- **Naming-Konvention** weiterhin `n8n` = offiziell (Instance-level), `n8n-mcp` = Community (czlonkowski-Repo-Name). Saemtliche Sub-Agents, Slash-Commands und Skills im Template referenzieren diese Naming-Convention.

### Voraussetzungen-Aenderung

- **Docker nicht mehr noetig** fuer den Community-MCP-Server. Node ≥ 20 reicht (war ohnehin Pflicht fuer die n8n-CLI).

## 2026-05-08 — v0.3.0 (MAWS-Merge)

### Added

- **6 n8n Sub-Agents** unter `.claude/agents/` — `n8n-workflow-analyst`, `n8n-integration-architect`, `n8n-workflow-developer`, `n8n-qa-engineer`, `n8n-security-reviewer`, `n8n-deployment-engineer`. Aktivieren eine optionale Multi-Agent-Pipeline (Spec→Architektur→Pre-Security→Build→Test→Final-Security→Deploy) mit Gates zwischen den Phasen. Nutzen die existierenden lokalen Skills unter `.claude/skills/` und beide MCP-Server (offiziell + Community).
- **WF-X Spec-System** unter `docs/specs/` — `README.md` (Lifecycle, Konventionen, Wer-schreibt-was) + `spec-template.md` (Kopier-Vorlage mit allen Phasen-Sections). Optional fuer triviale Workflows, empfohlen ab 3+ Nodes oder Webhook/Schedule.
- **M365-Pattern-Library** unter `docs/integrations/m365/` — 5 Files: `README.md`, `auth-patterns.md` (OAuth-Flows, Scopes), `service-patterns.md` (Teams/SP/Outlook/OneDrive/Excel/Planner), `error-handling.md` (Rate-Limits, Pagination, Delta-Queries, Webhook-Renewal), `architectures.md` (5 Reference-Architekturen). Opt-in fuer M365-Workflows, von `n8n-integration-architect` automatisch geladen wenn relevant.
- **`/security-review-workflow` Slash-Command** unter `.claude/commands/` — Audit eines Workflow-JSONs gegen Credentials / Permissions / Webhook / Rate-Limits / Logging-Hygiene / Repo-Hygiene. Komplementaer zur `n8n-security-reviewer` Sub-Agent-Rolle: schnellerer ad-hoc-Check ohne Pipeline-Setup.
- **README-Section "Optional: Multi-Agent-Pipeline"** verweist auf die neuen Komponenten.

### Source

Merge aus `template-own-n8n-workflow-starter` (cc-ecosystem), das nach diesem Merge dort archiviert wurde (`status: archived`, `superseded_by: template-own-n8n-project`). Sub-Agent-Frontmatter wurde auf Anthropic-Spec konvertiert (name/description/tools/model). Skill-Pfade zeigen jetzt auf `.claude/skills/`. WORKFLOW_CONTEXT.md-Verweise wurden durch `docs/specs/spec-template.md` ersetzt.

## [Unreleased] — OSS-Release-Ready

### Changed (latest)

- **`.mcp.json` Image-Tag auf `:latest`** umgestellt (von `:2.51.1`). Bewusste Wahl: Komfort > Reproduzierbarkeit. Bei Breaking Change upstream kann der Tag wieder auf eine konkrete Version gepinnt werden — der `_comment`-Eintrag in `.mcp.json` dokumentiert das.
- **`dependabot.yml` Docker-Block entfernt** — ohne Pin nichts zu tracken.

### Changed (Template-Repo-Hardening)

- **Job-Level `if`-Guard** auf `deploy-prod.yml`, `deploy-staging.yml` und `drift-check.yml`: `if: github.repository != 'Wagner-Emden-IT-Services/n8n-project-template'`. Im Template-Repo selbst laufen die Deploy-/Drift-Jobs nicht mehr (keine echte n8n-Instanz dahinter). Beim Use-Template/Fork aendert sich `github.repository` automatisch — Jobs werden in Konsumenten-Repos sofort aktiv.
- **GitHub Repository Template-Toggle aktiviert** (`is_template: true`). "Use this template"-Button erscheint auf der Repo-Seite.
- **gitleaks-Action durch direkten CLI-Aufruf ersetzt** in `validate-on-pr.yml`. `gitleaks-action@v2` verlangt seit Mid-2024 eine bezahlte Lizenz fuer Org-Repos; das CLI (MIT) deckt die Funktionalitaet kostenlos ab.
- **Commit-Convention auf [Conventional Commits](https://www.conventionalcommits.org)** umgestellt fuer das Template-Repo. `[ENV] [ACTION]:` bleibt als optionale Variante in geforkten Workflow-Repos dokumentiert (Audit-Trail wer, wann, welches Env). `CLAUDE.md` §10, `CONTRIBUTING.md` und `pull_request_template.md` angepasst.
- **README** um "Template benutzen"-Section erweitert: Use-Template-Pfad, automatische Guard-Aktivierung im neuen Repo, einmalige Anpassungen nach Use (LICENSE, config.yml, Secrets, Branch-Protection).

### Changed (post-initial-push)

- **MCP-Server-Keys umbenannt** auf Original-Naming: `n8n-mcp-official` → `n8n` (Built-in seit n8n 2.x), `n8n-mcp-community` → `n8n-mcp` (entspricht dem [czlonkowski/n8n-mcp](https://github.com/czlonkowski/n8n-mcp)-Repo-Namen). Aktualisiert in `.mcp.json`, `README.md`, `CLAUDE.md`, `docs/architecture.md` und betroffenen Slash-Commands.
- **`.mcp.json` Settings nach Repo-Empfehlung** des czlonkowski-MCP: `MCP_MODE=stdio` und `LOG_LEVEL=info` als ENV-Vars statt Docker-Args. Image-Pin bleibt `:2.51.1`.
- **`.env.example` mit Default-MCP-URL-Pattern** dokumentiert (`<base>/mcp-server/http`) — vorher musste der User den vollstaendigen Endpoint aus der UI raten/kopieren.
- **README** mit Pflicht-Hinweis zur `.env`-Anlage vor erstem Claude-Code-Start (ohne `.env` startet kein MCP-Server).

### Added

- **OSS-Pflichtfiles** fuer GitHub-Public-Release: `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1, deutsch), `SECURITY.md` (private Disclosure-Pfad), `.github/ISSUE_TEMPLATE/{bug-report,feature-request,config}.yml`, `.github/pull_request_template.md`, `.github/dependabot.yml` (npm + github-actions + docker, gruppiert).
- **Test-Suite** mit Vitest + nock: 41 Tests in 5 Files. Units fuer `sanitize.mjs` / `env-mapper.mjs` / `normalize.mjs` / `validate.mjs`. Integration-Tests fuer `api.mjs` mit Cursor-Pagination-Regression (Schutz gegen `.first()`-Bug aus v0.2.0), Auto-Rollback-Fehlerpfad (HTTP 4xx/5xx liefert `Error.status` und `Error.body`) und CRUD-URL-Konventionen.
- **Prettier-Setup** (Prettier-only, kein ESLint): `.editorconfig`, `.prettierrc.json`, `.prettierignore` (Workflow-JSONs gehoeren dem Normalize-Step, `.claude/skills/` sind Drittanbieter und bleiben unangetastet), `npm run format` und `npm run format:check`.
- **Error-Handler-Beispiel** `workflows/shared/error-handler.json` als Pflicht-Pattern-Demo (Error-Trigger → Set → Code-Stub).
- **README**: Shields.io-Badges (License, Node, gitleaks, n8n), PowerShell-Variante fuer Branch-Protection-Setup mit `gh api --input -`, Maintainer-Footer.
- **CI**: `npm test` als zusaetzlicher Step in `validate-on-pr.yml` vor Schema-Validation.

### Changed

- **`workflows/hello-world.json`** referenziert jetzt `shared-error-handler` als `settings.errorWorkflow` — Beispiel-Workflow respektiert die eigene Pflicht-Regel aus `CLAUDE.md` §6.
- **`.mcp.json`** Docker-Image-Pin: `ghcr.io/czlonkowski/n8n-mcp:2.51.1` statt `:latest`. Dependabot-`docker`-Block haelt das aktuell.
- **`scripts/lib/env-mapper.mjs`** Comment klargestellt: Tags werden nicht via Mapping gesetzt (n8n liefert tags read-only zurueck). Pro-Env-Tags manuell oder via separater `/tags`-API.
- **`config/env-mapping.yaml.example`**: Tags-Feld entfernt (war halb implementiert). Beispiele bleiben mit Credentials + `webhook_path_suffix`.
- **`LICENSE`**: Platzhalter ersetzt durch `Copyright (c) 2026 Wagner-Emden IT Services`.
- **Code-Baseline** durch Prettier formatiert: alle JS/MJS/YAML/MD-Files (ausser `.claude/skills/` und `CHANGELOG.md` per `.prettierignore`).

### Removed

- **`config/environments.yaml`** geloescht — toter Code, in keiner CLI-Pfad geladen. `health_monitor_minutes`-Felder widersprachen dem CHANGELOG-Eintrag aus v0.2.0 ("Health-Monitoring-Versprechen entfernt").

### Fixed

- Test-Suite verewigt den Pagination-Bug aus v0.2.0 als Regression-Test (`tests/integration/api.test.mjs` `listAllWorkflows` mit zwei Pages und `nextCursor`).

## 2026-05-07 — Senior-Grade Refactor (v0.2.0)

### Breaking Changes

- **Bash + PowerShell-Scripts entfernt.** Alle 8 `scripts/*.sh` und `scripts/*.ps1` durch eine Cross-Platform Node-CLI (`scripts/n8n-cli.mjs`) ersetzt. Subcommands: `deploy`, `backup`, `export`, `validate`, `normalize`, `drift-check`. Pinned Dependencies in `package.json` + `package-lock.json` fuer Reproduzierbarkeit.
- **Hybrid-Naming-Convention.** Workflow-Files leben jetzt env-agnostisch in `workflows/<funktion>.json` (kebab-case, ohne Env-Prefix). Env-Differenzen (Credentials, Webhook-Suffixe, Tags) kommen aus `config/env-mapping.yaml`. Schema-Pattern fuer `name` von `^(prod|staging|dev|shared)-...$` auf `^[a-z][a-z0-9-]*$` gelockert. Alte `workflows/<env>/`-Verzeichnisse bleiben fuer Backward-Compat.
- **Beispiel-Workflow umbenannt:** `workflows/dev/dev-hello-world.json` → `workflows/hello-world.json`, `tests/pins/dev-hello-world.json` → `tests/pins/hello-world.json`.

### Bug-Fixes (aus Audit)

- **Pagination-Bug behoben.** `scripts/lib/api.mjs` `listAllWorkflows()` macht zentrale Cursor-Pagination. Kein silent-loss mehr bei >100 Workflows. Loest gleichzeitig den Bug in den entfernten `backup-workflows.sh` und `export-from-n8n.sh`.
- **Auto-Rollback verifiziert HTTP-Status.** Neuer Rollback-Pfad in `n8n-cli.mjs deploy --auto-rollback`: Rollback-PUT wird auf 2xx geprueft; bei eigenem Fehler exit 2 mit klarem Hinweis statt silent fail.
- **MCP-URL ist jetzt explizit.** `.mcp.json` nutzt `${N8N_ACTIVE_MCP_URL}` (vollstaendiger Endpoint aus n8n-UI). Kein geratener `/mcp-server/http`-Pfad mehr.
- **`.env`-Loading robust.** dotenv ersetzt fragiles Regex-Parsen — Werte mit `=` (z.B. Base64-Padding in API-Keys) funktionieren jetzt.

### Neue Senior-Features

- **Workflow-Normalize-Script** (`n8n-cli.mjs normalize`): strippt volatile Felder (`versionId`, `position`, `instanceId`, `updatedAt`, `triggerCount`, `pinData`, `isArchived`), sortiert Nodes deterministisch, sortiert Object-Keys. Pre-Commit-Hook schreibt zurueck und re-stagt automatisch — saubere PR-Diffs ohne Canvas-Noise.
- **Drift-Detection** (`.github/workflows/drift-check.yml`): nightly Cron-Job vergleicht Repo↔Live, oeffnet bei Drift Issue mit Label `drift`. Auch manuell triggerbar via `workflow_dispatch`.
- **gitleaks** als Pre-Commit-Hook + CI-Step. Custom-Rules in `.gitleaks.toml` fuer n8n-Patterns: Encryption-Key, API-Key, Slack-Webhooks, Bearer-Tokens, JWTs.
- **Disaster-Recovery-Runbook** (`docs/disaster-recovery.md`): Praevention + 4 Szenarien (Workflow-Korruption, VPS-Verlust, Encryption-Key-Verlust, Repo-Korruption) + RTO/RPO-Vorlage + quartalsweise Drill-Checklist.
- **Sanitize-Fields-Doku** (`docs/sanitize-fields.md`): versionierte Liste der read-only Felder, die beim Deploy gestrippt werden, plus "wann erweitern"-Anleitung.

### Doku-Cleanup

- **Health-Monitoring-Versprechen entfernt** aus `architecture.md`, `runbook.md`, `CLAUDE.md` — war in den Actions nirgendwo implementiert. Dokumentations-Theater raus.
- **Encryption-Key-Rotation** in `runbook.md` zeigt jetzt auf `disaster-recovery.md` fuer Detail-Pfad mit Backup-Verifikation und Rollback-Fenster.
- **README-Schnellstart** auf Node-CLI umgestellt; gitleaks-Installation dokumentiert; `gh api branch protection` via `--input` (statt fragiles `-f`-Nesting).

## 2026-05-07 — Template-Umbau (Audit-Fixes)

- `scripts/deploy-workflow.sh`: Rewrite — `jq`-Sanitize von read-only Feldern (id, versionId, createdAt, updatedAt, triggerCount, pinData, meta, shared, isArchived), client-seitiger Name-Lookup mit Cursor-Pagination, optionaler `--auto-rollback` Flag, HTTP-Status-Check
- PowerShell-Varianten der Scripts: `scripts/deploy-workflow.ps1`, `backup-workflows.ps1`, `export-from-n8n.ps1`, `validate-workflows.ps1` — Spiegel der Bash-Scripts mit `Invoke-RestMethod`
- `.mcp.json`: Routing ueber `N8N_ACTIVE_BASE_URL`/`N8N_ACTIVE_API_*`/`N8N_ACTIVE_MCP_TOKEN` statt hartem Prod-Pin. Beide MCP-Server folgen jetzt dem aktiven Environment, Default `dev`
- `.env.example`: ACTIVE-Block oben, Variable-in-Variable (`N8N_API_URL=${N8N_DEV_API_URL}`) entfernt — Community-MCP-Container bekommt seine Werte direkt aus `.mcp.json`
- Branch-Strategie zwei-stufig (`feature/* → staging → main`) — `develop` entfernt aus `architecture.md`, `runbook.md`, `environments.yaml`, `CLAUDE.md`, `README.md`, `validate-on-pr.yml`. `deploy-dev.yml` geloescht
- Branch-Protection als Pflicht-Setup im README-Schnellstart dokumentiert (mit `gh api`-Befehlen) und in `architecture.md` hinterlegt
- `schemas/workflow-schema.json`: `errorWorkflow` als `oneOf [string, object]`, generische Node-Namen via `pattern` (faengt jetzt auch `If 1`, `Code (alt)` etc.)
- `validate-on-pr.yml`: Idempotency-Heuristik auf Warning-only umgestellt (`continue-on-error: true`, kein Hard-Fail mehr — false-positive-anfaellig)
- `.claude/settings.json`: `enabledPlugins` entfernt — Skills nur noch projekt-lokal in `.claude/skills/`. `_README.md` aktualisiert mit Auto-Trigger-Doku
- `workflows/dev/dev-hello-world.json` + `tests/pins/dev-hello-world.json` als Beispiel-Workflow zum Testen aller Slash-Commands
- `.claude/commands/deploy-workflow.md` an tatsaechliches Script-Verhalten angeglichen (`--auto-rollback` Flag, manueller Rollback-Pfad)
- `README.md` + `CLAUDE.md`: Versions-Pinning auf `n8n 2.x mit Instance-level MCP` (vorher: `2.18.4`). Branch-Modell vereinheitlicht
- `hooks/pre-push`: false-security-Logik (Push-auf-main-nur-von-staging) entfernt — gehoert in GitHub Branch-Protection. Nur noch Validation

## 2026-05-07 — Konsistenz-Fixes

- Naming-Regex in `validate-on-pr.yml` an Schema und Pre-Commit-Hook angeglichen (`^(env)-[a-z0-9-]+$`, single-segment funktion erlaubt)
- `.mcp.json` ohne bash-Parameterexpansion — neue Env-Var `N8N_PROD_BASE_URL` (Instanz-URL ohne `/api/v1`)
- `deploy-dev.yml` ergänzt — auto-deploy von `develop` nach Dev-Instanz, passt zu `architecture.md` und `environments.yaml`
- `tests/pins/` als Verzeichnis angelegt — wird von `/deploy-workflow` für Pin-Daten erwartet
- README: `git init`-Fallback, Windows-Hook-Setup (PowerShell-Variante), Bash-Runtime in Voraussetzungen

## 2026-05-07 — Initial Template

- Folder-Struktur: workflows pro Environment + shared Sub-Workflows
- CLAUDE.md mit Hard-Earned Lessons aus n8n-Praxisprojekten
- 7 Slash-Commands: validate-workflow, check-naming, backup-before-deploy, deploy-workflow, check-idempotency, check-pagination, audit-error-handling
- `.mcp.json` mit beiden n8n-MCP-Servern (offiziell + Community parallel)
- GitHub Actions: Validate-on-PR, Deploy-Staging (auto), Deploy-Prod (manual approval)
- Pre-Commit + Pre-Push-Hooks
- Karpathy Coding Guidelines in CLAUDE.md eingebettet
- Operating-Mode-Section für n8n-MCP (Silent, Parallel, Templates First, Never Trust Defaults, Multi-Level-Validation, Template-Attribution)
- 7 n8n-Skills aus czlonkowski/n8n-skills projekt-lokal in `.claude/skills/`
