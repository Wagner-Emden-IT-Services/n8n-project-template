<!-- Copyright (c) 2025-2026 Wagner-Emden IT Services. All rights reserved. -->
---
user-invocable: true
description: Aktualisiert das Golden-Dev-Template aus GitHub mit Hash-Manifest, 3-Wege-Diff und 4-Tier-Schutz. Default Dry-Run.
argument-hint: "[--apply] um wirklich zu schreiben. [--force-frozen] ueberschreibt geaenderte FROZEN-Files ohne Backup-Bestaetigung."
allowed-tools: Bash(git:*), Bash(rm:*), Bash(mkdir:*), Bash(mv:*), Bash(ls:*), PowerShell, Read, Write, Edit, AskUserQuestion
---

# /template-update — Golden-Dev-Template aktualisieren

Aktualisiert das Template auf die neueste Version von GitHub. Sicher dank
**4-Tier-Schutz** und **3-Wege-Diff** ueber `.n8n-template/manifest.json`.

**Default: Dry-Run.** Ohne `--apply` werden nur Aenderungen angezeigt, nichts geschrieben.

---

## Workflow

### Schritt 0: Argumente parsen

- `--apply` → schreibt nach User-Bestaetigung pro Konflikt-Gruppe
- `--force-frozen` → ueberschreibt geaenderte FROZEN-Files ohne nochmalige Bestaetigung (Backup `.bak.<ts>` wird trotzdem angelegt)
- `--from <commit>` → optional: vergleicht gegen einen bestimmten REMOTE-Stand (Default: latest Tag)

Setze Variablen:
- `$applyMode` = true wenn `--apply` enthalten
- `$forceFrozen` = true wenn `--force-frozen` enthalten

### Schritt 1: Vorbedingungen pruefen

1. `.template-version.json` lesen.
   - Falls nicht vorhanden: STOPP — "Kein Template-Stempel. Fuer Migration aus einem Fremd-Template: `/template-migrate` verwenden."
2. Schema-Version pruefen:
   - `schema_version == "1.2"`: weiter.
   - `schema_version == "1.1"` oder `"1.0"`: **AUTO-UPGRADE** triggern (siehe Schritt 1a), dann weiter.
   - Andere Version: STOPP — "Unbekannte Schema-Version. Bitte Template-Maintainer kontaktieren."
3. `.n8n-template/manifest.json` lesen.
   - Falls nicht vorhanden: STOPP — "Manifest fehlt. Repariere mit `/template-migrate` oder manuell via `pwsh .n8n-template/Generate-Manifest.ps1`."

### Schritt 1a: Schema-Auto-Upgrade (1.1 → 1.2)

Wenn Schema 1.1 erkannt:
- Lies bestehende Felder
- Schreibe `.template-version.json` neu mit:
  - `schema_version: "1.2"`
  - Alle Bestandsfelder uebernehmen
  - Neue Felder: `installed_via: "auto-upgrade-from-1.1"`, `manifest_path: ".n8n-template/manifest.json"`, `last_update_at: null`, `last_update_from_version: null`
- Falls `.n8n-template/manifest.json` fehlt: erstmal **PSEUDO-Manifest** mit aktuellen Hashes generieren (BASE = LOCAL — Diff wird beim ersten Update neutral sein):
  ```
  pwsh .n8n-template/Generate-Manifest.ps1 -Root .
  ```
- Audit-Log: `<ts> SCHEMA_UPGRADE 1.1 1.2 - - - -`

### Schritt 1b-v17: Bug-Migration v1.6.x → v1.7.x (one-shot, automatisch)

Aktiv wenn lokale Version `< 1.7.0` UND REMOTE-Version `>= 1.7.0`. Konvention seit v1.7.0: Bugs ausschliesslich in GitHub-Issues. Dieser Schritt migriert die Legacy-Bug-Pflegestellen einmalig.

**Voraussetzungen:**
- `gh auth status` OK (sonst STOPP: User soll `gh auth login` durchlaufen)
- `.template-version.json` `target_repo` muss befuellt sein (sonst STOPP: "Kein Repo — /onboard Phase 5.7 nachholen bevor v1.7-Migration moeglich ist. Alternative: `/template-update --skip-bug-migration` ueberspringt nur diesen Schritt mit Warnung im Audit-Log.")

**Ablauf:**

1. **Scan** mit dem Helper-Skript:
   ```bash
   pwsh .n8n-template/Scan-Workflow-Bugs-In-Project.ps1 -Root . -OutputPath .n8n-template/_bug-migration-scan.json
   ```

2. **JSON lesen** — Schema `{schema_version, scanned_at, project_root, stats, findings: [{source_file, source_kind, line_start, line_end, raw, title_suggestion, body_draft, feature_id}]}`.

3. **Bei 0 Funden:** Hinweis "Keine Legacy-Bug-Pflegestellen gefunden — Migration uebersprungen." → weiter mit Schritt 2.

4. **Bei N Funden:** Tabelle praesentieren:
   ```
   v1.6→v1.7 BUG-MIGRATION — N Findings

   | # | Datei                  | Kind          | Vorschlag-Titel                       |
   |---|------------------------|---------------|---------------------------------------|
   | 1 | docs/specs/PROJ-13-...   | spec-section  | [BUG] PROJ-13: Known Bugs (...)       |
   | 2 | .claude/memory/...     | memory-marker | [BUG] Memory: Login bricht bei Safari |
   | 3 | docs/QA-FINDINGS.md    | docs-bullet   | [BUG] Doc-Migration: Timeout in cron  |
   ```

5. **Pro Finding User-Choice** (AskUserQuestion in Batch oder einzeln):
   - `[a]nlegen` — Issue im target_repo via `gh issue create --template 02-qa-finding.yml` mit `body_draft` als Body
   - `[s]kippen` — Finding bleibt unangetastet, aber NICHT als Issue
   - `[r]edraft` — User editiert title + body inline
   - `[d]rop` — Finding ist nicht relevant (z.B. False-Positive), wird nicht angefasst

6. **Nach Issue-Anlage:** Im Source-File einen Cross-Reference-Marker einfuegen (idempotent, an die Stelle wo das Finding war):
   - bei `spec-section`: erste Zeile der Sektion bekommt Suffix ` (migriert zu #N — siehe GitHub-Issue)`
   - bei `spec-bullet`/`docs-bullet`/`memory-marker`: Original-Zeile bekommt Suffix ` (See #N)`
   - bei `memory-frontmatter`: ganzes File bekommt Sektion am Ende `> Migrated to GitHub Issue: #N (YYYY-MM-DD)`

   **Wichtig:** Diese Source-File-Edits sind nicht-destruktiv (Original-Inhalt bleibt) — sie nageln nur fest, dass die Migration stattgefunden hat.

7. **Audit-Eintrag** in `.n8n-template/audit.log`:
   ```
   <ts>\tBUG_MIGRATION\tv1.6.x\tv1.7.x\t<created-count>\t0\t<skipped-count>\t0
   ```

8. **Cleanup** — `_bug-migration-scan.json` darf liegen bleiben (wird beim naechsten Lauf ueberschrieben).

9. **Hinweis an User:** "Bug-Migration abgeschlossen. Ab jetzt: alle Bugs als GitHub-Issues. WF-X-Specs dokumentieren nur Features."

**Skip-Flag:** `/template-update --apply --skip-bug-migration` ueberspringt diesen Schritt mit Audit-Log-Vermerk `BUG_MIGRATION_SKIPPED`. Empfohlen nur wenn Repo gerade nicht verfuegbar — bei naechstem Update wird neu versucht.

### Schritt 2: REMOTE-Template clonen

`$source = (.template-version.json).source_repo`

```
$tmp = "$env:TEMP/n8n-template-update-$(Get-Date -UFormat %s)"
git clone --depth 1 --branch main $source $tmp
```

Falls `--from <commit>`: `git checkout $commit` im `$tmp`.

**Wenn REMOTE kein `.n8n-template/manifest.json` hat:** Das REMOTE-Template ist aelter als v1.6.0. STOPP — "Remote-Template noch nicht auf manifest-basiertem Update. Bitte zuerst `/template-check` auf dem REMOTE pushen oder Template-Maintainer kontaktieren."

REMOTE-Version lesen aus `$tmp/.template-version.json` → `$newVersion`.
LOCAL-Version aus `.template-version.json` → `$currentVersion`.

Falls `$currentVersion == $newVersion`: "Template ist aktuell ($currentVersion). Kein Update notwendig." → STOPP (cleanup tmp).

### Schritt 3: Update-Plan berechnen

```
pwsh .n8n-template/Compute-Update-Plan.ps1 `
  -LocalRoot . `
  -RemoteRoot $tmp `
  -OutputPath .n8n-template/_update-plan.json
```

Das Skript erzeugt fuer jede Datei ein `action`-Feld:

| Action | Tier | Bedeutung |
|--------|------|-----------|
| `NO-OP` | alle | LOCAL == REMOTE — nichts zu tun |
| `CREATE` | FROZEN, UPDATABLE | File ist neu, lokal fehlt |
| `CREATE-FROM-REMOTE` | MARKER-AWARE, USER-GENERATED | File ist neu, Stub aus REMOTE installieren |
| `KEEP-LOCAL` | USER-GENERATED | File existiert lokal — niemals ueberschreiben |
| `SAFE-UPDATE` | FROZEN, UPDATABLE | LOCAL == BASE, REMOTE neuer — sicher update |
| `OVERWRITE-WITH-BACKUP` | FROZEN | LOCAL != BASE — User hat geaendert, Backup + Overwrite |
| `CONFLICT` | UPDATABLE-WITH-DIFF | LOCAL != BASE und != REMOTE — User entscheidet |
| `MARKER-MERGE` | MARKER-AWARE | Block-fuer-Block Merge der N8N-TEMPLATE-Bloecke |
| `ORPHAN` | (vom BASE-Manifest) | File war in BASE aber nicht mehr in REMOTE — User entscheidet (DELETE/KEEP) |

### Schritt 4: Plan praesentieren (immer, auch Dry-Run)

Lies `.n8n-template/_update-plan.json` und gib eine kompakte Uebersicht aus:

```
Template-Update: n8n-template v{from} -> v{to}

Sichere Updates (X)
  ~ .claude/commands/onboard.md
  ~ .claude/commands/change.md
  ...

Neue Dateien (Y)
  + .claude/skills/architecture/SKILL.md
  ...

MARKER-MERGE (Z)
  ⬚ CLAUDE.md (Bloecke: tech-stack-summary, memory-loading, ...)

Konflikte (UPDATABLE-WITH-DIFF, A)
  ! .claude/rules/frontend.md — lokal angepasst und REMOTE geaendert
  ! .claude/rules/backend.md — lokal angepasst und REMOTE geaendert

FROZEN-Overwrite-Warnungen (B)
  ⚠ .claude/settings.json — lokal angepasst, Update wuerde mit Backup ueberschreiben

Orphans (C — in BASE aber nicht mehr in REMOTE)
  ? prompts/templates/feature-old-template.md

Unveraendert (D), KEEP-LOCAL (E)   [Details auf Anfrage]
```

Plus Changelog-Excerpt aus `$tmp/CHANGELOG.md` zwischen den beiden Versionen.

### Schritt 5: Wenn Dry-Run — STOPP

Wenn `$applyMode == false`:
- Ausgabe: "Dry-Run — keine Aenderungen geschrieben. Mit `/template-update --apply` ausfuehren."
- `_update-plan.json` darf liegen bleiben (wird beim naechsten Lauf ueberschrieben)
- Cleanup `$tmp` ausfuehren
- STOPP

### Schritt 6: Konflikt-Resolution (nur bei --apply)

Sammle `$decisions = {}` (Map: Pfad → Aktion):

**FROZEN mit `OVERWRITE-WITH-BACKUP`:**
- Wenn `$forceFrozen == true`: alle akzeptieren, Aktion bleibt `OVERWRITE-WITH-BACKUP`.
- Sonst: User fragen (gruppiert wenn >3 Files): "FROZEN-Files lokal angepasst. Standard ist Overwrite mit Backup. Pro File entscheiden oder alle akzeptieren?"
  - "Alle akzeptieren (Backup wird angelegt)" → keine Override-Decisions
  - "Pro File entscheiden" → per File: ACCEPT-REMOTE / KEEP-LOCAL

**UPDATABLE-WITH-DIFF mit `CONFLICT`:**
- Fuer jeden Konflikt: User-Frage mit AskUserQuestion:
  - Optionen: "REMOTE uebernehmen (lokal als .bak)" / "LOKAL behalten (Update skippen)" / "Beides anzeigen + entscheiden"
  - Bei "Beides anzeigen": `git diff $tmp/<path> <path>` zeigen, dann nochmal fragen.
- Decision speichern: `$decisions[<path>] = "ACCEPT-REMOTE" | "KEEP-LOCAL"`

**ORPHAN:**
- User-Frage: "Datei <path> wurde aus dem Template entfernt. Lokal behalten oder loeschen?"
  - "Behalten" → `KEEP-LOCAL`
  - "Loeschen" → `DELETE` (Backup wird angelegt)

Schreibe `$decisions` nach `.n8n-template/_update-decisions.json`.

### Schritt 7: Plan anwenden

```
pwsh .n8n-template/Apply-Update.ps1 `
  -PlanPath .n8n-template/_update-plan.json `
  -LocalRoot . `
  -RemoteRoot $tmp `
  -DecisionsPath .n8n-template/_update-decisions.json `
  -Confirm
```

Erfasse die Counts aus dem stdout (JSON-Report am Ende).

### Schritt 8: Manifest + Version-File fortschreiben

```
pwsh .n8n-template/Generate-Manifest.ps1 -Root . -TemplateVersion $newVersion
```

`.template-version.json` updaten:
- `version` → `$newVersion`
- `last_update_at` → ISO-Timestamp jetzt (UTC)
- `last_update_from_version` → `$currentVersion`

### Schritt 9: Audit-Log

Append an `.n8n-template/audit.log` (Tab-separiert, ISO-Timestamp, UTF-8):

```
<ts>\tUPDATE\t<from>\t<to>\t<written>\t<backed_up>\t<skipped>\t<deleted>
```

### Schritt 10: Cleanup

- `Remove-Item -Recurse -Force $tmp`
- `Remove-Item .n8n-template/_update-plan.json` (optional)
- `Remove-Item .n8n-template/_update-decisions.json` (optional)

### Schritt 11: Zusammenfassung

```
Template-Update v{from} -> v{to} abgeschlossen.

Geschrieben     : X Dateien
Backups         : Y (.bak.<ts>)
Geloescht       : Z (Orphans)
Uebersprungen   : N
Konflikte       : K (User entschied)

Backup-Files liegen unangetastet — wenn alles funktioniert, koennen sie geloescht werden:
  git ls-files -o --exclude-standard | Select-String '\.bak\.'

Naechster Schritt: git diff prufen, dann commiten.
```

---

## Hinweise

- **Niemals --force-frozen ohne Code-Review.** FROZEN-Files sind Template-Code; lokale Aenderungen sind selten und meist Workarounds, die im naechsten Template-Release obsolet werden.
- **Backups (`*.bak.<ts>`) sind `.gitignore`d** — werden nicht committet. Wer sie behalten will: explizit `git add -f` (Ausnahme dokumentieren).
- **Cleanup auf eigenes Risiko:** Nach erfolgreichem Update + Test koennen die `*.bak.*`-Files manuell geloescht werden. Aktuelles Skript loescht nie selbst.
- **MARKER-AWARE-Merge ist strikt:** Bloecke werden Block-fuer-Block per ID + Regex ersetzt; Inhalt ausserhalb der Marker bleibt unangetastet. Verschachtelte `<!-- PROJECT:START -->`-Bloecke innerhalb eines N8N-TEMPLATE-Blocks werden NICHT separat geschuetzt — die ganze Block-Definition kommt aus REMOTE. Wer dort projekt-eigenen Code haben will: ausserhalb der N8N-TEMPLATE-Marker platzieren.
- **`--check`-Kompatibilitaet:** Frueher gab es `/template-update --check`. Das wurde durch den Dry-Run-Default ersetzt. Wer einen Versions-Vergleich ohne Plan-Generation will: `/template-check`.

## Bezug zu /template-check und /template-migrate

- `/template-check` ist read-only und zeigt nur Versions-Gap + Changelog-Excerpt — kein Plan.
- `/template-migrate` ist fuer Projekte ohne `.template-version.json` (Fremd-Template oder manuell gebaut).
