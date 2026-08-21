import { z } from "zod";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { logAktivitas } from "@/lib/audit";
import { recordStreamerExperienceOnSessionComplete } from "@/lib/services/streamer-experience";

/**
 * Platform webhook ingest (Twitch / TikTok / LiveKit style).
 * Receives `stream.online` / `stream.offline` events, updates the scheduled
 * session's live state, and records exact stream uptime in seconds.
 *
 * Security: endpoint must be gated by WEBHOOK_SECRET (see route).
 * ACID: each event is applied in a $transaction so liveState + durationSec
 * stay consistent with the SessionStateLog entry.
 */

export type WebhookEventType = "stream.online" | "stream.offline";

const webhookSchema = z.object({
  event: z.enum(["stream.online", "stream.offline"]),
  // Stream key or session id the platform emits. Must map to a Jadwal.
  sessionKey: z.string().min(1),
  streamerKey: z.string().optional().nullable(), // platform user id for the streamer
  timestamp: z.coerce.date().optional(),
  // For offline events: total observed uptime in seconds (platform-computed).
  durationSec: z.number().int().nonnegative().optional(),
});

export type WebhookInput = z.infer<typeof webhookSchema>;

export async function ingestWebhookEvent(input: WebhookInput) {
  const parsed = webhookSchema.parse(input);
  const now = parsed.timestamp ?? new Date();

  const session = await resolveSession(parsed.sessionKey);
  if (!session) throw AppError.notFound(`Sesi "${parsed.sessionKey}" tidak ditemukan`);

  if (parsed.event === "stream.online") {
    // Transition SCHEDULED -> LIVE (or allow re-online from REVIEW).
    const allowed = session.liveState === "SCHEDULED" || session.liveState === "REVIEW";
    if (!allowed) {
      throw AppError.conflict(`stream.online tidak valid dari state ${session.liveState}`);
    }
    return db.$transaction(async (tx) => {
      await tx.jadwal.update({
        where: { id: session.id },
        data: { liveState: "LIVE", status: "TERJADWAL", jamMulaiLive: now },
      });
      await tx.sessionStateLog.create({
        data: {
          tenantId: session.tenantId ?? undefined,
          jadwalId: session.id,
          fromState: session.liveState,
          toState: "LIVE",
          note: "stream.online (webhook)",
        },
      });
      return { status: "ok", event: "stream.online", sessionKey: parsed.sessionKey };
    });
  }

  // stream.offline
  if (session.liveState !== "LIVE") {
    throw AppError.conflict(`stream.offline tidak valid dari state ${session.liveState}`);
  }
  // If the platform provides duration, trust it; else compute from timestamps.
  const durationSec = parsed.durationSec ?? Math.max(0, Math.round((now.getTime() - session.jamMulaiLive.getTime()) / 1000));

  return db.$transaction(async (tx) => {
    await tx.jadwal.update({
      where: { id: session.id },
      data: {
        liveState: "REVIEW",
        status: "SELESAI",
        jamSelesaiLive: now,
        durationSec,
      },
    });
    await tx.sessionStateLog.create({
      data: {
        tenantId: session.tenantId ?? undefined,
        jadwalId: session.id,
        fromState: "LIVE",
        toState: "REVIEW",
        note: `stream.offline (webhook), durationSec=${durationSec}`,
      },
    });
    // Audit trail (non-fatal).
    await logAktivitas({
      tenantId: session.tenantId,
      aksi: "WEBHOOK_STREAM_OFFLINE",
      detail: JSON.stringify({ sessionKey: parsed.sessionKey, durationSec }),
    });
    return { status: true, event: "stream.offline", durationSec };
  }).then(async () => {
    // After the session completes, auto-record it in the streamer's experience.
    await recordStreamerExperienceOnSessionComplete(session.id).catch(() => {
      // non-fatal: experience logging must not break the webhook response
    });
  });
}

/** Resolve a session by idJadwal, platform key, or id. */
async function resolveSession(sessionKey: string) {
  const byId = await db.jadwal.findFirst({ where: { idJadwal: sessionKey } });
  if (byId) return byId;
  try {
    return await db.jadwal.findUnique({ where: { id: sessionKey } });
  } catch {
    return null;
  }
}
