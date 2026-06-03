# Tracking Rules

Rules for normalizing, validating, and reporting time. Apply during compile and when ingesting messy notes.

## Core Rules

1. **Do not fabricate.** Only report time that appears in the source. If missing, classify as `needs clarification` — do not guess.

2. **Do not guess project codes** when the source is ambiguous. Flag for review.

3. **Prefer exact extraction over reconstruction** when the source is incomplete.

4. **Call out assumptions explicitly** in `notes` (e.g., "Assumed 30m from calendar block; not confirmed in journal").

5. **Keep source notes visible** when helpful for review — especially for inferred entries.

6. **Journal wins.** When compiling from `journal.md`, the journal is source of truth. If report and journal conflict, re-read the journal.

7. **Overwrite, don't append.** `time-tracking.md` is regenerated each full run — a derived report, not an independent record.

## Margin (ExCat Journal Model)

When the journal Duration line includes user overhead:

```
**Duration:** ~Xh Ym (agent) + N% user overhead = ~Xh Ym total
```

- Report **agent time** and **total with margin** separately
- Use session Duration line for session subtotals when present
- If margin missing: report agent time only and note *"Margin not in journal; add 5-15% for user overhead if needed."*

## Rounding

- **Per-action:** preserve journal granularity — do not round individual actions
- **Subtotals/totals:** normalize to minutes for arithmetic; display as `Xm` (< 60) or `Xh Ym` (≥ 60)
- **Strip `~` prefix** for arithmetic; retain in display when journal uses it
- **No aggressive rounding** — 63m stays 1h 3m, not 1h

## Billable vs Non-Billable

- Default `billable: true` when not specified
- Mark `billable: false` only when source explicitly says so (e.g., "internal", "non-billable", "admin")
- Include `billable` column in CSV and timesheet outputs when any entry is non-billable

## Minimum Increments

- ExCat journal uses minute-level estimates — no forced 15-minute rounding unless user requests it
- If user specifies increment (e.g., "round to nearest 15m"), apply consistently and note in output header

## Overlap and Break Handling

- **Journal sessions:** typically sequential — flag if session time ranges overlap
- **Messy input:** flag overlapping calendar events or duplicate task entries; do not double-count
- **Breaks:** exclude from totals when explicitly marked; classify as `excluded from time tracking`

## Date and Timezone

- Use date from session header or source document as-is
- If timezone is ambiguous, note in `notes` — do not silently convert
- Multi-date backfill sessions (Session 000): list under start date with date-range note; do not split

## Action-Level Detail

When compiling from journal, break out individual actions — do not collapse to session totals only.
