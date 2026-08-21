import { apiHandler } from "@/lib/api-handler";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-helpers";
import { NOTIFICATION_TYPES } from "@/lib/notification-types";

export const GET = apiHandler(async () => {
  const user = await requireRole();
  const u = await db.user.findUnique({ where: { id: user.id } });
  return { types: NOTIFICATION_TYPES, prefs: (u?.telegramNotifPrefs as Record<string, boolean>) ?? {} };
});

export const POST = apiHandler(async (req: Request) => {
  const user = await requireRole();
  const body = await req.json();
  const prefs = (body.prefs ?? {}) as Record<string, boolean>;
  await db.user.update({ where: { id: user.id }, data: { telegramNotifPrefs: prefs } });
  return { saved: true, prefs };
});
