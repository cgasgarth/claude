/* oxlint-disable typescript/no-deprecated -- Low-level Server preserves upstream JSON schemas without conversion. */
/* oxlint-disable unicorn/prefer-add-event-listener -- MCP uses onclose callbacks. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- Shared bridge owns a mutable SDK session. */
import { Server } from "@modelcontextprotocol/server";
import type { Tool } from "@modelcontextprotocol/server";
import type { AppServerOptions } from "../plugins/session.ts";
import { CodexPluginsBridge } from "../plugins/bridge.ts";
import { groupId } from "../plugins/groups.ts";

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
  shared?: Readonly<{ bridge: CodexPluginsBridge; group: string }>,
): Promise<{ server: Server; bridge: CodexPluginsBridge }> {
  const server = new Server(
    { name: "claude-codex-plugins", version: "0.2.0" },
    { capabilities: { tools: { listChanged: true } } },
  );
  const bridge = shared?.bridge ?? new CodexPluginsBridge(server, options);
  const visibleTools = (): Tool[] => {
    const names = new Set(
      bridge
        .catalogTools()
        .filter((tool) => shared === undefined || groupId(tool) === shared.group)
        .map((tool) => tool.name),
    );
    return bridge.tools().filter((tool) => names.has(tool.name));
  };
  server.setRequestHandler("tools/list", () => ({
    tools: [...MANAGEMENT_TOOLS, ...visibleTools()],
  }));
  server.setRequestHandler("tools/call", async (request, ctx) => {
    const { name } = request.params;
    if (name !== "codex_status" && name !== "refresh_plugins") {
      const tool = visibleTools().find((entry) => entry.name === name);
      if (tool === undefined) {
        return {
          isError: true,
          content: [{ type: "text", text: "Tool is not available in this integration." }],
        };
      }
      const result = await bridge.execute(name, request.params.arguments ?? {}, ctx);
      return server.projectCallToolResult(result, tool.outputSchema);
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
  let unsubscribe: (() => void) | undefined = undefined;
  async function notify(): Promise<void> {
    try {
      await server.sendToolListChanged();
    } catch {
      /* Client already disconnected. */
    }
  }
  server.oninitialized = (): void => {
    if (shared === undefined) {
      bridge.enableNotifications();
    } else {
      unsubscribe = bridge.onChange(() => {
        void notify();
      });
    }
  };
  server.onclose = (): void => {
    unsubscribe?.();
    if (shared === undefined) {
      void bridge.close();
    }
  };
  try {
    if (shared === undefined) {
      await bridge.start();
    }
  } catch {
    // Keep status and refresh available when an enabled upstream server cannot start.
  }
  return { server, bridge };
}
export { createPluginsServer };
