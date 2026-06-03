#!/usr/bin/env bash
# ExCat project tracking — stop hook
# If a journal session is still open, auto-submit a close reminder (once per loop).
# Fail open: exit 0 with {} when no action needed.

set -euo pipefail

input=$(cat)

# Prefer jq; fall back to grep for status/loop_count
hook_status=""
loop_count=0

if command -v jq >/dev/null 2>&1; then
  hook_status=$(echo "$input" | jq -r '.status // empty')
  loop_count=$(echo "$input" | jq -r '.loop_count // 0')
else
  hook_status=$(echo "$input" | grep -o '"status"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"\([^"]*\)"$/\1/')
  loop_count=$(echo "$input" | grep -o '"loop_count"[[:space:]]*:[[:space:]]*[0-9]*' | head -1 | grep -o '[0-9]*$')
  loop_count=${loop_count:-0}
fi

# Only remind on successful completion; respect loop_limit (hooks.json sets loop_limit: 1)
if [ "$hook_status" != "completed" ]; then
  echo '{}'
  exit 0
fi

if [ "${loop_count:-0}" -gt 0 ]; then
  echo '{}'
  exit 0
fi

read_journal_dir() {
  if [ -n "${EXCAT_JOURNAL_DIR:-}" ] && [ -d "${EXCAT_JOURNAL_DIR}" ]; then
    echo "${EXCAT_JOURNAL_DIR}"
    return
  fi
  if [ -f "journal-config.yaml" ]; then
    grep -E '^\s*journal_dir:' journal-config.yaml 2>/dev/null \
      | head -1 \
      | sed -E 's/^[[:space:]]*journal_dir:[[:space:]]*//' \
      | tr -d "\"'" \
      | tr -d '\r'
    return
  fi
  if [ -d "journal" ]; then
    echo "journal"
    return
  fi
  echo ""
}

read_yaml_value() {
  local file="$1"
  local key="$2"
  if [ ! -f "$file" ]; then
    echo ""
    return
  fi
  grep -E "^[[:space:]]*${key}:[[:space:]]*" "$file" 2>/dev/null \
    | head -1 \
    | sed -E "s/^[[:space:]]*${key}:[[:space:]]*//" \
    | tr -d "\"'" \
    | tr -d '\r'
}

journal_dir=$(read_journal_dir)

if [ -z "$journal_dir" ]; then
  echo '{}'
  exit 0
fi

state_file="${journal_dir}/session-state.yaml"
session_status=$(read_yaml_value "$state_file" "status")
active_session=$(read_yaml_value "$state_file" "active_session")

if [ "$session_status" != "open" ]; then
  echo '{}'
  exit 0
fi

session_label="${active_session:-unknown}"

followup="ExCat session close required: journal session ${session_label} is still open in ${journal_dir}/session-state.yaml.

Run excat-project-tracking CLOSE checklist now:
1. Finalize journal.md (Outcomes, Duration, Carry-Forward)
2. Update journal-index.md and project-context.md
3. Update problems-reference.md if this session had problems
4. Regenerate time-tracking.md
5. Update metrics.md
6. Set session-state.yaml status: closed

See .cursor/skills/excat-project-tracking/references/session-close-checklist.md"

if command -v python3 >/dev/null 2>&1; then
  msg_json=$(printf '%s' "$followup" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')
  printf '{"followup_message": %s}\n' "$msg_json"
else
  # Degraded: single-line escape
  escaped=$(printf '%s' "$followup" | tr '\n' ' ' | sed 's/"/\\"/g')
  printf '{"followup_message": "%s"}\n' "$escaped"
fi

exit 0
