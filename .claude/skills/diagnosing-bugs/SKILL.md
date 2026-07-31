---
name: diagnosing-bugs
description: Diagnosis loop for hard bugs and performance regressions. Use when the user says "diagnose"/"debug this", or reports something broken/throwing/failing/slow.
---

<!-- Vendored from mattpocock/skills (MIT), upstream commit 2ab9580 (2026-07-28), plugin v1.2.0, adapted for n8n-project-template. See .claude/skills/_LICENSE-mattpocock.md -->

# Diagnosing Bugs

A discipline for hard bugs. Skip phases only when explicitly justified.

When exploring the codebase, read the affected workflow's WF-X spec (`docs/specs/WF-X.md`, if it exists) to get a clear mental model of the workflow — trigger, data flow, services, error handling — and check `docs/troubleshooting.md`: many n8n failure modes are already documented there.

If the bug arrived as a `/qa-workflow` finding (a GitHub issue carrying `repro` / `expected` / `actual` / `execution_id` — see `.claude/skills/qa-workflow/`), that is your diagnosis input: `repro` seeds the feedback loop, `expected` vs `actual` is the red assertion, and `execution_id` is your replay handle.

## Phase 1 — Build a feedback loop

**This is the skill.** Everything else is mechanical. If you have a **tight** pass/fail signal for the bug — one that goes red on _this_ bug — you will find the cause; bisection, hypothesis-testing, and instrumentation all just consume it. If you don't have one, no amount of staring at code will save you.

Spend disproportionate effort here. **Be aggressive. Be creative. Refuse to give up.**

### Ways to construct one — try them in roughly this order

1. **Failing test** at whatever seam reaches the bug — for CLI or Code-node logic (`scripts/`, extracted Code-node functions), a unit or integration test in `tests/`.
2. **Pin-data test run.** `mcp__n8n__n8n_test_workflow` with pin data from `tests/pins/<workflow-name>.json` — deterministic input, no live upstream systems needed.
3. **Curl against the webhook endpoint** of a running n8n instance, with the exact payload that triggers the bug.
4. **Execution replay via the n8n MCP.** Pull the failing execution through the Executions API (`n8n_executions` — seed it with the finding's `execution_id`), extract the input of the failing node, and replay it through `n8n_test_workflow` as pin data.
5. **CLI invocation** with a fixture input, diffing stdout against a known-good snapshot (`node scripts/n8n-cli.mjs …`).
6. **Headless browser script** (Playwright / Puppeteer) — drives the n8n editor UI, asserts on DOM/console/network. Rarely needed; prefer the MCP routes above.
7. **Replay a captured trace.** Save a real webhook payload / event log to disk; replay it through the code path in isolation.
8. **Throwaway harness.** Spin up a minimal subset of the system (one workflow, mocked upstreams) that exercises the bug code path with a single call.
9. **Property / fuzz loop.** If the bug is "sometimes wrong output", run 1000 random inputs and look for the failure mode.
10. **Bisection harness.** If the bug appeared between two known states (commit, dataset, version), automate "boot at state X, check, repeat" so you can `git bisect run` it — the template's atomic-commit convention exists exactly for this.
11. **Differential loop.** Run the same pin data through the old vs the new workflow version (two revisions of `workflows/<name>.json`, or two configs) and diff the execution outputs.
12. **HITL bash script.** Last resort. If a human must click, drive _them_ with `.claude/skills/diagnosing-bugs/scripts/hitl-loop.template.sh` so the loop is still structured. Captured output feeds back to you.

Build the right feedback loop, and the bug is 90% fixed.

### Tighten the loop

Treat the loop as a product. Once you have _a_ loop, **tighten** it:

- Can I make it faster? (Cache setup, skip unrelated init, narrow the test scope.)
- Can I make the signal sharper? (Assert on the specific symptom, not "didn't crash".)
- Can I make it more deterministic? (Pin time, seed RNG, pin node inputs, freeze network.)

A 30-second flaky loop is barely better than no loop; a 2-second deterministic one is tight — a debugging superpower.

### Non-deterministic bugs

The goal is not a clean repro but a **higher reproduction rate**. Loop the trigger 100×, parallelise, add stress, narrow timing windows, inject sleeps. A 50%-flake bug is debuggable; 1% is not — keep raising the rate until it's debuggable.

### When you genuinely cannot build a loop

Stop and say so explicitly. List what you tried. Ask the user for: (a) access to whatever environment reproduces it, (b) a captured artifact (execution ID, exported execution JSON, HAR file, log dump, screen recording with timestamps), or (c) permission to add temporary production instrumentation. Do **not** proceed to hypothesise without a loop.

### Completion criterion — a tight loop that goes red

Phase 1 is done when the loop is **tight** and **red-capable**: you can name **one command** — a script path, a test invocation, a curl, an `n8n_test_workflow` call — that you have **already run at least once** (paste the invocation and its output), and that is:

- [ ] **Red-capable** — it drives the actual bug code path and asserts the **user's exact symptom**, so it can go red on this bug and green once fixed. Not "runs without erroring" — it must be able to _catch this specific bug_.
- [ ] **Deterministic** — same verdict every run (flaky bugs: a pinned, high reproduction rate, per above).
- [ ] **Fast** — seconds, not minutes.
- [ ] **Agent-runnable** — you can run it unattended; a human in the loop only via `.claude/skills/diagnosing-bugs/scripts/hitl-loop.template.sh`.

If you catch yourself reading code to build a theory before this command exists, **stop — jumping straight to a hypothesis is the exact failure this skill prevents.** No red-capable command, no Phase 2.

## Phase 2 — Reproduce + minimise

Run the loop. Watch it go red — the bug appears.

Confirm:

- [ ] The loop produces the failure mode the **user** described — not a different failure that happens to be nearby. Wrong bug = wrong fix.
- [ ] The failure is reproducible across multiple runs (or, for non-deterministic bugs, reproducible at a high enough rate to debug against).
- [ ] You have captured the exact symptom (error message, wrong output, slow timing) so later phases can verify the fix actually addresses it.

### Minimise

Once it's red, shrink the repro to the **smallest scenario that still goes red**. Cut inputs, nodes, config, pin-data items, and steps **one at a time**, re-running the loop after each cut — keep only what's load-bearing for the failure.

Why bother: a minimal repro shrinks the hypothesis space in Phase 3 (fewer moving parts left to suspect) and becomes the clean regression test in Phase 5.

Done when **every remaining element is load-bearing** — removing any one of them makes the loop go green.

Do not proceed until you have reproduced **and** minimised.

## Phase 3 — Hypothesise

Generate **3–5 ranked hypotheses** before testing any of them. Single-hypothesis generation anchors on the first plausible idea.

Each hypothesis must be **falsifiable**: state the prediction it makes.

> Format: "If <X> is the cause, then <changing Y> will make the bug disappear / <changing Z> will make it worse."

If you cannot state the prediction, the hypothesis is a vibe — discard or sharpen it.

**Show the ranked list to the user before testing.** They often have domain knowledge that re-ranks instantly ("we just deployed a change to #3"), or know hypotheses they've already ruled out. Cheap checkpoint, big time saver. Don't block on it — proceed with your ranking if the user is AFK.

## Phase 4 — Instrument

Each probe must map to a specific prediction from Phase 3. **Change one variable at a time.**

Tool preference:

1. **Execution data inspection.** n8n stores every node's input/output per execution — reading the failing execution (`n8n_executions`) beats ten logs. For CLI/Code-node logic: debugger / REPL inspection if the env supports it.
2. **Targeted logs** at the boundaries that distinguish hypotheses (in Code nodes: tagged `console.log`).
3. Never "log everything and grep".

**Tag every debug log** with a unique prefix, e.g. `[DEBUG-a4f2]`. Cleanup at the end becomes a single grep. Untagged logs survive; tagged logs die.

**Perf branch.** For performance regressions, logs are usually wrong. Instead: establish a baseline measurement (timing harness, per-node execution timings in the execution data, `performance.now()`, profiler, query plan), then bisect. Measure first, fix second.

## Phase 5 — Fix + regression test

Write the regression test **before the fix** — but only if there is a **correct seam** for it.

The template gives you two standard seams:

- **Workflow bugs** → a pin-data test case in `tests/pins/<workflow-name>.json` that reproduces the failing input, verified through `/qa-workflow` (test run + AC check).
- **CLI / Code-node bugs** → a normal unit or integration test in `tests/`.

A correct seam is one where the test exercises the **real bug pattern** as it occurs at the call site. If the only available seam is too shallow (single-node pin data when the bug needs the full node chain, unit test that can't replicate the chain that triggered the bug), a regression test there gives false confidence.

**If no correct seam exists, that itself is the finding.** Note it. The codebase architecture is preventing the bug from being locked down. Flag this for the next phase.

If a correct seam exists:

1. Turn the minimised repro into a failing test at that seam.
2. Watch it fail.
3. Apply the fix.
4. Watch it pass.
5. Re-run the Phase 1 feedback loop against the original (un-minimised) scenario.

## Phase 6 — Cleanup + post-mortem

Required before declaring done:

- [ ] Original repro no longer reproduces (re-run the Phase 1 loop)
- [ ] Regression test passes (or absence of seam is documented)
- [ ] All `[DEBUG-...]` instrumentation removed (`grep` the prefix)
- [ ] Throwaway prototypes deleted (or moved to a clearly-marked debug location)
- [ ] The hypothesis that turned out correct is stated in the commit / PR message (`fix(WF-X): …`; PR body carries `Closes #N` if the bug arrived as an issue) — so the next debugger learns

**Then ask: what would have prevented this bug?** Capture the learnings where the template keeps them:

- **File remaining work as a GitHub issue.** Bugs and follow-ups live exclusively as GitHub issues in this template (Bug-Tracking-Konvention, `.claude/rules/general.md`) — never in "Known Bugs" sections of WF-X specs.
- **Add the failure mode to `docs/troubleshooting.md`** if it is an n8n pattern others will hit again (symptom, root cause, fix — match the existing entries).
- **Recurring pattern?** If the same class of bug has now bitten more than once, name it as a candidate for the "Hard-Earned Lessons" section in `CLAUDE.md` and propose the entry to the user.

Make the recommendation **after** the fix is in, not before — you have more information now than when you started.
