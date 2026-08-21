import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireRole } from "@/lib/auth-helpers";
import type { Role } from "@/generated/prisma/enums";

const RATER_ROLES: Role[] = ["CLIENT", "CLIENT_ADMIN", "SUPER_ADMIN"];

/**
 * Auto-record a streamer's project experience when a session completes.
 * When a linked marketplace application's jadwal reaches SELESAI, we create a
 * StreamerExperience entry so the streamer's profile grows their track record.
 */
export async function recordStreamerExperienceOnSessionComplete(jadwalId: string) {
  const jadwal = await db.jadwal.findUnique({
    where: { id: jadwalId },
    include: { client: true },
  });
  if (!jadwal || jadwal.status !== "SELESAI" || !jadwal.streamerKaryawanId) return;

  // Find the streamer's profile (create if missing).
  let profile = await db.streamerProfile.findUnique({
    where: { karyawanId: jadwal.streamerKaryawanId },
  });
  if (!profile) {
    profile = await db.streamerProfile.create({
      data: { tenantId: jadwal.tenantId ?? undefined, karyawanId: jadwal.streamerKaryawanId },
    });
  }

  // Avoid duplicates: one experience per jadwal.
  const existing = await db.streamerExperience.findFirst({ where: { jadwalId } });
  if (existing) return;

  const title = jadwal.judulLive || jadwal.platform || jadwal.idJadwal;
  const periode = jadwal.periodeBulan || undefined;

  await db.$transaction(async (tx) => {
    await tx.streamerExperience.create({
      data: {
        streamerProfileId: profile!.id,
        clientId: jadwal.clientId ?? undefined,
        jadwalId,
        title,
        platform: jadwal.platform ?? undefined,
        periode,
        result: `Sesi selesai (${jadwal.idJadwal})`,
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });
    // Bump the session counter on the profile.
    await tx.streamerProfile.update({
      where: { id: profile!.id },
      data: { totalSessions: { increment: 1 } },
    });
  });
}

/**
 * Client rates a completed experience + leaves a testimonial.
 * Recomputes the streamer's aggregate rating from all rated experiences.
 */
export async function rateExperience(experienceId: string, rating: number, testimonial?: string) {
  const user = await requireRole(...RATER_ROLES);
  if (rating < 1 || rating > 5) throw AppError.badRequest("Rating harus 1-5");

  const exp = await db.streamerExperience.findUnique({
    where: { id: experienceId },
    include: { profile: true, client: true },
  });
  if (!exp) throw AppError.notFound("Pengalaman tidak ditemukan");
  // Only the owning client (or admin) may rate.
  const isOwner = user.role === "SUPER_ADMIN" || (exp.clientId && exp.clientId === (user as any).clientId) || exp.client?.tenantId === user.tenantId;
  if (!isOwner) throw AppError.forbidden("Hanya klien pemilik proyek yang dapat menilai");

  const updated = await db.streamerExperience.update({
    where: { id: experienceId },
    data: { clientRating: rating, clientTestimonial: testimonial ?? null },
  });

  // Recompute aggregate rating across all rated experiences on the profile.
  const all = await db.streamerExperience.findMany({
    where: { streamerProfileId: exp.streamerProfileId, clientRating: { not: null } },
  });
  const avg = all.length
    ? Math.round((all.reduce((s, x) => s + Number(x.clientRating), 0) / all.length) * 100) / 100
    : 0;
  await db.streamerProfile.update({
    where: { id: exp.streamerProfileId },
    data: { rating: avg },
  });

  return updated;
}
