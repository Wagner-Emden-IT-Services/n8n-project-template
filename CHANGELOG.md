# Changelog

Format folgt [Keep a Changelog](https://keepachangelog.com/de/1.1.0/), Versionierung nach [Semantic Versioning](https://semver.org/lang/de/).

## 2026-07-31 — v1.2.0 (Issue-Batch: Praxis-Lessons, Sticky-Notes-Hard-Rule, DataTable-Upsert-Validator)

Leert den kompletten Issue-Backlog (fixes #15, #16, #17, #18, #19, #20, #35; relates to #32). Alle Wissens-Items stammen aus dem produktiven Hoheisen-Incident 2026-05-17 (DataTable-Bloat 2.608 -> 144.049 Rows, Host-OOM, TZ-Drift).

### Added

- **DataTable-Upsert-Validator** (#16) — `checkDataTableUpserts()` in `scripts/lib/validate.mjs`: jeder `dataTable`-Node mit `operation: upsert` braucht nicht-leere `matchingColumns`, valide `filters.conditions` (kein leeres Objekt) und die Key-Column im `columns.value`-Mapping (letzterer Check entfaellt bei `mappingMode: autoMapInputData` — dort ist leeres `value` legitim) — sonst Validation-ERROR mit Silent-Insert-Bloat-Hinweis (AJV-Error-Shape, greift in CLI `validate` + CI). 10 neue Vitest-Tests (Suite: 51/51 gruen); CLI-Verhalten manuell gegen eine Fehlkonfigurations-Fixture verifiziert (`node scripts/n8n-cli.mjs validate` → 2 Errors, Exit 1). Dazu Sektion "DataTable Upsert Silent Bloat" in `docs/troubleshooting.md` (Detection-SQL, Cleanup mit Backup-Warnung).
- **`docs/integrations/n8n-code-node-pitfalls.md`** (#18, #20) — Branch-Sibling-Lookup auf NoOp-Nodes (`$('NoOp').all()` liefert `[]`, Workaround Math-Derivation) + `pairedItem` mit `sourceOverwrite` fuer Multi-Input Code-Nodes. Kurzformen in `.claude/skills/n8n-code-javascript/SKILL.md` (Production Gotchas).
- **`docs/troubleshooting.md`**: Sektion "DataTable dateTime TZ-Bug" (#15) — Symptom, Detection-SQL, `.toISOString()`-Workaround, Altbestand-Korrektur mit DST-Warnung.
- **`docs/runbook.md`**: Sektion `N8N_CONCURRENCY_PRODUCTION_LIMIT` (#17) — Wirkweise (FIFO-Queueing, instanz-weit, Default unlimited), 5-Punkte-Trigger-Liste, Docker-Setup. `.env.example` um die Variable (auskommentiert) ergaenzt.
- **Sticky-Notes-Pflege Hard-Rule** (#19) — `.claude/rules/general.md`: nach jedem Workflow-Edit alle Sticky-Notes gegen die reale Node-Konfiguration verifizieren; driftende Stickys im selben Edit korrigieren/entfernen. `n8n-workflow-reviewer` Kategorie 4 prueft Sticky-vs-Config-Drift jetzt verpflichtend (Drift = BLOCKER).
- **CLAUDE.md Section 7**: vier neue Hard-Earned Lessons (dateTime-TZ, Upsert-Silent-Insert, Concurrency-Limit, NoOp-Lookup).

### Changed

- **`scripts/lib/config.mjs`** — js-yaml auf Named-Import umgestellt (kompatibel mit v4 UND v5; js-yaml 5 hat den Default-Export entfernt). Macht den Dependabot-PR #32 (prod-deps) mergebar, dessen CI daran scheiterte.
- **`.n8n-template/protection-rules.json`** (#35) — 18 tote golden-dev-Regeln entfernt (84 -> 66; jede einzeln gegen Repo-Baum, Lazy-Create-Referenzen und `git log --all` verifiziert; Lazy-Create-Ziele wie `skills-context.md`, `.claude/memory/**` bewusst behalten).
- **`UPDATING.md` / `.claude/commands/template-update.md`** (#35) — golden-dev-Versions-Beispiele (v1.5/v1.6/v1.7, "1b-v17") auf die reale n8n-Template-Historie umgestellt; keine Mechanik-Aenderung.
- **`.template-version.json`** (#35) — `schema_version` 1.1 -> 1.2 (Felder `installed_via`, `manifest_path`, `last_update_at`, `last_update_from_version` — Commands beschrieben Schema 1.2 bereits seit v0.6.0); `version` 1.2.0.
- **`package.json`** — Version 1.2.0.
- **`.n8n-template/manifest.json`** — regeneriert (LF-normalisierte Hashes, s.u.).
- **Delivery-Luecke geschlossen** — `protection-rules.json` +7 Regeln: `scripts/lib/**`, `tests/**`, `schemas/**`, `package.json`, `package-lock.json`, `.env.example` -> UPDATABLE-WITH-DIFF, `tests/pins/**` -> USER-GENERATED. Vorher waren Validator/CLI-Lib/Tests fuer `/template-update` unsichtbar — Bestandsprojekte haetten den Versions-Stempel 1.2.0 ohne die Features bekommen.
- **`onboard.md`** — schreibt jetzt alle Schema-1.2-Felder (`installed_via: "onboard"` etc.); tote Referenzen bereinigt (`01-bug.yml` -> 02-workflow-bug.yml, Hook-Erwaehnungen in `03-template-bug.yml`/`qa-workflow`, v1.7.0-Platzhalter).

### Fixed

- **CRLF-abhaengige Manifest-Hashes** — `Generate-Manifest.ps1` + `Compute-Update-Plan.ps1` hashen jetzt line-ending-normalisiert (CRLF -> LF vor SHA-256, byte-identische Zwillings-Funktion in beiden Skripten). Vorher hingen die Hashes vom `core.autocrlf`-Setting des Checkouts ab — LF-Checkouts (Linux-CI, WSL) haetten bei `/template-update` flaechendeckend falsche Konflikte gesehen.
- **`version-merge` war deklariert, aber nie implementiert** — `.template-version.json` lief als plain FROZEN: der Auto-Upgrade 1.1 -> 1.2 haette den befuellten Kunden-Stempel mit dem `{{PLACEHOLDER}}`-File ueberschrieben. `Compute-Update-Plan.ps1` setzt `special: version-merge`-Eintraege jetzt fix auf KEEP-LOCAL (Versions-Felder pflegt der `/template-update`-Command in Schritt 1a/8).
- **Pre-Commit-Hook rief `normalize --in/--out` auf** (Flags existieren nicht — jeder Commit mit staged Workflow-JSON brach ab; gleiche Drift-Klasse wie das in v0.6.1 gefixte #22, der Hook wurde damals uebersehen). Jetzt `normalize "<file>"` gemaess echter CLI-Signatur. `refs #22`.

### Notes

- Kein neues Hard-Gate; der Upsert-Validator laeuft im bestehenden `validate`-Gate (5 Pflicht-Pre-Checks vor Deploy).
- Verhaltensaenderung: `npm run validate` schlaegt jetzt auch bei schema-validen Workflows mit Upsert-Fehlkonfiguration fehl — gewollt (genau der Silent-Bloat-Fall).
- **Reichweite fuer Bestandsprojekte** via `/template-update`: Validator + CLI-Lib + Tests, Skill-Updates, Rules und Update-Mechanik kommen an; die Doku-Nachtraege in `docs/**` und die CLAUDE.md-Lessons (User-Land bzw. ausserhalb der Marker-Bloecke) erreichen nur Neu-Installationen — bei Bedarf manuell uebernehmen.

## 2026-07-31 — v1.1.0 (Prozess-Skills: mattpocock/skills adaptiert + Workflow-Verdrahtung)

Sieben Prozess-Skills aus [mattpocock/skills](https://github.com/mattpocock/skills) (MIT, Upstream-Commit `2ab9580` vom 2026-07-28) projekt-lokal vendored, fuer n8n adaptiert und an die bestehenden Pipeline-Gates verdrahtet.

### Added

- **`.claude/skills/{grilling,grill-me,grill-with-docs,domain-modeling,handoff,diagnosing-bugs,research}/`** — adaptierte Prozess-Skills (Details + Attribution: `.claude/skills/_README.md`, Lizenz: `.claude/skills/_LICENSE-mattpocock.md`). Kern-Adaptionen: `handoff` schreibt nach `docs/sessions/` + aktualisiert `docs/STATE.md` (statt OS-Temp) mit verschaerfter Secret-Redaktion; `diagnosing-bugs` mit n8n-Feedback-Loops (curl-gegen-Webhook, Execution-Replay, Pin-Daten) und Post-Mortem als GitHub-Issue; `research` mit Perplexity/Context7-Backends, Inline-Fallback fuer Sub-Agent-Kontexte und Zitierpflicht nach `docs/research/` bzw. `docs/integrations/<service>/`; `domain-modeling` auf `CONTEXT.md` + `docs/adr/` gemappt; `grill-with-docs` + `handoff` model-invoked gestellt (upstream user-only), damit Pipeline und Session-Ende-Check sie laden koennen.

### Changed

- **`.claude/commands/prd-generate.md`** — Standard-Schritt "Grilling-Pass" zwischen PRD-Generierung und `Status: APPROVED` (per `/grilling`, ueberspringbar nur durch aktive Owner-Entscheidung mit Vermerk).
- **`.claude/agents/n8n-workflow-analyst.md`** — Spec-Phase schaerft unklare Anforderungen via `/grill-with-docs` vor dem Schreiben der WF-X-Spec; `Skill` in die Tool-Whitelist aufgenommen.
- **`.claude/agents/n8n-integration-architect.md`** — API-Fakten zu Drittsystemen werden via `/research` belegt statt angenommen (inline, mit WebFetch/WebSearch-Fallback), bevor das Technical Design finalisiert wird; `Skill`, `WebFetch`, `WebSearch` in die Tool-Whitelist aufgenommen.
- **`.claude/commands/change-workflow.md`** — Issue-/Bug-Fix-Modus: Pflicht-Diagnose-Phase via `/diagnosing-bugs` vor der Build-Phase; Phasen-Gates empfehlen `/handoff` bei Session-Wechsel.
- **`.claude/rules/general.md`** — Session-Ende-Check um `/handoff` ergaenzt.
- **`.claude/commands/help-workflow.md` / `.claude/commands/next-recommend.md`** — Prozess-Skills in `--first-steps` bzw. Empfehlungs-Heuristik aufgenommen.
- **`CLAUDE.md`** — Marker-Block `n8n-pipeline` (v1.1.0): Prozess-Skills-Tabelle + Auto-loaded Skills der Spec-/Architecture-Phase erweitert. Section 14 Memory-System auf aktuelle Commands (`/remember`, `/memory-cleanup`, `/memory-install`) korrigiert.
- **`.claude/commands/template-{check,update,migrate}.md`, `UPDATING.md`** — golden-dev Copy-Drift bereinigt (Naming + Referenzen auf nicht-existente Dateien). Darunter zwei Verhaltens-Fixes: der Bereits-installiert-Guard in `/template-migrate` prueft jetzt `template == "n8n-project"` (der alte Wert `"n8n-template"` konnte nie matchen — Erkennung war tot) und der Inventar-Scan nutzt `workflows/` statt des nicht-existenten `prompts/`. UPDATING.md-Klassen-Listen mit `protection-rules.json` abgeglichen (Phantom-Referenz `skills-context.md` entfernt, MARKER-AWARE auf die real existierenden Bloecke `bug-tracking` + `n8n-pipeline` reduziert).
- **`.claude/rules/prd-required.md`** — widerspruechliche Bug-Fix-Ausnahme eindeutig formuliert: Bug-Fix an bestehendem Workflow = echte Ausnahme ohne Flag; `--bypass-prd` nur fuer neue Workflows ohne approved PRD.
- **`.claude/rules/template-version-pinning.md`** — Hinweis ergaenzt, dass das 4-Tier-Modell (protection-rules.json + UPDATING.md) verbindlich ist; die 3-Klassen-Beschreibung ist historisch.
- **`.n8n-template/Generate-Manifest.ps1`** — Manifest-Header `template` von `n8n-template` auf `n8n-project` korrigiert (matcht `.template-version.json`).
- **`README.md`** — Feature-Bullet fuer die Prozess-Skills.
- **`.n8n-template/protection-rules.json`** — Luecken geschlossen: Catch-all `.claude/commands/**` -> FROZEN (bisher fielen Commands ohne Einzel-Regel — u.a. das v1.0.0-`prd-generate.md` und alle Lint-/Deploy-Commands — still aus dem Manifest und wurden von `/template-update` NIE ausgeliefert; Doktrin lt. `template-version-pinning.md` ist Always-Overwrite fuer Commands). Zusaetzlich `.claude/rules/{prd-required,onboard-required,template-version-pinning}.md` -> FROZEN, `.claude/skills/_README.md` + `_LICENSE-mattpocock.md` + Companion-Dateien der Prozess-Skills (`domain-modeling/*`, `diagnosing-bugs/scripts/*`) -> UPDATABLE-WITH-DIFF. Tote Regel `.claude/skills/qa-workflow/SKILL.md -> FROZEN` entfernt (wurde von `.claude/skills/**/SKILL.md -> UPDATABLE-WITH-DIFF` bei first-match immer verdeckt; Manifest-Verhalten unveraendert). `managed_blocks` der CLAUDE.md auf die real existierenden Bloecke reduziert.
- **`.n8n-template/manifest.json`** — regeneriert; war seit v0.6.0 stale (v0.7.0-/v1.0.0-/v1.1.0-Dateien fehlten). Neue Skills als UPDATABLE-WITH-DIFF.
- **`docs/sessions/.gitkeep`** — Verzeichnis fuer `/handoff`-Session-Protokolle liegt jetzt im Template (Regel existierte bereits).
- **`package.json` / `.template-version.json`** — Version auf `1.1.0`.

### Notes

- Kein neues Hard-Gate. Grilling-Pass und Diagnose-Phase sind Standard-Schritte der jeweiligen Commands, Bypass-Semantik unveraendert.
- Doppel-Trigger-Hinweis: Plugin `mattpocock-skills` nicht parallel in Template-Projekten aktivieren (siehe `_README.md`).

Konsumenten-Projekte ziehen v1.1.0 via `/template-update` (neue Skill-Ordner kommen als UPDATABLE-WITH-DIFF; der CLAUDE.md-Marker-Block `n8n-pipeline` wird ersetzt, Rest der CLAUDE.md bleibt User-Land).

## 2026-07-21 — v1.0.0 (PRD-First: /prd-generate + prd-required Hard-Gate)

Loest das seit v0.5.0 als Roadmap gefuehrte PRD-First-Feature ein. `fixes #30`.

### Added

- **`.claude/skills/n8n-prd-generator/`** — adoptierter 3-Phasen-Interview-Skill (Initial Understanding -> Clarifying Questions -> PRD-Generierung) mit Template-Integrations-Note. Der bisherige Spec-Phasen-Verweis auf `n8n-prd-generator` (Pipeline) war ein Dangling-Reference — jetzt real gebuendelt.
- **`/prd-generate`** (`.claude/commands/prd-generate.md`) — erzeugt projekt-weit `docs/PRD.md` im 12-Sektionen-Format aus `docs/PRD.template.md`. Wrappt den Skill, mappt Antworten in die Template-Sektionen, context7 fuer Service-/API-Fakten, Status DRAFT -> Owner-Review -> APPROVED. `--update` fuer Refresh.
- **`.claude/rules/prd-required.md`** — neuer Hard-Gate: `docs/PRD.md` muss `Status: APPROVED` tragen und frei von `{{`-Placeholdern sein, bevor ein Workflow gebaut oder deployt wird. Gated Sub-Agents + `/deploy-workflow` + Build-Phase von `/change-workflow`. Override `--bypass-prd` mit Audit-Log. Ausnahmen: /onboard, /prd-generate, read-only Lints, Template-Lifecycle, Bug-Fix an bestehenden Workflows.

### Changed

- **`CLAUDE.md`** — Section 0 Punkt 2 (PRD jetzt aktiv statt "ab v1.0.0"); Hard-Gates-Liste +`prd-required`; Section 11 +`/prd-generate`.
- **`.claude/commands/change-workflow.md`** — Schritt 0 Vorbedingungen +`prd-required`; Schritt 4 Hard-Gate-Verifikation +`prd-required`; Flag `--bypass-prd`.
- **`.claude/rules/general.md`** — Hard-Gates-Liste +`prd-required`.
- **`.claude/commands/onboard.md`** — Phase 7 ruft `/prd-generate` real auf (statt "sobald in v1.0.0 verfuegbar").
- **`docs/PRD.template.md`, `README.md`, `docs/ONBOARDING.md`, `docs/ONBOARD_LOG.md`, `.claude/skills/_README.md`** — "ab v1.0.0"-Vermerke auf aktiv umgestellt, Skill dokumentiert.
- **`package.json` / `.template-version.json`** — Version auf `1.0.0`.

### Breaking

- **Neuer Hard-Gate `prd-required`.** Ab v1.0.0 blockieren Sub-Agents, `/deploy-workflow` und die Build-Phase von `/change-workflow`, solange keine `docs/PRD.md` mit `Status: APPROVED` (und ohne `{{`-Placeholder) existiert. **Bestehende Projekte** ohne approved PRD muessen vor dem naechsten Build `/prd-generate` durchlaufen (oder bewusst `--bypass-prd` mit Audit-Log setzen). Reine Bug-Fixes an bestehenden Live-Workflows sind ausgenommen.

Konsumenten-Projekte ziehen v1.0.0 via `/template-update` (Skill unter `.claude/skills/n8n-*/`, Command + Rule als Always-Overwrite-Klasse).

## 2026-07-19 — v0.7.0 (Workflow-Reviewer-Skill + Post-Build-Review)

Neuer statischer Review-Skill, der nach jedem Build/Edit eines Workflows laeuft — vor Validate/Deploy.

### Added

- **`.claude/skills/n8n-workflow-reviewer/`** — adoptierter 5-Kategorien-Audit-Skill (Errors & Breaks, Missing Error Handling, Performance & Efficiency, Structure & Maintainability, Summary + Score). Laeuft als Post-Build-Review ueber `workflows/*.json` und ergaenzt `qa-workflow` (statischer Review zuerst, dann Test-Ausfuehrung). Skill-Description um einen Post-Build-Trigger erweitert, damit der Skill nach dem Bauen/Aendern automatisch feuert.
- **`.claude/rules/general.md`** — neue Sektion "Post-Build-Review": nach jedem Workflow-Build/-Edit ist der Reviewer Pflicht-Schritt vor Validate/Deploy. `relates to #19` (Sticky-Notes-Pflege nach Workflow-Edits wird von Kategorie 4 des Reviewers mit-adressiert).

### Changed

- **`CLAUDE.md`** — "Workflow fuer jede Aenderung" (Section 4) um Schritt 3 "Review" erweitert (Sequenz jetzt 8-stufig). Pipeline-Tabelle: `n8n-workflow-reviewer` in die Build-Phase aufgenommen.
- **`.claude/commands/change-workflow.md`** — Build-Phase laedt `n8n-workflow-reviewer` als Abschluss-Review vor der Test-Phase.
- **`package.json` / `.template-version.json`** — Version auf `0.7.0` (letztere war seit v0.4.0 auf `0.5.0` haengen geblieben, jetzt mit-gebumpt).

### Why

- User-Vorgabe: der Reviewer-Skill soll sinnvoll nach dem Bauen/Aendern JEDES n8n-Workflows genutzt werden — verankert in der kanonischen Aenderungssequenz + Pipeline + Rule, statt nur description-getriggert.

Konsumenten-Projekte ziehen v0.7.0 via `/template-update` (der Skill liegt unter `.claude/skills/n8n-*/` → Always-Overwrite-Klasse, kommt automatisch mit).

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
