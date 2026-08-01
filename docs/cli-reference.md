# CLI-Reference — `scripts/n8n-cli.mjs`

> Vollstaendige Referenz aller Sub-Commands. Single Source of Truth fuer
> Aufrufe in CI-Workflows, Slash-Commands und Pre-Commit-Hooks.
> Bei Aenderungen an der CLI: diese Datei mit-aktualisieren.
> Eingefuehrt in n8n-template v0.6.1 (verhindert Wiederholung von Issue #22).

## Konvention

Alle Sub-Commands nutzen **positionale Argumente** fuer Pfade — keine `--in/--out` Flags.
`commander.js` parst die Signatur direkt aus den `.argument()`-Aufrufen in
`scripts/n8n-cli.mjs`. Wer einen neuen Sub-Command hinzufuegt, ergaenzt
hier die Signatur.

## Sub-Commands

### `deploy <file>`

Deployt eine Workflow-JSON gegen die Ziel-Instanz (Sanitize, Pre-Deploy-Backup, optional Auto-Rollback).

**Argumente:**

| Position/Flag | Pflicht | Default | Beschreibung |
|---|---|---|---|
| `<file>` (positional) | ja | — | Pfad zur Workflow-JSON |
| `-e, --env <env>` | nein | aus `.env` / Profil | Ziel-Env (`prod` \| `staging` \| `dev`) |
| `--auto-rollback` | nein | `false` | Bei HTTP-Fehler im PUT automatisch Backup zurueckspielen + verifizieren |
| `--no-mapping` | nein | `false` | `config/env-mapping.yaml` ignorieren |

**Beispiele:**

```bash
node scripts/n8n-cli.mjs deploy workflows/azure-billing.json --env=staging --auto-rollback
node scripts/n8n-cli.mjs deploy workflows/exchange-sync.json --env=prod --auto-rollback
```

### `backup`

Vollstaendiges Backup aller Workflows einer Instanz (Cursor-paginiert).

| Flag | Pflicht | Default | Beschreibung |
|---|---|---|---|
| `-e, --env <env>` | nein | aus `.env` | Ziel-Env |

```bash
node scripts/n8n-cli.mjs backup --env=prod
```

### `export`

Exportiert alle Workflows als einzelne JSONs nach `workflows/` (normalized, env-agnostisch).

| Flag | Pflicht | Default | Beschreibung |
|---|---|---|---|
| `-e, --env <env>` | nein | aus `.env` | Quell-Env |
| `-o, --out <dir>` | nein | `workflows` | Ziel-Verzeichnis |
| `--keep-positions` | nein | `false` | `nodes[].position` behalten (Default: gestrippt) |

```bash
node scripts/n8n-cli.mjs export --env=prod --out=workflows
```

### `validate [target]`

Validiert eine Workflow-JSON (oder ein Verzeichnis) gegen das lokale Schema.

| Position | Pflicht | Default | Beschreibung |
|---|---|---|---|
| `[target]` (positional) | nein | `workflows` | Pfad zur JSON oder Verzeichnis |

**KEINE `--in/--out` Flags** — `target` ist immer positional.

```bash
# Ganzes Verzeichnis
node scripts/n8n-cli.mjs validate workflows

# Einzelne Datei
node scripts/n8n-cli.mjs validate workflows/exchange-sync.json

# Default (workflows/)
node scripts/n8n-cli.mjs validate
```

### `normalize <target>`

Normalisiert eine Workflow-JSON in-place (volatile Felder strippen, Nodes sortieren). Mit `--check` exit-code-only.

| Position/Flag | Pflicht | Default | Beschreibung |
|---|---|---|---|
| `<target>` (positional) | ja | — | Pfad zur JSON oder Verzeichnis |
| `--check` | nein | `false` | Nur pruefen (exit 1 bei Diff), nicht schreiben |
| `--keep-positions` | nein | `false` | `nodes[].position` behalten |

**KEINE `--in/--out` Flags** — schreibt immer in-place (oder mit `--check` nur Exit-Code).

```bash
# In-place normalize aller Workflows
node scripts/n8n-cli.mjs normalize workflows

# Check-only (fuer CI)
node scripts/n8n-cli.mjs normalize workflows --check
```

### `drift-check`

Vergleicht Repo-Workflows mit Live-Instanz. Exit 1 bei Drift, optional Markdown-Report.

| Flag | Pflicht | Default | Beschreibung |
|---|---|---|---|
| `-e, --env <env>` | nein | aus `.env` | Ziel-Env |
| `-o, --output <file>` | nein | — | Markdown-Report-Datei |
| `-d, --dir <dir>` | nein | `workflows` | Repo-Workflow-Verzeichnis |

```bash
node scripts/n8n-cli.mjs drift-check --env=prod --output=drift-report.md
```

### `env-sync`

Generiert bzw. aktualisiert `.claude/settings.local.json` (env-Block) aus der Projekt-`.env`.

**Zweck:** Claude Code laedt die Projekt-`.env` fuer die `${VAR}`-Expansion in `.mcp.json`
**NICHT** — die MCP-Server sehen nur die Shell-Umgebung und die `env`-Bloecke der
Settings-Dateien. Ohne Sync starten die MCP-Server mit Literal-`${VAR}`-Werten
(Fehlerbild: `'url' is not a valid URL` bzw. stiller Teilausfall des stdio-Servers).
`env-sync` liest die `.env` (nur Datei-Inhalt, nie `process.env`), extrahiert alle
`N8N_ACTIVE_*`-Variablen (exakt das Set, das `.mcp.json` referenziert — PROD-/STAGING-/DEV-Secrets bleiben bewusst draussen) und merged sie in den `env`-Block — bestehende andere Keys
und andere Top-Level-Settings (z.B. `permissions`) bleiben unangetastet (relates to #39).

| Flag | Pflicht | Default | Beschreibung |
|---|---|---|---|
| `--dry-run` | nein | `false` | Nur Plan anzeigen (Werte maskiert, nie Klartext-Secrets), nichts schreiben |
| `--prune` | nein | `false` | `N8N_ACTIVE_*`-Keys entfernen, die nicht mehr in `.env` stehen |

**Verhalten:**

- Ohne `.env` im Projekt-Root: sprechender Fehler (zuerst `.env` aus `.env.example` anlegen).
- Write ist atomar (Temp-File + Rename), UTF-8 ohne BOM, 2-space-indent.
- Nach dem Sync: **Claude Code neu starten**, damit die MCP-Server die Werte sehen.
- Bei Key-Rotation: `.env` aendern, dann `env-sync` erneut ausfuehren (eine Quelle, zwei Konsumenten).

```bash
# Plan anzeigen (maskiert)
node scripts/n8n-cli.mjs env-sync --dry-run

# Sync ausfuehren
node scripts/n8n-cli.mjs env-sync

# Sync inkl. Entfernen nicht mehr vorhandener N8N_*-Keys
node scripts/n8n-cli.mjs env-sync --prune
```

## CI-Workflow-Cheatsheet

Korrekte CLI-Aufrufe in `.github/workflows/*.yml`:

```yaml
# normalize-check.yml
- run: node scripts/n8n-cli.mjs normalize workflows --check

# validate-workflows.yml
- run: node scripts/n8n-cli.mjs validate workflows

# validate-on-pr.yml
- run: node scripts/n8n-cli.mjs validate workflows
- run: node scripts/n8n-cli.mjs normalize workflows --check
```

## Hinzufuegen eines neuen Sub-Commands

1. `.command()`, `.description()`, `.argument()`/`.option()`, `.action()` in `scripts/n8n-cli.mjs` ergaenzen
2. Hier die neue Sub-Command-Section mit Signatur ergaenzen
3. Falls von CI/Pre-Commit-Hook genutzt: Beispiel in den jeweiligen YAML-Files
4. Test in `tests/unit/` ergaenzen (vitest + nock fuer API-Calls)

## Cross-Check vor PR-Merge

Wenn neue CI-Workflows hinzukommen oder bestehende CLI-Aufrufe in YAML aenderst:

- Aufruf-Signatur gegen diese Datei pruefen
- Lokal `node scripts/n8n-cli.mjs <subcommand> --help` ausfuehren — die `commander`-Auto-Help muss zur Doku passen

Geplant fuer v0.7.0 (Issue #24, optional): Lint-Skript `npm run cli:doc-check`, das jede
`n8n-cli.mjs`-Erwaehnung in `.github/workflows/*.yml` gegen diese Datei verifiziert.
