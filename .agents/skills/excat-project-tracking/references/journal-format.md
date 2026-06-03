# Journal Format — Quick Reference

> Session entry schema for excat-project-tracking. See [journal-workflow.md](./journal-workflow.md) for open/work/close steps.

---

## Session [NNN] — [YYYY-MM-DD] [HH:MM–HH:MM] — [Brief Title]

**Branch:** `[git-branch-name]`
**Duration:** [agent-time] (agent) + [margin]% user overhead = [total]
**Session goal:** [What the user is trying to accomplish]

### Actions

**Table format** (default — retries or complexity):

| # | Action | Pattern | Attempts | Result | Time (est.) |
|---|--------|---------|----------|--------|-------------|
| 1 | [Specific action with file/function names] | [new/retry/continuation] | [N] | [pass/fail/partial] | [Xm] |

**Bullet format** (< 5 straightforward actions):

- [x] Action description (~Xm) — pass
- [ ] Action description — deferred

*Pick one format per session. Don't mix.*

### Outcomes
- **Completed:** [Things finished]
- **Partial:** [Things started but not finished, with state]
- **Deferred:** [Things identified but postponed]

### Problems Encountered

| Problem | Severity | Resolved? | Resolution | Related Action # |
|---------|----------|-----------|------------|-----------------|
| [Description] | [blocker/major/minor] | [yes/no/workaround] | [How fixed] | [#N] |

*(Write "(none)" if no problems occurred)*

### Key Decisions
- [Decision and rationale — only for non-obvious choices]

### Files Changed
- `[path/to/file]` — [what changed and why]

### Commits
- `[short-hash]` — [commit message summary]

### Carry-Forward
> [What the next session must know. Where to start. Any open threads.]

---

## Field Reference

| Field | Values |
|-------|--------|
| Pattern | `new` / `retry` / `continuation` |
| Result | `pass` / `fail` / `partial` |
| Severity | `blocker` / `major` / `minor` |
| Resolved | `yes` / `no` / `workaround` |
| Margin | `5%` / `10%` / `15%` |

## Time Estimation Guide

| Action Type | Base Estimate |
|---|---|
| File read/analysis | 1–2 min |
| Simple edit | 2–3 min |
| Code generation | 5–15 min |
| Complex implementation | 15–45 min |
| Debugging/troubleshooting | 10–30 min |
| Research/exploration | 5–15 min |
| Conversion/generation | 3–5 min |
| Git operations | 1–2 min |
| Visual verification | 3–5 min |

**Margin:** `total = agent_time × (1 + margin_pct)`
