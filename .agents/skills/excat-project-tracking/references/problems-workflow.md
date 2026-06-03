# Problems Workflow

Problems mode — extract from journal, merge into reference. **Problems only**; do not summarize actions or time.

## When to run

- Session close when Problems table is non-empty
- Session close when Active Blockers changed in project-context
- On request: "update problem tracker", "how did we fix X", "review problems"
- Mid-session read-only: consult reference before risky work (DA, Lottie, git in containers)

Skip when session had no problems and no blocker changes.

## Steps

### 1. Read sources

- `journal/journal.md` — every `### Problems Encountered` table
- `project-context.md` — `## Active Blockers` not yet in reference
- Existing `problems-reference.md` — preserve IDs

### 2. Extract and normalize

For each problem row capture: Problem, Severity, Resolved?, Resolution, session number.

Group similar issues into categories. Recurring problems (2+ sessions) are highest value.

### 3. Add cause and avoidance

- **Cause** — root cause from resolution or context
- **How to avoid** — actionable: "always X / never Y", specific commands/values

### 4. Update reference

1. Prevention Checklists at top (one subsection per category)
2. Category tables with all fields
3. Unresolved / workaround-only section if any

Append and merge — do not delete history. Preserve stable IDs.

### 5. Quick lookup (on request)

Match user issue to category/entry → respond with problem, resolution, avoidance, session cite.

## Rules

- journal.md is source of truth — never modify from problems mode
- Do not fabricate problems
- Avoidance must be actionable
- IDs stable once assigned

## Category prefix table

See [problems-format.md](./problems-format.md).
