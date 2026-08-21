import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTelegramConfig } from "@/lib/services/telegram";
import {
  handleTelegramAbsensiMessage,
  handleTelegramAbsensiCallback,
} from "@/lib/services/telegram-absensi";

const SECRET = process.env.TELEGRAM_BOT_TOKEN || "";

export async function POST(req: Request) {
  if (!SECRET) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false });
  }

  const cfg = { botToken: SECRET, botUsername: process.env.TELEGRAM_BOT_USERNAME || "" };

  // Inline button callback (Absen Masuk / Absen Pulang)
  const callback = body?.callback_query;
  if (callback?.data && callback?.message?.chat?.id) {
    const chatId = callback.message.chat.id;
    const user = await db.user.findUnique({ where: { telegramChatId: String(chatId) } });
    if (!user) {
      await sendTelegramText(chatId, "Akun belum terhubung ke aplikasi HRIS.");
      return NextResponse.json({ ok: true });
    }
    await db.user.update({
      where: { id: user.id },
      data: {
        telegramAbsensiState: {
          tipe: callback.data === "ABSEN_IN" ? "CHECK_IN" : "CHECK_OUT",
          step: "awaiting_photo",
        },
      },
    });
    await sendTelegramText(
      chatId,
      callback.data === "ABSEN_IN"
        ? "✅ Absen Masuk\nKirim foto selfie kamu."
        : "🚪 Absen Pulang\nKirim foto selfie kamu."
    );
    await answerCallback(callback.id, chatId);
    return NextResponse.json({ ok: true });
  }

  const message = body?.message;
  const chatId = message?.chat?.id;
  const text = (message?.text ?? "") as string;

  if (!chatId) return NextResponse.json({ ok: true });

  // /start <bindToken> binds this Telegram chat to the matching user account.
  if (text.startsWith("/start")) {
    const token = text.split(/\s+/)[1] ?? "";
    if (!token) return NextResponse.json({ ok: true });

    const user = await db.user.findFirst({
      where: { telegramBindToken: token, telegramBindExpires: { gt: new Date() } },
    });

    if (!user) {
      await sendTelegramText(chatId, "Tautan tidak valid atau sudah kedaluwarsa. Buka ulang dari aplikasi HRIS.");
      return NextResponse.json({ ok: true });
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

    await sendTelegramText(chatId, `Terhubung sebagai ${user.name || user.email}.\nKamu akan menerima notifikasi di sini.`);
    return NextResponse.json({ ok: true });
  }

  // Photo during absensi flow -> save as selfie proof, ask for location.
  if (message?.photo?.length) {
    const fileId = message.photo[message.photo.length - 1].file_id;
    await handleTelegramAbsensiMessage(chatId, text, cfg, fileId, undefined);
    return NextResponse.json({ ok: true });
  }

  // Location during absensi flow -> record absensi.
  if (message?.location) {
    const { latitude, longitude } = message.location;
    await handleTelegramAbsensiMessage(chatId, text, cfg, undefined, { latitude, longitude });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}

async function sendTelegramText(chatId: number | string, text: string) {
  try {
    await fetch(`https://api.telegram.org/bot${SECRET}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
      cache: "no-store",
    });
  } catch {
    // ignore
  }
}

async function answerCallback(callbackQueryId: string, chatId: number | string) {
  try {
    await fetch(`https://api.telegram.org/bot${SECRET}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQueryId }),
      cache: "no-store",
    });
  } catch {
    // ignore
  }
}
