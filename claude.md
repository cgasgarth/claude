# Subagent Model Selection

- Use sol-6.1 (gpt-6.1-sol) for backend, research, and exploration work as a subagent. Use Opus 5.5 for UI / UX work. 

* Always run sol-6.1 subagents at medium or high effort; choose high for exceptionally hard work.
* For direct subagent calls that do not expose an effort setting, select one of these models and use its inherited reasoning configuration.
* Do not use fork subagents. Spawn a fresh subagent for every delegated task.

## Working Style

- Keep routine command, script, and validation output concise.
- Prefer compact summaries on success and bounded, actionable excerpts on failure.
- Keep responses information-dense and avoid unnecessary repetition.

* Do not use Python for inline scripts; use bun. Use Python only when the task requires it, and then use `uv` as the Python manager and package manager.
* When several independent checks are needed, batch them where practical rather than running them serially.

## Pull request descriptions

- Use the `show-me` skill when you write or update PR descriptions. Explain the change visually and keep the description concise.

## GitHub CLI screenshots and media

- Capture complete pages or sections at native resolution. Inspect saved screenshots before you publish them.
- Use `gh` 2.99+ with `--attach 'path#alt text'` for issue and PR media (`gh pr create`, `gh pr edit`, `gh issue create`). Put the same path in the Markdown body (`![alt](./path.png)`) for inline placement; `gh` rewrites it to the uploaded asset URL. Use `--body-file` for multiline text. Check the version and command help first.
- Do not upload media through a browser. Uploads require write access and OAuth or a classic PAT; images are limited to 10 MB. [Media documentation](https://github.blog/changelog/2026-09-01-github-cli-media-in-issues-pull-requests-and-comments/).

## GitHub stacked pull requests

- Use `gh stack` for dependent PRs. Install it with `gh extension install github/gh-stack` if necessary; check command help first.
- Create a stack with `init`, `add`, and `submit`. Fix the owning branch, then run `rebase --upstack` and `push`; run `sync` after merges.
- Merge bottom-up and check the full merge scope; higher PRs can include lower ones. Required approvals and checks still apply. [Stack documentation](https://docs.github.com/en/pull-requests/how-tos/stacked-pull-requests).
- `gh pr merge` (also with `--auto` or `--admin`) fails for a PR in a stack. Merge with `gh stack merge <pr>`, or with the asynchronous merge API: `gh api -X PUT repos/OWNER/REPO/pulls/N/merge-async -f sha=<head sha> -f merge_method=squash -f merge_action=direct_merge`. This also merges all open PRs below N. Then poll `GET repos/OWNER/REPO/pulls/N/merge-async/<uuid>` until the status is `merged` or `failed`, and run `gh stack sync`.
- To bypass rules (for example, a required review), add `-F bypass_rules=true` to the API call. Do this only when the user explicitly authorizes the bypass for that PR. `gh stack merge` cannot bypass rules. [Asynchronous merge API](https://docs.github.com/rest/pulls/pulls#merge-a-pull-request-asynchronously).

## File search

- Use the `fff` MCP server for file name, path, and content searches in the current repository or worktree.
- Use `find_files` for names and paths, `grep` for content, and `multi_grep` for several literal terms in one call. These are tools from the `fff` server.
- Start each session in the repository or worktree that must be searched. `fff` indexes its startup directory.
- Use short queries and directory or glob constraints. Keep results small, then read the matching files.

## Engineering Principles

- Do not preserve backward compatibility. Remove obsolete paths instead of adding compatibility layers, fallbacks, migrations, or tests that only prove the removal.

* Grow the system in layers. Start from the smallest version that works end to end, and add each new capability on top of a product that already works. Never trade a working product for unfinished complexity.
* Keep components modular and concerns clearly separated.
* Prefer established, well-maintained libraries when they reduce overall complexity or improve reliability. Do not reimplement common functionality without a clear reason.
* Use dependencies already in the project before writing your own implementation or adding packages. Do not assume a library lacks a capability without checking its documentation and types.
* Use official SDK types directly. Add validation or parsing only for untrusted or untyped data; avoid duplicate contracts and broad casts.

Always talk in ASD-STE100 Simplified Technical English.
