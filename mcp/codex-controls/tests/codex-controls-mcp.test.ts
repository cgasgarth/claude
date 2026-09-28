import { expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

test.each(["computer", "chrome"])("stdio MCP exposes the %s surface", async (surface) => {
  const client = new Client({ name: "codex-controls-test", version: "0.1.0" });
  const transport = new StdioClientTransport({
    command: Bun.which("bun") ?? "bun",
    args: ["src/app/server.ts", "--surface", surface],
  });
  try {
    await client.connect(transport);
    const listed = await client.listTools();
    expect(listed.tools.map((tool) => tool.name)).toEqual([
      `${surface}_js`,
      "reset_controls",
      "end_controls",
    ]);
  } finally {
    await client.close();
  }
});
