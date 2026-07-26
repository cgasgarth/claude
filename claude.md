# Subagent Model Selection

- Use only `sol` or `luna` for subagents.
- Use `luna` for research, exploration, straightforward implementations, and well-scoped tasks.
- Run `luna` at `medium` reasoning effort for research and exploration.
- Run `luna` at `xhigh` reasoning effort for straightforward implementations and other well-scoped tasks.
- Use `sol` for problem-solving tasks.
- Always run `sol` subagents at `medium` or `high` reasoning effort when the execution surface supports an effort setting; choose `high` for harder problems.
- For direct subagent calls that do not expose an effort setting, select the required model and use its inherited reasoning configuration.

## Working Style

- Keep routine command, script, and validation output concise.
- Prefer compact summaries on success and bounded, actionable excerpts on failure.
- Keep responses information-dense and avoid unnecessary repetition.
- Prefer `rg` for searching files and text.
- Use focused CLI tools when appropriate, including `ast-grep` (`sg`), `git`, `gh`, `bun`, and `bunx`.
- When several independent checks are needed, batch them where practical rather than running them serially.
