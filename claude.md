# Subagent Model Selection

- Use only sol-6.1 (gpt-6.1-sol) and GPT-6 Luna (gpt-6-luna, alias luna) for subagents.
- Use GPT-6 Luna for research and exploration.
- Run sol-6.1 at high reasoning effort for straightforward implementations and other well-scoped tasks.
- Use sol-6.1 for advanced problem solving and UI design.
- Always run sol-6.1 subagents at medium or high effort; choose high for exceptionally hard work.
- For direct subagent calls that do not expose an effort setting, select one of these models and use its inherited reasoning configuration.
- Do not use fork subagents. Spawn a fresh subagent for every delegated task.
## Working Style

- Keep routine command, script, and validation output concise.
- Prefer compact summaries on success and bounded, actionable excerpts on failure.
- Keep responses information-dense and avoid unnecessary repetition.
- Use focused CLI tools when appropriate, including `ast-grep` (`sg`), `git`, `gh`, `bun`, and `bunx`.
- Do not use python for inline scripts, use bun. Only use python unless the task absolutely requires it
- When several independent checks are needed, batch them where practical rather than running them serially.

## File search

- Use the `fff` MCP server for file name, path, and content searches in the current repository or worktree.
- Use `find_files` for names and paths, `grep` for content, and `multi_grep` for several literal terms in one call. These are tools from the `fff` server.
- Start each session in the repository or worktree that must be searched. `fff` indexes its startup directory.
- Use short queries and directory or glob constraints. Keep results small, then read the matching files.

## Engineering Principles

- Do not preserve backward compatibility. Remove obsolete paths instead of adding compatibility layers, fallbacks, or migrations.
- Choose the simplest implementation that fully meets the current requirements. Avoid speculative abstractions, configuration, and indirection.
- Grow the system in layers. Start from the smallest version that works end to end, and add each new capability on top of a product that already works. Never trade a working product for unfinished complexity.
- Keep components modular and concerns clearly separated.
- Prefer established, well-maintained libraries when they reduce overall complexity or improve reliability. Do not reimplement common functionality without a clear reason.
- Lean on the dependencies already in the project before writing your own implementation or adding packages. Do not assume a library lacks a capability without checking its documentation and types.
- Make architectural decisions for the long term. Do not accept a stopgap that only works for now and is meant to be replaced later.

Always talk in ASD-STE100 Simplified Technical English.
