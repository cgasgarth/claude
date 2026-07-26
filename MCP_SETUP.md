# MCP setup

## CUA Driver

Install or update CUA Driver using its signed macOS application installer:

```sh
/bin/bash -c "$(curl -fsSL https://cua.ai/driver/install.sh)"
cua-driver telemetry disable
open -n -g -a CuaDriver --args serve
cua-driver permissions grant
```

Register it globally with Claude Code:

```sh
claude mcp add-json --scope user cua-computer-use \
  '{"args":["mcp"],"command":"'"$HOME"'/.local/bin/cua-driver"}'
```

Install the matching agent skill:

```sh
mkdir -p ~/.claude/skills
cua-driver skills install
```

Verify:

```sh
cua-driver doctor
cua-driver permissions status
claude mcp get cua-computer-use
claude mcp list
```
