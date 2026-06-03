# Output Templates

Choose template based on user request. Default for "time report" is **daily report file**.

---

## 1. Daily Report File (default)

**Output:** `journal/time-tracking.md` (same directory as journal)

### File header

```markdown
# Time Tracking — [Project Name]

> Daily time reports compiled from journal.md session data.
> Last updated: [YYYY-MM-DD] (after Session [NNN])

**Project total:** [Xh Ym] (agent) / [Xh Ym] (with margin)
```

### Daily section (reverse chronological)

```markdown
---

## [YYYY-MM-DD] — [Daily total with margin]

### Session [NNN] — [Title] ([agent time] agent + [N]% = [total])

| # | Action | Time | Confidence |
|---|--------|------|------------|
| 1 | [Action description] | [Xm] | direct entry |
| 2 | [Action description] | [Xm] | direct entry |
| **Total** | | **[Xm]** | |

**Session subtotal (agent):** [Xh Ym]
**Session total (with margin):** [Xh Ym]

**Daily total:** [Xh Ym] (agent) / [Xh Ym] (with margin)
```

### Cumulative summary (bottom)

```markdown
---

## Cumulative Summary

| Date | Sessions | Agent Time | With Margin | Actions |
|------|----------|------------|-------------|---------|
| [YYYY-MM-DD] | [N] | [Xh Ym] | [Xh Ym] | [N] |
| **Total** | **[N]** | **[Xh Ym]** | **[Xh Ym]** | **[N]** |
```

---

## 2. Quick Reply (chat)

For "how much time today?" — output daily summary in chat; do not write file.

```markdown
## Time — [YYYY-MM-DD]

**Daily total:** [Xh Ym] (agent) / [Xh Ym] (with margin)

### Session [NNN] — [Title]
| Action | Time |
|--------|------|
| [Action] | [Xm] |
| **Subtotal** | **[Xh Ym]** |
```

---

## 3. Weekly Summary

For "this week", "weekly summary", or date-range requests.

```markdown
# Weekly Time Summary — [YYYY-MM-DD] to [YYYY-MM-DD]

**Week total:** [Xh Ym] (agent) / [Xh Ym] (with margin)

| Date | Sessions | Agent Time | With Margin | Top focus |
|------|----------|------------|-------------|-----------|
| Mon [MM-DD] | [N] | [Xh Ym] | [Xh Ym] | [brief theme] |
| ... | | | | |

## Flags
- [needs clarification items]
- [sessions with no time data]
```

---

## 4. CSV / Structured Table

For export, invoicing prep, or approval workflows.

```csv
date,project,task,session,start_time,end_time,duration_min,agent_time_min,total_with_margin_min,billable,source_classification,confidence,notes
2026-02-26,Zelis EDS Migration,Fix hero Lottie detection,Session 001,,,10,10,11,true,direct entry,high,
```

Markdown table equivalent when CSV not requested:

| Date | Project | Task | Duration | Billable | Confidence | Notes |
|------|---------|------|----------|----------|------------|-------|
| 2026-02-26 | [Project] | [Action] | 10m | yes | high | |

---

## 5. Approval-Ready Report

For sign-off before billing or client reporting.

```markdown
# Time Report for Approval — [Project Name]
**Period:** [start] to [end]
**Prepared:** [YYYY-MM-DD]

## Summary
| Metric | Value |
|--------|-------|
| Total hours (agent) | [Xh Ym] |
| Total hours (with margin) | [Xh Ym] |
| Billable hours | [Xh Ym] |
| Sessions | [N] |
| Actions | [N] |

## Items Needing Clarification
- [List entries with confidence: low or needs clarification]

## Detail by Date
[Daily sections — abbreviated action list per day]

## Certification
> All times extracted from journal.md unless marked as inferred.
> Assumptions noted inline. Review flagged items before approval.
```

---

## 6. Messy Notes → Journal-Compatible Entries

When user provides raw notes (not yet in journal), output cleaned entries for review before journal update:

```markdown
## Normalized Time Entries (review before journaling)

| Date | Task | Duration | Classification | Confidence | Notes |
|------|------|----------|----------------|------------|-------|
| 2026-06-01 | Hero nav fix from Slack thread | 45m | inferred from task history | medium | No explicit duration in source |

**Flags:** 1 item needs clarification
**Not counted:** 30m lunch break (excluded from time tracking)
```

Do not write to `time-tracking.md` until entries are confirmed or added to journal.

---

## Output Mode Selection

| User request | Template |
|--------------|----------|
| "time report", "compile time", end of day | Daily report file (#1) |
| "how much time today?" | Quick reply (#2) |
| "this week", "weekly summary" | Weekly summary (#3) |
| "CSV", "export", "timesheet" | CSV (#4) |
| "approval", "for billing", "sign-off" | Approval-ready (#5) |
| messy notes, calendar, chat logs | Normalized entries (#6) → then compile |
