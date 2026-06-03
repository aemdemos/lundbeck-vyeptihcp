# Journal Workflow

Extended workflow for journal mode. Session lifecycle overview in main SKILL.md.

## Rules (non-negotiable)

1. **Append-only** — never edit past sessions; correct in current session only
2. **One active session** — close before opening another
3. **Keep Carry-Forward current** during the session
4. **Be specific** — file names, commits, error messages
5. **Record failures** — failed attempts are valuable context

## Session Open

1. Check `journal/journal.md` and `project-context.md` exist; else [project-init.md](./project-init.md)
2. Read `project-context.md` + last 1–2 sessions (Carry-Forward)
3. Increment session number from `journal-index.md` or count `## Session` headers
4. Append session header with date, branch, goal
5. Set `session-state.yaml` to `status: open`

## During Session

After each significant action → append Actions row with time estimate.

On problem → append Problems row immediately.

On non-obvious decision → Key Decisions bullet.

Update Carry-Forward when priorities shift.

## Session Close

Follow [session-close-checklist.md](./session-close-checklist.md).

## Quick Context Recovery

**Default (< 60 seconds):**
1. `project-context.md` — current state
2. Last Carry-Forward in `journal.md`
3. Start working

**Deep dive:** Add `journal-index.md`, specific sessions, `metrics.md`.

## Parsing Notes

**Session headers:**
```
## Session NNN — YYYY-MM-DD — Title
## Session NNN — YYYY-MM-DD HH:MM-HH:MM — Title
```

**Duration line:**
```
**Duration:** ~Xh Ym (agent) + N% user overhead = ~Xh Ym total
```

**Action time:** last column of Actions table, or `(~Xm)` in bullets.

**Normalize:** `1h 30m` → 90 minutes for sums; display as `Xh Ym` when ≥ 60m.

**Backfill sessions:** Session 000 under start date with date-range note.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Journal missing | Re-init from project-init; backfill from git |
| Session numbers out of sync | Check journal-index or count headers |
| Metrics drift | Recount from journal.md — journal wins |
| Journal too large | Use index + context; archive after 50+ sessions |
