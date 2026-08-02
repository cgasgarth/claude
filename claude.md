# Subagent Model Selection

- Use only `sol` or `luna` for subagents. Default to `luna`
- Use `luna` for research, exploration, straightforward implementations, and well-scoped tasks.
- Run `luna` at `medium` reasoning effort for research and exploration.
- Run `luna` at `max` reasoning effort for straightforward implementations and other well-scoped tasks.
- Use `sol` for advanced problem solving and UI design work.
- Always run `sol` subagents at `medium` or `high` reasoning effort when the execution surface supports an effort setting; choose `high` for harder problems that another agent or reasoning level already attempted but did not solve.
- For direct subagent calls that do not expose an effort setting, select the required model and use its inherited reasoning configuration.

## Working Style

- Keep routine command, script, and validation output concise.
- Prefer compact summaries on success and bounded, actionable excerpts on failure.
- Keep responses information-dense and avoid unnecessary repetition.
- Prefer `rg` for searching files and text.
- Use focused CLI tools when appropriate, including `ast-grep` (`sg`), `git`, `gh`, `bun`, and `bunx`.
- When several independent checks are needed, batch them where practical rather than running them serially.

## Engineering Principles

- Do not preserve backward compatibility. Remove obsolete paths instead of adding compatibility layers, fallbacks, or migrations.
- Choose the simplest implementation that fully meets the current requirements. Avoid speculative abstractions, configuration, and indirection.
- Grow the system in layers. Start from the smallest version that works end to end, and add each new capability on top of a product that already works. Never trade a working product for unfinished complexity.
- Keep components modular and concerns clearly separated.
- Prefer established, well-maintained libraries when they reduce overall complexity or improve reliability. Do not reimplement common functionality without a clear reason.
- Lean on the dependencies already in the project before writing your own implementation or adding packages. Do not assume a library lacks a capability without checking its documentation and types.
- Make architectural decisions for the long term. Do not accept a stopgap that only works for now and is meant to be replaced later.
