# UPDATING — n8n-Project-Template-Lebenszyklus

Wie das n8n Project Template in einem Projekt installiert, aktualisiert und
migriert wird. Geschrieben fuer die Person, die ein Projekt betreut (du,
spaeter ggf. neuer Kollege).

---

## 1. Initial-Install (neues Projekt)

**Option A — frisches Projekt mit /onboard:**
```
/onboard
```
Wird durch den Wizard gefuehrt (Customer-Identity, PRD, Deep Research, Skills, Rules, Bootstrap, GitHub-Setup).

**Option B — leeres Projekt manuell:**
```bash
git clone --depth 1 https://github.com/Wagner-Emden-IT-Services/n8n-project-template /tmp/n8n-template
rm -rf /tmp/n8n-template/.git
cp -r /tmp/n8n-template/. .
pwsh .n8n-template/Generate-Manifest.ps1 -Root . -TemplateVersion <version>
```
Danach `.template-version.json` bearbeiten (`installed_at`, `customer_slug`, `project_slug`).

**Option C — bestehendes Projekt OHNE Template:**
```
/template-migrate
```

## 2. Update auf neue Version

```
/template-check               # Read-only — zeigt ob Update verfuegbar
/template-update              # Dry-Run — zeigt Plan, schreibt nichts
/template-update --apply      # Schreibt nach Konflikt-Bestaetigung
```

Was `/template-update` macht:

1. Liest `.template-version.json` + `.n8n-template/manifest.json` (BASE).
2. Falls Schema 1.1: Auto-Upgrade auf 1.2.
3. Cloned das Source-Repo (REMOTE).
4. Berechnet pro Datei BASE/LOCAL/REMOTE-Hash, leitet Aktion ab.
5. Zeigt Plan gruppiert nach Tier (FROZEN/UPDATABLE/MARKER-AWARE/USER-GENERATED).
6. Bei `--apply`: fragt pro Konflikt, dann schreibt mit Backup `.bak.<ts>`.
7. Aktualisiert Manifest + `.template-version.json`, schreibt `.n8n-template/audit.log`.

**Was wird nicht angefasst:**
- Alles unter `docs/` (PRD, ONBOARD_LOG, STATE, Integrations-Doku)
- `docs/specs/` komplett (Specs + INDEX)
- `docs/sessions/`
- `.claude/customer.json`
- `.claude/skills/` ausserhalb der bekannten Stubs (lokale Skills bleiben USER-GENERATED)
- `.mcp.json` (nach Onboarding ist die Datei `USER-GENERATED`)

**Was kann mit Backup ueberschrieben werden (FROZEN):**
- `.claude/commands/*.md` (Template-Code)
- `.claude/agents/*.md`
- `.n8n-template/*.ps1` (Update-/Manifest-Skripte)
- `.claude/rules/general.md`, `prd-required.md`, `onboard-required.md`, `template-version-pinning.md`
- `.git-hooks/pre-commit`
- `.claude/settings.json`
- `.gitignore`, `UPDATING.md`

**Wo Konflikte gefragt werden (UPDATABLE-WITH-DIFF):**
- `.claude/skills/<name>/SKILL.md` der bundled Skill-Stubs
- `.claude/skills/_README.md`, `_LICENSE-mattpocock.md` sowie die Companion-Dateien der
  Prozess-Skills (`domain-modeling/*`, `diagnosing-bugs/scripts/*`)
- `scripts/n8n-cli.mjs`, `config/staging-profiles/*.yaml`
- `.github/workflows/validate-workflows.yml`, `normalize-check.yml`, `issue-triage.yml`, `pr-issue-link-check.yml`

**Wo Block-fuer-Block gemergt wird (MARKER-AWARE):**
- `CLAUDE.md` (Bloecke `bug-tracking`, `n8n-pipeline`)

## 3. Migration aus Fremd-Template

```
/template-migrate
```

Funktioniert auch fuer Projekte ohne Template-Stempel. Ablauf:

1. **Inventur** der vorhandenen Dev-Infrastruktur (.claude/, CLAUDE.md, docs/, MCP-Configs, Hooks).
2. **Mapping-Vorschlag** mit Klassifizierung pro Datei:
   - `AUTO-ADOPT`: REMOTE-Version installieren, lokal nach `docs/legacy/<datum>/`
   - `MAP-AND-PRESERVE`: lokaler Inhalt in `<!-- PROJECT:START/END -->`-Block portieren
   - `PROJECT-SPECIFIC`: lokal lassen, als USER-GENERATED markieren
   - `DROP`: Anti-Pattern archivieren (Duplex Skills, hardcoded Secrets)
3. **User-Bestaetigung** pro nicht-trivialer Decision.
4. Bei `--apply`: Schreibt + erzeugt `MIGRATION_REPORT.md`.
5. Erzeugt `.template-version.json` (Schema 1.2, `installed_via: "migrate"`) und Initial-Manifest.

## 4. Marker-Konvention (MARKER-AWARE-Dateien)

Geteilte Dateien haben `MARKER-AWARE`-Schutz im Manifest. Inhalt-Updates erfolgen
nur in markierten Bloecken. Beispiel `CLAUDE.md`:

```markdown
# {{PROJECT_NAME}}

{{PROJECT_DESCRIPTION}}

<!-- PROJECT:START -->
Hier steht freier projekt-eigener Text. Wird bei Update NIE angefasst.
<!-- PROJECT:END -->

<!-- N8N-TEMPLATE:START id="tech-stack-summary" version="1.6.0" -->
## Tech Stack

| Layer | Technologie | Version |
|-------|-------------|---------|
| ...   | ...         | ...     |
<!-- N8N-TEMPLATE:END id="tech-stack-summary" -->
```

**Regeln:**
- `id` ist Pflicht, identifiziert den Block.
- `version` ist Pflicht, kennzeichnet die Liefer-Version des Blocks.
- Nur in MARKER-AWARE-Dateien verwenden (Liste in `protection-rules.json`).
- Inhalt **ausserhalb** der Marker = User-Land, bleibt unangetastet.
- `<!-- PROJECT:START/END -->`-Bloecke werden NIE angefasst.
- Bei `/template-update` wird der N8N-TEMPLATE-Block per ID + Regex ersetzt — Block in REMOTE muss gleiche ID haben.

**Neue MARKER-AWARE-Dateien einfuehren** (Template-Maintainer):
1. Eintrag in `protection-rules.json` mit `protection: "MARKER-AWARE"` und `managed_blocks: [...]`.
2. Marker im Template-File anlegen.
3. Manifest regenerieren.

## 5. Konflikt-Aufloesung im Detail

Bei `UPDATABLE-WITH-DIFF` und `CONFLICT`-Aktion zeigt `/template-update --apply` pro File:

```
[CONFLICT] scripts/n8n-cli.mjs
  BASE   = abc123...   (lieferte v1.5.0)
  LOCAL  = def456...   (du hast es im April geaendert)
  REMOTE = ghi789...   (neuer Stand v1.6.0)
```

Wahlmoeglichkeit:
- `REMOTE uebernehmen (lokal als .bak)` — sicher fuer "frische Liefer-Version mitnehmen".
- `LOKAL behalten (Update skippen)` — sicher fuer "lokale Anpassung schwerer als REMOTE-Fortschritt".
- `Beides anzeigen + entscheiden` — `git diff` zwischen REMOTE und LOCAL, dann nochmal fragen.

**Bei FROZEN mit lokalen Aenderungen** (sehr selten):
- Default ist `OVERWRITE-WITH-BACKUP` — REMOTE wird installiert, LOCAL geht in `.bak.<ts>`.
- Mit `--force-frozen` werden alle ohne weitere Frage uebernommen (Backup bleibt).
- Empfehlung: lokale Aenderungen an FROZEN-Files SIND ein Hinweis, dass diese Aenderung in das Template selbst gehoert — als Upstream-PR im Template-Repo.

## 6. Manifest-Hand-Edit — wann ok, wann nicht

**OK:**
- Eintrag in `protection-rules.json` ergaenzen wenn man eine neue USER-GENERATED-Datei kategorisch schuetzen will (z.B. `docs/CUSTOM-RUNBOOK.md`).
- Lokal Manifest regenerieren wenn man manuell Dateien hinzugefuegt hat: `pwsh .n8n-template/Generate-Manifest.ps1 -Root .`

**Nicht OK:**
- `sha256`-Werte im `manifest.json` per Hand aendern (Quelle der Wahrheit ist das Generate-Skript).
- Tier eines bestehenden Files herabsetzen (z.B. FROZEN → USER-GENERATED), nur um ein Update zu vermeiden — dann lieber ein Upstream-Fix.
- `audit.log` manipulieren (gitignored, aber als Forensik-Quelle gedacht).

## 7. Schema-Migration 1.1 → 1.2

Wenn ein Projekt von einer aelteren n8n-Template-Version kommt, wird `/template-update`
das Schema automatisch hochziehen:

| Feld | Schema 1.1 | Schema 1.2 |
|------|------------|------------|
| `schema_version` | "1.1" | "1.2" |
| `template` | "n8n-project" | "n8n-project" |
| `version` | "1.5.0" | "1.5.0" |
| `installed_at` | Datum | Datum |
| `source_repo` | URL | URL |
| `target_repo` | URL/null | URL/null |
| `customer_slug` | str | str |
| `project_slug` | str | str |
| `installed_via` | (fehlt) | "auto-upgrade-from-1.1" |
| `manifest_path` | (fehlt) | ".n8n-template/manifest.json" |
| `last_update_at` | (fehlt) | null |
| `last_update_from_version` | (fehlt) | null |

Beim Auto-Upgrade:
- Falls `.n8n-template/manifest.json` fehlt: Pseudo-Manifest aus dem JETZT-Stand erzeugt — BASE wird gleich LOCAL. Beim **naechsten** Update gibt es dann sinnvolle BASE-Werte.
- Audit-Log-Event: `SCHEMA_UPGRADE 1.1 1.2`.

## 8. Issue-Workflow + Repo-Pflicht (seit v1.7.0)

Seit v1.7.0 ist die **GitHub-Repo-Anlage Pflicht** (`/onboard` Phase 2/6). Bug-Tracking erfolgt **ausschliesslich ueber GitHub-Issues** — KEINE Bug-Sektionen in WF-X-Specs, KEIN Bug-Memory.

### Bug-Workflows

| Wer | Wie |
|---|---|
| Mensch direkt | `gh issue create` (Template-Picker zeigt `01-bug.yml`) |
| /change-workflow-Klassifizierung erkennt Bug | AskUserQuestion ob Issue anlegen, dann Branch `fix/issue-<N>-<slug>` |
| /qa-workflow-Skill bei FAIL | Auto-File bei P0/P1 (mit `priority:P0`/`P1`-Label), User-Choice-Liste bei P2/P3 |
| Template-Bug (Skill/Hook/Command) | `/template-bugreport` — Sanitisiert + Privacy-Hard-Gate ins n8n-template-Source-Repo |

### Issue-Abarbeitung

- **Einzeln:** `/change-workflow --issue <N>` → Branch `fix/issue-<N>-<slug>` → PR-Body `Closes #N` → Auto-Close beim Merge
- **Multi-Batch (parallel):** `/change-workflow --issues [--priority P0,P1] [--milestone <name>] [--max-parallel 3]` → bis zu 3 Worktrees parallel via Multi-Agent-Teams
- **Konflikt-Detection:** Orchestrator-Agent erkennt File-Overlap zwischen Issues → ueberlappende Issues sequenziell statt parallel

### Default-Label-Set

15 Labels werden via `Deploy-Labels.ps1` deployt:

- `bug` `enhancement` `feature` `qa-found`
- `origin:template` `origin:project`
- `source:ai-qa` `source:ai-change` `source:human`
- `priority:P0` `priority:P1` `priority:P2` `priority:P3`
- `needs-triage` `blocked`

Idempotent — Skript kann jederzeit nachgeholt werden:

```bash
pwsh .n8n-template/Deploy-Labels.ps1
# (liest target_repo aus .template-version.json)
```

### Migration v1.6.x → v1.7.x (Bug-Sammelstellen)

Beim ersten `/template-update --apply` von v1.6.x auf v1.7.x scannt das System automatisch nach:
- `docs/specs/*.md` Sektionen ("Known Bugs", "Bekannte Fehler", "Open Bugs", "TODO: Fix")
- `docs/specs/*.md` Bullets (`BUG:`, `FIXME:`, `TODO: fix`)
- `.claude/memory/**/*.md` mit `type: bug`-Frontmatter oder `**BUG:**`-Marker
- `docs/**/*.md` Bullets (ohne USER-GENERATED-Whitelist)

Pro Finding: User-Choice (`[a]nlegen` / `[s]kippen` / `[r]edraft` / `[d]rop`). Bei Anlegen wird ein Issue erstellt und in der Source-Datei ein Cross-Reference-Marker `(See #N)` eingefuegt — Original-Inhalt bleibt.

Skip-Option: `/template-update --apply --skip-bug-migration` (Audit-Log-Vermerk, wird beim naechsten Update nachgeholt).

Bei `/template-migrate` analog (Sub-Phase 8f).

### CI-Workflows (committet, GitHub aktiviert automatisch)

- `.github/workflows/issue-triage.yml` — Auto-Label nach Title-Pattern (`[BUG]` → `bug`, `[QA]` → `workflow-bug`, `[FEAT]` → `feature`, `[TEMPLATE-BUG]` → `template-bug`)
- `.github/workflows/pr-issue-link-check.yml` — Informativer Comment wenn PR-Body kein `Closes #N` enthaelt (nicht-blocking)

Beide UPDATABLE-WITH-DIFF — koennen vom User erweitert werden.

### Was tun wenn das Repo doch fehlt

Wenn `gh` nicht verfuegbar/authentifiziert ist, ueberspringt `/onboard` die GitHub-Schritte automatisch mit Warnung (Phase 2). In diesem Modus sind Issue-Workflows deaktiviert und die Bug-Migration v1.6→v1.7 wird verschoben (`BUG_MIGRATION_DEFERRED` im Audit). Beim ersten `/template-update` nach nachgeholtem GitHub-Setup (Phase 2/6) wird sie nachgeholt.

## 9. Bei Problemen

- **`/template-update` schlaegt fehl mit "Manifest not found":** Pseudo-Manifest erzeugen: `pwsh .n8n-template/Generate-Manifest.ps1 -Root .` — danach nochmal `/template-update`.
- **Backup-Files (`*.bak.*`) sammeln sich:** Sie sind `.gitignore`d. Nach erfolgreichem Update + Test manuell loeschen: `Get-ChildItem -Recurse -Filter '*.bak.*' | Remove-Item`.
- **Cross-Update lokale Anpassung beibehalten:** Wenn Konflikt-Resolution immer `KEEP-LOCAL` ist, in `protection-rules.json` den Tier auf `USER-GENERATED` herabsetzen — dann fragt `/template-update` nicht mehr. (Achtung: damit verzichtet man auf REMOTE-Fortschritt fuer dieses File.)
