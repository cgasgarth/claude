#!/bin/bash
set -euo pipefail

bridge_root="$(cd "$(dirname "$0")/.." && pwd)"
bun_bin="$(command -v bun)"
claude_bin="$(command -v claude)"

cd "$bridge_root"
"$bun_bin" install --frozen-lockfile

# Claude stores global MCP registrations in ~/.claude.json, outside this repo.
# Replace only the servers owned by this setup.
"$claude_bin" mcp remove --scope user cua_repl >/dev/null 2>&1 || true
"$claude_bin" mcp add --scope user --transport stdio cua_repl -- \
  "$bun_bin" "$bridge_root/src/app/cua.ts"

state_dir="$HOME/.claude/cache/codex-integrations"
agent_file="$HOME/Library/LaunchAgents/com.cgas.claude-codex-integrations.plist"
mkdir -p "$state_dir" "$HOME/Library/LaunchAgents"
chmod 700 "$state_dir"
cat > "$agent_file" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>com.cgas.claude-codex-integrations</string>
<key>ProgramArguments</key><array><string>$bun_bin</string><string>$bridge_root/src/app/integrations.ts</string></array>
<key>WorkingDirectory</key><string>$bridge_root</string>
<key>EnvironmentVariables</key><dict><key>PATH</key><string>$HOME/.local/share/fnm/aliases/default/bin:$HOME/.bun/bin:$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string></dict>
<key>RunAtLoad</key><true/>
<key>KeepAlive</key><true/>
<key>StandardOutPath</key><string>$state_dir/service.log</string>
<key>StandardErrorPath</key><string>$state_dir/error.log</string>
</dict></plist>
PLIST
launchctl bootout "gui/$(id -u)/com.cgas.claude-codex-integrations" >/dev/null 2>&1 || true
# launchd can briefly retain a job after bootout while its child exits.
for attempt in 1 2 3; do
  if launchctl bootstrap "gui/$(id -u)" "$agent_file" 2>"$state_dir/install-error.log"; then break; fi
  if [ "$attempt" = 3 ]; then cat "$state_dir/install-error.log" >&2; exit 1; fi
  sleep 1
done

for surface in computer chrome; do
  "$claude_bin" mcp remove --scope user "$surface" >/dev/null 2>&1 || true
done

echo "Shared integration discovery started. Start a new Claude session and check /mcp."
