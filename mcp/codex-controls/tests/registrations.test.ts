import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { z } from "zod";
import { syncRegistrations } from "../src/plugins/registrations.ts";
import { integrations } from "../src/plugins/groups.ts";

test("live connector metadata generates separate entries and preserves unrelated Claude settings", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "claude-integrations-test-"));
  const file = path.join(directory, "claude.json");
  try {
    const cua = { command: "bun", args: ["cua.ts"] };
    await Bun.write(file, JSON.stringify({ theme: "dark", mcpServers: { cua_repl: cua } }));
    const groups = integrations([
      {
        name: "profile",
        server: "codex_apps",
        upstreamName: "gmail.get_profile",
        definition: {
          name: "profile",
          inputSchema: { type: "object" },
          _meta: { connector_id: "mail", connector_name: "Gmail" },
        },
      },
    ]);
    await syncRegistrations(groups, "test-token", file);
    const first = await Bun.file(file).text();
    const parsed = z
      .object({ theme: z.string(), mcpServers: z.record(z.string(), z.unknown()) })
      .parse(JSON.parse(first) as unknown);
    expect(parsed.theme).toBe("dark");
    expect(parsed.mcpServers["cua_repl"]).toEqual(cua);
    expect(parsed.mcpServers["gmail"]).toMatchObject({
      type: "http",
      url: "http://127.0.0.1:17648/mcp/codex_apps%3Amail",
    });
    await syncRegistrations(groups, "test-token", file);
    expect(await Bun.file(file).text()).toBe(first);
    await syncRegistrations(
      [...groups, { id: "docs", name: "docs", tools: 1 }],
      "test-token",
      file,
    );
    expect(await Bun.file(file).text()).toContain('"docs"');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
