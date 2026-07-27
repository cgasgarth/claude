# MCP setup

## Native computer use

Claude Code 2.1.220 includes a built-in MCP server named `computer-use`.
The installed `cgasgarth/clodex` fork exposes it to Sol and Luna and enables it
across projects when this user setting is present:

```json
{
  "env": {
    "CLODEX_NATIVE_COMPUTER_USE": "1"
  }
}
```

After a Claude update or Clodex transform update, apply the binary patch:

```sh
clodex patch
```

Verify from a newly launched interactive Claude session:

```text
/mcp
```

`computer-use` should report `connected · 24 tools`. Native computer use is
macOS-only, does not run under `claude -p`, asks for app access per session, and
permits only one Claude computer-use session at a time.

No third-party computer-use MCP or skill is required.
