/* oxlint-disable typescript/no-deprecated -- Server preserves upstream tool schemas. */
import { randomUUID } from "node:crypto";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/server";
import type { Server } from "@modelcontextprotocol/server";
import { IMAGE_INTEGRATION, createImagesServer } from "./images-server.ts";
import { createPluginsServer } from "./plugins-server.ts";
import { integrations } from "../plugins/groups.ts";
import type { Integration } from "../plugins/groups.ts";
import { BRIDGE_URL, bridgeToken, syncRegistrations } from "../plugins/registrations.ts";

interface Connection {
  group: string;
  server: Server;
  transport: WebStandardStreamableHTTPServerTransport;
}
const token = await bridgeToken();
const { bridge } = await createPluginsServer();
function availableIntegrations(): Integration[] {
  return [...integrations(bridge.catalogTools()), IMAGE_INTEGRATION];
}
const connections = new Map<string, Connection>();
let sync = Promise.resolve();
async function synchronizeAfter(
  previous: Promise<void>,
  groups: readonly Readonly<Integration>[],
): Promise<void> {
  await previous;
  try {
    await syncRegistrations(groups, token);
  } catch (error) {
    console.error("Codex integration sync failed:", error instanceof Error ? error.message : error);
  }
}
function synchronize(): void {
  if (!bridge.discoveryHealthy()) {
    return;
  }
  const groups = availableIntegrations();
  sync = synchronizeAfter(sync, groups);
}
bridge.onChange(synchronize);
synchronize();
await sync;

async function connect(group: string, request: Request): Promise<Response> {
  const { server } =
    group === IMAGE_INTEGRATION.id
      ? { server: createImagesServer() }
      : await createPluginsServer({}, { bridge, group });
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: randomUUID,
    onsessioninitialized: (id): void => {
      connections.set(id, { group, server, transport });
    },
    onsessionclosed: (id): void => {
      connections.delete(id);
      void server.close();
    },
  });
  await server.connect(transport);
  const response = await transport.handleRequest(request);
  if (transport.sessionId === undefined) {
    await server.close();
  }
  return response;
}

async function handle(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (request.headers.get("authorization") !== `Bearer ${token}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const origin = request.headers.get("origin");
  if (origin !== null && origin !== BRIDGE_URL) {
    return new Response("Forbidden", { status: 403 });
  }
  if (url.pathname === "/health") {
    return Response.json({
      ready: bridge.discoveryHealthy(),
      integrations: availableIntegrations(),
    });
  }
  if (!url.pathname.startsWith("/mcp/")) {
    return new Response("Not found", { status: 404 });
  }
  const group = decodeURIComponent(url.pathname.slice("/mcp/".length));
  if (!availableIntegrations().some((entry) => entry.id === group)) {
    return new Response("Integration unavailable", { status: 404 });
  }
  const id = request.headers.get("mcp-session-id");
  if (id !== null) {
    const connection = connections.get(id);
    if (connection?.group !== group) {
      return new Response("Session not found", { status: 404 });
    }
    return connection.transport.handleRequest(request);
  }
  return connect(group, request);
}

const listener = Bun.serve({
  hostname: "127.0.0.1",
  port: Number(new URL(BRIDGE_URL).port),
  idleTimeout: 0,
  fetch: handle,
});
console.log(`Codex integrations ready: ${availableIntegrations().length} separate MCP entries.`);
async function close(): Promise<void> {
  await listener.stop(true);
  await Promise.all(
    [...connections.values()].map(async (entry) => {
      await entry.server.close();
    }),
  );
  await bridge.close();
  await sync;
  process.exitCode = 0;
}
process.once("SIGTERM", () => {
  void close();
});
process.once("SIGINT", () => {
  void close();
});
