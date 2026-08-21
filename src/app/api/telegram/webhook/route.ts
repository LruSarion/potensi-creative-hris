import { NextResponse } from "next/server";
import { handleTelegramUpdate } from "@/lib/services/telegram-bot";

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
  await handleTelegramUpdate(body, cfg);
  return NextResponse.json({ ok: true });
}
