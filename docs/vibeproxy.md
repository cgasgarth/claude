# VibeProxy model routing

Claude Code connects directly to VibeProxy at `http://127.0.0.1:8318`.
VibeProxy selects its saved Claude or ChatGPT credential for the selected model.
Keep VibeProxy running before starting Claude Code.

[settings.json](../settings.json) sets the endpoint, model windows, and model
picker. Opus 5.5 is the default. No gateway API key is set: the saved Claude.ai
login stays active, so cloud connectors remain available. VibeProxy selects
its own saved upstream credentials. Start a new Claude session after changes.

```sh
claude                           # Opus 5.5
claude --model claude-fable-5-1
claude --model gpt-6.1-sol
claude --model gpt-6-astra
claude --model gpt-6-luna
```

Codex models (`gpt-6-luna`, `gpt-6.1-sol`, and `gpt-6-astra`) use a 900k
context and auto-compaction window. `CLAUDE_CODE_MAX_CONTEXT_TOKENS=900000`
sets the custom GPT context size; their `modelSettings` entries set the matching
auto-compaction window. Claude models use their normal default windows.

Claude Code handles automatic compaction and `/compact`. GPT models use the
[native compaction plugin](https://github.com/cgasgarth/clodex/tree/main/plugins/native-compaction);
Claude models use CPA's built-in behavior. The plugin is installed at
`~/.cli-proxy-api/plugins/darwin/arm64/cpa-native-compaction-v0.1.2.dylib`.
Its source is in `~/Documents/Projects/clodex/plugins/native-compaction/`.
Keep `~/.cli-proxy-api/native-compaction/`: these private checkpoints are needed
to resume compacted GPT chats with their original model and credential.

Clodex is no longer part of Claude's request path. Its startup hook, HTTPS proxy,
and local CA settings are removed. Existing Clodex files and services are retained.
Do not set `CLAUDE_CODE_EFFORT_LEVEL` if you want to change effort with `/effort`.

## Fast mode

Use `/fast on` and `/fast off` with Luna, Sol, or Astra. Each session starts with
fast mode off (`fastModePerSessionOptIn: true`); the command toggles it for that
session. VibeProxy translates Claude's `speed: fast` to OpenAI's
`service_tier: priority`.

`CLAUDE_CODE_MODEL_CAPABILITIES` adds `fast_mode` for the three GPT model IDs.
This flag is supported by the installed CLI but is not in the public docs.
`CLAUDE_CODE_SKIP_FAST_MODE_ORG_CHECK=1` skips the Anthropic availability check
for GPT models. Upstream requests still must be accepted by the provider. No binary patch or forced request tier is used.
Claude's `/fast` price label uses its own estimates; it is not GPT pricing.

## Computer controls

The standalone MCP package in this repository provides `computer` and `chrome`.
Its approval mode is configured in
[permissions.json](../mcp/codex-controls/permissions.json). The tracked Claude
settings deny the old built-in computer-use, Claude Chrome, and Playwright tool
namespaces. See the package guide for setup and verification.
