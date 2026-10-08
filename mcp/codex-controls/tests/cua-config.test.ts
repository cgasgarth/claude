import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { readCuaRuntime } from "../src/controls/cua-config.ts";

test("loads the newest complete Codex runtime command and environment", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "claude-cua-config-"));
  try {
    await Promise.all(
      ["26.9.9", "26.10.1"].map(async (version) => {
        const folder = path.join(directory, version);
        await mkdir(folder);
        await Bun.write(
          path.join(folder, ".mcp.json"),
          JSON.stringify({
            mcpServers: {
              cua_repl: {
                command: "/runtime/node",
                args: [version],
                env: { VERSION: version },
                enabled: true,
              },
            },
          }),
        );
      }),
    );
    expect(await readCuaRuntime(directory)).toMatchObject({
      args: ["26.10.1"],
      env: { VERSION: "26.10.1" },
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
