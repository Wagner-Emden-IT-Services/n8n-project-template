# Project State

> **Hinweis:** Dieser File wird von `/onboard` Phase 7.8 initialisiert und
> dann fortlaufend von `/change-workflow` Schritt 5 + manuellen Edits gepflegt.
> `/next-recommend` LIEST nur (kein Write). USER-GENERATED — `/template-update`
> fasst ihn niemals an.

Letzte Aktualisierung: {{INITIALIZED_AT}}
Quelle: `/onboard` (Initial-Stand)

---

## Position (aktueller Stand)

**Aktive Phase:** none
**Aktiver Workflow:** —
**Aktive Session:** —

---

## Workflow-Pipeline (aus docs/specs/INDEX.md gespiegelt)

| WF | Titel | Status | Phase | Letzte Aktivitaet |
|---|---|---|---|---|
| — | — | — | — | — |

---

## Aktive Entscheidungen (per Phase)

> Wachsen mit dem Projekt. Eintraege ergaenzen bei nicht-trivialen Decisions.

- (noch keine — wird bei jeder Architecture-Phase ergaenzt)

---

## Open Loops (Was wartet)

> Was aktuell offen ist und Aufmerksamkeit braucht. `/next-recommend` liest hier.

- (noch keine Open Loops)

---

## Last Session Summary

- **Session:** —
- **Outcome:** —
- **Next:** Beginne mit `/change-workflow` oder `/help-workflow --first-steps`

---

## Konvention

- **Aktive Phase**: aus `/change-workflow` Schritt 5 — eine der Pipeline-Phasen (`spec`, `architecture`, `build`, `test`, `security`, `deploy`) oder `none`
- **Aktiver Workflow**: WF-N (bei Multi-Workflow-Batch: erster der Liste, andere in "Open Loops")
- **Aktive Session**: Pfad zu `docs/sessions/<datum>-<kurzname>.md` falls Multi-Session-Initiative
- **Workflow-Pipeline-Tabelle**: gespiegelt aus `docs/specs/INDEX.md` + Frontmatter der WF-X.md
- **Aktive Entscheidungen**: kurze Decision-Records — fuer detaillierte ADRs separat `.claude/memory/decisions/` (falls Memory-System installiert)
- **Open Loops**: PR offen / Issue offen / Hard-Gate-Drift / Template-Update verfuegbar
- **Last Session Summary**: 3-Bullet-Outcome + konkreter Next-Step

> Inkonsistenz mit `docs/specs/INDEX.md` wird von `/next-recommend` erkannt und gemeldet — manuell auflösen.
