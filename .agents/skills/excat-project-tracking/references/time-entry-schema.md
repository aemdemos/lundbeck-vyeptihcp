# Time Entry Schema

Canonical fields for every time entry — whether compiled from `journal.md` or normalized from messy notes.

## Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `date` | `YYYY-MM-DD` | Calendar date of the work |
| `project` | string | Project name or code; use journal project name when compiling |
| `task` / `description` | string | What was done (action text or task summary) |
| `duration` | string or minutes | Time spent (`20m`, `1h 30m`, or `90`) |
| `source_classification` | enum | See classification below |
| `confidence` | high \| medium \| low | Certainty of the entry |

## Optional Fields

| Field | Type | When to Use |
|-------|------|-------------|
| `start_time` | `HH:MM` | When session header or calendar provides it |
| `end_time` | `HH:MM` | When session header or calendar provides it |
| `session` | string | Journal session ID (e.g., `Session 003`) |
| `billable` | boolean | When project distinguishes billable vs non-billable; default `true` if unspecified |
| `notes` | string | Source context, assumptions, or review notes |
| `agent_time` | duration | Agent-reported time before user margin |
| `margin_pct` | number | User overhead percentage from journal |
| `total_with_margin` | duration | Agent time + margin |

## Source Classification

Every entry must be classified as one of:

| Classification | Meaning |
|----------------|---------|
| `direct entry` | Time explicitly recorded in journal or user-provided notes |
| `inferred from calendar` | Duration/date derived from calendar event |
| `inferred from task history` | Duration estimated from task/issue activity without explicit time |
| `needs clarification` | Ambiguous allocation, missing duration, or conflicting sources |
| `excluded from time tracking` | Meeting noise, breaks, or user-marked non-work — not counted in totals |

## Journal → Schema Mapping

| Journal source | Schema fields populated |
|----------------|-------------------------|
| Session header `## Session NNN — YYYY-MM-DD — Title` | `date`, `session`, `task` (title) |
| Session header with `HH:MM-HH:MM` | `start_time`, `end_time` (when parseable) |
| Duration line | `agent_time`, `margin_pct`, `total_with_margin`, `duration` |
| Actions table / bullets | `task`, `duration` per row |
| Project name from journal header | `project` |

## Messy Input → Schema

When normalizing notes, calendar snippets, chat updates, or issue links:

1. Extract one row per distinct work item
2. Set `source_classification` honestly — prefer `needs clarification` over guessing
3. Do not populate `project` from ambiguous context — flag instead
4. Keep original source text in `notes` when helpful for review

## Example Row (YAML)

```yaml
date: 2026-02-26
project: Zelis EDS Migration
task: Fix hero Lottie detection to use link text content
duration: 10m
agent_time: 10m
margin_pct: 10
total_with_margin: 11m
session: Session 001
billable: true
source_classification: direct entry
confidence: high
notes: null
```
