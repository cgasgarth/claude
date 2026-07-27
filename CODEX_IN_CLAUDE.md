# Codex in Claude

Claude Code is the UI; Clodex routes `sol` and `luna` to the user's
OpenAI/ChatGPT subscription.

## Current installation

- Clodex: `@bman654/clodex` 2.1.4
- Fork: `https://github.com/cgasgarth/clodex` (`main`)
- Checkout: `/Users/cgas/Documents/Projects/clodex`
- Clodex executable: `~/.nvm/versions/node/v26.3.0/bin/clodex`
- Claude Code: 2.1.220 at `~/.local/bin/claude`
- State: `~/.clodex/`
- Provider: `openai-oauth`

The global Clodex package links to the local fork checkout. Rebuild after
updating it; already-running Clodex processes must restart to load new code.

## Launch and defaults

`~/.zshrc`:

```sh
export CLODEX_OPENAI_COMPACTION=1
export CLODEX_OPENAI_COMPACT_THRESHOLD=244800
alias claude='$HOME/.claude/bin/launch-clodex'
```

The launcher resolves Claude's saved alias and starts Clodex endpoint mode
without a provider/model picker.

- Default: `sol`, medium effort
- Alternate: `luna`
- Only `sol` and `luna` appear in `/model` and subagent overrides
- Permissions: `bypassPermissions`; dangerous-mode confirmation skipped
- Claude auto-update: disabled
- Workflow stall timeout: 10 minutes

Aliases:

- `sol` → `gpt-5.6-sol`
- `luna` → `gpt-5.6-luna`

## Prompt caching and agents

- Exact continuations send only the delta plus `previous_response_id`.
- Parent, direct-subagent, and Workflow histories remain isolated.
- A completed subagent socket may be reused by a different agent only when its
  session partition and prompt shape match.
- Parent, active tool-loop, and same-agent heads are never recycled.
- Parallelism is unchanged: every active agent has its own socket.

Validated with direct-agent waves and two separate Workflows across a Claude
exit/resume, with no history leakage.

## Native OpenAI compaction

- Enabled through `CLODEX_OPENAI_COMPACTION=1`
- Trigger: 244,800 tokens
- Policy: 272K raw input, 258.4K effective window; 1M mode disabled
- Normal path: compact the active Responses WebSocket chain, then resume
  delta-only continuation from OpenAI's opaque compact item
- Recovery: `POST /responses/compact` when the live head is unavailable
- Claude `/compact`: remains Claude's portable-summary path
- Portable summaries reconnect only when their summary anchor matches
- Timeout: 60 seconds
- Checkpoints: 30-minute TTL; 8 per session partition, 32 globally

Disable for troubleshooting:

```sh
CLODEX_OPENAI_COMPACTION=0 claude
```

Implementation details: `docs/native-codex-compaction.md` in the Clodex fork.

## Claude/Clodex compatibility patches

Clodex patches Claude Code at launch and reapplies stale patches when needed:

- Pass gateway auth through `ANTHROPIC_AUTH_TOKEN` and remove inherited
  `ANTHROPIC_API_KEY`, preventing the custom-key prompt
- Normalize model names and restrict model/subagent surfaces to `sol`/`luna`
- Keep Claude's context policy above Clodex's native-compaction trigger
- Enable bundled native computer use for Sol and Luna
- Extend Workflow agent stall handling
- Preserve live Workflow token reporting

Patch state: `~/.clodex/patch-state.json`.

After a Clodex/Claude replacement:

```sh
clodex patch --restore
clodex patch --trace
```

To return to the public Clodex package:

```sh
npm install -g @bman654/clodex@2.1.4
```

## Computer use

Sol and Luna use Claude Code's bundled `computer-use` MCP, enabled by
`CLODEX_NATIVE_COMPUTER_USE=1` in `settings.json`.

- `/mcp` should show `computer-use · connected · 24 tools`
- Tools are pre-allowed with `mcp__computer-use__*`
- macOS and interactive sessions only; `-p` is unsupported
- Per-app access approval remains mandatory and cannot be disabled in
  `settings.json`
- Request all anticipated apps and clipboard/system-key access in one
  consolidated `request_access` call

CUA Driver and Peekaboo are not installed.

## Troubleshooting

- **Anthropic login:** bare native Claude uses Anthropic auth. Launch through
  the `claude` alias for OpenAI/Clodex.
- **Custom API-key prompt:** gateway auth regressed to `ANTHROPIC_API_KEY`;
  repatch Clodex.
- **Built-in models reappear:** rebuild the fork and rerun the patch commands.
- **Old behavior after an update:** restart Claude/Clodex; running processes do
  not reload code or environment.
- **False background-agent status:** inspect `claude agents --json --all` and
  verify the PID before clearing stale registry state. Do not delete transcripts.
- **One-line prompt is too long:** a bundled slash-command skill previously
  injected roughly 616K characters. `--disable-slash-commands` isolates this
  failure.

The duplicate npm-global Claude install and CC Switch were removed. The only
Claude binary is `~/.local/bin/claude`, launched through Clodex.
