# MCP setup

Claude uses two independent stdio MCP servers from this repository:

- `computer`: Codex native computer controls.
- `chrome`: Codex Chrome extension controls.

The complete bridge source, dependency manifest, lockfile, and tests are in
this directory. This does not need System One or a
Clodex checkout. Clodex model routing is separate from the control tools.

## Setup

Requires macOS, Bun, Claude Code, and the ChatGPT desktop app installed at
`/Applications/ChatGPT.app`. Set up Codex Computer Use and connect its Chrome
extension first. The bridge uses the installed app-server and enabled plugins
from your Codex configuration.

```sh
~/.claude/mcp/codex-controls/scripts/install.sh
```

The script installs this package's locked dependencies and registers `computer`
and `chrome` at user scope. It replaces only those two registrations. Claude
writes the live registrations to `~/.claude.json`, outside this Git repository.
Keep that personal state file out of Git; the setup script recreates the MCP
entries with the correct local paths.

Start a new Claude session and check `/mcp`. Both servers should connect. This
checks MCP connectivity, not access to the selected model.

## How it works

```text
Claude's selected model
  -> computer / chrome MCP (Bun, stdio)
  -> Codex app-server (stdio, temporary tool session)
  -> native controls / Codex Chrome extension
```

Claude makes the decisions. The bridge calls tools without starting a Codex
model turn. It does not start an HTTP listener or local model server. Each MCP
process owns its temporary session.

`mcp/codex-controls/permissions.json` sets `approvalMode` to `bypass`, as requested
for this personal setup. Both MCP servers automatically accept Codex tool
confirmation requests without sending approval forms to Claude. They do not
write global or permanent Codex grants. macOS permission enforcement still
belongs to the installed desktop runtime.

Set `approvalMode` to `ask` and reconnect the MCP servers to show confirmation
forms instead. Claude's own `bypassPermissions` setting does not answer MCP
approval forms; this bridge policy controls that separate step.

Each server exposes an execution tool (`computer_js` or `chrome_js`), plus
`reset_controls` and `end_controls`. Call the execution tool with empty code first
to read its API. JavaScript bindings persist until reset or end. End the session
when the task is finished, and close temporary tabs created for the task.

Claude reserves `computer-use`, so the custom native server is called `computer`.
The tracked [`settings.json`](../../settings.json) denies the old `computer-use`, `claude-in-chrome`, and
`playwright` tool namespaces. Keep built-in Chrome mode disabled. This setup
does not change your model or provider settings.

## Development

```sh
cd ~/.claude/mcp/codex-controls
bun install --frozen-lockfile
bun run check
bun run test
bun run format:check
```

Strict TypeScript and Oxlint checks include a 600-line source-file limit. Tests
cover session lifecycle, cancellation, approval handling, configuration scope,
and the stdio tool lists. They do not drive your desktop.

This is an experimental integration with the installed desktop runtime. Desktop
updates can change its interfaces. The repository includes no proprietary
runtime, credentials, or permission grants. Model availability and agent task
accuracy remain separate from MCP connectivity.
