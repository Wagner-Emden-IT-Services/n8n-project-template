# CLAUDE.md — n8n Projekt-Kontext

Dies ist ein n8n-Workflow-Automation-Projekt mit Naming-Convention und eingebetteten Best-Practices fuer Claude Code als Development-Assistent.

## 0. Vor jeder Arbeit (Pflicht ab v0.5.0)

In einem Customer-Repo (geklont via "Use this template"):

1. **`.template-version.json` muss existieren** — wird vom `/onboard`-Wizard angelegt. Wenn die Datei fehlt: `/onboard` zuerst durchlaufen. Hard-Gate-Details: `.claude/rules/onboard-required.md`.
2. **Zusaetzlich (seit v1.0.0):** `docs/PRD.md` mit `Status: APPROVED` — via `/prd-generate` erzeugt. Sub-Agents und `/deploy-workflow` brechen sonst ab (Hard-Gate `prd-required`, Override `--bypass-prd` mit Audit-Log). Details: `.claude/rules/prd-required.md`.
3. **Pro Workflow (>= 3 Nodes oder Webhook/Schedule):** WF-X-Spec in `docs/specs/` anlegen, siehe `docs/specs/spec-template.md`.

Im Template-Repo selbst (Wagner-Emden-IT-Services/n8n-project-template) sind diese Gates kosmetisch — produktive Slash-Commands werden hier nie ausgefuehrt (GitHub-Actions sind via Template-Guard `if: github.repository != ...` blockiert).

## 1. Projekt-Übersicht

- **Tech-Stack:** n8n (self-hosted), JSON-Workflows als Code, GitHub Actions CI/CD
- **n8n-Instanzen:**
  - Production: `https://n8n.example.com`
  - Staging: `https://n8n-staging.example.com`
  - Development: `http://localhost:5678` oder `https://n8n-dev.example.com`
- **Mindest-n8n-Version:** 2.x mit aktiviertem Instance-level MCP (Settings → MCP). MCP-Server ist seit 2.x core-built-in; exakter Endpoint-Pfad ist instanz-spezifisch und nach Aktivierung in Settings zu kopieren.
- **Deployment-Strategie:** Git-basiert, zwei-stufig (`feature/* → staging → main`). Dev-Instanz wird lokal befuellt (kein develop-Branch, keine Dev-CI).

## 2. Directory Structure

```
.
├── workflows/                # ein File pro Funktion, env-agnostisch (kebab-case)
│   ├── shared/               # Wiederverwendbare Sub-Workflows
│   ├── dev/staging/prod/     # Backward-Compat-Verzeichnisse (deprecated)
│   └── *.json
├── credentials/              # NUR Templates + secrets-vault-map.yaml. NIEMALS Klartext
├── config/                   # environments.yaml + env-mapping.yaml
├── schemas/                  # workflow-schema.json (AJV)
├── scripts/                  # n8n-cli.mjs (Cross-Platform Node) + lib/
├── tests/                    # tests/pins/ — Pin-Daten pro Workflow
├── .github/workflows/        # validate-on-pr, deploy-staging, deploy-prod, drift-check
├── hooks/                    # pre-commit (gitleaks + normalize), pre-push
├── docs/                     # architecture, runbook, troubleshooting, disaster-recovery, sanitize-fields
├── package.json              # pinned deps fuer Node-CLI
└── .claude/
    ├── commands/             # Slash-Commands (siehe Section 11)
    └── skills/
```

## 3. Naming-Conventions (Hybrid)

| Was                 | Pattern                                         | Beispiel                         |
| ------------------- | ----------------------------------------------- | -------------------------------- |
| Workflow-File       | `<funktion>.json` (kebab-case, kein Env-Prefix) | `workflows/exchange-sync.json`   |
| Workflow-`name`     | `<funktion>`                                    | `exchange-sync`                  |
| Knoten              | Klartext-Frage statt Default                    | `Has user email?` statt `If`     |
| Credential (in n8n) | `<service>-<env>`                               | `slack-api-prod`                 |
| Git-Commit          | `[ENV] [ACTION]: ...`                           | `[PROD] DEPLOY: Add retry logic` |
| Sub-Workflow        | `shared-<funktion>`                             | `shared-error-handler`           |

Env-Differenzen (Credentials, Webhook-Suffixe, Tags) liegen in `config/env-mapping.yaml` — **nicht** im Workflow-Namen. Beim Deploy via `node scripts/n8n-cli.mjs deploy ... --env=<env>` wird das Mapping vor dem PUT angewendet.

Verboten: `Workflow 1`, `URGENT-FIX-DO-NOT-TOUCH`, generische Default-Knotennamen.

## 4. MCP-Server-Strategie (zwei parallel)

In `.mcp.json` sind zwei n8n-MCP-Server konfiguriert:

| Server    | Zweck                                                                    | Wann                                                                                          |
| --------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `n8n`     | Deploy, Execute, Test, Activate, Pin-Data-Tests                          | Live-Operationen gegen die Instanz (Built-in seit n8n 2.x)                                    |
| `n8n-mcp` | Composition, Validation, surgical Updates, AutoFix, Node-Doku, Templates | Während du den Workflow baust ([czlonkowski/n8n-mcp](https://github.com/czlonkowski/n8n-mcp)) |

**Workflow für jede Änderung:** 0. **Templates First** — `search_templates` (4 Modi: by_metadata, by_task, by_nodes, keyword). Nur wenn nichts passt: weiter zu Schritt 1

1. Frage Community-MCP nach passenden Nodes / hole Template
2. Baue/ändere Workflow lokal als JSON in `workflows/<funktion>.json` (env-agnostisch)
3. **Review (Pflicht nach jedem Build/Edit)** — Skill `n8n-workflow-reviewer` über den gebauten/geänderten Workflow laufen lassen (5-Kategorien-Audit: Errors, Error-Handling, Performance, Struktur, Score). Blocker vor Schritt 4 beheben. Statischer Review VOR der Test-Ausführung — Details siehe `.claude/rules/general.md` "Post-Build-Review".
4. Validiere über Community-MCP (`validate_workflow`, ggf. `n8n_autofix_workflow`) — und lokal `node scripts/n8n-cli.mjs validate <pfad>`
5. Backup der laufenden Version via `/backup-before-deploy` (offizieller MCP) bzw. `node scripts/n8n-cli.mjs backup --env=<env>`
6. Deploy via offiziellen MCP (`update_workflow` oder `create_workflow`) — Fallback `node scripts/n8n-cli.mjs deploy <file> --env=<env> --auto-rollback`
7. Test-Run mit Pin-Daten via offiziellen MCP (`test_workflow`)
8. Erst dann: `activate_workflow`

## 4a. Operating Mode für n8n-MCP

Verhaltensregeln für jede n8n-MCP-Tool-Session. Tool-Details (nodeType-Formate, Validation-Profiles, addConnection-Syntax, IF-Branch-Param, smart parameters) stehen im Skill `.claude/skills/n8n-mcp-tools-expert/` — hier nur die operativen Defaults:

- **Silent Execution** — Tool-Calls ohne Zwischenkommentar; Ergebnis erst nach Abschluss aller Calls in einer Antwort kommunizieren.
- **Parallel Execution** — Unabhängige Reads, Searches und Validations in einem Message-Block parallel feuern. Sequenziell nur wenn ein Call vom Ergebnis des vorherigen abhängt.
- **Templates First** — Vor `search_nodes` oder `n8n_create_workflow` immer zuerst `search_templates`. Wenn Treffer → `get_template` + Attribution; sonst → Node-Discovery.
- **Never Trust Defaults** — Alle verhaltenssteuernden Parameter explizit setzen. Häufige Fallen: `returnAll: true` (statt schweigendem limit 50), IF-Node `branch: "true"|"false"` (sonst beide auf gleichem Output), Code-Node `mode`, Pagination-Container.
- **Tools-Documentation First** — Bei unbekannter MCP-Tool-Frage zuerst `tools_documentation({topic, depth: "full"})` statt raten.
- **Multi-Level-Validation** als kanonische Reihenfolge:
  1. `validate_node({mode: "minimal"})` — Required-Fields-Check (<100 ms)
  2. `validate_node({mode: "full", profile: "runtime"})` — komplette Pre-Build-Validation
  3. `validate_workflow(workflow)` — Connections + Expressions + AI-Tools nach dem Bau
  4. `n8n_validate_workflow({id})` post-Deploy, ggf. `n8n_autofix_workflow({id})`
- **Template-Attribution Pflicht** — Wenn ein Template als Basis dient, Author + `@username` + n8n.io-Link in Commit-Message und Workflow-Description aufnehmen.
- **Code-Node nur als Last Resort** — Standard-Nodes bevorzugen. Code-Node ausschließlich für Aggregation / Transformation, nie für HTTP-Calls (`fetch()` blockiert, `$helpers` nicht im task-runner).

## 5. Development Workflow

### Branch-Strategie (zwei-stufig)

- `feature/*` (lokal) — Dev-Deploy lokal via `node scripts/n8n-cli.mjs deploy <file> --env=dev`
- `staging` (protected) — auto-deploy nach Staging-Instanz nach Merge
- `main` (protected) — manuelle Approval (GitHub Environment), dann Prod-Deploy
- **Kein** `develop`-Branch, keine Dev-CI. Branch-Protection ist Pflicht — siehe `docs/architecture.md`.

### Vor jeder Edit

- Backup des laufenden Workflows via `/backup-before-deploy`

### Vor Commit

- Pre-Commit-Hook prüft automatisch: gitleaks Secret-Scan, Workflow-Schema, Workflow-Normalize (auto-re-stage)
- Commit-Message-Format: `[ENV] [ACTION]: ...`

### Deployment

- Lokal nach Dev: `node scripts/n8n-cli.mjs deploy workflows/<file>.json --env=dev`
- PR nach `staging` → nach Merge auto-deploy nach Staging-Instanz (mit `--auto-rollback`)
- PR `staging → main` → manuelle Approval, dann Deploy nach Prod (mit Pre-Deploy-Full-Backup-Artifact + `--auto-rollback`)
- Drift-Check laeuft nightly via `.github/workflows/drift-check.yml` und oeffnet Issue bei Repo↔Live-Drift

## 6. Common Patterns

### Error Handling

- Jeder Workflow MUSS einen Error-Workflow als `Settings → Error Workflow` referenzieren
- Kritische HTTP-Knoten: `Retry on Failure` mit 3 Versuchen + Backoff
- Niemals personenbezogene Daten in Error-Messages (DSGVO + Datenleck-Risiko)

### Sub-Workflows

- Wiederverwendbare Logik in `workflows/shared/`
- Per `Execute Workflow`-Knoten aufrufen, mit explizitem Input-Mapping

### Pagination

- HTTP-Pagination immer im n8n-HTTP-Node konfigurieren (`responseContainsNextURL` o. Ä.)
- Im Code-Node: `$input.all()` über alle Batches iterieren — **NIEMALS** `.first()` (siehe Section 7)
- Rate-Limit: `batching` mit `batchSize: 3, batchInterval: 5000` als Default

### Idempotente DB-Writes

- INSERT mit `ON CONFLICT DO UPDATE` (UPSERT)
- POST-Calls mit Dedup-Key (z. B. Idempotency-Key-Header)
- Checkpoints für lange Sync-Runs (`last_modified` persistieren)

### Code-Node-Restriktionen

- KEIN `fetch()` (sandbox blockiert es)
- KEIN `$helpers` (task-runner mode hat keinen Zugriff)
- Nutze HTTP-Request-Node mit Pagination, dann Code-Node nur für Aggregation

## 7. Hard-Earned Lessons (Anti-Patterns)

Praxis-Patterns aus n8n-Produktiv-Projekten:

### `.first()` vs `.all()` bei Pagination

```javascript
// FALSCH — holt nur ersten Batch (z. B. 828 von 4193 Kontakten)
const data = $('Get Contacts').first().json;

// RICHTIG — alle Batches
const allBatches = $('Get Contacts').all();
const contacts = [];
for (const batch of allBatches) contacts.push(...(batch.json.value || []));
```

### SplitInBatches "Done"-Output triggert nicht

- Done-Output ist leer wenn Loop fertig — nachfolgende Nodes feuern NICHT
- **Lösung:** Pattern verwerfen, stattdessen HTTP-Request-Node mit eingebauter Pagination + Code-Node für Collection
- Falls SplitInBatches zwingend nötig: Code-Node mit `return $input.all()` als Bridge nach Done-Output

### Parallel Connections = Item Explosion

```
DataTable (2.606 rows) ─┬─→ Merge Node (parallel)
                        │
HTTP-Source (25 items) ─┘
→ 65.150 Items! (2.606 × 25)
```

- **Lösung:** sequenzielles Routing (`DataTable → Lookup → Merge`) oder Aggregate-Node nach Parallel-Split

### DataTable returnAll

- Default `limit: 50` schweigend! Bei 2.606 rows kommen nur 50 zurück
- **Lösung:** explizit `returnAll: true` setzen

### `n8n execute:workflow` Code-Node-Limits

- `fetch()` und `$helpers` sind im task-runner-mode NICHT verfügbar
- **Lösung:** HTTP-Request-Node nutzen, Code-Node nur für Datenverarbeitung

### Manual > Automation bei One-Time-Cleanup

- Komplexer Cleanup-Workflow mit SplitInBatches: 6h Entwicklung, nicht funktional
- Manuell: 5 Min
- **Regel:** Nur automatisieren wenn rekurrierend / fehleranfällig manuell. One-Time-Cleanup: manuell.

### Workflow-Backup vor jeder Änderung

- IMMER vor Edit: aktuelle Version per REST-API holen, Timestamp-JSON in `backups/` speichern
- Worklog-Eintrag mit Backup-Pfad

### Rate-Limiting

- Pro API individuelle Limits beachten — `batching` mit passendem `batchSize` und `batchInterval` als Default
- Beispiel: 3 Requests / 5s → `batching: { batchSize: 3, batchInterval: 5000 }`
- IMMER Rate-Limit-Header beobachten (`X-RateLimit-Remaining`, `Retry-After`)

### DataTable dateTime speichert Container-lokal, nicht UTC

- `dateTime`-Columns speichern `Z`-Suffix-Timestamps als Container-Timezone — Offset wandert mit DST (CET -1h / CEST -2h)
- Folge: Change-Detection `modified > lastKnownModified` ist permanent `true` → jeder Lauf ist ein Full-Update
- **Lösung:** vor jedem DataTable-Write `new Date(v).toISOString()` — Details + Detection-SQL: `docs/troubleshooting.md`

### DataTable Upsert ohne matchingColumns = Silent Insert

- Leere `matchingColumns` / `filters.conditions` → Upsert fällt still auf Insert zurück, pro Lauf neue Rows (Praxis-Fall: 2.608 → 144.049 Rows in 2 Wochen, 95 MB JSON pro Read, Host-OOM)
- `n8n_validate_workflow` flaggt das NICHT — der Template-Validator prüft es seit v1.2.0 (`npm run validate`)

### Concurrency: ein langer Workflow killt die Instanz

- Schedule-Intervall kürzer als Laufzeit → parallele Fires stapeln sich (Praxis-Fall: 14 parallel → Host-OOM)
- `N8N_CONCURRENCY_PRODUCTION_LIMIT=1` setzen (queued FIFO statt Overlap; Default ist unlimited!) — Trigger-Liste: `docs/runbook.md`

### `$('NoOp-Node').all()` liefert leeres Array

- Branch-Sibling-Lookup auf NoOp-/Passthrough-Nodes kann `[]` liefern, obwohl die Branch sichtbar Items ausgab — Audit-Counter zeigen dann 0
- **Lösung:** Counts per Math-Derivation aus zuverlässigen Nodes ableiten (`total - updated - created = skipped`) — Details: `docs/integrations/n8n-code-node-pitfalls.md`

## 8. Debugging Techniques

### Daten fehlen

1. Output jedes Knotens einzeln prüfen (n8n UI: Execution Details)
2. Bei Pagination: Anzahl Batches × Items-pro-Batch = Erwartung. Vergleich.
3. Code-Node lokal mit Node.js simulieren

### Performance

- Long-running Workflows: in Batches á 100–500 Items aufteilen
- Parallel-Execution prüfen: `Execute once for all items` vs. per item
- DB-Queries: Indexe prüfen, EXPLAIN

### Crashes (OOM)

- Memory-Limit bei großen Datasets erreicht
- **Lösung:** ein Workflow-Run pro Batch, Batches als separate Executions

## 9. Deployment Checklist Pre-Prod

- [ ] Workflow-JSON valide (Schema-Check grün)
- [ ] Naming-Convention eingehalten
- [ ] Error-Workflow referenziert
- [ ] Retry-Settings auf kritischen Knoten
- [ ] Credentials existieren in Ziel-Instanz
- [ ] Rate-Limiting konfiguriert
- [ ] Idempotenz geprüft (Re-Run sicher)
- [ ] Backup der laufenden Version erstellt (Pre-Deploy via `--auto-rollback`)
- [ ] Test-Run mit Pin-Daten erfolgreich
- [ ] Drift-Check nach Deploy gruen (`node scripts/n8n-cli.mjs drift-check --env=<env>`)

## 10. Git Commit Convention

Hybrid-Pfad: **Conventional Commits** im Template-Repo selbst (OSS-Standard, Tooling-faehig), `[ENV] [ACTION]:` als optionales Format in geforkten Workflow-Repos (wenn Commits direkt zu Deploys mappen und Audit-Trail wichtig ist).

### Im Template-Repo (und allen Repos, die Code/Doku/Tests aendern): Conventional Commits

Format `<type>(<scope>): <description>` — Spec: <https://www.conventionalcommits.org>.

```
feat(cli): add --smoke-test flag to deploy command
fix(api): handle 429 rate-limit responses with retry
docs: clarify MCP setup in README
chore(deps): bump vitest to 2.2.0
refactor(env-mapper): consolidate credential lookup logic
test(api): add nock mocks for activate/deactivate endpoints
ci: add npm test step to validate-on-pr workflow
```

Types: `feat` | `fix` | `docs` | `chore` | `refactor` | `test` | `ci` | `perf` | `style` | `build`. Description im Imperativ, klein, ohne Punkt am Ende.

Breaking Changes: `feat!: ...` oder Footer `BREAKING CHANGE: ...`.

### In geforkten Workflow-Repos (optional): `[ENV] [ACTION]:`

Wenn das geforkte Projekt n8n-Workflows gegen echte Instanzen deployt und Audit-Trail (wer, wann, welches Env) wichtig ist:

```
[STAGING] FIX: Pagination-Bug in exchange-sync (.first → .all)

- Workflow-IDs: <id1>, <id2>
- Backup: backups/<workflow>-2026-05-07-1423.json
```

ACTION = `DEPLOY` | `UPDATE` | `FIX` | `REFACTOR` | `BACKUP` | `EXPERIMENT`. Diese Variante traegt Env-Info, ist aber **nicht** OSS-Standard und nicht von Release-Tooling unterstuetzt — daher nur bewusst und nur in Workflow-Repos.

<!-- N8N-TEMPLATE:START id="commit-attribution" version="1.5.0" -->
### Keine Tool-Attribution (HARD-RULE)

Commits und PR-/Issue-Bodies dieses Projekts enthalten **KEINE Tool-Attribution** — weder Trailer noch Footer:

- KEIN `Co-Authored-By: Claude <...>` — auch nicht mit Modell-Suffix (`Claude Opus 5 (1M context)`, `Claude Sonnet ...`)
- KEIN `🤖 Generated with [Claude Code](https://claude.com/claude-code)`
- KEIN sonstiger Hinweis auf KI-Beteiligung an der Aenderung

Die Regel gilt **auch dann**, wenn ein globales `CLAUDE.md`, ein System-Default, ein Skill
oder ein Plugin genau diese Trailer vorschreibt — diese Projekt-Regel gewinnt.

**Vor jedem `git commit` / `gh pr create`:** Message bzw. Body auf `Co-Authored-By`,
`Generated with` und `Claude` pruefen, entsprechende Zeilen entfernen. Wenn der Commit schon
steht: `git commit --amend` VOR dem Push.

Davon unberuehrt bleibt die **Template-Attribution** aus Section 4a (Author + `@username` +
n8n.io-Link, wenn ein n8n.io-Template als Basis dient) — das ist Quellen-Nachweis, keine
Tool-Attribution.
<!-- N8N-TEMPLATE:END id="commit-attribution" -->

## 11. Slash-Commands

In `.claude/commands/`:

**Setup / Lifecycle (ab v0.5.0):**

- `/onboard [beschreibung]` — 8-Phasen-Wizard, **Pflicht** in jedem neuen Customer-Repo. Erzeugt `.template-version.json`, Staging-Profil, `.env`, Credentials-Plan, optional GitHub-Repo. Details: `docs/ONBOARDING.md`.
- `/prd-generate [beschreibung]` — erzeugt `docs/PRD.md` (12-Sektionen) via 3-Phasen-Interview (wrappt Skill `n8n-prd-generator`). **Pflicht vor Build/Deploy** (Hard-Gate `prd-required`). Seit v1.0.0.

**Workflow-Quality-Lints (read-only, keine Onboard-Pflicht):**

- `/validate-workflow <pfad>` — Schema, Verbindungen, Credential-Refs (`node scripts/n8n-cli.mjs validate`)
- `/check-naming <pfad>` — Naming-Convention, generische Knotennamen
- `/check-idempotency <pfad>` — INSERT/POST-Idempotenz
- `/check-pagination <pfad>` — `.all()`, Done-Output-Trap, Cursor-Logik
- `/audit-error-handling <pfad>` — Error-Workflow + Retry-Settings
- `/security-review-workflow [pfad]` — Credentials/Webhook/Rate-Limits/Logging-Audit

**Deployment (Onboard-Pflicht ab v0.5.0):**

- `/backup-before-deploy <workflow-id>` — REST-API-Backup
- `/deploy-workflow <pfad> [env]` — Sanitize + Env-Mapping + verifiziertes Auto-Rollback

## 12. n8n CLI Cheatsheet

```bash
# Alle Workflows exportieren (eine JSON pro Workflow)
n8n export:workflow --all --output=workflows/ --separate

# Einzelnen Workflow exportieren
n8n export:workflow --id=<ID> --output=workflows/<env>/

# Import (single oder folder)
n8n import:workflow --input=workflows/ --separate

# Credentials exportieren (verschlüsselt — NIEMALS in Git!)
n8n export:credentials --all --output=credentials-backup.json

# Workflow lokal ausführen mit Test-Input
n8n execute:workflow --id=<ID> --testData=test-input.json
```

## 13. Useful URLs

- n8n Docs: https://docs.n8n.io
- n8n MCP-Server (offiziell): https://docs.n8n.io/advanced-ai/mcp/accessing-n8n-mcp-server/
- Community-MCP-Server: https://github.com/czlonkowski/n8n-mcp
- n8n-Skills (czlonkowski): https://github.com/czlonkowski/n8n-skills
- Sustainable Use License: https://docs.n8n.io/sustainable-use-license/

## 14. Memory-System

Bei Session-Start wird `.claude/memory/MEMORY.md` automatisch geladen via SessionStart-Hook (falls das Memory-System installiert ist — Installation: `/memory-install`).

Lessons aus Sessions speichern: `/remember`. Wartung: `/memory-cleanup`. System-Update: `/memory-update`. (Plugin `memory-system`; ohne project-local Install: `/memory-system:remember` etc.)

---

## 15. Karpathy Coding Guidelines

Verhaltensregeln für jede Code-Änderung. Quelle: https://github.com/forrestchang/andrej-karpathy-skills

### Think Before Coding

Don't assume. Don't hide confusion. Surface tradeoffs.

- Annahmen explizit nennen, bei Unklarheit fragen
- Mehrere Interpretationen offenlegen, nicht still entscheiden
- Wenn einfacher geht: sagen
- Bei Unklarheit: stoppen und benennen

### Simplicity First

Minimum code that solves the problem. Nothing speculative.

- Keine Features über das Geforderte hinaus
- Keine Abstraktionen für Single-Use-Code
- Keine spekulative Konfigurierbarkeit
- Kein Error-Handling für unmögliche Fälle
- 200 Zeilen die auch 50 sein könnten → umschreiben

### Surgical Changes

Touch only what you must. Clean up only your own mess.

- Angrenzenden Code/Kommentare/Formatierung nicht "verbessern"
- Nicht refaktorieren, was nicht kaputt ist
- Bestehenden Stil matchen
- Eigene Änderungen aufräumen, vorhandene Altlasten nicht
- Test: jede geänderte Zeile muss direkt auf die User-Anfrage zurückführbar sein

### Goal-Driven Execution

Define success criteria. Loop until verified.

- "Add validation" → "Tests für invalid inputs schreiben, dann grün"
- "Fix the bug" → "Test schreiben der ihn reproduziert, dann grün"
- Multi-Step: Plan mit Verify-Step pro Schritt


<!-- N8N-TEMPLATE:START id="bug-tracking" version="0.6.0" -->
## Bug-Tracking (verbindlich seit n8n-template v0.6.0)

**Bugs werden AUSSCHLIESSLICH als GitHub-Issues im Project-Repo gepflegt** — NICHT in WF-X-Specs, NICHT in docs/, NICHT in workflows/*.json-Beschreibungen.

- **Repo:** {{TARGET_REPO_URL}}/issues
- **Templates:** `01-bug.yml` (Mensch), `02-workflow-bug.yml` (Auto-File durch /qa-workflow), `03-template-bug.yml` (im n8n-project-template Source-Repo via `/template-bugreport`)
- **Workflow Single-Issue:** `/change-workflow --issue <N>` → Branch `fix/issue-N-<slug>` → PR mit `Closes #N` → Auto-Close beim Merge
- **Workflow Multi-Issue/Multi-Workflow:** `/change-workflow --issues [--priority P0,P1] [--milestone <name>]` oder `/change-workflow --workflows WF-1,WF-2` → Multi-Agent-Teams via TeamCreate (max 2-3 parallel, Konflikt-Detection bei shared Credentials)
- **Template-Bug:** `/template-bugreport` (sanitisiert + Privacy-Hard-Gate ins n8n-project-template Source-Repo)
- **"Was soll ich als naechstes machen?":** `/next-recommend` (GSD-Style mit Priorisierungs-Heuristik)
- **Hilfe:** `/help-workflow` (kontextabhaengig)

Details: `.claude/rules/general.md` Sektion "Bug-Tracking-Konvention".
<!-- N8N-TEMPLATE:END id="bug-tracking" -->

<!-- N8N-TEMPLATE:START id="n8n-pipeline" version="1.1.0" -->
## n8n-Pipeline (Sub-Agents je Phase)

| Phase | Sub-Agent (`.claude/agents/`) | Auto-loaded Skills |
|---|---|---|
| Spec | `n8n-workflow-analyst` | `n8n-prd-generator`, `grill-with-docs` (Anforderungen schaerfen) |
| Architecture | `n8n-integration-architect` | `n8n-workflow-patterns`, `n8n-mcp-tools-expert`, `research` (API-Fakten belegen) |
| Build | `n8n-workflow-developer` | `n8n-mcp-tools-expert`, `n8n-node-configuration`, `n8n-code-javascript`, `n8n-code-python`, `n8n-expression-syntax`, `n8n-workflow-reviewer` (Post-Build-Review) |
| Test | `n8n-qa-engineer` | `n8n-validation-expert`, `n8n-mcp-tools-expert` |
| Security | `n8n-security-reviewer` | (`/security-review-workflow` Hard-Gate) |
| Deploy | `n8n-deployment-engineer` | `n8n-mcp-tools-expert` |

Hard-Gates vor Deploy: `onboard-required`, `prd-required`, `wf-x-spec-required`, `security-audit-required`, `normalize-on-commit`. Bypass nur via expliziter `--bypass-<gate>`-Flag mit Audit-Log.

Orchestrator: `/change-workflow` (Hybrid Pipeline + Issue-Mode + Multi-Workflow-Batch).

### Prozess-Skills (seit v1.1.0)

Adaptiert aus [mattpocock/skills](https://github.com/mattpocock/skills) (MIT), projekt-lokal in `.claude/skills/` gebuendelt — Details und Attribution: `.claude/skills/_README.md`.

| Skill | Einsatzpunkt |
|---|---|
| `/grilling` / `/grill-me` | Plan-/Entscheidungs-Stress-Test (eine Frage pro Turn, mit Empfehlung). Standard-Pass in `/prd-generate` vor `Status: APPROVED` |
| `/grill-with-docs` | Spec-Phase: Anforderungen schaerfen + nebenbei `CONTEXT.md`/ADRs aufbauen |
| `/domain-modeling` | Ubiquitous Language pflegen (`CONTEXT.md`, `docs/adr/`) — speist WF-X-Specs + PRD |
| `/research` | Architecture-Phase: API-Fakten (Scopes, Rate-Limits, Webhooks, Pagination) belegt statt geraten — Ablage `docs/research/` bzw. `docs/integrations/<service>/` |
| `/diagnosing-bugs` | Pflicht-Diagnose vor Bug-Fix-Builds (`/change-workflow --issue N`): Feedback-Loop zuerst, dann Fix |
| `/handoff` | Session-Uebergabe an Phasen-Gates + Session-Ende: `docs/sessions/` + `docs/STATE.md`-Update |
<!-- N8N-TEMPLATE:END id="n8n-pipeline" -->

<!-- N8N-TEMPLATE:START id="graphify" version="1.4.0" -->
## Graphify Knowledge Graph (verbindlich seit n8n-template v1.4.0)

Fuer Code-Struktur- und Impact-Fragen zur Projekt-Codebasis (scripts/ CLI + lib, tests/,
hooks/, .n8n-template-Engine) existiert ein lokaler Knowledge-Graph: tree-sitter-AST
(deterministisch, **kein LLM, nichts verlaesst den Rechner**) -> `graphify-out/graph.json`.

**Directive:** Bei "was ruft X auf / was haengt an Y / was bricht wenn ich Z aendere"
im CLI-/Script-/Test-Code **zuerst den Graphen fragen** statt breit zu greppen:

```bash
export PATH="$HOME/.local/bin:$PATH"   # graphify liegt in ~/.local/bin
graphify query "<frage>"     # BFS-Kontext zu einem Thema
graphify path "A" "B"        # kuerzester Pfad zwischen zwei Konzepten
graphify explain "X"         # woran haengt X (Nachbarschaft + Quellzeilen)
graphify affected "X"        # Reverse-Impact: was wird von X beeinflusst
```

- **Scope (bewusste Abgrenzung):** NUR Code (`.graphifyignore`). `workflows/*.json` sind
  NICHT im Graphen — Workflow-Semantik (Nodes, Connections, Credentials, Webhooks)
  beantwortet der n8n-MCP (`n8n_get_workflow`, `validate_workflow`), nicht der AST-Graph.
- **Setup:** automatisiert via `/onboard` Phase 6 (Schritte 2b/2c). Manuelle Nachinstallation:
  `uv tool install "graphifyy[sql]"` (Fallback pipx/pip) -> `graphify install --project`
  -> `graphify update .` (Erst-Build) -> `graphify hook install` (Post-Commit-Auto-Rebuild).
  PyPI-Paket `graphifyy` (Doppel-y), CLI `graphify`.
- **Frische:** `graphify-out/` ist **committed** (geteilte Map; nur `cost.json`/`cache/`
  bleiben lokal). Post-Commit-Hook rebuildet; bei uncommitteten Code-Aenderungen vorab
  `graphify update .`.
- In PowerShell `graphify .` nutzen (nicht `/graphify .` — fuehrender Slash = Pfadtrenner).
- Ein `UserPromptSubmit`-Hook (`.claude/hooks/graphify-preflight.ps1`) erinnert bei
  `/change-workflow`, `/next-recommend` und `/diagnosing-bugs` automatisch daran.
<!-- N8N-TEMPLATE:END id="graphify" -->
