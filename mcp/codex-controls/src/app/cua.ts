import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { readCuaRuntime } from "../controls/cua-config.ts";
import { CuaProxy } from "../controls/cua-proxy.ts";
import { permissionSettingsSchema } from "../controls/permissions.ts";

const runtime = await readCuaRuntime();
const permissions = permissionSettingsSchema.parse(
  await Bun.file(new URL("../../permissions.json", import.meta.url)).json(),
);
const proxy = new CuaProxy(
  new StdioServerTransport(),
  new StdioClientTransport({
    command: runtime.command,
    args: runtime.args,
    env: runtime.env,
    stderr: "inherit",
  }),
  permissions,
);
process.once("SIGTERM", () => {
  proxy.close();
});
process.once("SIGINT", () => {
  proxy.close();
});
await proxy.start();
