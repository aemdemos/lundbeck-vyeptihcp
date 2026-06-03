# Problems Reference — Schema and Format

> Output schema for problems mode. See [problems-workflow.md](./problems-workflow.md) for extraction steps.

The reference lives at `journal/problems-reference.md`.

---

## File header

```markdown
# Problems Reference — [Project Name]

> Referential index of problems encountered (from the project journal), their
> resolutions, and how to avoid them.

**Source:** `journal/journal.md`
**Last review:** [YYYY-MM-DD] (after Session [NNN])
```

## Prevention checklists (top)

```markdown
## Quick Reference — Prevention Checklists

### [Category Name]
- [ ] [Verb] [specific technique/value] — [brief context] ([ID])
```

## Category table

```markdown
## [Category Name]

| Problem | ID | Cause | Resolution | How to avoid | Sessions | Severity | Resolved? |
|---------|----|-------|------------|--------------|----------|----------|-----------|
| [Short desc] | [DA-001] | [Cause] | [Fix] | [Concrete guidance] | [001, 003] | [major] | [yes] |

**Recurring:** Yes/No
**Notes:** [Optional link to fix location]
```

## Unresolved section (if needed)

```markdown
## Unresolved or Workaround-Only

| Problem | ID | Sessions | Current state |
|---------|----|----------|---------------|
| [Desc] | [ID] | [001] | Workaround: [brief] |
```

## Field reference

| Field | Description |
|-------|-------------|
| ID | Stable `{PREFIX}-{NNN}` — never reassign |
| How to avoid | Specific technique — not generic advice |
| Resolved? | `yes` / `no` / `workaround` |

## Category prefixes

| Category | Prefix |
|----------|--------|
| DA / URL and path mangling | `DA` |
| Git / environment | `GIT` |
| Performance / loading | `PERF` |
| File sync / auto-generation | `SYNC` |
| Build / deployment | `BUILD` |
| Content authoring | `AUTH` |
| Block rendering | `BLOCK` |

New categories get a short uppercase prefix on first encounter.
