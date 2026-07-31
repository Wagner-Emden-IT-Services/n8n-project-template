---
name: handoff
description: Compact the current conversation into a handoff document for another agent to pick up. Use at session end or between pipeline phases when the work continues in a fresh session.
argument-hint: "What will the next session be used for?"
---

<!-- Vendored from mattpocock/skills (MIT), upstream commit 2ab9580 (2026-07-28), plugin v1.2.0, adapted for n8n-project-template. See .claude/skills/_LICENSE-mattpocock.md -->

Write a handoff document summarising the current conversation so a fresh agent can continue the work. Save to `docs/sessions/<YYYY-MM-DD>-<kurzname>.md` in this repo (create `docs/sessions/` if it does not exist) — this is the template's session convention; `docs/STATE.md` points to the file via "Aktive Session". Do not save to the OS temp directory.

After writing the document, update `docs/STATE.md` (Write-Then-Verify, see `.claude/rules/general.md` "Status-Updates"):

- Set "Aktive Session" to the session file path.
- Rewrite "Last Session Summary": 3 outcome bullets plus one concrete next step.
- Never claim the update happened without an actual Edit-tool call.

Include a "suggested skills" section in the document, which suggests skills that the agent should invoke. Draw only from what exists in this template: the `/change-workflow` pipeline phases (spec, architecture, build, test, security, deploy), `/diagnosing-bugs`, `/grill-with-docs`, `/grilling`, `/grill-me`, `/domain-modeling`, `/research`, `/qa-workflow`, `/validate-workflow`, `/security-review-workflow`, `/next-recommend`.

Do not duplicate content already captured in other artifacts (WF-X specs in `docs/specs/`, `docs/PRD.md`, `docs/STATE.md`, ADRs, issues, commits, diffs). Reference them by path or URL instead.

Redact any sensitive information — and be stricter than usual, because this document gets committed and the template's gitleaks pre-commit hook (`hooks/pre-commit`) scans it: no API keys or tokens, no webhook URLs containing secrets, no tenant IDs in cleartext, no passwords, no personally identifiable information. Reference credentials by their n8n credential name instead of their values.

If the user passed arguments, treat them as a description of what the next session will focus on and tailor the doc accordingly.
