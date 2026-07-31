<!-- Copyright (c) 2025-2026 Wagner-Emden IT Services. All rights reserved. -->
---
user-invocable: true
description: Migriert ein Projekt mit FREMDEM oder KEINEM Template auf das n8n Project Template. Inventarisiert Bestand, schlaegt Mapping vor, schreibt nach Freigabe.
argument-hint: "[--dry-run] (Default) | [--apply] | [--from <commit>] | [--source <repo-url>]"
allowed-tools: Bash(git:*), Bash(rm:*), Bash(mkdir:*), Bash(cp:*), Bash(mv:*), Bash(ls:*), Bash(find:*), PowerShell, Read, Write, Edit, Glob, Grep, AskUserQuestion
---

# /template-migrate — Projekt auf n8n Project Template heben

Hebt ein bestehendes Projekt (kein Template oder Fremd-Template) auf das
n8n Project Template. Inventarisiert vorhandene Dev-Infrastruktur, mappt
auf n8n-Template-Aequivalente, fragt bei jedem Konflikt nach.

**Wann verwenden:**
- Projekt hat kein `.template-version.json` und kein `.n8n-template/manifest.json`
- Projekt hat ein anderes Template-Stempel (z.B. ai-coding-starter-kit)
- Projekt wurde manuell aufgesetzt und soll auf den Standard-Pfad

**Default: Dry-Run.** Ohne `--apply` wird nur ein Migrationsplan geschrieben.

---

## Workflow

### Schritt 0: Argumente

- `--apply` → schreibt nach User-Freigabe
- `--from <commit>` → REMOTE auf bestimmten Stand pinnen (Default: latest Tag von source_repo)
- `--source <repo-url>` → uebersteuert Default-Source (Default: `https://github.com/Wagner-Emden-IT-Services/n8n-project-template`)

### Schritt 1: Vorbedingungen

1. Pruefe: ist das Projekt bereits auf dem n8n Project Template?
   - `.template-version.json` mit `template == "n8n-project"` → STOPP, "Projekt basiert bereits auf dem n8n Project Template. Fuer Updates: `/template-update`."
2. Git-Status sauber? Falls uncommitted Aenderungen: User-Frage "Migration mit uncommitted Changes durchfuehren? Empfehlung: erst committen oder stashen."
3. Ist `gh` verfuegbar und `git` initialisiert? Falls nicht initialisiert: User-Frage "git-init durchfuehren?"

### Schritt 2: Inventur des Ist-Stands

Scanne folgende Bereiche und sammele Befunde in `_migration-inventory.json` (temporaer):

**.claude/**
- `commands/*.md` (Liste mit Namen + 1-Zeilen-Beschreibung aus Frontmatter)
- `agents/*.md`
- `skills/**/SKILL.md`
- `rules/*.md`
- `hooks/**`
- `settings.json`, `settings.local.json`, `customer.json` (Existenz, KEINE Inhalts-Dumps wegen Secrets)
- `memory/MEMORY.md` und Strukturordner

**Root**
- `CLAUDE.md`, `README.md`, `LICENSE.md`
- `.mcp.json`
- `.gitignore`
- `docs/` (Files-Liste)
- `docs/specs/INDEX.md` + Specs
- `workflows/` (n8n-Workflow-JSONs, falls vorhanden)
- `.github/workflows/*`

**Template-Marker (anderer Templates)**
- `.template-version.json` (falls Fremd-Template)
- `.git-source.json`
- Andere Verzeichnisse mit Versions-Marker

**Stack-Detection (leichtgewichtig)**
- `package.json` Top-Level-Deps (max 20 zeigen)
- `pyproject.toml`, `go.mod`, `Cargo.toml`, `Gemfile` — nur Existenz + Hauptframework

### Schritt 3: REMOTE-Template clonen

```
$tmp = "$env:TEMP/n8n-template-migrate-$(Get-Date -UFormat %s)"
git clone --depth 1 --branch main <source> $tmp
```

Falls `--from`: `git checkout` im `$tmp`.

REMOTE-Manifest in `$tmp/.n8n-template/manifest.json` lesen → liste aller n8n-Template-Pflicht-Files.

### Schritt 4: Mapping-Vorschlag erstellen

Erzeuge eine Mapping-Tabelle. Pro Eintrag eine Decision-Klasse:

| Klasse | Bedeutung |
|--------|-----------|
| `AUTO-ADOPT` | Datei existiert lokal UND im REMOTE auf gleichem Pfad → REMOTE-Version wird genutzt. Lokal-Version geht in `docs/legacy/<datum>/<pfad>` als Backup. |
| `MAP-AND-PRESERVE` | Lokaler Inhalt ist relevant, REMOTE-Datei hat andere Struktur. Lokaler Inhalt wird in `<!-- PROJECT:START/END -->`-Block in der REMOTE-Datei portiert. |
| `PROJECT-SPECIFIC` | Kein REMOTE-Aequivalent — Lokal-Datei bleibt unveraendert (wird vom Manifest als USER-GENERATED markiert wenn unter `docs/` o.ae., sonst per `docs/legacy/`). |
| `DROP` | Anti-Pattern erkannt (Duplex Skills, hardcoded Secrets, Bug). Wird mit Begruendung archiviert, nicht uebernommen. |

**Auto-Erkennung haeufiger Anti-Patterns:**
- `.agents/` Ordner UND `.claude/skills/` mit gleichen Skill-Namen → Duplex-Skills → DROP `.agents/`.
- `Bearer\s+sb_` oder `Bearer\s+sk_` in `.mcp.json` → hardcoded Secret → DROP, durch `${ENV_VAR}` ersetzen.
- `name: "ai-coding-starter-kit"` in `package.json` → generischer Name → User-Frage nach echtem Projekt-Namen.
- `.claude/settings.local.json` mit echten Secrets → User-Frage nach Bereinigung.

**Inhalts-Mapping fuer geteilte Files:**
- `CLAUDE.md` lokal hat z.B. eine "Tech Stack"-Sektion → wird in den REMOTE-MARKER-Block `tech-stack-summary` portiert. Andere lokale Inhalte → `<!-- PROJECT:START/END -->`-Block.
- `.claude/rules/general.md` lokal hat eigene Sektionen → User-Frage pro Sektion: in REMOTE-`general.md` mergen oder als eigene Rule `.claude/rules/local-conventions.md`?
- `.claude/skills/<name>/SKILL.md` der bundled Skills lokal angepasst → bleibt drin (UPDATABLE-WITH-DIFF im Manifest, bei `/template-update` later mit Diff-Check).

Schreibe Plan nach `.n8n-template/_migration-plan.md` (Markdown, lesbar fuer User).

### Schritt 5: Plan praesentieren

```
Migrationsplan: <projekt-name> -> n8n-template v<VERSION>

Erkanntes Ist-System: <Stack-Beschreibung, Templates falls vorhanden>

Aktionen (Vorschau):

AUTO-ADOPT (X)         — REMOTE installieren, lokal nach docs/legacy/
  ~ .claude/commands/onboard.md
  ~ .claude/commands/change-workflow.md
  ...

MAP-AND-PRESERVE (Y)   — lokaler Inhalt in MARKER-Block portieren
  ⇄ CLAUDE.md (tech-stack-summary, projekt-text → PROJECT-Block)
  ...

PROJECT-SPECIFIC (Z)   — lokale Inhalte bleiben, als USER-GENERATED markiert
  · docs/PRD.md
  · docs/specs/INDEX.md mit X Eintraegen
  ...

DROP (D)               — Anti-Pattern, wird archiviert
  ✗ .agents/ (Duplex zu .claude/skills/) → docs/legacy/<datum>/.agents/
  ✗ .mcp.json mit hardcoded Token → docs/legacy/<datum>/.mcp.json, REMOTE-Stub installieren
  ...

NEU (N)                — n8n-Template-Files die lokal noch nicht existieren
  + .n8n-template/manifest.json
  + scripts/n8n-cli.mjs
  + .github/workflows/validate-workflows.yml
  ...

Versions-Stempel: .template-version.json wird mit version=v<VERSION>, installed_via="migrate" angelegt.
```

### Schritt 6: User-Entscheidungen einsammeln

Fuer jeden `MAP-AND-PRESERVE` und jeden `DROP`-Eintrag User-Bestaetigung:

```
AskUserQuestion: "CLAUDE.md (lokal 87 Zeilen, REMOTE 56 Zeilen): wie portieren?"
  - "Auto-Vorschlag (Tech-Stack-Sektion → tech-stack-summary-Block, Rest → PROJECT-Block)" (Recommended)
  - "Lokal komplett in PROJECT-Block, REMOTE-Sektionen leer lassen"
  - "Lokal verwerfen, nur REMOTE-Template nutzen (lokale Version nach docs/legacy/)"
```

```
AskUserQuestion: "Duplex-Skills (.agents/) erkannt. Wirklich nach docs/legacy/ archivieren und nur .claude/skills/ behalten?"
  - "Ja, archivieren"
  - "Nein, .agents/ behalten und als USER-GENERATED markieren"
```

Sammle Entscheidungen in `_migration-decisions.json`.

### Schritt 7: Wenn Dry-Run — STOPP

Wenn nicht `--apply`:
- Ausgabe: "Dry-Run. Migrationsplan in `.n8n-template/_migration-plan.md` — Review und dann `/template-migrate --apply`."
- Cleanup `$tmp`
- STOPP

### Schritt 8: Migration anwenden (nur --apply)

Reihenfolge wichtig (atomar pro Stufe):

**8a. Backup-Sektion**
```
mkdir -p docs/legacy/<datum>
```

**8b. DROP-Files archivieren**
- Pro DROP: `mv <lokaler-pfad> docs/legacy/<datum>/<pfad>`
- Archive-Notiz in `docs/legacy/<datum>/MIGRATION_NOTES.md`

**8c. REMOTE-Files installieren (analog Apply-Update.ps1 mit Override)**

Erzeuge `_migration-overrides.json` aus den User-Entscheidungen und rufe `Apply-Update.ps1` auf — aber mit Spezial-Logik fuer MAP-AND-PRESERVE:
- Bei MAP-AND-PRESERVE: erst REMOTE-File installieren, dann lokalen Inhalt in `<!-- PROJECT:START/END -->`-Block einsetzen (an passender Stelle, typischerweise nach Frontmatter/Header).

**8d. `.template-version.json` und `.n8n-template/manifest.json` schreiben**

```
.template-version.json:
{
  "schema_version": "1.2",
  "template": "n8n-project",
  "version": "<REMOTE-VERSION>",
  "installed_at": "<heute>",
  "installed_via": "migrate",
  "source_repo": "<source>",
  "target_repo": null,         // wird von /onboard (Phase 2/6 GitHub-Setup) befuellt
  "customer_slug": null,
  "project_slug": null,
  "manifest_path": ".n8n-template/manifest.json",
  "last_update_at": null,
  "last_update_from_version": null
}
```

Dann Manifest aus dem JETZIGEN Stand des Projekts generieren:
```
pwsh .n8n-template/Generate-Manifest.ps1 -Root . -TemplateVersion <REMOTE-VERSION>
```

Bei Migration ist BASE == LOCAL (Manifest beschreibt den jetzigen Stand) — beim ersten `/template-update` ist also LOCAL == BASE und es gibt keine OVERWRITE-WITH-BACKUP-Konflikte fuer Files die wir gerade frisch installiert haben.

**8e. MIGRATION_REPORT.md schreiben**

`docs/legacy/<datum>/MIGRATION_REPORT.md` mit:
- Datum, source_repo, source-Version
- Tabelle aller Aktionen (AUTO-ADOPT/MAP-AND-PRESERVE/PROJECT-SPECIFIC/DROP)
- User-Entscheidungen pro Entry
- Liste archivierter Files mit DROP-Begruendung
- Liste neuer Files
- Hinweis: "Nach erfolgreicher Verifikation kann `docs/legacy/<datum>/` ins Archiv verschoben oder geloescht werden."

**8f. Bug-Migration (PFLICHT seit v1.7.0)**

Wenn REMOTE-Version `>= 1.7.0`: nach erfolgreicher 8d (Manifest-Init) folgt automatisch eine Bug-Migration-Phase analog zu `/template-update` Schritt 1b-v17.

Voraussetzungen:
- `gh auth status` OK
- `.template-version.json` `target_repo` muss bereits gesetzt sein. Bei `/template-migrate` ist das typischerweise noch null — in diesem Fall wird die Bug-Migration **verschoben**: User bekommt Hinweis "Bug-Migration uebersprungen — wird beim naechsten `/template-update` nach erfolgreichem GitHub-Setup via `/onboard` (Phase 2/6) nachgeholt." Audit-Eintrag `BUG_MIGRATION_DEFERRED`.

Bei vorhandenem target_repo: Ablauf identisch zu /template-update Schritt 1b-v17 (Scan, User-Choice, gh issue create, Source-File-Cross-Reference, Audit-Log).

### Schritt 9: Audit-Log

```
<ts>\tMIGRATE\t-\t<REMOTE-VERSION>\t<written>\t<dropped>\t<preserved>\t<archived>
```

### Schritt 10: Cleanup + Verifikations-Hinweis

- `Remove-Item -Recurse -Force $tmp`
- Hinweis an User:
  ```
  Migration abgeschlossen — n8n-template v<VERSION> installiert.
  
  Verifikations-Schritte:
    1. /onboard durchlaufen — Phasen 0-7 (Project Identity, Staging, GitHub, Hosting, Credentials, Optionen, Bootstrap, PRD).
    2. /template-check — sollte "aktuell" melden.
    3. /template-update --apply (Dry-Run) — sollte 0 Konflikte und 0 Updates zeigen.
    4. docs/legacy/<datum>/MIGRATION_REPORT.md durchlesen + bestaetigen.
    5. git diff + commit.
  ```

---

## Hinweise

- **Niemals destructive ohne --apply.** Default ist Dry-Run; `--apply` schreibt erst nach User-Bestaetigung pro Konflikt.
- **DSGVO-Schutz:** `customer.json` wird NICHT in den Plan aufgenommen (Stand wird mitgenommen, Inhalt nicht gedumpt). Bei `--apply` bleibt das File unangetastet.
- **Secrets-Erkennung ist heuristisch.** Wenn ein hardcoded Token nicht erkannt wird (z.B. eigener Pattern), trotzdem manuell pruefen — `.mcp.json` und `.env*` nach `--apply` durchsuchen.
- **Lokal-Conventions-Block:** Wenn lokale Rules-Files (`.claude/rules/local-conventions.md`) entstanden sind, im naechsten `/template-update` als USER-GENERATED markieren (in `protection-rules.json` Eintrag ergaenzen — gilt Cross-Update).
- **Bei Fremd-Template mit `.template-version.json`:** Der alte Stempel wird mit ins `MIGRATION_REPORT.md` aufgenommen und das File gedroppt (wird durch das neue `.template-version.json` ueberschrieben).
