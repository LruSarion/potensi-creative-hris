import { db } from "@/lib/db";

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
