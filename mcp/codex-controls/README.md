# MCP setup

Claude uses three stdio MCP servers from this repository:

- `computer`: Codex native computer controls.
- `chrome`: Codex Chrome extension controls.
- `codex`: tools discovered from your enabled Codex MCP servers and connected apps.

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

The script installs this package's locked dependencies and registers `computer`,
`chrome`, and `codex` at user scope. It replaces only those registrations. Claude
writes the live registrations to `~/.claude.json`, outside this Git repository.
Keep that personal state file out of Git; the setup script recreates the MCP
entries with the correct local paths.

Start a new Claude session and check `/mcp`. All three servers should connect. This
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

## Dynamic Codex tools

The `codex` MCP process reads the live Codex tool inventory when Claude starts
it. It passes the upstream input/output schemas, descriptions, annotations, and
account metadata through to Claude. Tool names have a stable server prefix and
hash so different servers cannot collide. No model turn is used for discovery
or execution.

The bridge watches `~/.codex/config.toml`, including file replacements. Changes
reload its owned Codex session after any active call finishes. Codex app-list
and server-startup events also refresh the inventory. An updated inventory emits
one `notifications/tools/list_changed` notification. No timer polls the catalog.
For account changes without a Codex event, call `refresh_plugins`, or reconnect
`codex` in `/mcp`. `codex_status` shows upstream startup errors. Failed and
disabled servers do not expose callable tools.

Gmail and other apps can advertise several accounts in their tool metadata.
The original `link_id` input remains required when Codex requires it. Claude
selects the account from the listed connections; the bridge forwards that ID
unchanged. Codex handles authentication. This package stores no connection
IDs or credentials. Both configured Gmail accounts were verified with read-only
profile calls through the stdio bridge.

Computer and Chrome REPLs remain in `computer` and `chrome`; `codex` does not
duplicate them. This synchronizes MCP **tools**. Plugin skills, prompts,
resources, and app UI rendering are not imported into Claude.

Validation:

```sh
bun run check
bun run test
bun run format:check
bun run smoke:plugins  # live discovery, Gmail account profiles, and reload
```

The live smoke test reads account profiles only. It does not send email.
