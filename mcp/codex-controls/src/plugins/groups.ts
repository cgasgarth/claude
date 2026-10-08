/* oxlint-disable eslint/no-underscore-dangle -- _meta contains upstream connector identities. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- Catalog entries contain SDK Tool types. */
import { createHash } from "node:crypto";
import type { CatalogTool } from "./catalog.ts";

interface Integration {
  id: string;
  name: string;
  tools: number;
}
const GROUP_HASH_LENGTH = 8;

function groupId(tool: Readonly<CatalogTool>): string {
  const connector = tool.definition._meta?.["connector_id"];
  return tool.server === "codex_apps" && typeof connector === "string"
    ? `${tool.server}:${connector}`
    : tool.server;
}

function integrations(tools: readonly CatalogTool[]): Integration[] {
  const groups = new Map<string, Integration>();
  for (const tool of tools) {
    const id = groupId(tool);
    const existing = groups.get(id);
    if (existing === undefined) {
      const label = tool.definition._meta?.["connector_name"];
      const name = typeof label === "string" ? label : tool.server;
      groups.set(id, {
        id,
        name: name.replaceAll(/[^a-zA-Z0-9_-]+/gu, "-").toLowerCase(),
        tools: 1,
      });
    } else {
      existing.tools += 1;
    }
  }
  const names = new Set<string>();
  return [...groups.values()].map((group) => {
    if (names.has(group.name)) {
      group.name += `-${createHash("sha256").update(group.id).digest("hex").slice(0, GROUP_HASH_LENGTH)}`;
    }
    names.add(group.name);
    return group;
  });
}
export { groupId, integrations };
export type { Integration };
