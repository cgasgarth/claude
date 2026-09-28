import { z } from "zod";
import type { ApprovalResult } from "./protocol.ts";

const permissionSettingsSchema = z.strictObject({
  approvalMode: z.enum(["bypass", "ask"]),
});
type PermissionSettings = z.infer<typeof permissionSettingsSchema>;

function automaticApproval(settings: Readonly<PermissionSettings>): ApprovalResult | undefined {
  if (settings.approvalMode !== "bypass") {
    return undefined;
  }
  return { action: "accept", content: {} };
}

export { automaticApproval, permissionSettingsSchema };
