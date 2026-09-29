import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { createPluginsServer } from "./plugins-server.ts";

const { server } = await createPluginsServer();
await server.connect(new StdioServerTransport());
