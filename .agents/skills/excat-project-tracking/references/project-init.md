# Project Initialization

Run when `journal/` does not exist. Creates the tracking directory and starter files.

## Steps

1. Create `journal/` at workspace root (or `journal_dir` from config)

2. Create `journal.md`:

```markdown
# Project Journal — [Project Name]

> Running log of all sessions, actions, outcomes, and time tracking.
> Each session is appended chronologically. Read from bottom for most recent.

---
```

3. Create `journal-index.md`:

```markdown
# Session Index

| Session | Date | Summary | Duration | Outcomes |
|---------|------|---------|----------|----------|
```

4. Create `project-context.md`:

```markdown
# Project Context — [Project Name]
**Last updated:** [YYYY-MM-DD] (not yet started)
**Branch:** `[branch]`
**Overall status:** Project initialized

## What's Done
- (none yet)

## What's In Progress
- (none yet)

## What's Pending
- [Initial goals if known]

## Active Blockers
- (none)

## Key Files
- (to be populated)

## Resume Point
> Begin first working session.
```

5. Create `metrics.md`:

```markdown
# Project Metrics

## Time
- **Total sessions:** 0
- **Total agent time:** 0h 0m
- **Total with user margin:** 0h 0m
- **Average session length:** —

## Success Rates
- **Actions attempted:** 0
- **First-try success:** 0 (—)
- **Required retry:** 0 (—)
- **Failed:** 0 (—)

## Problems
- **Total encountered:** 0
- **Resolved:** 0 (—)
- **Unresolved:** 0
- **Most common category:** —
```

6. Create `time-tracking.md`:

```markdown
# Time Tracking — [Project Name]

> Daily time reports compiled from journal.md session data.
> Last updated: (pending first session)

**Project total:** 0h 0m (agent) / 0h 0m (with margin)
```

7. Create `problems-reference.md`:

```markdown
# Problems Reference — [Project Name]

> Referential index of problems encountered (from the project journal).
> **Source:** `journal/journal.md`
> **Last review:** (pending first problem)
```

8. Create `session-state.yaml`:

```yaml
active_session: null
status: closed
project: "[Project Name]"
```

## Backfill (existing project)

If tracking is added mid-project, create **Session 000 — [BACKFILL]** summarizing prior work from git log and conversation context. Mark with `[BACKFILL]` in the title.

## Optional: journal-config.yaml

Place in project root or skill directory:

```yaml
journal_dir: journal
project_name: My Project Name
default_margin_pct: 10
```
