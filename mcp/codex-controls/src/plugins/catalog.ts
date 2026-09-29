/* oxlint-disable typescript/prefer-readonly-parameter-types -- SDK Tool types are mutable external contracts. */
/* oxlint-disable eslint/no-await-in-loop -- Each inventory page depends on its previous cursor. */
import { createHash } from "node:crypto";
import { ToolSchema } from "@modelcontextprotocol/core";
import type { Tool } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { CodexControlsSession } from "../controls/app-server.ts";

const pageSchema = z.object({
  data: z.array(
    z.object({
      name: z.string(),
      runtimeStatus: z.string().nullable().optional(),
      toolsError: z.string().nullable().optional(),
      tools: z.record(z.string(), ToolSchema),
    }),
  ),
  nextCursor: z.string().nullable(),
});
const CONTROL_SERVERS = new Set(["cua_repl", "node_repl"]);
const NAME_PREFIX_LENGTH = 48;
const HASH_LENGTH = 12;
interface CatalogTool {
  name: string;
  server: string;
  upstreamName: string;
  definition: Tool;
}
type CatalogPage = z.infer<typeof pageSchema>;

function toolName(server: string, name: string): string {
  const identity = `${server}/${name}`;
  const prefix = `${server}_${name}`
    .replaceAll(/[^a-zA-Z0-9_-]/gu, "_")
    .slice(0, NAME_PREFIX_LENGTH);
  const hash = createHash("sha256").update(identity).digest("hex").slice(0, HASH_LENGTH);
  return `${prefix}_${hash}`;
}
function toolsFromPage(page: Readonly<CatalogPage>): CatalogTool[] {
  return page.data.flatMap((upstream) => {
    if (
      CONTROL_SERVERS.has(upstream.name) ||
      upstream.runtimeStatus === "disabled" ||
      upstream.runtimeStatus === "failed" ||
      typeof upstream.toolsError === "string"
    ) {
      return [];
    }
    return Object.entries(upstream.tools).map(([key, definition]) => ({
      name: toolName(upstream.name, key),
      server: upstream.name,
      upstreamName: key,
      definition,
    }));
  });
}
async function loadCatalog(session: CodexControlsSession): Promise<{
  tools: CatalogTool[];
  servers: { name: string; status: string | undefined; error: string | undefined }[];
}> {
  const tools: CatalogTool[] = [];
  const servers: { name: string; status: string | undefined; error: string | undefined }[] = [];
  const seen = new Set<string>();
  let cursor: string | undefined = undefined;
  do {
    const page = pageSchema.parse(await session.listServers(cursor));
    tools.push(...toolsFromPage(page));
    servers.push(
      ...page.data.map((entry) => ({
        name: entry.name,
        status: entry.runtimeStatus ?? undefined,
        error: entry.toolsError ?? undefined,
      })),
    );
    cursor = page.nextCursor ?? undefined;
    if (cursor !== undefined && seen.has(cursor)) {
      throw new Error("Codex tool inventory repeated a pagination cursor");
    }
    if (cursor !== undefined) {
      seen.add(cursor);
    }
  } while (cursor !== undefined);
  return { tools, servers };
}
export { loadCatalog, toolName, toolsFromPage };
export type { CatalogTool };
