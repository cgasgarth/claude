/* oxlint-disable typescript/prefer-readonly-parameter-types -- SDK types are mutable external contracts. */
/* oxlint-disable typescript/no-deprecated -- Low-level Server preserves upstream JSON schemas without conversion. */
import { watch } from "node:fs";
import type { FSWatcher } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import type { CallToolResult, Server, ServerContext, Tool } from "@modelcontextprotocol/server";
import { CodexControlsSession } from "../controls/app-server.ts";
import type { AppServerOptions } from "../controls/app-server.ts";
import { approval } from "../app/approval.ts";
import { loadCatalog } from "./catalog.ts";
import type { CatalogTool } from "./catalog.ts";

const REFRESH_DELAY_MS = 200;
const STARTUP_TIMEOUT_MS = 60_000;
class CodexPluginsBridge {
  private session: CodexControlsSession;
  private readonly server: Server;
  private readonly options: Readonly<AppServerOptions>;
  private readonly registrations = new Map<string, CatalogTool>();
  private watcher: FSWatcher | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private tail: Promise<void> = Promise.resolve();
  private ready = false;
  private notifications = false;
  private closed = false;
  private needsRestart = false;
  private catalog: Awaited<ReturnType<typeof loadCatalog>> | undefined;
  private error: string | undefined;

  public constructor(server: Server, options: Readonly<AppServerOptions> = {}) {
    this.server = server;
    this.options = options;
    this.session = this.createSession();
  }
  private createSession(): CodexControlsSession {
    return new CodexControlsSession({
      ...this.options,
      timeoutMs: this.options.timeoutMs ?? STARTUP_TIMEOUT_MS,
      allPlugins: true,
      onNotification: (method) => {
        if (
          this.ready &&
          (method === "mcpServer/startupStatus/updated" || method === "app/list/updated")
        ) {
          this.scheduleRefresh(false);
        }
      },
    });
  }
  public async start(): Promise<void> {
    const configPath = this.options.configPath ?? path.join(homedir(), ".codex", "config.toml");
    this.watcher = watch(path.dirname(configPath), (_event, filename) => {
      if (filename === path.basename(configPath)) {
        this.scheduleRefresh(true);
      }
    });
    this.watcher.on("error", (error) => {
      this.error = `Codex config watcher failed: ${error.message}`;
    });
    this.watcher.unref();
    await this.refresh(false);
  }
  private scheduleRefresh(restart: boolean): void {
    if (this.closed) {
      return;
    }
    this.needsRestart ||= restart;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      const shouldRestart = this.needsRestart;
      this.needsRestart = false;
      void this.refreshScheduled(shouldRestart);
    }, REFRESH_DELAY_MS);
    this.timer.unref();
  }
  private async refreshScheduled(restart: boolean): Promise<void> {
    try {
      await this.refresh(restart);
    } catch (error) {
      this.error = error instanceof Error ? error.message : "Codex discovery failed";
    }
  }
  private async runQueued<Value>(
    previous: Promise<void>,
    operation: () => Promise<Value>,
  ): Promise<Value> {
    await previous;
    if (this.closed) {
      throw new Error("Codex plugin bridge is closed");
    }
    return operation();
  }
  private static async settle(task: Promise<unknown>): Promise<void> {
    try {
      await task;
    } catch {
      /* The caller receives the failure. Later work can continue. */
    }
  }
  private async enqueue<Value>(operation: () => Promise<Value>): Promise<Value> {
    const result = this.runQueued(this.tail, operation);
    this.tail = CodexPluginsBridge.settle(result);
    return result;
  }
  public enableNotifications(): void {
    this.notifications = true;
  }
  public async refresh(restart = true): Promise<void> {
    return this.enqueue(async () => {
      this.ready = false;
      if (restart || this.error !== undefined) {
        await this.session.close();
        this.session = this.createSession();
      }
      try {
        const catalog = await loadCatalog(this.session);
        await this.syncTools(catalog.tools);
        this.catalog = catalog;
        this.error = undefined;
      } catch (error) {
        await this.syncTools([]);
        this.catalog = undefined;
        this.error = error instanceof Error ? error.message : "Codex discovery failed";
        throw error;
      } finally {
        this.ready = true;
      }
    });
  }
  private clearTools(): void {
    this.registrations.clear();
  }
  private async syncTools(tools: readonly CatalogTool[]): Promise<void> {
    const old = JSON.stringify([...this.registrations.values()]);
    this.clearTools();
    for (const tool of tools) {
      this.registrations.set(tool.name, tool);
    }
    if (old !== JSON.stringify(tools) && this.notifications) {
      await this.server.sendToolListChanged();
    }
  }
  public tools(): Tool[] {
    const tools: Tool[] = [];
    for (const entry of this.registrations.values()) {
      tools.push({
        ...entry.definition,
        name: entry.name,
        description: `${entry.definition.description ?? entry.upstreamName}\nCodex server: ${entry.server}; tool: ${entry.upstreamName}.`,
      });
    }
    return tools;
  }
  public async execute(
    name: string,
    argumentsValue: unknown,
    ctx: Readonly<ServerContext>,
  ): Promise<CallToolResult> {
    try {
      return await this.enqueue(async () => {
        const entry = this.registrations.get(name);
        if (entry === undefined) {
          throw new Error("This Codex tool is no longer available. Refresh the tool list.");
        }
        const result = await this.session.callTool({
          server: entry.server,
          tool: entry.upstreamName,
          arguments: argumentsValue,
          relay: approval(ctx),
          signal: ctx.mcpReq.signal,
        });
        return this.server.projectCallToolResult(result, entry.definition.outputSchema);
      });
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: "text" as const,
            text: error instanceof Error ? error.message : "Codex tool failed",
          },
        ],
      };
    }
  }
  public status(): string {
    return JSON.stringify({
      tools: this.registrations.size,
      servers: this.catalog?.servers ?? [],
      error: this.error,
    });
  }
  public async close(): Promise<void> {
    this.closed = true;
    clearTimeout(this.timer);
    this.watcher?.close();
    await this.session.close();
    await this.tail;
  }
}
export { CodexPluginsBridge };
