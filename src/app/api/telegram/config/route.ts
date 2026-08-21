import { apiHandler } from "@/lib/api-handler";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-helpers";

const ADMIN_ROLES = ["SUPER_ADMIN"] as const;

export const GET = apiHandler(async (req: Request) => {
  const user = await requireRole(...ADMIN_ROLES);
  const tenant = await db.tenant.findUnique({ where: { id: user.tenantId ?? "" } });
  const cfg = (tenant?.config ?? {}) as { telegram?: { botToken?: string; botUsername?: string } };
  const tg = cfg.telegram ?? {};
  return {
    hasToken: Boolean(tg.botToken || process.env.TELEGRAM_BOT_TOKEN),
    hasSavedToken: Boolean(tg.botToken),
    botUsername: tg.botUsername || process.env.TELEGRAM_BOT_USERNAME || "",
    source: tg.botToken ? "tenant" : process.env.TELEGRAM_BOT_TOKEN ? "env" : "none",
  };
});

export const POST = apiHandler(async (req: Request) => {
  const user = await requireRole(...ADMIN_ROLES);
  if (!user.tenantId) throw new Error("Akun tidak terkait tenant");
  const body = await req.json();

  const tenant = await db.tenant.findUnique({ where: { id: user.tenantId } });
  const cfg = (tenant?.config ?? {}) as { telegram?: { botToken?: string; botUsername?: string } };
  const tg = cfg.telegram ?? {};

  const next = {
    ...cfg,
    telegram: {
      botToken: typeof body.botToken === "string" && body.botToken.trim() ? body.botToken.trim() : (tg.botToken ?? ""),
      botUsername:
        typeof body.botUsername === "string" && body.botUsername.trim()
          ? body.botUsername.trim().replace("@", "")
          : (tg.botUsername ?? ""),
    },
  };

  await db.tenant.update({ where: { id: user.tenantId }, data: { config: next } });
  return { saved: true };
});
