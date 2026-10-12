# VibeProxy model routing

Claude Code connects directly to VibeProxy at `http://127.0.0.1:8318`.
VibeProxy selects its saved Claude or ChatGPT credential for the selected model.
Keep VibeProxy running before starting Claude Code.

[settings.json](../settings.json) sets the endpoint, a local placeholder API key,
the 350k auto-compaction window, and the model picker. Opus 5.5 is the default.
The proxy currently requires no client API key; replace the placeholder if
client authentication is enabled. Start a new Claude session after config changes.

```sh
claude                           # Opus 5.5
claude --model claude-fable-5-1
claude --model gpt-6.1-sol
claude --model gpt-6-astra
claude --model gpt-6-luna
```

`autoCompactWindow: 350000` applies to all models. The environment context limit
also tells Claude Code that custom GPT models have a 350k window. Known Claude
models can still display their native 1M capacity, but auto-compaction uses 350k.

Claude Code handles automatic compaction and `/compact`. GPT models use the
[native compaction plugin](https://github.com/cgasgarth/codex/tree/main/native-compaction-plugin);
Claude models use CPA's built-in behavior. The plugin is installed at
`~/.cli-proxy-api/plugins/darwin/arm64/cpa-native-compaction-v0.1.2.dylib`.
Its source is in `~/.codex/native-compaction-plugin/`.
Keep `~/.cli-proxy-api/native-compaction/`: these private checkpoints are needed
to resume compacted GPT chats with their original model and credential.

Clodex is no longer part of Claude's request path. Its startup hook, HTTPS proxy,
and local CA settings are removed. Existing Clodex files and services are retained.
Do not set `CLAUDE_CODE_EFFORT_LEVEL` if you want to change effort with `/effort`.

## Computer controls

The standalone MCP package in this repository provides `computer` and `chrome`.
Its approval mode is configured in
[permissions.json](../mcp/codex-controls/permissions.json). The tracked Claude
settings deny the old built-in computer-use, Claude Chrome, and Playwright tool
namespaces. See the package guide for setup and verification.
