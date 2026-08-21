import { apiHandler } from "@/lib/api-handler";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-helpers";

export const POST = apiHandler(async (req: Request) => {
  const user = await requireRole("SUPER_ADMIN");
  const tenant = user.tenantId ? await db.tenant.findUnique({ where: { id: user.tenantId } }) : null;
  const cfg = (tenant?.config ?? {}) as { telegram?: { botToken?: string } };
  const botToken = cfg.telegram?.botToken || process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    throw new Error("Bot Token belum dikonfigurasi");
  }

  const body = await req.json().catch(() => ({}));
  let appUrl = (typeof body.appUrl === "string" ? body.appUrl.trim() : "") || req.headers.get("origin") || "";
  if (!appUrl && process.env.VERCEL_URL) {
    appUrl = `https://${process.env.VERCEL_URL}`;
  }
  appUrl = appUrl.replace(/\/$/, "");

  if (!appUrl) {
    throw new Error("URL aplikasi tidak terdeteksi. Silakan ketik URL Vercel kamu.");
  }

  const webhookUrl = `${appUrl}/api/telegram/webhook`;
  const res = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
  const data = await res.json();

  if (!data.ok) {
    throw new Error(data.description || "Gagal memasang webhook ke Telegram");
  }

  return { ok: true, webhookUrl, description: data.description || "Webhook berhasil didaftarkan" };
});
