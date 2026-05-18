<!-- Copyright (c) 2025-2026 Wagner-Emden IT Services. All rights reserved. -->
---
user-invocable: true
description: Meldet einen Template-Bug (Skill/Hook/Command/Update-Mechanik) sanitisiert ins n8n-template-Source-Repo. Privacy-Hard-Gate verhindert Customer-Identifier-Leak.
argument-hint: "[--component <skill|hook|command|rule|update-mechanik|onboarding|other>] [--no-prompt] (kurzer Symptom-Text als Rest)"
allowed-tools: Bash(gh:*), Read, Write, Edit, Glob, Grep, AskUserQuestion
---

# /template-bugreport — Template-Bug sanitisiert melden

Filed einen Bug **am n8n-template-Template selbst** (Skill, Hook, Command, Update-Mechanik, Onboarding-Phase) ins Source-Repo (`n8n-project-template`), nachdem Customer-Identifier sanitisiert wurden.

**NICHT verwenden fuer:**
- Project-Code-Bugs → normaler `gh issue create --template 01-bug.yml` im Project-Repo
- QA-Findings im Projekt → `/qa` mit Auto-File
- Feature-Wuensche am Template → direkt im Source-Repo manuell

---

## Workflow

### Schritt 1: Voraussetzungen

- `gh --version` + `gh auth status` OK (sonst STOPP)
- `.template-version.json` lesbar, `source_repo`-Feld befuellt (Default `https://github.com/Wagner-Emden-IT-Services/n8n-project-template`)
- `.claude/customer.json` lesbar (fuer Sanitization-Whitelist) — bei `--no-prompt`-Mode optional

### Schritt 2: Symptom + Repro erfassen

AskUserQuestion-Block (kurz halten, NICHT verschachtelt):

1. "Welche Komponente ist betroffen?" (Dropdown: Skill / Hook / Command / Rule / Update-Mechanik / Onboarding-Phase / Other)
2. "Welche Datei?" (Pfad, z.B. `.claude/commands/remember.md`)
3. "Template-Version aus `.template-version.json`?" (auto-lesen, User bestaetigt)
4. "Minimal-Repro (3-5 Schritte)?"
5. "Erwartetes Verhalten?"
6. "Tatsaechliches Verhalten?"
7. "Workaround bekannt? (optional)"
8. "Projekt-Typ wo entdeckt? (Customer / Internal / Template-Test) — KEIN Customer-Name!"

Bei `--no-prompt` (CI/Automation): Werte aus $ARGUMENTS-Restwerten oder Stdin parsen.

### Schritt 3: Sanitization-Whitelist aufbauen

Lies `.claude/customer.json` falls vorhanden. Sammele Werte aller folgenden Felder als Sanitization-Targets:

- `customer.name` (voller Name) → `<customer-name>`
- `customer.slug` → `<customer-slug>`
- `customer.contact.name` → `<contact-name>`
- `customer.contact.email` → `<contact-email>`
- `customer.contact.role` → `<contact-role>`
- `project.name` (voller Name) → `<project-name>`
- `project.slug` → `<project-slug>`

Sammele zusaetzlich aus dem Working-Tree:
- Project-Pfad-Root (z.B. `C:/Users/.../Customer-XY/Project-Z/...`) → `<project-path>`
- Repo-URL aus `.template-version.json` `target_repo` → `<project-repo>`

### Schritt 4: Sanitization-Diff zeigen

Erzeuge zwei Versionen des Issue-Bodys (Repro/Expected/Actual/Workaround-Felder):

**Original** (was der User eingegeben hat) und **Sanitisiert** (alle Sanitization-Targets ersetzt durch ihre Platzhalter).

Zeige Side-by-Side:

```
=== Sanitization-Diff ===

Original  → Sanitisiert
─────────────────────────
"in Batzenhof-Projekt   → "in <customer-slug>-Projekt
 aufgetreten beim Aufruf  aufgetreten beim Aufruf
 mit Max Mustermann"      mit <contact-name>"

... (alle weiteren Aenderungen)

Stats: X Customer-Identifier ersetzt.
```

AskUserQuestion: "Sanitisierte Version OK? (Ja-uebernehmen / Editieren / Abbrechen)"

### Schritt 5: Privacy-Hard-Gate (PFLICHT, NIEMALS skippen)

Vor `gh issue create` automatischer grep auf den FINALEN Body (= sanitisierte Version, ggf. vom User editiert):

```bash
# Beispiel — die echten Werte kommen aus customer.json
echo "$FINAL_BODY" | grep -iE "(batzenhof|max mustermann|max@batzenhof|cc-project-batzenhof-mens-day)"
```

(Patterns dynamisch aus Schritt-3-Whitelist generieren — alle Werte als `-iE`-Pattern mit `|`-Join.)

**Bei Treffer:**

```
⛔ HARD-GATE-ABBRUCH: Customer-Identifier im Body gefunden:
  Match: "batzenhof" in Zeile 14: "...beim Test mit dem Batzenhof-Datensatz..."

Optionen:
A) Editieren — User kuriert manuell, dann Re-Check
B) Trotzdem submitten (User uebernimmt Verantwortung — Privacy-Risiko, im docs/ONBOARD_LOG.md protokolliert)
C) Abbrechen

Bitte waehle A, B oder C:
```

Bei **A**: User editiert, Re-Check ausfuehren.
Bei **B**: explizite Bestaetigung "JA TROTZDEM" verlangen. Im Audit-Log + ONBOARD_LOG.md vermerken: "PRIVACY-OVERRIDE bei /template-bugreport am <ts>, Match: <pattern>".
Bei **C**: Abbruch ohne weitere Aktion.

**Bei kein Treffer:** weiter mit Schritt 6.

### Schritt 6: gh issue create im Source-Repo

```bash
SOURCE_REPO=$(jq -r '.source_repo' .template-version.json | sed 's|^https://github.com/||;s|\.git$||')
# z.B. "Wagner-Emden-IT-Services/n8n-project-template"

gh issue create \
  --repo "$SOURCE_REPO" \
  --template 03-template-bug.yml \
  --title "[TEMPLATE-BUG] <kurzbeschreibung>" \
  --label "template-bug,needs-triage,source:ai-change" \
  --body-file /tmp/template-bug-body.md
```

Body-File enthaelt die sanitisierte Version, formatiert nach `03-template-bug.yml`-Schema (affected_component, version_seen, repro_minimal, expected, actual, discovered_in_project_type, workaround).

### Schritt 7: Issue-Link zurueck + protokollieren

Output:
```
✅ Template-Bug gefiled:
   Repo:  https://github.com/Wagner-Emden-IT-Services/n8n-project-template
   Issue: #<N> [TEMPLATE-BUG] <kurzbeschreibung>
   URL:   https://github.com/.../issues/<N>
```

Append an `docs/ONBOARD_LOG.md` Sektion "Template-Bugs gemeldet" (anlegen falls nicht da):

```markdown
## Template-Bugs gemeldet

| Datum | Komponente | Issue | Kurztitel |
|---|---|---|---|
| YYYY-MM-DD | <skill/hook/...> | [#<N>](https://...) | <kurzbeschreibung> |
```

Bei PRIVACY-OVERRIDE (Schritt 5 Option B): zusaetzliche Zeile in der Tabelle: "(PRIVACY-OVERRIDE — siehe Audit)".

---

## Auto-Trigger (von anderen Skills aufrufbar)

- **`/change` Schritt 0.4** bei `origin:template`-Label im Loaded-Issue
- **`/qa` Routing-Heuristik** bei Failure auf bundled-File-Pfad

In beiden Faellen wird `/template-bugreport` als Sub-Command aufgerufen. User muss trotzdem Hard-Gate-Bestaetigung geben — kein Auto-Submit ohne User.

## Anti-Patterns

- **Privacy-Hard-Gate skippen** ist explizit dokumentiert + im ONBOARD_LOG protokolliert. Nie stillschweigend.
- **Source-Repo-URL hardcoded** statt aus `.template-version.json` lesen — verhindert Push in falsche Repos bei Forks.
- **Issue im Project-Repo (statt Source) anlegen wenn `origin:template`** — gehoert thematisch ins Template-Tracker, nicht in den Kunden-Backlog.
