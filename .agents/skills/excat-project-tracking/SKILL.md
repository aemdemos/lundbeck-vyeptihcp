---
name: excat-project-tracking
description: Unified ExCat project tracking — journal sessions, problems reference, time reports, and status briefings in one lifecycle. Maintains journal.md, problems-reference.md, time-tracking.md, and project-context.md. Use at session start/end, or when user says journal, log session, update problem tracker, time report, status checkup, catch me up, where did we leave off, daily summary, project hours, or closing out work.
---

# ExCat Project Tracking

## Goal

One skill for the full project tracking loop: **open → work → close → report**. Maintains journal, problems, time, and context so developers install a single skill per project.

## Journal Directory

Default: `{workspace-root}/journal/`. Override via `JOURNAL_DIR` or `journal-config.yaml`:

```yaml
journal_dir: /path/to/journal
project_name: My EDS Migration
```

### Files

| File | Purpose | Updated |
|------|---------|---------|
| `journal.md` | Append-only session log (source of truth) | During + close |
| `journal-index.md` | One-line session index | Session close |
| `project-context.md` | Current state snapshot | Session close |
| `metrics.md` | Cumulative stats | Session close |
| `problems-reference.md` | Problem patterns + prevention | Session close (if problems) |
| `time-tracking.md` | Daily time breakdown | Session close + on request |
| `session-state.yaml` | Active session pointer | Open + close |
| `status-checkup.md` | Optional briefing snapshot | Status mode (optional) |

**Optional — automatic hooks:** [hooks/project-tracking/](../../../../hooks/project-tracking/) (Cursor, Claude Code, other tools)

Initialize on first use: [references/project-init.md](./references/project-init.md)

---

## Session Lifecycle (always follow)

```
OPEN    → status briefing + start session entry
WORK    → log actions and problems as they happen
CLOSE   → finalize journal → problems → time → metrics → context
```

### OPEN

1. If no `journal/` exists → initialize ([project-init.md](./references/project-init.md))
2. Run **Status mode** (abbreviated if user gave a clear task): [status-checkup-format.md](./references/status-checkup-format.md)
3. Append new session header to `journal.md`; write `session-state.yaml`:

```yaml
active_session: "003"
started_at: "2026-06-01T14:00:00Z"
project: "[Project Name]"
branch: "[git branch]"
status: open
```

4. Do not start a second open session — close the current one first

### WORK (during session)

After each significant action, append to the current session's Actions table ([journal-format.md](./references/journal-format.md)):

- Specific description (files, functions, blocks)
- Pattern: `new` / `retry` / `continuation`
- Attempts, result (`pass` / `fail` / `partial`), time estimate

When a problem occurs → add to Problems Encountered table immediately.

Keep **Carry-Forward** current if priorities shift.

### CLOSE (mandatory checklist)

Run [references/session-close-checklist.md](./references/session-close-checklist.md) in order:

1. Finalize session entry (Outcomes, Files Changed, Commits, Carry-Forward, Duration + margin)
2. Update `journal-index.md`
3. Overwrite `project-context.md`
4. **Problems mode** — if session had problems OR active blockers changed → update `problems-reference.md`
5. **Time mode** — regenerate `time-tracking.md`
6. Update `metrics.md`
7. Clear `session-state.yaml` (`status: closed`)

---

## Modes

Invoke the relevant mode based on user request or lifecycle phase.

| Mode | When | Read | Write |
|------|------|------|-------|
| **status** | Session open, "catch me up", "where are we" | All journal files | Optional `status-checkup.md` |
| **journal** | During work, "log session", "update journal" | journal tail | `journal.md` |
| **problems** | Session close w/ problems, "update problem tracker" | journal problems tables | `problems-reference.md` |
| **time** | Session close, "time report", CSV, weekly | journal actions | `time-tracking.md` |

### Status mode

Read-only synthesis. Sources and format: [status-checkup-format.md](./references/status-checkup-format.md).

- Blockers and unresolved problems first
- Carry-Forward / Resume Point = authoritative "where to begin"
- One screen of bullets; do not fabricate

### Journal mode

Rules: append-only history; one active session; be specific; record failures.

Full schema + time estimates: [journal-format.md](./references/journal-format.md)
Extended workflow: [journal-workflow.md](./references/journal-workflow.md)

### Problems mode

Problems only — do not summarize actions or time. Journal is source of truth.

Workflow + category prefixes: [problems-workflow.md](./references/problems-workflow.md)
Output schema: [problems-format.md](./references/problems-format.md)

### Time mode

Compile from journal; do not fabricate.

Schema: [time-entry-schema.md](./references/time-entry-schema.md)
Rules: [tracking-rules.md](./references/tracking-rules.md)
Templates (daily, weekly, CSV, approval): [output-templates.md](./references/output-templates.md)

---

## Shared Rules

1. **journal.md wins** — all derived files are regenerated from it
2. **Do not fabricate** — time, problems, and status come from recorded data
3. **Append-only journal** — never edit past sessions; correct in current session
4. **Actionable avoidance** — problem "how to avoid" must name specific techniques
5. **Call out uncertainty** — use `needs clarification` and `confidence: low` for time entries

---

## Triggers

| User says | Mode |
|-----------|------|
| "catch me up", "status", "where did we leave off", "resume" | status (+ open if new session) |
| "journal", "log session", "update journal" | journal |
| "update problem tracker", "how did we fix X", "review problems" | problems |
| "time report", "how much time today", "weekly summary", "timesheet" | time |
| End of session / "close session" / "log session" (complete) | close checklist (all modes) |

---

## Integration with Legacy Skills

This skill replaces `excat-journaling`, `excat-problem-tracker`, `excat-project-time-tracking`, and `excat-daily-status-checkup`. Those skills redirect here. Same `journal/` paths — no data migration needed.

---

## References

| File | Purpose |
|------|---------|
| [references/project-init.md](./references/project-init.md) | First-time journal setup |
| [references/session-close-checklist.md](./references/session-close-checklist.md) | Ordered close steps |
| [references/journal-format.md](./references/journal-format.md) | Session entry schema |
| [references/journal-workflow.md](./references/journal-workflow.md) | Open/work/close detail |
| [references/problems-format.md](./references/problems-format.md) | Problems reference schema |
| [references/problems-workflow.md](./references/problems-workflow.md) | Extract + merge problems |
| [references/time-entry-schema.md](./references/time-entry-schema.md) | Time entry fields |
| [references/tracking-rules.md](./references/tracking-rules.md) | Margin, rounding, billable |
| [references/output-templates.md](./references/output-templates.md) | Report formats |
| [references/status-checkup-format.md](./references/status-checkup-format.md) | Status briefing template |
| [references/hook-setup.md](./references/hook-setup.md) | Cursor hooks for auto open/close reminders |

## Hooks (optional)

Cross-platform lifecycle hooks live in **`hooks/project-tracking/`** at the repo root (visible, committable, tool-agnostic).

```bash
bash hooks/project-tracking/install.sh all
```

- **Cursor** → `.cursor/hooks.json`
- **Claude Code** → `.claude/settings.json`
- **Other tools** → run the same Node scripts on session open/close

Full docs: [hooks/project-tracking/README.md](../../../../hooks/project-tracking/README.md) · [references/hook-setup.md](./references/hook-setup.md)
