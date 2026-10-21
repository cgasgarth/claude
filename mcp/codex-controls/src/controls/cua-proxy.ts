/* oxlint-disable unicorn/prefer-add-event-listener -- MCP transports use callback properties. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- SDK transports are mutable external contracts. */
/* oxlint-disable eslint/no-underscore-dangle -- _meta is an MCP wire field. */
import { randomUUID } from "node:crypto";
import type { JSONRPCMessage, Transport } from "@modelcontextprotocol/client";
import { ListToolsResultSchema } from "@modelcontextprotocol/core";
import { automaticApproval } from "./permissions.ts";
import type { PermissionSettings } from "./permissions.ts";

const CLEANUP_TIMEOUT_MS = 2000;
const CUA_DESCRIPTION =
  "Control this Mac and your signed-in Chrome browser. Read screens, click, type, take screenshots, and work with existing Chrome tabs.\n\n" +
  "Use the cua JavaScript API inside this REPL. This is separate from cua-driver and Cua Spaces; their CLI commands, SDKs, and instructions do not apply here.\n\n" +
  "Start with await cua.getState() to discover available apps, browsers, and tabs. Read the returned API documentation before continuing.\n\n";

class CuaProxy {
  private readonly sessionId = randomUUID();
  private turnId = randomUUID();
  private readonly cleanupId = `claude-cua-cleanup-${randomUUID()}`;
  private closing = false;
  private cleanupTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly downstream: Transport;
  private readonly upstream: Transport;
  private readonly permissions: Readonly<PermissionSettings>;

  public constructor(
    downstream: Transport,
    upstream: Transport,
    permissions: Readonly<PermissionSettings>,
  ) {
    this.downstream = downstream;
    this.upstream = upstream;
    this.permissions = permissions;
  }

  public async start(): Promise<void> {
    this.downstream.onmessage = (message): void => {
      void this.forward(message);
    };
    this.upstream.onmessage = (message): void => {
      void this.receiveSafely(message);
    };
    this.downstream.onclose = (): void => {
      this.close();
    };
    this.upstream.onclose = (): void => {
      clearTimeout(this.cleanupTimer);
      this.closing = true;
      void this.downstream.close();
    };
    await this.upstream.start();
    await this.downstream.start();
  }

  private async forward(message: JSONRPCMessage): Promise<void> {
    try {
      await this.upstream.send(this.withMetadata(message));
    } catch {
      this.close();
    }
  }

  private async receiveSafely(message: JSONRPCMessage): Promise<void> {
    try {
      await this.receive(message);
    } catch {
      this.close();
    }
  }

  private withMetadata(message: JSONRPCMessage): JSONRPCMessage {
    if (!("method" in message) || message.method !== "tools/call") {
      return message;
    }
    const params = message.params ?? {};
    let args = params["arguments"];
    if (params["name"] === "turn_ended") {
      args = { hook_event_name: "Stop", session_id: this.sessionId, turn_id: this.turnId };
    }
    const metadata = JSON.stringify({ session_id: this.sessionId, turn_id: this.turnId });
    if (params["name"] === "turn_ended" || params["name"] === "js_reset") {
      this.turnId = randomUUID();
    }
    return {
      ...message,
      params: {
        ...params,
        ...(args === undefined ? {} : { arguments: args }),
        _meta: { ...params._meta, "x-codex-turn-metadata": metadata },
      },
    };
  }

  private async receive(message: JSONRPCMessage): Promise<void> {
    if ("id" in message && message.id === this.cleanupId && !("method" in message)) {
      clearTimeout(this.cleanupTimer);
      await this.upstream.close();
      return;
    }
    const saved = automaticApproval(this.permissions);
    if (
      saved !== undefined &&
      "method" in message &&
      "id" in message &&
      message.method === "elicitation/create" &&
      message.params?.["mode"] !== "url"
    ) {
      await this.upstream.send({ jsonrpc: "2.0", id: message.id, result: saved });
      return;
    }
    let outgoing = message;
    if ("result" in message) {
      const list = ListToolsResultSchema.safeParse(message.result);
      if (list.success) {
        for (const tool of list.data.tools) {
          if (tool.name === "js") {
            tool.description = CUA_DESCRIPTION + (tool.description ?? "");
          }
        }
        outgoing = {
          ...message,
          result: {
            ...message.result,
            tools: list.data.tools,
          },
        };
      }
    }
    await this.downstream.send(outgoing);
  }

  public close(): void {
    if (this.closing) {
      return;
    }
    this.closing = true;
    this.cleanupTimer = setTimeout(() => {
      void this.upstream.close();
    }, CLEANUP_TIMEOUT_MS);
    void this.sendCleanup();
  }

  private async sendCleanup(): Promise<void> {
    try {
      await this.upstream.send({
        jsonrpc: "2.0",
        id: this.cleanupId,
        method: "tools/call",
        params: {
          name: "turn_ended",
          arguments: { hook_event_name: "Stop", session_id: this.sessionId, turn_id: this.turnId },
        },
      });
    } catch {
      clearTimeout(this.cleanupTimer);
      await this.upstream.close();
    }
  }
}

export { CuaProxy };
