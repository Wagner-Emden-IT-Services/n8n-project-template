<!-- Copyright (c) 2025-2026 Wagner-Emden IT Services. All rights reserved. -->
---
user-invocable: true
description: Erzeugt projekt-weit die docs/PRD.md (12-Sektionen-Format) via 3-Phasen-Interview aus dem Skill n8n-prd-generator. Status DRAFT -> Owner-Review -> APPROVED. Voraussetzung fuer den prd-required Hard-Gate.
argument-hint: "[freie Beschreibung der Automation] [--update] (--update = bestehende docs/PRD.md ueberarbeiten statt neu)"
allowed-tools: Bash(*), Read, Write, Edit, Glob, Grep, AskUserQuestion, mcp__context7__resolve-library-id, mcp__context7__query-docs, mcp__n8n__search_nodes, mcp__n8n__get_node
---

# /prd-generate — Projekt-PRD erzeugen

> Wrappt den Skill `n8n-prd-generator` (3-Phasen-Interview), schreibt aber **eine**
> projekt-weite `docs/PRD.md` im 12-Sektionen-Format aus `docs/PRD.template.md` —
> nicht `prd-<name>.md` pro Workflow. Pro-Workflow-Detail kommt in die WF-X-Specs.

## Eingabe

$ARGUMENTS

---

## Schritt 0: Vorbedingungen (Hard-Gate `onboard-required`)

```bash
test -f .template-version.json || { echo "[onboard-required] Zuerst /onboard durchlaufen."; exit 1; }
```

- `.template-version.json` muss existieren und ein gueltiges Schema-1.1-Dokument sein
  (siehe `.claude/rules/onboard-required.md`). Fehlt es: STOPP, Hinweis auf `/onboard`.

## Schritt 0.5: Bestehende PRD pruefen

Lies `docs/PRD.md` (falls vorhanden) und pruefe das `Status:`-Feld im Frontmatter/Header.

| Zustand | Verhalten |
|---|---|
| Datei fehlt oder `Status: NOT_STARTED` | Neu erzeugen (Default) |
| `Status: DRAFT` | Weiter verfeinern (Refresh); geaenderte Sektionen ueberschreiben |
| `Status: APPROVED` **und** kein `--update` | STOPP + AskUserQuestion: "PRD ist APPROVED. Ueberarbeiten (Status faellt zurueck auf DRAFT) oder abbrechen?" |
| `--update` gesetzt | Ueberarbeiten, Status wird auf `DRAFT` zurueckgesetzt |

## Schritt 1: Projekt-Identitaet laden (keine PII)

- Aus `.template-version.json`: `customer_slug`, `project_slug`, `staging_profile`, `hosting`.
- Aus `.claude/customer.json` **nur** Rollen/Zielsysteme fuer Section 0 — **niemals**
  Name/E-Mail/Telefon ins PRD schreiben (DSGVO, bleibt in `customer.json`).
- Diese Werte fuellen Section 0 des Templates (`{{CUSTOMER_SLUG}}`, `{{PROJECT_SLUG}}`,
  `{{OWNER_ROLE}}`, `{{TARGET_SYSTEMS}}`, `{{STAGING_PROFILE}}`, `{{HOSTING}}`).

## Schritt 2: 3-Phasen-Interview (Skill `n8n-prd-generator`)

Fuehre den Prozess aus dem Skill `.claude/skills/n8n-prd-generator/` durch — Phasen strikt,
nicht ueberspringen:

1. **Phase 1 — Initial Understanding:** freie Beschreibung annehmen (aus `$ARGUMENTS` oder
   erfragen), in 2-3 Saetzen zusammenfassen, bestaetigen lassen.
2. **Phase 2 — Clarifying Questions (Pflicht):** via `AskUserQuestion`, max. 4 pro Runde,
   ueber Trigger/Zeitplan, Datenfluss/Services, Error-Handling/Edge-Cases, Credentials/Env.
   Bereits Beantwortetes ueberspringen.
3. **context7 fuer Fakten:** Bei konkreten Auth-Flows/SDK/API-Details der genannten Services
   **zuerst context7** (`resolve-library-id` -> `query-docs`) statt raten. Node-Vorschlaege
   via `search_nodes` validieren.

## Schritt 3: docs/PRD.md schreiben (12-Sektionen-Format)

- Basis ist `docs/PRD.template.md`. Mappe die Interview-Antworten in die **12 Sektionen**
  (Ziel/Kontext, Trigger, Datenfluss, Services+Credentials, Pro-Workflow-Uebersicht,
  Error-Handling, Pitfalls, Akzeptanzkriterien, offene Fragen, Workflow-Inventur,
  Deployment-Strategie, DR-Bezug).
- **Alle `{{}}`-Placeholder ersetzen.** Keine Erfindungen — offene Punkte in Section 9
  ("Offene Fragen / Annahmen") explizit als Annahme markieren.
- Header/Frontmatter: `Status: DRAFT`, `created:`/`template_version:` aus `.template-version.json`.
- Schreibe nach `docs/PRD.md` (nicht ins Template).

## Schritt 4: Qualitaets-Check (vor Uebergabe)

Pruefe und melde:

- [ ] Keine `{{`-Placeholder mehr in `docs/PRD.md`
- [ ] Jeder Service (Section 4) hat Credential-Status + Vault-Slot-Verweis
- [ ] Error-Handling pro externem API-Call spezifiziert (Section 6)
- [ ] >= 3 konkrete, testbare Akzeptanzkriterien (Section 8)
- [ ] Workflow-Inventur (Section 10) befuellt
- [ ] DR-Bezug (Section 12) geklaert (Encryption-Key-Persistenz benannt)

Bei fehlenden Punkten: nachfragen statt raten.

## Schritt 4.5: Grilling-Pass (Standard vor Approval)

Stress-teste das Draft-PRD via Skill `/grilling` Frage fuer Frage gegen den Owner:

- **Eine Frage pro Turn**, jeweils mit eigener Empfehlung — keine Fragen-Batches.
- **Fakten** (API-Verhalten, Node-Faehigkeiten, bestehende Doku) schlaegt der Agent
  selbst nach (context7, `search_nodes`, Repo-Dateien) — **Entscheidungen** liegen
  beim Owner.
- Primaeres Material: Annahmen (Section 9), Akzeptanzkriterien (Section 8),
  Error-Handling (Section 6).
- Ergebnisse fliessen direkt ins PRD zurueck (Sektionen aktualisieren, Annahmen
  in Section 9 aufloesen oder als bewusste Entscheidung dokumentieren).

**Ueberspringen nur durch aktive Owner-Entscheidung** (explizit erfragen, kein
stilles Auslassen). Bei Skip: `Grilling-Pass uebersprungen` im PRD-Header/Changelog
vermerken. Der Grilling-Pass ist **kein** neues Hard-Gate — `prd-required` bleibt
unveraendert.

## Schritt 5: Approval-Uebergabe

- PRD steht auf `Status: DRAFT`. Zeige Zusammenfassung + Approval-Block (Section-Ende).
- **Owner setzt nach Review `Status: APPROVED`** (manuell oder auf explizite Bestaetigung
  hin durch diesen Command). Erst dann greift `/change-workflow` / `/deploy-workflow`
  ohne `--bypass-prd` (Hard-Gate `prd-required`).
- Naechste Schritte anzeigen: pro Workflow WF-X-Spec anlegen (`docs/specs/spec-template.md`),
  dann `/change-workflow`.

## Bezug zu anderen Commands

- `/onboard` — Phase 7 ruft diesen Command auf.
- `/change-workflow` — Spec-Phase nutzt das PRD als Kontext; Hard-Gate `prd-required` vor Build/Deploy.
- `/deploy-workflow` — bricht ohne `Status: APPROVED` ab (Override `--bypass-prd` mit Audit-Log).

## Anti-Patterns

- PRD mit `{{`-Placeholdern als `APPROVED` markieren — das Gate faengt es, aber es kostet einen Zyklus.
- Services/Credentials raten statt erfragen (Skill-Regel: "always ask").
- Implementierungsdetails (exakte Expressions/Code) ins PRD — das gehoert in die Build-Phase/WF-X-Spec.
- Kontaktdaten ins PRD schreiben — DSGVO-Verstoss, bleibt in `.claude/customer.json`.
