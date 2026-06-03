#!/usr/bin/env bash
# Install ExCat project tracking hooks into the current project.
# Run from project root: bash .cursor/skills/excat-project-tracking/templates/install-hooks.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(pwd)"

if [ ! -f "${SCRIPT_DIR}/hooks.json" ]; then
  echo "Error: hooks.json not found at ${SCRIPT_DIR}" >&2
  exit 1
fi

mkdir -p "${PROJECT_ROOT}/.cursor/hooks"
cp "${SCRIPT_DIR}/hooks.json" "${PROJECT_ROOT}/.cursor/hooks.json"
cp "${SCRIPT_DIR}/hooks/"*.sh "${PROJECT_ROOT}/.cursor/hooks/"
chmod +x "${PROJECT_ROOT}/.cursor/hooks/"*.sh

echo "Installed ExCat tracking hooks:"
echo "  ${PROJECT_ROOT}/.cursor/hooks.json"
echo "  ${PROJECT_ROOT}/.cursor/hooks/excat-session-start.sh"
echo "  ${PROJECT_ROOT}/.cursor/hooks/excat-session-close-reminder.sh"
echo ""
echo "Restart Cursor or save hooks.json if hooks do not load immediately."
echo "Ensure excat-project-tracking skill is installed and journal/ exists (or will be initialized on first session)."
