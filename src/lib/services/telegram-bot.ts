import { db } from "@/lib/db";
import { getTelegramConfig, type TelegramConfig } from "@/lib/services/telegram";
import { handleTelegramAbsensiMessage } from "@/lib/services/telegram-absensi";

export type TelegramUpdate = {
  update_id?: number;
  message?: {
    chat?: { id?: number };
    text?: string;
    photo?: { file_id: string }[];
    location?: { latitude: number; longitude: number };
  };
  callback_query?: {
    id?: string;
    data?: string;
    message?: { chat?: { id?: number } };
  };
};

export async function handleTelegramUpdate(update: TelegramUpdate, cfg: TelegramConfig) {
  const callback = update.callback_query;
  if (callback?.data && callback?.message?.chat?.id) {
    await handleCallback(callback.data, callback.message.chat.id, callback.id, cfg);
    return;
  }

  const message = update.message;
  const chatId = message?.chat?.id;
  const text = (message?.text ?? "") as string;
  if (!chatId) return;

  if (text.startsWith("/start")) {
    await handleStart(chatId, text, cfg);
    return;
  }

  if (message?.photo?.length) {
    const fileId = message.photo[message.photo.length - 1].file_id;
    await handleTelegramAbsensiMessage(chatId, text, cfg, fileId, undefined);
    return;
  }

  if (message?.location) {
    const { latitude, longitude } = message.location;
    await handleTelegramAbsensiMessage(chatId, text, cfg, undefined, { latitude, longitude });
    return;
  }
}

async function handleStart(chatId: number, text: string, cfg: TelegramConfig) {
  const token = text.split(/\s+/)[1] ?? "";
  if (!token) return;

  const user = await db.user.findFirst({
    where: { telegramBindToken: token, telegramBindExpires: { gt: new Date() } },
  });

  if (!user) {
    await sendTelegramText(chatId, "Tautan tidak valid atau sudah kedaluwarsa. Buka ulang dari aplikasi HRIS.", cfg);
    return;
  }

  await db.$transaction([
    db.user.updateMany({ where: { telegramChatId: String(chatId) }, data: { telegramChatId: null } }),
    db.user.update({
      where: { id: user.id },
      data: {
        telegramChatId: String(chatId),
        telegramBoundAt: new Date(),
        telegramBindToken: null,
        telegramBindExpires: null,
      },
    }),
  ]);

  await sendTelegramText(chatId, `Terhubung sebagai ${user.name || user.email}.\nKamu akan menerima notifikasi di sini.`, cfg);
}

async function handleCallback(data: string, chatId: number, callbackId: string | undefined, cfg: TelegramConfig) {
  if (data !== "ABSEN_IN" && data !== "ABSEN_OUT") return;
  const user = await db.user.findUnique({ where: { telegramChatId: String(chatId) } });
  if (!user) {
    await sendTelegramText(chatId, "Akun belum terhubung ke aplikasi HRIS.", cfg);
    return;
  }
  await db.user.update({
    where: { id: user.id },
    data: {
      telegramAbsensiState: { tipe: data === "ABSEN_IN" ? "CHECK_IN" : "CHECK_OUT", step: "awaiting_photo" },
    },
  });
  await sendTelegramText(
    chatId,
    data === "ABSEN_IN" ? "✅ Absen Masuk\nKirim foto selfie kamu." : "🚪 Absen Pulang\nKirim foto selfie kamu.",
    cfg
  );
  if (callbackId) await answerCallback(callbackId, cfg);
}

export async function sendTelegramText(chatId: number | string, text: string, cfg: TelegramConfig) {
  if (!cfg.botToken) return;
  try {
    await fetch(`https://api.telegram.org/bot${cfg.botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
      cache: "no-store",
    });
  } catch {
    // ignore
  }
}

async function answerCallback(callbackQueryId: string, cfg: TelegramConfig) {
  if (!cfg.botToken) return;
  try {
    await fetch(`https://api.telegram.org/bot${cfg.botToken}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQueryId }),
      cache: "no-store",
    });
  } catch {
    // ignore
  }
}

export async function processTelegramBot(cfg: TelegramConfig): Promise<number> {
  if (!cfg.botToken) return 0;
  const me = await fetch(`https://api.telegram.org/bot${cfg.botToken}/getMe`, { cache: "no-store" });
  const meJson = await me.json().catch(() => null);
  if (!meJson?.ok) return 0;

  // getUpdates long-poll with offset; max 30s.
  const upd = await fetch(`https://api.telegram.org/bot${cfg.botToken}/getUpdates?timeout=30`, {
    cache: "no-store",
  });
  const data = await upd.json().catch(() => null);
  const updates: TelegramUpdate[] = data?.ok ? (data.result ?? []) : [];
  let processed = 0;
  for (const u of updates) {
    try {
      await handleTelegramUpdate(u, cfg);
      processed++;
    } catch {
      // continue
    }
  }
  // Acknowledge by setting offset to last processed + 1 so Telegram won't resend.
  if (updates.length > 0) {
    const lastId = updates[updates.length - 1].update_id ?? 0;
    await fetch(`https://api.telegram.org/bot${cfg.botToken}/getUpdates?offset=${lastId + 1}`, { cache: "no-store" });
  }
  return processed;
}
