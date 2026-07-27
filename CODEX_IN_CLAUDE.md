# Codex-in-Claude Setup

This machine uses Claude Code as a local UI bridged to the user's OpenAI Codex/ChatGPT subscription through clodex.

## Installed package

- Package identity: `@bman654/clodex`
- Version: `2.1.4`
- Source fork: `https://github.com/cgasgarth/clodex`
- Installed source: fork `main`
- Upstream contribution PR: `https://github.com/bman654/clodex/pull/53`
- Executable: `/Users/cgas/.nvm/versions/node/v26.3.0/bin/clodex`
- Claude Code: `2.1.220`
- Claude executable: `/Users/cgas/.local/bin/claude`
- clodex state: `~/.clodex/`
- OpenAI provider: `openai-oauth` (ChatGPT/Codex-plan OAuth)

The global package is linked to `/Users/cgas/Documents/Projects/clodex` and
built from the fork's `main`, rather than installed from the public npm release.
New Claude launches use the latest locally built fork; already-running Clodex
processes retain their in-memory code until restarted.

## Launch behavior

The `claude` alias in `~/.zshrc` is:

```sh
export CLODEX_OPENAI_COMPACTION=1
export CLODEX_OPENAI_COMPACT_THRESHOLD=244800
alias claude='$HOME/.claude/bin/launch-clodex'
```

Use `claude` from a new shell. The tracked launcher reads Claude's `model`
setting, resolves `sol` or `luna` through Clodex's alias table, and launches
endpoint mode without a provider/model picker. Claude's own settings remain the
source of truth for Sol at medium effort; the shell alias contains no model.

## Models

Only these clodex favorites and aliases are configured:

- `sol` → `gpt-5.6-sol` (default)
- `luna` → `gpt-5.6-luna`

Effective launch behavior and Claude settings are:

- Default model in `~/.claude/settings.json`: `sol`
- Default reasoning effort in `~/.claude/settings.json`: `medium`
- The shell alias does not override the model or effort
- Permissions: `bypassPermissions` with dangerous-mode confirmation skipped
- Automatic Claude Code updates: disabled with `DISABLE_AUTOUPDATER=1`

The Claude `/model` picker was patched to show only `sol` and `luna`. Both were verified with successful test responses.

## Agent and workflow prompt-cache affinity

- **Continuation:** exact history matches send only the new delta with
  `previous_response_id`.
- **Isolation:** parent, direct-subagent, and Workflow histories remain separate.
- **Recycling:** a terminal subagent socket may serve a different agent only
  when the session partition and prompt shape match.
- **Protected heads:** parent, active tool-loop, and same-agent heads are never
  recycled.
- **Concurrency:** unchanged; every simultaneously active agent has its own
  socket.
- **Validated:** direct-agent waves and two separate Workflows across a process
  exit/resume completed without history leakage.

## Native OpenAI/Codex compaction

The fork adds native OpenAI/Codex compaction for ChatGPT/Codex OAuth Responses
sessions. This machine explicitly sets:

- Native compaction opt-in: `CLODEX_OPENAI_COMPACTION=1`.
- Native compaction trigger: `244800` tokens through
  `CLODEX_OPENAI_COMPACT_THRESHOLD`, matching 90% of the provider model's 272K
  input window.
- Advertised provider window: `272000` tokens for both Sol and Luna.
- OpenAI 1M model mode: not enabled.

The upstream feature is experimental and off by default. This machine opts in
through `~/.zshrc` and pins the threshold explicitly. Native compaction matches
Codex's fallback model policy: a 272K raw window, a 258.4K effective window
(95%), and a 244.8K auto-compaction threshold (90%).

The normal Sol path uses the active Responses WebSocket head and sends only the
new delta, `previous_response_id`, and a compaction trigger. OpenAI returns its
opaque native compaction item, and clodex starts a fresh canonical Responses
chain from that item. Later turns return to delta-only continuation.

Claude portable-summary turns, including `/compact`, remain on the normal
unmodified path. Native compaction can occur on a later ordinary turn after the
threshold is reached.

`POST /responses/compact` is retained only as recovery when the live head is
unavailable or expired. Claude Code may still perform its own local transcript
rewrite; clodex reconnects that rewrite to the native compacted state only when
the portable summary's SHA-256 anchor matches exactly.

Both native transports have a 60-second budget. Process-local checkpoints
expire after 30 minutes and remain capped at 8 per session partition / 32
globally. Superseded checkpoints are discarded rather than allowed to restore
stale state.

Native compaction can be disabled for troubleshooting:

```sh
CLODEX_OPENAI_COMPACTION=0 claude
```

Detailed architecture and failure behavior are in the fork at
`docs/native-codex-compaction.md`.

## Local clodex patches

Several small machine-specific compatibility patches are reapplied to the
fork-built clodex `2.1.4` bundle and the Claude Code binary:

1. In the installed clodex bundle, endpoint launch removes any inherited
   `ANTHROPIC_API_KEY` and passes the local gateway credential as
   `ANTHROPIC_AUTH_TOKEN`. This prevents Claude Code from repeatedly asking
   whether to use a custom API key while preserving gateway authentication.
2. In the installed clodex model seed, Sol and Luna advertise a 400K safety
   window. The clodex favorites and aliases restrict the normal switch surface
   to those two models; provider-cache metadata for other models may still
   exist.
3. In the patched Claude Code binary, startup model names are normalized to the
   aliases `sol`/`luna`, preventing a duplicate canonical `gpt-5.6-sol` entry.
4. The Claude `/model` picker replaces built-in entries rather than appending
   to them, leaving only `sol` and `luna`.
5. The Claude Agent/subagent model enum and known-model validator replace the
   built-in model names, leaving only `sol` and `luna` as permitted overrides.

The clodex bundle edits are under:

`/Users/cgas/.nvm/versions/node/v26.3.0/lib/node_modules/@bman654/clodex/dist/`

The model-picker and agent-model edits are applied to Claude Code `2.1.220` and
tracked by `~/.clodex/patch-state.json`.

An npm upgrade, clodex reinstall, or Claude Code replacement may overwrite the
relevant fork build or machine-specific compatibility patches. If the API-key
prompt returns or built-in models reappear, reinstall the fork, reapply the
equivalent changes, and rerun:

```sh
clodex patch --restore
clodex patch --trace
```

The pre-native-compaction installed package was backed up outside `PATH` at:

`/Users/cgas/.clodex/install-backups/clodex-2.1.3-pre-native.1eSMjQ/`

To return to the public package instead of the fork:

```sh
npm install -g @bman654/clodex@2.1.4
```

## Troubleshooting history

### Native Claude login

Running bare native Claude without clodex attempts Anthropic authentication. An OpenAI/Codex subscription does not satisfy `/login`; use the `claude` alias above instead.

### Repeated API-key prompt

The prompt was caused by clodex injecting a local gateway credential. Choosing “No” caused `Login expired`; choosing “Yes” worked, confirming the gateway credential was required. Passing it as `ANTHROPIC_AUTH_TOKEN` removed the prompt and retained working authentication.

### Context-window failure

A one-line prompt produced a `Prompt is too long` error because Claude Code auto-loaded a bundled `claude-api` skill of approximately 616k characters. The prompt itself was only 69 characters. Running with `--disable-slash-commands` avoided the oversized skill injection, identifying bundled skill loading as the trigger rather than a corrupted transcript or duplicated Claude install.

### Existing sessions and compaction flags

Environment and installed-code changes only apply to newly launched processes.
One session started before native compaction was configured used Claude's own
auto-compaction at `371904` tokens instead of the desired 244.8K native trigger.
After exiting and resuming through the `claude` alias, both the clodex parent and
Claude child inherited `CLODEX_OPENAI_COMPACTION=1` and
`CLODEX_OPENAI_COMPACT_THRESHOLD=244800`.

If a resumed session is incorrectly reported as a running background agent,
inspect `claude agents --json --all`. A killed background session can leave a
stale registry entry whose PID is later reused by a Claude spare worker. Verify
the process identity before clearing any stale session record; the transcript
JSONL is separate and must not be deleted.

### Install cleanup

The duplicate npm-global Claude installation was removed. CC Switch was uninstalled; its app and local data were moved to:

`/Users/cgas/.Trash/CC-Switch-uninstall-2026-07-25/`

The remaining Claude installation is the native binary at `~/.local/bin/claude`, launched through clodex by the shell alias.

## Computer use

Sol and Luna use Claude Code's bundled native `computer-use` MCP. This is the
same CLI computer-use implementation exposed to eligible Anthropic models, not
a third-party CUA compatibility server.

The installed build comes from `cgasgarth/clodex` `main`. PR #4 added two
Claude binary patch sites:

- an explicit eligibility override for the bundled server, while preserving
  Claude's HIPAA, macOS, and interactive-session guards;
- global default enablement, avoiding the upstream per-project `/mcp` setup.

PR #5 versioned Clodex's patch digest so transform updates force one clean
restore-and-repatch instead of being mistaken for an already-current binary.
The feature is enabled by `CLODEX_NATIVE_COMPUTER_USE=1` in
`~/.claude/settings.json`. Removing that setting restores upstream behavior.

Validation on Claude Code 2.1.220:

- `/mcp` reports `computer-use · connected · 24 tools` in a fresh project;
- Sol completed native app approval, screenshot, app launch, and mouse movement;
- Luna read Calculator's display/keypad from a screenshot and moved the pointer;
- global MCPs were suppressed during both tests, so CUA Driver could not satisfy
  the calls.

Native computer use is macOS-only and interactive-only (`-p` is unsupported).
It retains Claude's per-app approval dialog, machine-wide one-session lock,
screen filtering, Terminal exclusion, and global Escape abort behavior. New
settings and binary patches apply only to newly launched Claude processes.

Claude's ordinary MCP permission layer is pre-allowed with
`mcp__computer-use__*`. The separate per-session app allowlist cannot be
disabled in `settings.json`; root instructions tell Claude to request every
anticipated app and any clipboard/system-key grants in one consolidated
`request_access` call.

CUA Driver and Peekaboo were removed after the bundled native server passed the
Sol and Luna smoke tests.
