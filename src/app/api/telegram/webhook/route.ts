import { NextResponse } from "next/server";
import { handleTelegramUpdate } from "@/lib/services/telegram-bot";
import { getBotConfig } from "@/lib/services/telegram";

export async function POST(req: Request) {
  const cfg = await getBotConfig();
  if (!cfg.botToken) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false });
  }

  await handleTelegramUpdate(body, cfg);
  return NextResponse.json({ ok: true });
}
