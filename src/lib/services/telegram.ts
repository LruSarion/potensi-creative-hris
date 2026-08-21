import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireRole, requirePortal } from "@/lib/auth-helpers";
import { randomBytes } from "crypto";

const BIND_TTL_MS = 10 * 60 * 1000;

export type TelegramConfig = {
  botToken?: string;
  botUsername?: string;
};

/** Resolve the real bot username for a token via Telegram getMe (no @ prefix). */
export async function resolveBotUsername(botToken: string): Promise<string> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`, { cache: "no-store" });
    const data = await res.json();
    const username = data?.ok ? (data.result?.username as string) : "";
    return (username || "").replace(/^@/, "");
  } catch {
    return "";
  }
}

export async function getTelegramConfig(user: { tenantId?: string }): Promise<TelegramConfig> {
  const tenant = user.tenantId ? await db.tenant.findUnique({ where: { id: user.tenantId } }) : null;
  const cfg = (tenant?.config ?? {}) as { telegram?: TelegramConfig };
  const saved = cfg.telegram ?? {};
  const botToken = saved.botToken || process.env.TELEGRAM_BOT_TOKEN || "";
  const savedUsername = saved.botUsername || process.env.TELEGRAM_BOT_USERNAME || "";

  // Trust the live username for the token over any manually-entered one; a stale
  // username produces a t.me link that Telegram drops into "Saved Messages".
  let botUsername = savedUsername.replace(/^@/, "");
  if (botToken) {
    const live = await resolveBotUsername(botToken);
    if (live) botUsername = live;
  }

  return { botToken, botUsername };
}

/**
 * Sessionless bot config for webhook/polling handlers (no authenticated user).
 * Reads the first tenant that has a Telegram bot token configured (or env as
 * fallback). Webhooks/polling have no session, so they can't use getTelegramConfig(user).
 */
export async function getBotConfig(): Promise<TelegramConfig> {
  const tenants = await db.tenant.findMany({ select: { config: true } });
  let saved: TelegramConfig = {};
  for (const t of tenants) {
    const tg = (t.config as { telegram?: TelegramConfig } | null)?.telegram;
    if (tg?.botToken) {
      saved = tg;
      break;
    }
  }
  const botToken = saved.botToken || process.env.TELEGRAM_BOT_TOKEN || "";
  const savedUsername = saved.botUsername || process.env.TELEGRAM_BOT_USERNAME || "";
  let botUsername = savedUsername.replace(/^@/, "");
  if (botToken) {
    const live = await resolveBotUsername(botToken);
    if (live) botUsername = live;
  }
  return { botToken, botUsername };
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
  const connected = Boolean(u.telegramChatId);
  const cfg = await getTelegramConfig(user);

  // When not connected, auto-provision a fresh bind link so the dashboard can
  // show a ready-to-click bot button (no separate "connect" step for the user).
  let link: string | null = null;
  let botUsername: string | null = null;
  if (!connected && cfg.botUsername) {
    const existing = u.telegramBindToken && u.telegramBindExpires && u.telegramBindExpires > new Date()
      ? { token: u.telegramBindToken, expires: u.telegramBindExpires }
      : null;
    const token = existing?.token ?? randomBytes(16).toString("hex");
    if (!existing) {
      await db.user.update({
        where: { id: user.id },
        data: { telegramBindToken: token, telegramBindExpires: new Date(Date.now() + BIND_TTL_MS) },
      });
    }
    link = `https://t.me/${cfg.botUsername}?start=${token}`;
    botUsername = cfg.botUsername;
  }

  return {
    connected,
    chatId: u.telegramChatId ?? null,
    boundAt: u.telegramBoundAt ?? null,
    link,
    botUsername,
    configured: Boolean(cfg.botToken && cfg.botUsername),
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
