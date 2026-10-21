# Codex tools for Claude

Claude shows each enabled Codex integration as its own MCP entry, such as
`gmail`, `github`, `google-drive`, and `google-calendar`. `cua_repl` remains a
separate server for OpenAI's desktop and browser controls.

This setup requires macOS, Bun, Claude Code, and the ChatGPT desktop app at
`/Applications/ChatGPT.app`. Enable Codex Computer Use and Chrome, and connect
OpenAI's Chrome extension in the desktop app first. It does not require
trycua/cua, CuaDriver, Cua Spaces, a VM, or a shared volume.

## Setup

```sh
~/.claude/mcp/codex-controls/scripts/install.sh
```

The installer registers `cua_repl` and starts one shared local bridge through
`com.cgas.claude-codex-integrations`. The bridge discovers integrations from the
live Codex catalog and updates only its own entries in `~/.claude.json`.
There is no hand-maintained connector list. Start a new Claude session to load
new server entries; existing entries receive tool-list updates automatically.

## Desktop and Chrome controls

```text
Claude -> cua_repl MCP proxy -> OpenAI's bundled cua_repl runtime
                                 ├─ Codex native desktop controls
                                 └─ OpenAI Chrome extension
```

The proxy loads the newest cached `unified-computer-use/.mcp.json` when it starts.
It uses that manifest's command, arguments, and environment. Reconnect `cua_repl`
after a desktop app update to use the current cached runtime.

Claude calls the upstream `js` and `js_reset` tools directly. The `js` description
adds a short Chrome discovery note, including the distinction from Cua Spaces.
Upstream descriptions, API documentation, initialization instructions, images,
errors, and cancellation messages are preserved. No Codex app-server or Codex model
turn is used for these controls.

A plain Claude registration does not supply the session and turn metadata that
OpenAI's browser runtime requires. The small proxy adds those IDs, keeps them
stable during an operation, and releases the operation when its MCP connection
ends. Calling `turn_ended` releases the current operation; the proxy supplies its
own IDs, so empty arguments are sufficient for that call. JavaScript state stays
available until `js_reset` or disconnection.

On the first `js` call, use exactly one runtime entry point and read the returned
API documentation before continuing:

```js
var calculator = await cua.getApp("com.apple.calculator");
```

For Chrome, select the browser once and use its returned ID:

```js
var browser = await cua.getBrowser({ id: "chrome" });
```

Then create a task tab with a session name or bind an existing tab through the
API shown in the returned documentation. There is no `setupBrowserRuntime`
import or separate `chrome_js` tool. Close temporary tabs when the task ends;
keep only requested deliverables or handoffs.

`permissions.json` retains this personal setup's `approvalMode: "bypass"`.
The proxy accepts runtime permission forms in that mode. Set it to `ask` and
reconnect to forward those forms to Claude. URL-based authentication requests
are always forwarded. This setting does not change macOS permissions or write
permanent Codex grants. The tracked Claude settings deny the old built-in
computer-use, Claude Chrome, and Playwright tool namespaces.

This is an experimental integration with OpenAI's installed desktop runtime.
App updates can change its interfaces. The source includes no proprietary
runtime, credentials, or permanent permission grants.

## Connected Codex tools

```text
Claude -> individual MCP entries -> one shared bridge -> Codex app-server
```

The shared bridge discovers live input/output schemas, descriptions,
annotations, and account metadata. Stable server prefixes and hashes prevent
tool-name collisions. Claude makes the decisions; discovery and execution do
not start a Codex model turn.

The bridge watches `~/.codex/config.toml`, including file replacements. It
reloads its owned session after active calls finish. Codex app-list and
server-startup events also refresh the inventory. Changed inventories emit
`notifications/tools/list_changed`; no timer polls the catalog. For account
changes without a Codex event, call `refresh_plugins` on any integration.
`codex_status` reports upstream startup errors. Failed and disabled servers do
not expose callable tools.

For apps with several accounts, Claude selects the required `link_id` from the
upstream account metadata. The bridge forwards it unchanged. Codex handles
authentication; this package stores no credentials or account IDs.

The bridge excludes the computer and browser REPLs. It exposes plugin
**tools**; it does not import plugin skills, prompts, resources, or app UI.
Model routing through Clodex remains separate.

The bridge listens on `127.0.0.1:17648`. A local bearer token protects the
endpoints; it is stored under `~/.claude/cache/codex-integrations/` and included
in the generated Claude registrations. Logs are in that same directory.
Discovery runs at service startup and on Codex configuration, app-list, and
server-startup events. Failed discovery preserves the existing registrations.

## Validation

```sh
cd ~/.claude/mcp/codex-controls
bun run check
bun run test
bun run format:check
bun run smoke:plugins
```

The tests cover direct runtime metadata, approval forms, cancellation, cleanup,
configuration selection, and connected-tool discovery and reload. The live
plugin smoke test reads account profiles only. It does not send email.

## Image generation

Claude also gets an `image-generation` entry from the shared bridge. Its
`generate_image` tool uses VibeProxy at `127.0.0.1:8318` with your existing Codex
connection, without a separate OpenAI API key. Flare is the default; Sunburst is
available for precise edits. Pass absolute `referenced_image_paths` to edit images.
Results include an image preview and a PNG saved under `~/.claude/generated_images/`.
VibeProxy must be running. Image calls have a five-minute limit and no automatic retries.
