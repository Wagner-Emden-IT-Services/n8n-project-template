<!-- Copyright (c) 2025-2026 Wagner-Emden IT Services. All rights reserved. -->
---
user-invocable: true
description: "Was soll ich als naechstes machen?" — liest Projekt-State, Issues, WF-X-Status und empfiehlt den EINEN konkreten naechsten Schritt. GSD-Style (inspiriert von gsd-build/get-shit-done).
argument-hint: "[--explain] [--top N] [--apply] [--skip <kategorie>]"
allowed-tools: Read, Glob, Grep, Bash(gh:*), Bash(git:*), AskUserQuestion
---

# /next-recommend — Was soll ich als naechstes machen?

Liest den aktuellen Projekt-State (STATE.md, WF-X-INDEX, Issues, letzte Aktivitaet, Hard-Gate-Status) und empfiehlt **eine konkrete naechste Aktion** mit Begruendung. Read-only by default, `--apply` delegiert an `/change-workflow` oder andere Commands.

## Modi

| Argument | Wirkung |
|---|---|
| `/next-recommend` | Standard-Run mit Top-Empfehlung |
| `/next-recommend --explain` | Volle Heuristik-Auswertung (welche Regel hat gegriffen, warum nicht andere) |
| `/next-recommend --top <N>` | Zeigt `N` Empfehlungen statt 1 (fuer Multi-Session-Planung) |
| `/next-recommend --apply` | Fuehrt die empfohlene Aktion direkt aus (User-Bestaetigung vorher) |
| `/next-recommend --skip <kat>` | Ueberspringt Prio-Stufen (`issues`, `workflows`, `hard-gates`, `template-update`) |

## Workflow

### Schritt 1: State laden

- `.template-version.json` (Version, Onboard-Status, target_repo)
- `docs/STATE.md` (falls vorhanden) — "Aktive Phase", "Aktiver Workflow", "Open Loops", "Last Session Summary"
- `docs/specs/INDEX.md` (alle WF-X mit Status + Phase)
- `docs/specs/WF-*.md` (Frontmatter `status`, `phase`, `last_updated`)

### Schritt 2: Issue-Backlog laden (wenn target_repo set)

```bash
gh issue list --state open --json number,title,labels,assignees,createdAt --limit 50
```

### Schritt 3: Hard-Gate-Status pruefen

- `git status --short` (uncommitted Code → Gate verletzt)
- `git log -5 --oneline` (letzte Aktivitaet)
- Sind Pre-Commit-Hooks installiert? (`.git/hooks/pre-commit` existiert?)
- `.template-version.json` Schema-Version (1.2 = aktuell, 1.1 = Migration noetig)
- `.n8n-template/manifest.json` (existiert? = Update-Mechanik installiert)

### Schritt 4: Priorisierungs-Heuristik (erste Regel die zutrifft gewinnt)

| Prio | Bedingung | Empfehlung |
|---|---|---|
| 0 | Kein Onboard (`{{INSTALLED_AT}}` Placeholder in `.template-version.json`) | `/onboard` — Erstinstallation noetig |
| 1 | Hard-Gate verletzt (uncommitted Code in src/, oder Workflow nicht normalisiert) | "STOPP-Gate adressieren zuerst: `git status` zeigt …" |
| 2 | P0-Issue offen (Label `priority:P0`) | `/change-workflow --issue <N>` mit Issue-Nummer + Titel |
| 3 | Active Multi-Session-Plan (`docs/specs/backlog/*.md`) mit offener Session | "Naechste Session aus Plan: …" |
| 4 | WF-X im Status `InProgress` (Frontmatter `last_updated` > 7 Tage alt) | "Stuck: WF-X seit X Tagen in InProgress — /change-workflow --workflow WF-X --phase <next>" |
| 5 | WF-X im Status `Testing` (PR offen, kein Review/Merge) | "PR #M wartet auf Review — /qa-workflow WF-X" |
| 6 | P1-Issue offen | `/change-workflow --issue <N>` |
| 7 | WF-X im Status `Planned` (aelteste zuerst) | "Naechster Build-Kandidat: WF-X — /change-workflow --workflow WF-X" |
| 8 | Template-Update verfuegbar (`/template-check` ergibt yes) | `/template-update` (Dry-Run-Default) |
| 9 | P2-Issue offen | `/change-workflow --issue <N>` (geringer Druck) |
| 10 | Keine pending Items | "Alles aktuell. /change-workflow fuer neues Feature, oder /next-recommend --explain." |

### Schritt 5: Output

```
═══════════════════════════════════════════════
NAECHSTER SCHRITT (Prioritaet: <PrioStufe>)
═══════════════════════════════════════════════

Aktion:       /change-workflow --workflow WF-3 --phase test
Grund:        WF-3 ist seit 3 Tagen in InProgress, Sub-Agent
              n8n-qa-engineer waere als naechstes dran.
Kontext:      WF-3 = Newsletter-Send-Workflow (PRD vom 2026-05-15)
              Letzter Commit: feat(WF-3): build phase done (#42)

Alternativen (weniger dringend):
  - P1-Issue #15 (Auth-Token-Refresh) ist seit 2 Tagen offen
  - WF-7 ist Planned — kann begonnen werden wenn WF-3 fertig

Hard-Gates aktuell OK: onboard ✅, normalize-hook ✅, security gruen ✅
═══════════════════════════════════════════════
```

Mit `--explain`: zusaetzlich anzeigen warum die anderen Prio-Regeln nicht griffen.

Mit `--top 3`: drei Empfehlungen mit Prio-Stufe.

Mit `--apply`: User-Bestaetigung "Aktion ausfuehren?" und dann den jeweiligen Slash-Command starten.

## Anti-Patterns

- **`--apply` ohne `--explain` zuerst**: blindes Vertrauen in Heuristik. Empfehlung: bei wichtigen Entscheidungen erst `--explain` lesen.
- **`/next-recommend` als Ersatz fuer Planung**: empfiehlt nur den naechsten Schritt, nicht eine Strategie. Fuer Multi-Workflow-Planung: `docs/specs/backlog/*.md` Plan-Dokument nutzen.

## Konsistenz-Check (Self-Healing)

Wenn `docs/STATE.md` veraltet ist (`Letzte Aktualisierung` > 7 Tage und gleichzeitig hat sich INDEX.md geaendert):
- Warnung ausgeben: "STATE.md weicht von WF-X-INDEX.md ab. Empfehlung: STATE.md manuell aktualisieren oder den naechsten `/change-workflow`-Lauf das tun lassen (Schritt 5)."

## Tools

Read, Glob, Grep, Bash(gh:*), Bash(git:*), AskUserQuestion. Bei `--apply`: delegiert an die jeweiligen Commands.
