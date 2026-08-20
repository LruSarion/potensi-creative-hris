import { NextResponse } from "next/server";
import { ingestWebhookEvent } from "@/lib/services/webhook";
import { AppError, toAppError } from "@/lib/errors";

/**
 * POST /api/webhook
 * Platform webhook ingest (stream.online / stream.offline).
 * Gated by WEBHOOK_SECRET via the `x-webhook-secret` header.
 */
export async function POST(req: Request) {
  // Fail-closed: require a configured secret.
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ status: "error", message: "WEBHOOK_SECRET not configured" }, { status: 503 });
  }
  if (req.headers.get("x-webhook-secret") !== secret) {
    return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const result = await ingestWebhookEvent(body);
    return NextResponse.json({ status: "success", data: result });
  } catch (err) {
    const appErr = toAppError(err);
    return NextResponse.json(
      { status: "error", code: appErr.code, message: appErr.message },
      { status: appErr.status }
    );
  }
}
