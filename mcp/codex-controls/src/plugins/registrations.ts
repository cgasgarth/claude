import { randomBytes } from "node:crypto";
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { z } from "zod";
import type { Integration } from "./groups.ts";

const TOKEN_BYTES = 32;
const PRIVATE_FILE_MODE = 0o600;
const JSON_INDENT = 2;
const BRIDGE_URL = "http://127.0.0.1:17648";
const configSchema = z.looseObject({ mcpServers: z.record(z.string(), z.unknown()).optional() });
const registrationSchema = z.looseObject({
  url: z.string().optional(),
  args: z.array(z.string()).optional(),
});

async function bridgeToken(): Promise<string> {
  const directory = path.join(homedir(), ".claude/cache/codex-integrations");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const file = path.join(directory, "token");
  if (!(await Bun.file(file).exists())) {
    await writeFile(file, randomBytes(TOKEN_BYTES).toString("hex"), {
      mode: PRIVATE_FILE_MODE,
      flag: "wx",
    });
  }
  const token = await readFile(file, "utf8");
  return token.trim();
}

function ownedRegistration(value: unknown): boolean {
  const parsed = registrationSchema.safeParse(value);
  return (
    parsed.success &&
    (parsed.data.url?.startsWith(`${BRIDGE_URL}/mcp/`) === true ||
      parsed.data.args?.some((arg) => arg.endsWith("/codex-controls/src/app/plugins.ts")) === true)
  );
}

async function syncRegistrations(
  groups: readonly Readonly<Integration>[],
  token: string,
  file = path.join(homedir(), ".claude.json"),
): Promise<void> {
  const config = configSchema.parse(JSON.parse(await readFile(file, "utf8")) as unknown);
  const previous = JSON.stringify(config.mcpServers);
  const servers = Object.fromEntries(
    Object.entries(config.mcpServers ?? {}).filter(([, value]) => !ownedRegistration(value)),
  );
  for (const group of groups) {
    const { name } = group;
    if (name in servers) {
      throw new Error(`MCP registration ${name} is owned by another setup`);
    }
    servers[name] = {
      type: "http",
      url: `${BRIDGE_URL}/mcp/${encodeURIComponent(group.id)}`,
      headers: { Authorization: `Bearer ${token}` },
    };
  }
  if (previous === JSON.stringify(servers)) {
    return;
  }
  config.mcpServers = servers;
  const temp = `${file}.codex-sync.tmp`;
  await writeFile(temp, `${JSON.stringify(config, undefined, JSON_INDENT)}\n`, {
    mode: PRIVATE_FILE_MODE,
  });
  await chmod(temp, PRIVATE_FILE_MODE);
  await rename(temp, file);
}
export { BRIDGE_URL, bridgeToken, syncRegistrations };
