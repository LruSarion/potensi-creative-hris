import { apiHandler } from "@/lib/api-handler";
import { requireRole } from "@/lib/auth-helpers";
import {
  getOperationalRules,
  updateOperationalRules,
  type OperationalRulesConfig,
} from "@/lib/services/operational-rules";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN_OPERASIONAL"] as const;

export const GET = apiHandler(async (req: Request) => {
  const user = await requireRole(...ADMIN_ROLES);
  const rules = await getOperationalRules(user.tenantId);
  return rules;
});

export const POST = apiHandler(async (req: Request) => {
  const user = await requireRole(...ADMIN_ROLES);
  const body = (await req.json()) as Partial<OperationalRulesConfig>;
  const updated = await updateOperationalRules(user.tenantId, body);
  return {
    success: true,
    message: "Rules operasional berhasil disimpan",
    rules: updated,
  };
});
