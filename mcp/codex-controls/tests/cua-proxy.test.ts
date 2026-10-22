/* oxlint-disable unicorn/prefer-add-event-listener -- MCP transports use callback properties. */
/* oxlint-disable eslint/no-underscore-dangle -- _meta is an MCP wire field. */
import { expect, test } from "bun:test";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import type { JSONRPCMessage, Transport } from "@modelcontextprotocol/client";
import { CuaProxy } from "../src/controls/cua-proxy.ts";
import type { PermissionSettings } from "../src/controls/permissions.ts";

interface TestState {
  client: Transport;
  runtime: Transport;
  proxy: CuaProxy;
  requests: JSONRPCMessage[];
  responses: JSONRPCMessage[];
}
async function setup(
  approvalMode: PermissionSettings["approvalMode"] = "bypass",
): Promise<TestState> {
  const [client, downstream] = InMemoryTransport.createLinkedPair();
  const [upstream, runtime] = InMemoryTransport.createLinkedPair();
  const requests: JSONRPCMessage[] = [];
  const responses: JSONRPCMessage[] = [];
  runtime.onmessage = (message): void => {
    requests.push(message);
  };
  client.onmessage = (message): void => {
    responses.push(message);
  };
  const proxy = new CuaProxy(downstream, upstream, { approvalMode });
  await runtime.start();
  await client.start();
  await proxy.start();
  return { client, runtime, proxy, requests, responses };
}

function call(id: string, name: string): JSONRPCMessage {
  return {
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: { name, arguments: { code: "await cua.getState();" }, _meta: { caller: "Claude" } },
  };
}

test("desktop and Chrome calls share metadata, and completed work gets a new turn", async () => {
  const state = await setup();
  try {
    await state.client.send(call("desktop", "js"));
    await state.client.send(call("chrome", "js"));
    await state.client.send(call("end", "turn_ended"));
    await state.client.send(call("next", "js"));
    const params = state.requests.map((message) => ("method" in message ? message.params : {}));
    expect(params[0]?._meta?.["caller"]).toBe("Claude");
    const first = params[0]?._meta?.["x-codex-turn-metadata"];
    expect(typeof first).toBe("string");
    expect(params[1]?._meta?.["x-codex-turn-metadata"]).toBe(first);
    expect(params[3]?._meta?.["x-codex-turn-metadata"]).not.toBe(first);
    expect(JSON.stringify(params[2]?.["arguments"])).toContain(String(first).slice(1, -1));
  } finally {
    await state.runtime.close();
  }
});

test.each(["bypass", "ask"] as const)("%s mode handles runtime approval forms", async (mode) => {
  const state = await setup(mode);
  const request: JSONRPCMessage = {
    jsonrpc: "2.0",
    id: "approval",
    method: "elicitation/create",
    params: { mode: "form", message: "Allow this app?", requestedSchema: { type: "object" } },
  };
  try {
    await state.runtime.send(request);
    if (mode === "bypass") {
      expect(state.requests).toEqual([
        { jsonrpc: "2.0", id: "approval", result: { action: "accept", content: {} } },
      ]);
    } else {
      expect(state.responses).toEqual([request]);
      const response: JSONRPCMessage = {
        jsonrpc: "2.0",
        id: "approval",
        result: { action: "cancel" },
      };
      await state.client.send(response);
      expect(state.requests).toEqual([response]);
    }
  } finally {
    await state.runtime.close();
  }
});

test("images, errors, and cancellation pass through unchanged", async () => {
  const state = await setup();
  const result: JSONRPCMessage = {
    jsonrpc: "2.0",
    id: 1,
    result: {
      content: [{ type: "image", data: "YWJj", mimeType: "image/png" }],
      isError: true,
      _meta: { upstream: "unchanged" },
    },
  };
  const cancelled: JSONRPCMessage = {
    jsonrpc: "2.0",
    method: "notifications/cancelled",
    params: { requestId: 1, reason: "Stopped" },
  };
  try {
    await state.runtime.send(result);
    await state.client.send(cancelled);
    expect(state.responses).toEqual([result]);
    expect(state.requests).toEqual([cancelled]);
  } finally {
    await state.runtime.close();
  }
});

test("closing Claude releases the runtime's current operation", async () => {
  const state = await setup();
  await state.client.send(call("desktop", "js"));
  await state.client.close();
  const cleanup = state.requests.at(-1);
  expect(cleanup).toMatchObject({ method: "tools/call", params: { name: "turn_ended" } });
  if (cleanup !== undefined && "id" in cleanup && cleanup.id !== undefined) {
    await state.runtime.send({ jsonrpc: "2.0", id: cleanup.id, result: { content: [] } });
  }
});

test("cleanup tool is model-visible and accepts empty arguments", async () => {
  const state = await setup();
  try {
    await state.runtime.send({
      jsonrpc: "2.0",
      id: "list",
      result: {
        tools: [
          {
            name: "turn_ended",
            inputSchema: { type: "object", required: ["session_id"] },
            _meta: { ui: { visibility: [] } },
          },
        ],
      },
    });
    expect(state.responses[0]).toMatchObject({
      result: {
        tools: [
          {
            name: "turn_ended",
            inputSchema: { type: "object", properties: {}, additionalProperties: false },
            _meta: { ui: { visibility: ["model"] } },
          },
        ],
      },
    });
  } finally {
    await state.runtime.close();
  }
});

test("cancellation releases the call's operation after its response", async () => {
  const state = await setup();
  try {
    await state.client.send(call("run", "js"));
    await state.client.send({
      jsonrpc: "2.0",
      method: "notifications/cancelled",
      params: { requestId: "run" },
    });
    expect(
      state.requests.map((message) => ("method" in message ? message.method : undefined)),
    ).toEqual(["tools/call", "notifications/cancelled"]);
    await state.runtime.send({
      jsonrpc: "2.0",
      id: "run",
      error: { code: -32_800, message: "Cancelled" },
    });
    await Bun.sleep(0);
    const release = state.requests.at(-1);
    expect(release).toMatchObject({
      method: "tools/call",
      params: { name: "turn_ended", arguments: { hook_event_name: "Stop" } },
    });
    if (release !== undefined && "id" in release && release.id !== undefined) {
      await state.runtime.send({ jsonrpc: "2.0", id: release.id, result: { content: [] } });
    }
    expect(state.responses).toHaveLength(1);
    await state.client.send(call("next", "js"));
    const original = state.requests.at(0);
    const next = state.requests.at(-1);
    if (original !== undefined && next !== undefined && "params" in original && "params" in next) {
      expect(next.params?._meta?.["x-codex-turn-metadata"]).not.toBe(
        original.params?._meta?.["x-codex-turn-metadata"],
      );
    }
  } finally {
    await state.runtime.close();
  }
});
