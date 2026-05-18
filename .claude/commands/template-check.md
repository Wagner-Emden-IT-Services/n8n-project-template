<!-- Copyright (c) 2025-2026 Wagner-Emden IT Services. All rights reserved. -->
---
user-invocable: true
description: Prueft ob das Golden-Dev-Template aktuell ist. Read-only, kein Schreiben.
argument-hint: ""
allowed-tools: Bash(git:*), Bash(rm:*), Bash(mkdir:*), Read
---

# /template-check — Template-Versions-Check

Read-only. Vergleicht installierte Template-Version mit GitHub-Tag und zeigt
Changelog-Excerpt. Schreibt nichts.

Fuer einen vollen Update-Plan: `/template-update` (Dry-Run-Default).

## Workflow

### Schritt 1: Installierte Version lesen

`.template-version.json` im Projektstamm:
- `version` → installierte Version
- `installed_at` → Installationsdatum
- `source_repo` → GitHub-Repo-URL

Falls Datei nicht existiert: "Kein Template-Stempel gefunden. Fuer Fremd-Template-Projekte: `/template-migrate`. Fuer Erst-Setup: `/onboard`."

### Schritt 2: Schema-Version pruefen

- `schema_version == "1.2"`: weiter.
- `schema_version == "1.1"` oder fehlend: Hinweis ausgeben "Template-Schema veraltet (1.1). Bei `/template-update` erfolgt Auto-Upgrade auf 1.2." → weiter.

### Schritt 3: Neueste Version vom Repo holen

```bash
git ls-remote --tags <source_repo> | grep -oP 'refs/tags/v\K[0-9.]+' | sort -V | tail -1
```

Falls keine Tags: Warnung "Keine Releases im Template-Repo gefunden. Default-Branch wird beim Update gezogen."

### Schritt 4: Changelog holen (falls Update verfuegbar)

```bash
git clone --depth 1 --branch main <source_repo> /tmp/template-check
cat /tmp/template-check/CHANGELOG.md
rm -rf /tmp/template-check
```

Excerpt: alles zwischen `## v<latest>` und `## v<installed>` (oder die letzten ~80 Zeilen falls Versionen nicht im Changelog stehen).

### Schritt 5: Manifest-Diff-Vorschau (kurz)

Falls Update verfuegbar UND lokales `.n8n-template/manifest.json` existiert:

```bash
git clone --depth 1 --branch main <source_repo> /tmp/template-check
diff <(jq '.counts' .n8n-template/manifest.json) <(jq '.counts' /tmp/template-check/.n8n-template/manifest.json) || true
rm -rf /tmp/template-check
```

Diese Diff zeigt nur Counts-Verschiebungen (z.B. "+8 FROZEN, -2 SKIPPED"). Fuer File-Liste: `/template-update` (Dry-Run).

### Schritt 6: Ergebnis anzeigen

**Falls aktuell:**
```
Template: n8n-template v<VERSION> (aktuell)
   Installiert am: <DATE>
   Schema: 1.2
   Kein Update verfuegbar.
```

**Falls Update verfuegbar:**
```
Template: n8n-template — Update verfuegbar
   Installiert: v<INSTALLED> (<DATE>)
   Aktuell:     v<LATEST>
   Schema:      1.2 (oder Auto-Upgrade-Hinweis bei 1.1)

   Aenderungen seit v<INSTALLED>:
   <CHANGELOG_EXCERPT>

   Naechster Schritt: /template-update  (Dry-Run-Default — zeigt nur was passieren wuerde)
                      /template-update --apply  (Update wirklich schreiben)
```
