/* oxlint-disable typescript/no-deprecated -- Low-level Server preserves upstream JSON schemas without conversion. */
/* oxlint-disable unicorn/prefer-add-event-listener -- MCP uses onclose callbacks. */
import { Server } from "@modelcontextprotocol/server";
import type { Tool } from "@modelcontextprotocol/server";
import type { AppServerOptions } from "../controls/app-server.ts";
import { CodexPluginsBridge } from "../plugins/bridge.ts";

const MANAGEMENT_TOOLS: Tool[] = [
  {
    name: "codex_status",
    description: "Show current Codex MCP servers, tool count, and discovery errors.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "refresh_plugins",
    description:
      "Reload Codex configuration and connected account tool schemas. Claude receives a tools/list_changed notification.",
    inputSchema: { type: "object", properties: {} },
  },
];
async function createPluginsServer(
  options: Readonly<AppServerOptions> = {},
): Promise<{ server: Server; bridge: CodexPluginsBridge }> {
  const server = new Server(
    { name: "claude-codex-plugins", version: "0.2.0" },
    { capabilities: { tools: { listChanged: true } } },
  );
  const bridge = new CodexPluginsBridge(server, options);
  server.setRequestHandler("tools/list", () => ({
    tools: [...MANAGEMENT_TOOLS, ...bridge.tools()],
  }));
  server.setRequestHandler("tools/call", async (request, ctx) => {
    const { name } = request.params;
    if (name !== "codex_status" && name !== "refresh_plugins") {
      return bridge.execute(name, request.params.arguments ?? {}, ctx);
    }
    try {
      if (name === "refresh_plugins") {
        await bridge.refresh();
      }
      return { content: [{ type: "text", text: bridge.status() }] };
    } catch (error) {
      return {
        isError: true,
        content: [
          { type: "text", text: error instanceof Error ? error.message : "Codex refresh failed" },
        ],
      };
    }
  });
  server.oninitialized = (): void => {
    bridge.enableNotifications();
  };
  server.onclose = (): void => {
    void bridge.close();
  };
  try {
    await bridge.start();
  } catch {
    // Keep status and refresh available when an enabled upstream server cannot start.
  }
  return { server, bridge };
}
export { createPluginsServer };
