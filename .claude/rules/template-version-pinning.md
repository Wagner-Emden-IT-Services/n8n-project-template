# Template-Version-Pinning Rule

> Diese Rule schuetzt die Update-Faehigkeit des Projekts. Sie regelt,
> welche Files vom Template-Update-Mechanismus (`/template-update` ab v0.6.0)
> ohne Rueckfrage ueberschrieben werden duerfen und welche nicht.

> **Hinweis (seit v0.6.0):** Verbindlich ist das 4-Tier-Modell aus
> `.n8n-template/protection-rules.json` + `UPDATING.md` (FROZEN /
> UPDATABLE-WITH-DIFF / MARKER-AWARE / USER-GENERATED). Die drei Klassen
> unten sind die historische Kurzfassung — im Konflikt gewinnt das Manifest.

## Hintergrund

`.template-version.json` markiert das Projekt als Instanz von
`n8n-project-template`. Bei einem Template-Update werden Files in drei Klassen
behandelt: **Protected** (nie ueberschrieben), **Always-Overwrite**
(Template-Core, silent overwrite), **Diff-Check** (bei lokalen Aenderungen
Konflikt-Resolution).

Eine Aenderung an Always-Overwrite-Files wird beim naechsten Template-Update
ueberschrieben.

## Always-Overwrite (lokal NICHT bearbeiten)

Wer hier editiert, verliert die Aenderung bei `/template-update`. Wenn ein
Fix dauerhaft erforderlich ist: Issue oder PR im Source-Repo
(`Wagner-Emden-IT-Services/n8n-project-template`) statt lokaler Patch.

- `scripts/n8n-cli.mjs` + `scripts/lib/*.mjs` (Hash-Warnung wird vor Update
  ausgegeben — User entscheidet im Konfliktfall)
- `schemas/workflow-schema.json`
- `.gitleaks.toml`
- `.claude/commands/*.md` (alle Slash-Commands)
- `.claude/skills/n8n-*/` (alle Template-Skills)
- `.claude/agents/*.md` (alle Sub-Agents)
- `.claude/rules/onboard-required.md`
- `.claude/rules/prd-required.md` (ab v1.0.0)
- `.claude/rules/template-version-pinning.md` (diese Datei)
- `config/staging-profiles/*.yaml`
- `.github/workflow-templates/*`
- `docs/integrations/m365/*` (wenn `options.m365_module=true`)

## Protected (lokal frei aenderbar, nie ueberschrieben)

Diese Files gehoeren dem Projekt. Sie werden beim Template-Update unangetastet
gelassen.

- `CLAUDE.md` (nach Onboard projektspezifisch befuellt)
- `README.md`
- `docs/PRD.md` (ab v1.0.0)
- `docs/PROJECT_CONTEXT.md` (falls vorhanden)
- `docs/specs/WF-*.md`
- `docs/ONBOARD_LOG.md`
- `docs/integrations/credentials-setup.md`
- `docs/integrations/n8n-hosting.md`
- `.env`, `.env.example` (User customisiert in Phase 4)
- `config/env-mapping.yaml`
- `config/secrets-vault-map.json`
- `workflows/*.json`
- `backups/`
- `.claude/customer.json`
- `.template-version.json` (nur `version` und `installed_at` werden bei
  `/template-update` aktualisiert; alle anderen Felder bleiben)

## Diff-Check (bei lokaler Aenderung: User entscheidet)

- `.github/workflows/*.yml`
- `.gitignore`
- `docs/disaster-recovery.md`
- `.claude/rules/skills-context.md`
- Weitere `.claude/rules/general.md` falls vorhanden

## Verstoss-Verhalten

- `/template-update` warnt vor jeder Aenderung in Always-Overwrite, wenn der
  lokale SHA von der installierten Version abweicht (Hash-Warn-Schicht).
- `/template-update` zeigt Plan-Anzeige (Dry-Run via `--check`), bevor es
  schreibt. User kann jederzeit abbrechen.
- Protected-Files werden niemals ohne explizite User-Erlaubnis veraendert.

## Quelle

Eingefuehrt mit n8n-project-template v0.5.0 (Onboard-Wizard).
Drei-Klassen-Diff wird vollstaendig implementiert in v0.6.0
(`/template-check`, `/template-update`, `/template-migrate`).
