/* oxlint-disable unicorn/no-null -- Codex JSON-RPC pagination uses null. */
/* oxlint-disable promise/avoid-new -- Notifications resolve test event promises. */
/* oxlint-disable eslint/no-await-in-loop -- Test calls must run serially on one owned session. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- MCP SDK and test state types are mutable external contracts. */
/* oxlint-disable eslint/no-underscore-dangle -- _meta is an MCP wire field. */
import { expect, test } from "bun:test";
import { mkdtemp, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import type { CodexPluginsBridge } from "../src/plugins/bridge.ts";
import type { Tool } from "@modelcontextprotocol/server";
import { createPluginsServer } from "../src/app/plugins-server.ts";
import { toolName } from "../src/plugins/catalog.ts";

const fixture = fileURLToPath(new URL("fixtures/codex-app-server.ts", import.meta.url));
const REQUEST_TIMEOUT_MS = 3000;
const profile: Tool = {
  name: "get_profile",
  description: "Read connected account identity",
  inputSchema: {
    type: "object",
    properties: { link_id: { type: "string", enum: ["personal", "work"] } },
    required: ["link_id"],
  },
  annotations: { readOnlyHint: true },
  _meta: { link_accounts: [{ link_id: "personal" }, { link_id: "work" }] },
};
function catalog(tools: Readonly<Record<string, Tool>>): object {
  return {
    data: [
      { name: "codex_apps", runtimeStatus: "connected", toolsError: null, tools },
      { name: "disabled", runtimeStatus: "disabled", tools: { profile } },
      { name: "broken", runtimeStatus: "failed", toolsError: "Offline", tools: {} },
      { name: "node_repl", runtimeStatus: "connected", tools: { profile } },
    ],
    nextCursor: null,
  };
}
interface TestState {
  directory: string;
  configPath: string;
  catalogPath: string;
  logPath: string;
  client: Client;
  bridge: CodexPluginsBridge;
}
const TOOL_COUNT = 3;
const MINIMUM_STARTS = 2;
async function waitChanged(client: Client): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("No tools/list_changed received"));
    }, REQUEST_TIMEOUT_MS);
    client.setNotificationHandler("notifications/tools/list_changed", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}
async function setup(): Promise<TestState> {
  const directory = await mkdtemp(path.join(tmpdir(), "codex-plugin-test-"));
  const configPath = path.join(directory, "config.toml");
  const catalogPath = path.join(directory, "catalog.json");
  const logPath = path.join(directory, "rpc.jsonl");
  await Bun.write(configPath, "");
  await Bun.write(catalogPath, JSON.stringify(catalog({ get_profile: profile })));
  const { server, bridge } = await createPluginsServer({
    executable: fixture,
    configPath,
    timeoutMs: REQUEST_TIMEOUT_MS,
    environment: { ...Bun.env, FAKE_CATALOG: catalogPath, FAKE_LOG: logPath },
  });
  const client = new Client({ name: "plugin-test", version: "1" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return { directory, configPath, catalogPath, logPath, client, bridge };
}
async function cleanup(state: Awaited<ReturnType<typeof setup>>): Promise<void> {
  await state.client.close();
  await state.bridge.close();
  await rm(state.directory, { recursive: true, force: true });
}
test("discovers runtime schemas and routes both account IDs unchanged", async () => {
  const state = await setup();
  try {
    const listed = await state.client.listTools();
    const name = toolName("codex_apps", "get_profile");
    const exposed = listed.tools.find((tool) => tool.name === name);
    expect(exposed?.inputSchema).toEqual(profile.inputSchema);
    expect(exposed?._meta).toEqual(profile._meta);
    expect(listed.tools).toHaveLength(TOOL_COUNT);
    for (const linkId of ["personal", "work"]) {
      const result = await state.client.callTool({ name, arguments: { link_id: linkId } });
      expect(result.content).toEqual([{ type: "text", text: JSON.stringify({ link_id: linkId }) }]);
    }
    const log = await Bun.file(state.logPath).text();
    expect(log).toContain('"server":"codex_apps"');
    expect(log).toContain('"tool":"get_profile"');
    expect(log.split("\n")[0]).toContain(JSON.stringify(["app-server", "--listen", "stdio://"]));
  } finally {
    await cleanup(state);
  }
});
test("refresh replaces tool definitions and notifies the MCP client", async () => {
  const state = await setup();
  let notifications = 0;
  state.client.setNotificationHandler("notifications/tools/list_changed", () => {
    notifications += 1;
  });
  try {
    const changed: Tool = {
      ...profile,
      name: "other_profile",
      inputSchema: { type: "object", required: ["new_value"] },
    };
    await Bun.write(state.catalogPath, JSON.stringify(catalog({ other_profile: changed })));
    await state.client.callTool({ name: "refresh_plugins", arguments: {} });
    const listed = await state.client.listTools();
    expect(
      listed.tools.find((tool) => tool.name === toolName("codex_apps", "other_profile"))
        ?.inputSchema,
    ).toEqual(changed.inputSchema);
    expect(notifications).toBeGreaterThan(0);
    const old = await state.client.callTool({
      name: toolName("codex_apps", "get_profile"),
      arguments: { link_id: "work" },
    });
    expect(old.isError).toBe(true);
  } finally {
    await cleanup(state);
  }
});
test("Codex app events and atomic config changes refresh without polling", async () => {
  const state = await setup();
  const emitter: Tool = { name: "emit_change", inputSchema: { type: "object" } };
  try {
    await Bun.write(state.catalogPath, JSON.stringify(catalog({ emit_change: emitter })));
    await state.bridge.refresh();
    const changed = catalog({ get_profile: profile });
    await Bun.write(state.catalogPath, JSON.stringify(changed));
    const event = waitChanged(state.client);
    await state.client.callTool({ name: toolName("codex_apps", "emit_change"), arguments: {} });
    await event;
    const toolsAfterEvent = await state.client.listTools();
    expect(
      toolsAfterEvent.tools.some((tool) => tool.name === toolName("codex_apps", "get_profile")),
    ).toBe(true);
    const reloaded = waitChanged(state.client);
    await Bun.write(state.catalogPath, JSON.stringify(catalog({ emit_change: emitter })));
    await Bun.write(`${state.configPath}.new`, "# New configuration\n");
    await rename(`${state.configPath}.new`, state.configPath);
    await reloaded;
    const log = await Bun.file(state.logPath).text();
    expect(log.split('"method":"initialize"').length).toBeGreaterThan(MINIMUM_STARTS);
  } finally {
    await cleanup(state);
  }
});
