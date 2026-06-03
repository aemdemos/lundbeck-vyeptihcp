# Status Checkup — Format

> Status mode briefing template. Read-only by default; optional write to `journal/status-checkup.md`.

**Constraint:** One screen of scannable bullets.

---

## Template

```markdown
# Status Checkup — [YYYY-MM-DD]

**Project:** [name]
**Branch:** `[branch]`
**Last journal update:** [date/session]

---

## Where we stand
- [Overall status summary]
- What's done: [2-4 milestone bullets]
- In progress: [current work or "between sessions"]

## What needs to be done
- [From Pending + Carry-Forward priorities, 3-5 max]

## Problems to keep in mind
> Skip if none relevant.

- **[category]:** [prevention summary]
- **[ID]** [title] — [severity], unresolved since Session [NNN]

## Where to begin
> [Carry-Forward or Resume Point — authoritative]

## Recent time (optional)
- Project total: [from time-tracking header]
- Recent days: [last 1-3 daily totals]
```

## Sources

| File | Extract |
|------|---------|
| `project-context.md` | Status, Done, In Progress, Pending, Blockers, Resume Point |
| `journal.md` | Last session Carry-Forward |
| `journal-index.md` | Session count, recent summaries |
| `problems-reference.md` | Prevention checklists, unresolved |
| `time-tracking.md` | Project total, recent daily totals |
| `metrics.md` | Session count, success rate |
| git (optional) | branch, uncommitted changes |

## Section rules

- **Blockers first** in Problems section
- **Where to begin** = Carry-Forward; Resume Point reinforces
- **Do not fabricate** — skip missing files
- Abbreviated mode ("what's next"): Where to begin + What needs to be done only

See full example in original status-checkup-format (same structure, project-specific content).
