# Security Policy

Vielen Dank, dass du Sicherheitsprobleme verantwortungsvoll meldest.

## Scope

Dieses Repo ist ein **Template** — es hat keine eigene Runtime und verarbeitet keine Userdaten. Sicherheitsrelevant sind:

- **CLI-Code** (`scripts/n8n-cli.mjs` + `scripts/lib/`) — Deploy-Pfad, Auto-Rollback, Backup-Schreiben
- **gitleaks-Custom-Rules** (`.gitleaks.toml`) — falscher Regex koennte Secret-Lecks durchlassen
- **GitHub-Actions-Workflows** (`.github/workflows/`) — Secret-Handling im CI
- **Pre-Commit-/Pre-Push-Hooks** (`hooks/`) — Bypass-Pfade

Schwachstellen in **n8n selbst** gehen nicht hierher, sondern an n8n.io: <https://github.com/n8n-io/n8n/security/policy>.

## Wie melden

**Bitte keine Public-GitHub-Issues fuer Security-Themen.** Stattdessen:

- **Email:** `soeren.wagneremden@gmail.com` mit Betreff `[SECURITY] n8n-project-template — <Kurzbeschreibung>`
- Alternativ ueber GitHub Private Vulnerability Reporting (Security-Tab des Repos), falls aktiviert.

Bitte enthalte:

- Beschreibung der Schwachstelle und des betroffenen Files / Codepfads
- Schritte zur Reproduktion oder Proof-of-Concept
- Auswirkung (was kann ein Angreifer tun)
- Optional: Vorschlag zum Fix

## Response-SLA

Best effort, in der Regel binnen 72 Stunden eine Erstantwort. Patches innerhalb von 14 Tagen, sofern die Komplexitaet es zulaesst.

Nach Patch-Release wird die Schwachstelle in `CHANGELOG.md` unter `Security` dokumentiert (mit CVE-Nummer, falls beantragt).

## Was als Security-Issue zaehlt

- Secret-Leaks durch Bypass der gitleaks-Rules
- RCE oder Path-Traversal in der Node-CLI
- Auth-Bypass im Deploy-Pfad (z.B. Token-Verlust, Logging von API-Keys)
- Fehlende Sanitize-Felder, die unintended-Daten an die n8n-API leaken

## Was kein Security-Issue ist

- Bug-Reports ohne Sicherheitsimpact (`workflow-validate-error`, `CLI crash` o.ae.) → bitte als normales Issue
- Schwachstellen in Drittanbieter-Dependencies — bitte direkt an die Maintainer; Dependabot in diesem Repo zieht automatisch Updates nach

## Disaster Recovery

Im Notfall (Encryption-Key-Verlust, kompromittierte Instanz) siehe [docs/disaster-recovery.md](docs/disaster-recovery.md).
