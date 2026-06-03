# Hook Setup — Automatic Session Tracking

Cross-platform hooks for **Cursor**, **Claude Code**, and other AI coding tools.

**Source of truth (visible in repo):** [`hooks/project-tracking/`](../../../../hooks/project-tracking/)

## What the hooks do

| Event | Script | Behavior |
|-------|--------|----------|
| Session start | `excat-session-start.js` | Inject tracking context when `journal/` exists |
| Session stop | `excat-session-close.js` | If `session-state.yaml` is `status: open`, prompt close checklist |

## Install

From **project root**:

```bash
bash hooks/project-tracking/install.sh all      # Cursor + Claude Code
bash hooks/project-tracking/install.sh cursor   # .cursor/hooks.json only
bash hooks/project-tracking/install.sh claude   # .claude/settings.json only
```

## Manual config

### Cursor — `.cursor/hooks.json`

See [hooks/project-tracking/cursor/hooks.json](../../../../hooks/project-tracking/cursor/hooks.json)

### Claude Code — `.claude/settings.json`

Merge [hooks/project-tracking/claude-code/settings.fragment.json](../../../../hooks/project-tracking/claude-code/settings.fragment.json)

### Other tools

Run the same Node scripts on session open/close. See [hooks/project-tracking/README.md](../../../../hooks/project-tracking/README.md).

## Copy into your project

Commit these to your project repository:

```
hooks/project-tracking/    ← hook scripts (required)
.cursor/hooks.json         ← after install (Cursor)
.claude/settings.json      ← after install (Claude Code)
skills/excat-project-tracking/   ← the skill
```

## session-state.yaml

```yaml
active_session: "003"
status: open   # open | closed
```

Set on OPEN, clear on CLOSE by excat-project-tracking.

## Requirements

- Node.js v16+
- `journal/` directory (skill creates on first use)

## Legacy

Skill-local templates at `excat-project-tracking/templates/` are deprecated — use `hooks/project-tracking/` instead.

Previous `.claude/skills/hooks/journal-reminder.js` superseded by `excat-session-close.js`.
