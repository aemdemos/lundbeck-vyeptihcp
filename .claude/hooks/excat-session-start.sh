#!/usr/bin/env bash
# ExCat project tracking — sessionStart hook
# Sets session env vars and injects tracking context when journal/ exists.
# Fail open: always exit 0.

set -euo pipefail

read_journal_dir() {
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

if [ -z "$journal_dir" ] || [ ! -d "$journal_dir" ]; then
  echo '{}'
  exit 0
fi

state_file="${journal_dir}/session-state.yaml"
session_status=$(read_yaml_value "$state_file" "status")
active_session=$(read_yaml_value "$state_file" "active_session")

context="ExCat project tracking is enabled. Journal directory: ${journal_dir}/.

At session start, follow excat-project-tracking SKILL:
1. Run Status mode (read project-context.md + last Carry-Forward).
2. If session-state.yaml status is not open, open a new journal session and set session-state.yaml to status: open."

if [ "$session_status" = "open" ] && [ -n "$active_session" ] && [ "$active_session" != "null" ]; then
  context="${context}

RESUME: Journal session ${active_session} is already open. Continue logging actions to journal.md; do not start a duplicate session."
else
  context="${context}

No open journal session detected. Open one before significant work (append session header + update session-state.yaml)."
fi

if command -v python3 >/dev/null 2>&1; then
  context_json=$(printf '%s' "$context" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')
else
  context_json="\"$(printf '%s' "$context" | tr '\n' ' ' | sed 's/"/\\"/g')\""
fi

cat <<EOF
{
  "env": {
    "EXCAT_JOURNAL_DIR": "${journal_dir}",
    "EXCAT_TRACKING_ENABLED": "1"
  },
  "additional_context": ${context_json}
}
EOF

exit 0
