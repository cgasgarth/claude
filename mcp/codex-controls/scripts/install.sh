#!/bin/bash
set -euo pipefail

bridge_root="$(cd "$(dirname "$0")/.." && pwd)"
bun_bin="$(command -v bun)"
claude_bin="$(command -v claude)"

cd "$bridge_root"
"$bun_bin" install --frozen-lockfile

# Claude stores global MCP registrations in ~/.claude.json, outside this repo.
# Replace only the two servers owned by this setup.
for surface in computer chrome; do
  "$claude_bin" mcp remove --scope user "$surface" >/dev/null 2>&1 || true
  "$claude_bin" mcp add --scope user --transport stdio "$surface" -- \
    "$bun_bin" "$bridge_root/src/app/server.ts" --surface "$surface"
done

echo "Start a new Claude session and check /mcp."
