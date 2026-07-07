#!/usr/bin/env bash
#
# Secure import wrapper for the Vyepti HCP migration.
#
# The source (stage) site is behind HTTP Basic Auth. Credentials must live ONLY in
# .env (git-ignored) — never in any committed/committable file. This wrapper:
#   1. Reads credentials from .env (VYEPTI_STAGE_USER / VYEPTI_STAGE_PASS).
#   2. Reads the CLEAN url list (tools/importer/urls-<template>.txt — plain URLs, no creds).
#   3. Writes an EPHEMERAL auth-embedded url list to a temp file OUTSIDE the repo
#      (mktemp), used only for this run, and deleted on exit.
#   4. Runs the shared bundled importer against the temp file.
#   5. Scrubs any leaked "user:pass@" credentials from the generated reports so the
#      on-disk report artifacts stay clean too (they are also git-ignored as defense-in-depth).
#
# Usage:  tools/importer/run-import.sh <template>       # default: homepage
#
set -euo pipefail

TEMPLATE="${1:-homepage}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

CONTENT_IMPORT_SCRIPTS_DIR="${CONTENT_IMPORT_SCRIPTS_DIR:-/home/node/.excat-marketplaces/excat-marketplace/excat/skills/excat-content-import/scripts}"
URLS_FILE="tools/importer/urls-${TEMPLATE}.txt"
BUNDLE="tools/importer/import-${TEMPLATE}.bundle.js"

[ -f .env ] || { echo "ERROR: .env not found (needs VYEPTI_STAGE_USER / VYEPTI_STAGE_PASS)"; exit 1; }
[ -f "$URLS_FILE" ] || { echo "ERROR: $URLS_FILE not found"; exit 1; }
[ -f "$BUNDLE" ] || { echo "ERROR: $BUNDLE not found (run aem-import-bundle.sh first)"; exit 1; }

# Load credentials from .env (only these vars).
VYEPTI_STAGE_USER="$(grep -E '^VYEPTI_STAGE_USER=' .env | head -1 | cut -d= -f2-)"
VYEPTI_STAGE_PASS="$(grep -E '^VYEPTI_STAGE_PASS=' .env | head -1 | cut -d= -f2-)"
[ -n "$VYEPTI_STAGE_USER" ] && [ -n "$VYEPTI_STAGE_PASS" ] || { echo "ERROR: creds missing in .env"; exit 1; }

# Build ephemeral auth-embedded url list OUTSIDE the repo; always clean it up.
TMP_URLS="$(mktemp /tmp/vyepti-urls-XXXXXX.txt)"
cleanup() { rm -f "$TMP_URLS"; }
trap cleanup EXIT

# Inject "user:pass@" after the scheme for each non-comment URL line.
while IFS= read -r line; do
  [ -z "$line" ] && continue
  case "$line" in \#*) continue ;; esac
  printf '%s\n' "$line" | sed -E "s#^(https?://)#\1${VYEPTI_STAGE_USER}:${VYEPTI_STAGE_PASS}@#"
done < "$URLS_FILE" > "$TMP_URLS"

echo "Running import for template '${TEMPLATE}' (credentials sourced from .env, not persisted)..."
node "${CONTENT_IMPORT_SCRIPTS_DIR}/run-bulk-import.js" \
  --import-script "$BUNDLE" \
  --urls "$TMP_URLS"

# Defense-in-depth: strip any credentials the runner wrote into report artifacts.
node -e '
const fs = require("fs");
const dir = "tools/importer/reports";
if (!fs.existsSync(dir)) process.exit(0);
const credRe = /\/\/[^/@\s"]+:[^/@\s"]+@/g;
for (const name of fs.readdirSync(dir)) {
  if (!name.endsWith(".report.json")) continue;
  const p = dir + "/" + name;
  const before = fs.readFileSync(p, "utf8");
  const after = before.replace(credRe, "//");
  if (after !== before) { fs.writeFileSync(p, after); console.log("Scrubbed credentials from " + p); }
}
'

# Regenerate the Excel report from the (now clean) JSON so the xlsx has no creds.
WORKSPACE_PATH="$REPO_ROOT" node --input-type=module -e "
const { compileReportsToExcel } = await import('${CONTENT_IMPORT_SCRIPTS_DIR}/import-report.js');
await compileReportsToExcel('tools/importer/import-${TEMPLATE}.js');
"

echo "Import complete. Credentials remain only in .env."
