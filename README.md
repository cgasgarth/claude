# Claude configuration

Personal Claude Code configuration for `cgasgarth`.

## Layout

```text
~/.claude/
├── settings.json             Claude settings and tool permissions
├── settings.local.json       Local Claude settings
├── claude.md                 Global instructions
├── docs/
│   └── clodex.md             Model routing setup
├── hooks/                   Claude lifecycle hooks
├── scripts/
│   └── statusline.sh         Status-line renderer
├── mcp/
│   └── codex-controls/
│       ├── README.md         Setup and usage
│       ├── permissions.json Approval mode
│       ├── package.json     Dependencies and commands
│       ├── bun.lock         Dependency lockfile
│       ├── scripts/         MCP registration
│       ├── src/             Control tools and dynamic Codex tool bridge
│       └── tests/           Tests and fixtures
├── plugins/                 Plugin and marketplace declarations
└── skills/                  User skills
```

Claude settings, instructions, hooks, skills, and plugin declarations stay in
the locations Claude expects. Standalone MCP packages own their source,
dependencies, setup scripts, and documentation.

## Setup guides

- [Codex controls and dynamic plugin tools](mcp/codex-controls/README.md)
- [Clodex model routing](docs/clodex.md)

## Git boundaries

Excluded:

- Sessions, transcripts, projects, jobs, tasks, and file history
- Logs, telemetry, caches, downloads, backups, and generated shell state
- OAuth material, credentials, tokens, private keys, and certificates
- Downloaded plugin caches and marketplace clones

The plugin manifests record desired installations; downloaded plugin code is
reproducible and intentionally not versioned.

Live user-scoped MCP registrations are in `~/.claude.json`, outside this repo.
Use the MCP package's install script to create them. Keep credentials and
generated runtime state out of Git.
