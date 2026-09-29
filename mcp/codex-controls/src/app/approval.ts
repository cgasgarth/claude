/* oxlint-disable eslint/no-underscore-dangle -- _meta is an MCP wire field. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- SDK context types are mutable external contracts. */
/* oxlint-disable typescript/no-deprecated -- Claude Code uses MCP form elicitation on the 2025 protocol. */
import type { ServerContext } from "@modelcontextprotocol/server";
import { approvalResultSchema, clientElicitationSchema } from "../controls/protocol.ts";
import { automaticApproval, permissionSettingsSchema } from "../controls/permissions.ts";
import type { ApprovalRequest, ApprovalResult } from "../controls/protocol.ts";

const APPROVAL_TIMEOUT_MS = 600_000;
const permissions = permissionSettingsSchema.parse(
  await Bun.file(new URL("../../permissions.json", import.meta.url)).json(),
);
function approval(
  ctx: Readonly<ServerContext>,
): (request: Readonly<ApprovalRequest>) => Promise<ApprovalResult> {
  return async (request): Promise<ApprovalResult> => {
    const saved = automaticApproval(permissions);
    if (saved !== undefined) {
      return saved;
    }
    const params = clientElicitationSchema.parse({
      mode: "form",
      message: request.message,
      requestedSchema: request.requestedSchema,
      _meta: request._meta,
    });
    try {
      return approvalResultSchema.parse(
        await ctx.mcpReq.elicitInput(params, { timeout: APPROVAL_TIMEOUT_MS }),
      );
    } catch {
      return { action: "cancel" };
    }
  };
}
export { approval };
