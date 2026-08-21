import { NextResponse } from "next/server";
import { getBotConfig } from "@/lib/services/telegram";
import { processTelegramBot } from "@/lib/services/telegram-bot";

/**
 * Poll Telegram updates immediately (dev/local testing). Unlike the cron job,
 * this has no dedup lock so it can be hit repeatedly to process /start, absensi
 * buttons, photos, and locations while testing locally.
 *
 * Security: only allowed in non-production, or when CRON_SECRET header matches
 * (so it stays usable from a scheduler after public deploy).
 */
export async function POST(req: Request) {
  const isProd = process.env.NODE_ENV === "production";
  const secret = process.env.CRON_SECRET;
  if (isProd && (!secret || req.headers.get("x-cron-secret") !== secret)) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const cfg = await getBotConfig();
  if (!cfg.botToken) {
    return NextResponse.json({ ok: false, message: "Bot tidak dikonfigurasi" }, { status: 503 });
  }

  const processed = await processTelegramBot(cfg);
  return NextResponse.json({ ok: true, processed });
}
