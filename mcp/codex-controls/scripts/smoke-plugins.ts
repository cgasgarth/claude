/* oxlint-disable eslint/no-underscore-dangle -- _meta is an MCP wire field. */
/* oxlint-disable eslint/no-await-in-loop -- One owned Codex session runs tool calls serially. */
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { CallToolResultSchema } from "@modelcontextprotocol/core";
import { z } from "zod";

const TIMEOUT_MS = 120_000;
const accountsSchema = z.object({
  link_accounts: z.array(z.object({ link_id: z.string(), profile_email: z.string() })),
});
const profileSchema = z.object({ email: z.string() });
const client = new Client({ name: "codex-plugin-smoke", version: "1" });
const transport = new StdioClientTransport({
  command: Bun.which("bun") ?? "bun",
  args: [new URL("../src/app/plugins.ts", import.meta.url).pathname],
  stderr: "pipe",
});
try {
  await client.connect(transport, { timeout: TIMEOUT_MS });
  const inventory = await client.listTools();
  console.log(`Discovered ${inventory.tools.length} tools through stdio MCP.`);
  const profile = inventory.tools.find(
    (tool) => tool.description?.includes("tool: gmail.get_profile.") === true,
  );
  if (profile === undefined) {
    throw new Error("The enabled Gmail profile tool was not discovered");
  }
  const accounts = accountsSchema.parse(profile._meta).link_accounts;
  for (const account of accounts) {
    const raw = await client.callTool(
      { name: profile.name, arguments: { link_id: account.link_id } },
      { timeout: TIMEOUT_MS },
    );
    const result = CallToolResultSchema.parse(raw);
    if (
      result.isError === true ||
      profileSchema.parse(result.structuredContent).email !== account.profile_email
    ) {
      throw new Error("Gmail profile did not match the selected account");
    }
  }
  console.log(`PASS: ${accounts.length} Gmail account profiles match explicit account routing.`);
  const refreshed = CallToolResultSchema.parse(
    await client.callTool({ name: "refresh_plugins", arguments: {} }, { timeout: TIMEOUT_MS }),
  );
  if (refreshed.isError === true) {
    throw new TypeError("Live tool refresh failed");
  }
  console.log("PASS: live Codex configuration reload.");
} finally {
  await client.close();
}
