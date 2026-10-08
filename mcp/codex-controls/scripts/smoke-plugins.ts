/* oxlint-disable eslint/no-underscore-dangle -- _meta is an upstream MCP field. */
/* oxlint-disable eslint/no-await-in-loop -- Each MCP connection is closed before opening the next. */
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { CallToolResultSchema } from "@modelcontextprotocol/core";
import { z } from "zod";
import { BRIDGE_URL, bridgeToken } from "../src/plugins/registrations.ts";

const inventorySchema = z.object({
  ready: z.boolean(),
  integrations: z.array(z.object({ id: z.string(), name: z.string(), tools: z.number() })),
});
const accountsSchema = z.object({
  link_accounts: z.array(z.object({ link_id: z.string(), profile_email: z.string() })),
});
const profileSchema = z.object({ email: z.string() });
const headers = { Authorization: `Bearer ${await bridgeToken()}` };
const response = await fetch(`${BRIDGE_URL}/health`, { headers });
const inventory = inventorySchema.parse(await response.json());
if (!inventory.ready) {
  throw new Error("Codex discovery is not ready");
}
let verifiedAccounts = 0;
for (const group of inventory.integrations) {
  const client = new Client({ name: "codex-integration-smoke", version: "1" });
  const transport = new StreamableHTTPClientTransport(
    new URL(`${BRIDGE_URL}/mcp/${encodeURIComponent(group.id)}`),
    { requestInit: { headers } },
  );
  try {
    await client.connect(transport);
    const listed = await client.listTools();
    if (
      listed.tools.filter((tool) => tool.name !== "codex_status" && tool.name !== "refresh_plugins")
        .length !== group.tools
    ) {
      throw new Error(`Wrong tool count for ${group.name}`);
    }
    const profile = listed.tools.find(
      (tool) => tool.description?.includes("tool: gmail.get_profile.") === true,
    );
    const accounts = profile === undefined ? [] : accountsSchema.parse(profile._meta).link_accounts;
    for (const account of accounts) {
      const result = CallToolResultSchema.parse(
        await client.callTool({
          name: profile?.name ?? "",
          arguments: { link_id: account.link_id },
        }),
      );
      if (
        result.isError === true ||
        profileSchema.parse(result.structuredContent).email !== account.profile_email
      ) {
        throw new Error("Account routing mismatch");
      }
      verifiedAccounts += 1;
    }
    await transport.terminateSession();
  } finally {
    await client.close();
  }
}
console.log(
  `PASS: ${inventory.integrations.length} separate MCP entries; ${verifiedAccounts} account profiles verified.`,
);
