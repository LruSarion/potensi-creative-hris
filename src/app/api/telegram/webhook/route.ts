import { NextResponse } from "next/server";
import { db } from "@/lib/db";

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

  const message = body?.message;
  const chatId = message?.chat?.id;
  const text = (message?.text ?? "") as string;

  // /start <bindToken> binds this Telegram chat to the matching user account.
  if (chatId && text.startsWith("/start")) {
    const token = text.split(/\s+/)[1] ?? "";
    if (!token) return NextResponse.json({ ok: true });

    const user = await db.user.findFirst({
      where: {
        telegramBindToken: token,
        telegramBindExpires: { gt: new Date() },
      },
    });

    if (!user) {
      await sendTelegramText(chatId, "Tautan tidak valid atau sudah kedaluwarsa. Buka ulang dari aplikasi HRIS.");
      return NextResponse.json({ ok: true });
    }

    // A chat can only be bound to one account, and an account to one chat.
    await db.$transaction([
      db.user.updateMany({ where: { telegramChatId: String(chatId) }, data: { telegramChatId: null } }),
      db.user.update({
        where: { id: user.id },
        data: { telegramChatId: String(chatId), telegramBoundAt: new Date(), telegramBindToken: null, telegramBindExpires: null },
      }),
    ]);

    await sendTelegramText(chatId, `Terhubung sebagai ${user.name || user.email}.\nKamu akan menerima notifikasi di sini.`);
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
