# Codex in Claude

Claude Code is the UI. The `cgasgarth/clodex` fork routes `sol` and `luna`
through the user's OpenAI/ChatGPT subscription.

## Installation

- Clodex: `@bman654/clodex` 2.1.5 from
  `https://github.com/cgasgarth/clodex` (`main`)
- Checkout: `/Users/cgas/Documents/Projects/clodex`
- Installed CLI: `~/.nvm/versions/node/v26.3.0/bin/clodex`
- Claude Code: 2.1.220 at `~/.local/bin/claude`
- Runtime state: `~/.clodex/`
- Provider: `openai-oauth`

The global package is a packed copy of `main`, not a link to the checkout.
Checkout edits have no effect until the package is rebuilt and reinstalled.

## Launch and defaults

`claude` aliases to `~/.claude/bin/launch-clodex`. The launcher reads the
saved short model name and attaches Claude to the shared endpoint daemon
without opening a provider/model picker.

- Default: `luna`, max effort (`CLAUDE_CODE_EFFORT_LEVEL=max`)
- Alternate: `sol`
- Only `sol` and `luna` appear in model and subagent surfaces
- Permissions: `bypassPermissions`; confirmation skipped
- Claude auto-update: disabled
- Workflow stall timeout: 10 minutes

Aliases:

- `sol` → `gpt-5.6-sol`
- `luna` → `gpt-5.6-luna`

## Persistent daemon

The macOS LaunchAgent owns one shared endpoint, proxy, OpenAI WebSocket pools,
compaction checkpoints, metrics, and session diagnostics.

- Endpoint: `127.0.0.1:17647`
- Selective proxy: `127.0.0.1:17646`
- Dashboard: `clodex`
- Start without dashboard: `clodex start`
- Stop: `clodex stop`
- Inspect: `clodex daemon status` and `clodex daemon logs`

Main sessions, subagents, workflows, and background sessions inherit the same
daemon and account ticket. Up to five OpenAI accounts may be stored; switching
is manual and affects new launches only.

Endpoint mode uses one stable, remembered loopback API key. The per-launch
account ticket travels separately in `x-clodex-launch-ticket`, preventing the
changing custom-API-key prompt while preserving account pinning.

## Caching and agents

- Exact continuations send only the delta with `previous_response_id`.
- Parent, subagent, and workflow histories use isolated partitions.
- Active agents retain independent sockets; completed physical sockets may be
  recycled without reusing logical agent history.
- Live heads expire after 30 minutes idle or 55 minutes total.
- Closing and quickly resuming Claude reuses a matching live head.
- Durable native-compaction checkpoints restore matching parent, subagent, and
  workflow histories after daemon restart.

## Native OpenAI compaction

- Enabled with `CLODEX_OPENAI_COMPACTION=1`
- Effective daemon trigger: 278,000 tokens
- Sol/Luna provider ceiling: 1M context
- Retained user-message budget during rebase: approximately 64K tokens
- Process-local checkpoints: 30 minutes
- Durable checkpoints: seven days
- Capacity: 16 per session partition, 64 globally

Clodex owns automatic model-facing compaction. Claude's automatic local
compactor and blocking guard are disabled for native-compaction routes.

Manual `/compact` also invokes native OpenAI compaction. On success, Clodex
stores OpenAI's opaque state and returns a synthetic checkpoint marker to
Claude; it does not run a second full-transcript summary inference. If native
compaction fails, the ordinary Claude summary request remains the fallback.

When no live head exists, Clodex tries standalone `POST /responses/compact`.
An already-oversized legacy transcript with no native checkpoint may be
unrecoverable in place; start a new session from a handoff instead of repeatedly
resuming or compacting it.

Details: `docs/native-codex-compaction.md` in the Clodex checkout.

## Claude compatibility patches

Clodex patches Claude at launch and reapplies stale patches when needed:

- Accept and expose only the configured short aliases
- Report configured context windows and hand context ownership to Clodex
- Enable Claude's bundled computer-use MCP for Sol/Luna
- Extend workflow stall handling and preserve live workflow token reporting

Patch state: `~/.clodex/patch-state.json`.

After replacing Clodex or Claude:

```sh
clodex patch
```

## Computer use

Sol and Luna use Claude Code's bundled `computer-use` MCP.

- `/mcp` should show `computer-use · connected · 24 tools`
- Tools are pre-allowed with `mcp__computer-use__*`
- macOS interactive sessions only; `claude -p` is unsupported
- Per-app access approval remains mandatory

CUA Driver and Peekaboo are not installed.

## Updating the fork

```sh
cd /Users/cgas/Documents/Projects/clodex
git switch main
git pull --ff-only origin main
pnpm install --frozen-lockfile
pnpm build
npm pack --pack-destination /tmp
npm install -g /tmp/bman654-clodex-<version>.tgz
clodex stop
clodex start
clodex patch
```

Install the packed archive rather than `npm install -g .`; the latter links the
global command to the checkout.

The duplicate npm-global Claude install, CC Switch, Peekaboo, and CUA Driver
were removed. The only Claude binary is `~/.local/bin/claude`.
