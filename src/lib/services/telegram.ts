import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireRole, requirePortal } from "@/lib/auth-helpers";
import { randomBytes } from "crypto";

const BIND_TTL_MS = 10 * 60 * 1000;

export type TelegramConfig = {
  botToken?: string;
  botUsername?: string;
};

export async function getTelegramConfig(user: { tenantId?: string }): Promise<TelegramConfig> {
  const tenant = user.tenantId ? await db.tenant.findUnique({ where: { id: user.tenantId } }) : null;
  const cfg = (tenant?.config ?? {}) as { telegram?: TelegramConfig };
  const saved = cfg.telegram ?? {};
  return {
    botToken: saved.botToken || process.env.TELEGRAM_BOT_TOKEN || "",
    botUsername: saved.botUsername || process.env.TELEGRAM_BOT_USERNAME || "",
  };
}

export async function sendTelegramMessage(chatId: string, text: string, cfg: TelegramConfig): Promise<boolean> {
  if (!cfg.botToken) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${cfg.botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      cache: "no-store",
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data?.ok === true;
  } catch {
    return false;
  }
}

export async function telegramStatus() {
  const user = await requireRole();
  const u = await db.user.findUnique({ where: { id: user.id } });
  if (!u) throw AppError.notFound("User tidak ditemukan");
  return {
    connected: Boolean(u.telegramChatId),
    chatId: u.telegramChatId ?? null,
    boundAt: u.telegramBoundAt ?? null,
  };
}

export async function createTelegramBindLink() {
  const user = await requireRole();
  const cfg = await getTelegramConfig(user);
  if (!cfg.botToken || !cfg.botUsername) {
    throw AppError.conflict("Bot Telegram belum dikonfigurasi. Hubungi admin / Super Admin.");
  }
  const token = randomBytes(16).toString("hex");
  const expires = new Date(Date.now() + BIND_TTL_MS);
  await db.user.update({
    where: { id: user.id },
    data: { telegramBindToken: token, telegramBindExpires: expires },
  });
  const botUrl = `https://t.me/${cfg.botUsername}?start=${token}`;
  return { link: botUrl, token, expires: expires.toISOString(), botUsername: cfg.botUsername };
}

export async function telegramDisconnect() {
  const user = await requireRole();
  await db.user.update({
    where: { id: user.id },
    data: {
      telegramChatId: null,
      telegramBindToken: null,
      telegramBindExpires: null,
      telegramBoundAt: null,
    },
  });
  return { connected: false };
}
