#!/bin/sh
# SPDX-License-Identifier: Apache-2.0
# Run every plugin validator installed on this machine against one plugin directory.
# Prints which validators ran and which were skipped; exits 1 if a validator that ran failed.
set -u
dir=${1:?usage: verify.sh <plugin-dir>}
rc=0
ran=""
skipped=""
if command -v agy >/dev/null 2>&1; then
  ran="$ran agy"
  agy plugin validate "$dir" || rc=1
else
  skipped="$skipped agy"
fi
if command -v claude >/dev/null 2>&1 && [ -d "$dir/.claude-plugin" ]; then
  ran="$ran claude"
  claude plugin validate --strict "$dir" || rc=1
else
  skipped="$skipped claude"
fi
echo "ran:${ran:- none}"
echo "skipped (not installed or not applicable):${skipped:- none}"
echo "documentation-checked only: codex copilot cursor opencode (no validator is run for them here)"
exit $rc
