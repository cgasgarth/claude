# Codex in Claude

Claude Code is the UI. The `cgasgarth/clodex` fork routes configured aliases
through an OpenAI/ChatGPT subscription.

## Installed setup

- Clodex checkout: `/Users/cgas/Documents/Projects/clodex` (`main`)
- Installed packed CLI: `~/.bun/bin/clodex`
- Claude Code: `2.1.227` at `~/.local/bin/claude`
- Runtime state: `~/.clodex/`
- Provider: `openai-oauth`
- Default: `sol`, high effort, bypass permissions
- Favorites/aliases: `sol`, `luna`, and `terra`
- Secondwind: on
- Claude auto-update: off

`claude` runs `~/.claude/bin/launch-clodex`, which reads the model from
`~/.claude/settings.json` and connects to the shared daemon without a picker.
Do not set `CLAUDE_CODE_EFFORT_LEVEL`; it prevents `/effort` changes.

## Shared daemon

- Endpoint: `127.0.0.1:17647`
- Dashboard: `clodex`
- Start/stop: `clodex start` / `clodex stop`
- Inspect: `clodex daemon status` and `clodex daemon logs`

Main sessions, subagents, workflows, and background sessions share the daemon.
Each launch pins its selected account. Stored accounts switch manually; there
is no automatic failover.

## Caching and compaction

- Exact continuations send only new items with `previous_response_id`.
- Main, subagent, and workflow histories use separate logical partitions.
- OpenAI native compaction normally starts near 265K tokens; model context can
  still grow beyond that when recovery needs it.
- Durable native checkpoints survive daemon restarts for seven days.
- Checkpoints accept Claude's reshaped or omitted opaque reasoning, but user
  messages, assistant text, tool calls, and tool results must match exactly.
- Manual `/compact` uses native OpenAI compaction and returns a synthetic marker
  to Claude. Claude's full-transcript summarizer is only a fallback.

See `docs/native-codex-compaction.md` in the Clodex checkout.

## Claude binary patch

This Clodex release supports Claude Code `2.1.227` only. `clodex patch` rejects
other versions before it reads or changes the binary; `clodex patch --restore`
remains available for recovery.

The patch exposes configured aliases and context windows, hands automatic
context ownership to Clodex, enables Claude's native computer-use MCP, extends
the workflow stall timeout to 10 minutes, and preserves workflow token counts.
Patch state is stored in `~/.clodex/patch-state.json`.

Do not update Claude independently. Update Clodex compatibility first, then run
the normal `claude update` command and `clodex patch`.

## Computer use

- Claude's bundled `computer-use` MCP is enabled for patched OpenAI models.
- Tools are pre-allowed with `mcp__computer-use__*`.
- macOS per-app access approval remains mandatory.
- CUA Driver and Peekaboo are not installed.

## Update Clodex

```sh
cd /Users/cgas/Documents/Projects/clodex
git switch main
git pull --ff-only origin main
bun install --frozen-lockfile
bun run build
bun run install:global
clodex patch
clodex daemon restart
```

The installed package is a packed copy of `main`, not a link to the checkout.
