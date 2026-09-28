# Clodex model routing

Claude Code is the client. [Clodex](https://github.com/cgasgarth/clodex) routes its
model requests to configured providers. Model routing is separate from the
[computer and Chrome MCP controls](../mcp/codex-controls/README.md).

## Configuration

- [settings.json](../settings.json) contains the client endpoint, model selection,
  and hook configuration.
- [hooks/ensure-clodex](../hooks/ensure-clodex) starts the daemon when needed.
- Clodex stores its own runtime state and accounts under `~/.clodex/`.
- Credentials and runtime state do not belong in this repository.

Do not set `CLAUDE_CODE_EFFORT_LEVEL` if you want to change effort with `/effort`.

## Runtime commands

```sh
clodex daemon status
clodex daemon logs
clodex start
clodex stop
```

Use Clodex's current compatibility and installation instructions when updating
Claude or the proxy. Version-specific patch behavior, model catalogs, and
compaction implementation belong in the Clodex repository.

## Computer controls

The standalone MCP package in this repository provides `computer` and `chrome`.
Its approval mode is configured in
[permissions.json](../mcp/codex-controls/permissions.json). The tracked Claude
settings deny the old built-in computer-use, Claude Chrome, and Playwright tool
namespaces. See the package guide for setup and verification.
