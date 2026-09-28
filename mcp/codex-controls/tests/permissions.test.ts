import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import { CodexControlsSession } from "../src/controls/app-server.ts";
import { automaticApproval } from "../src/controls/permissions.ts";

test.each(["cua_repl", "node_repl"] as const)(
  "bypass mode answers %s approval requests without client input",
  async (server) => {
    const session = new CodexControlsSession({
      executable: fileURLToPath(new URL("fixtures/codex-app-server.ts", import.meta.url)),
      configPath: fileURLToPath(new URL("fixtures/codex-controls-config.toml", import.meta.url)),
    });
    try {
      const result = await session.invoke({
        server,
        code: "needsApproval",
        title: "Approval",
        relay: async () => {
          const answer = automaticApproval({ approvalMode: "bypass" });
          if (answer === undefined) {
            throw new Error("Bypass mode requested interactive approval");
          }
          return answer;
        },
      });
      expect(result.content).toEqual([{ type: "text", text: "accept" }]);
    } finally {
      await session.close();
    }
  },
);
