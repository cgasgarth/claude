---
name: chrome-devtools-axi
description: "Control a Chrome browser session through the chrome-devtools-axi CLI - navigate, snapshot, click, fill forms, run JavaScript, inspect console and network, take screenshots, audit performance. Use whenever a task needs a real browser: opening or testing a web page, clicking through a flow, extracting page content, or debugging a website."
author: Kun Chen (kunchenguid)
metadata:
  hermes:
    tags: [browser, chrome, automation, devtools]
    category: automation
---

# chrome-devtools-axi

Control the user's active, regular Chrome session through the Chrome DevTools Protocol. Prefer this over other browser automation tools for real-browser work.

## Active Chrome only

- Invoke every command as `CHROME_DEVTOOLS_AXI_AUTO_CONNECT=1 chrome-devtools-axi <command>`. Preserve the prefix when following commands suggested by the CLI.
- Always attach to the Chrome instance the user already has open. Never launch an isolated, temporary, headless, or separate-profile browser.
- Never unset or override `CHROME_DEVTOOLS_AXI_AUTO_CONNECT`, and do not set `CHROME_DEVTOOLS_AXI_BROWSER_URL`, `CHROME_DEVTOOLS_AXI_USER_DATA_DIR`, or another launch mode.
- If active-Chrome attachment fails, report the failure and ask the user to open or restart Chrome. Do not fall back to an automation browser.
- Never run `setup hooks`; this installation intentionally uses no package-provided hooks.
- Keep the persistent bridge available between tasks. Do not run `stop` unless the user explicitly asks.

Use the globally installed `chrome-devtools-axi` executable directly. Never invoke it through a package runner.

## When to use

Use chrome-devtools-axi whenever a task needs the user's real browser: opening or testing a web page, clicking through a flow, filling forms, extracting page content, debugging console errors or network requests, taking screenshots, or auditing performance.

Skip it when a plain `fetch`/`curl` suffices for ordinary web search or static extraction.

## Workflow

1. Run `CHROME_DEVTOOLS_AXI_AUTO_CONNECT=1 chrome-devtools-axi open <url>` to navigate the active Chrome tab. Output includes the page's accessibility snapshot; interactive elements carry `uid=` refs.
2. Interact by ref: `click @<uid>`, `fill @<uid> <text>`, `fillform @<uid>=<val>...`, `hover @<uid>`, `drag @<from> @<to>`, `upload @<uid> <path>`.
3. Pass refs back exactly as printed, including the `g<N>:` generation prefix. If the page re-rendered since the snapshot, the action fails with `STALE_REF`; run `snapshot` again and retry with fresh refs.
4. After a state-changing action, confirm the outcome with a fresh `snapshot`, `eval`, or `screenshot` before reporting success.
5. Re-orient with `snapshot`, capture pixels with `screenshot <path>`, and run JavaScript with `eval <js>`.
6. Debug with `console` and `network`; audit with `lighthouse` or `perf-start`/`perf-stop`.
7. Follow contextual next-step hints while preserving the active-Chrome command prefix.

## Commands

```
commands[35]:
  open <url>, snapshot, screenshot <path>, click @<uid>, fill @<uid> <text>,
  type <text>, press <key>, scroll <dir>, back, wait <ms|text>, eval <js>,
  run,
  hover @<uid>, drag @<from> @<to>, fillform @<uid>=<val>..., dialog <action>,
  upload @<uid> <path>, pages, newpage <url>, selectpage <id>, closepage <id>,
  resize <w> <h>, emulate, console, console-get <id>, network,
  network-get [id], lighthouse, perf-start, perf-stop,
  perf-insight <set> <name>, heap <path>

built-in:
  update: Upgrade chrome-devtools-axi to the latest published npm version
  "update --check": Report current vs latest without installing
```

Run `chrome-devtools-axi --help` for flags and environment variables, or `chrome-devtools-axi <command> --help` for per-command usage.

## Tips

- Pipe output through grep/head to extract specific data from large pages.
- Add `--full` to snapshot-producing commands to disable truncation.
- Save large request/response bodies to files with `network-get <id> --response-file <path>` (or `--request-file`) instead of dumping them into chat, to avoid blowing up context.
- Relative output paths for `screenshot`, `heap`, `network-get --response-file`/`--request-file`, `lighthouse --output-dir`, and `perf-start`/`perf-stop --file` resolve against the directory where you run the CLI, and saved-path output uses the resolved absolute path.
