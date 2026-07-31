---
name: research
description: Investigate a question against high-trust primary sources and capture the findings as a Markdown file in the repo. Use when the user wants a topic researched, docs or API facts gathered, or reading legwork delegated to a background agent.
---
<!-- Vendored from mattpocock/skills (MIT), upstream commit 2ab9580 (2026-07-28), plugin v1.2.0, adapted for n8n-project-template. See .claude/skills/_LICENSE-mattpocock.md -->

Spin up a **background agent** to do the research, so you keep working while it reads. If you cannot spawn agents in your current context (e.g. you are a pipeline sub-agent), run the research inline instead — the rules below apply either way.

Its job:

1. Investigate the question against **primary sources** — official docs, source code, specs, first-party APIs — not a secondary write-up of them. Follow every claim back to the source that owns it.
2. Write the findings to a single Markdown file, citing each claim's source — **every factual claim carries its source URL plus the retrieval date**.
3. Save it where this repo keeps such notes: service-specific integration research goes to `docs/integrations/<service>/` (precedent: `docs/integrations/m365/`); everything else goes to `docs/research/<topic>.md` (create the directory if it does not exist).

## Research backends

Use them in this order of preference:

1. **`mcp__perplexity__perplexity_research`** — deep multi-source investigation. If the tool is deferred, load its schema via ToolSearch first.
2. **Context7** (`mcp__context7__resolve-library-id` + `query-docs`) — library, framework, and API documentation.
3. **WebFetch / WebSearch** as fallback — pointed at official primary sources only.

Whichever backend answers, the primary-source rule above still holds: cite the source that owns the claim, never a secondary write-up of it.

## Typical questions in this template

- API rate limits of a third-party service a workflow calls
- OAuth scopes a credential actually needs
- Webhook signature verification (algorithm, header, timestamp tolerance)
- Pagination behavior of third-party APIs (cursor vs. offset, page size caps)
