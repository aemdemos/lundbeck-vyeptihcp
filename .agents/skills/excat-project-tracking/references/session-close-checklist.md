# Session Close Checklist

Run in order at every session close. Do not skip steps.

## Checklist

- [ ] **1. Finalize `journal.md` session entry**
  - Outcomes (completed / partial / deferred)
  - Files Changed, Commits
  - Carry-Forward (authoritative next step)
  - Duration line: `~Xh Ym (agent) + N% user overhead = ~Xh Ym total`

- [ ] **2. Update `journal-index.md`**
  - Append row: Session | Date | Summary | Duration | Outcomes

- [ ] **3. Overwrite `project-context.md`**
  - What's Done / In Progress / Pending / Active Blockers / Key Files / Resume Point

- [ ] **4. Problems reference** (skip if no problems this session AND no blocker changes)
  - Run problems workflow → update `problems-reference.md`
  - See [problems-workflow.md](./problems-workflow.md)

- [ ] **5. Time report**
  - Regenerate `journal/time-tracking.md` from journal
  - See [output-templates.md](./output-templates.md) §1

- [ ] **6. Update `metrics.md`**
  - Cumulative sessions, time, success rates, problem stats

- [ ] **7. Close `session-state.yaml`**
  ```yaml
  active_session: null
  status: closed
  closed_at: "[ISO timestamp]"
  last_session: "[NNN]"
  ```

## Validation (before marking complete)

- [ ] Action time sum ≈ session Duration (agent)
- [ ] Carry-Forward matches Resume Point in project-context
- [ ] No fabricated time or problems
- [ ] `needs clarification` items flagged in time output if any
