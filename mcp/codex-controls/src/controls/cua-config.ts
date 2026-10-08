import { readFile, readdir } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { z } from "zod";

const runtimeSchema = z.object({
  command: z.string().min(1),
  args: z.array(z.string()),
  env: z.record(z.string(), z.string()),
  enabled: z.literal(true),
});
const manifestSchema = z.object({ mcpServers: z.object({ cua_repl: runtimeSchema }) });
type CuaRuntime = z.infer<typeof runtimeSchema>;

async function readCuaRuntime(
  directory = path.join(homedir(), ".codex/plugins/cache/openai-bundled/unified-computer-use"),
): Promise<CuaRuntime> {
  const entries = await readdir(directory, { withFileTypes: true });
  const versions = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .toSorted((left, right) => right.localeCompare(left, "en", { numeric: true }));
  const [version] = versions;
  if (version === undefined) {
    throw new Error("Enable Codex Computer Use and Chrome in the desktop app first.");
  }
  const file = path.join(directory, version, ".mcp.json");
  return manifestSchema.parse(JSON.parse(await readFile(file, "utf8")) as unknown).mcpServers
    .cua_repl;
}

export { readCuaRuntime };
export type { CuaRuntime };
