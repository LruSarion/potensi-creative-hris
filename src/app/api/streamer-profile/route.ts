import { apiHandler } from "@/lib/api-handler";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-helpers";

/**
 * Streamer's own profile + experience, and self-editing of photoUrl/bio.
 * Only the streamer themselves (or SUPER_ADMIN) can edit their own profile.
 */
export const GET = apiHandler(async () => {
  const user = await requireRole();
  if (!user.karyawanId) return null;
  const profile = await db.streamerProfile.findUnique({
    where: { karyawanId: user.karyawanId },
    include: { experiences: { orderBy: { completedAt: "desc" }, include: { client: true } } },
  });
  return {
    photoUrl: profile?.photoUrl ?? null,
    rating: Number(profile?.rating ?? 0),
    totalSessions: profile?.totalSessions ?? 0,
    availability: profile?.availability ?? "FLEXIBLE",
    bio: profile?.bio ?? null,
    experiences: (profile?.experiences ?? []).map((x) => ({
      id: x.id,
      title: x.title,
      platform: x.platform,
      periode: x.periode,
      result: x.result,
      status: x.status,
      clientName: x.client?.namaClient ?? null,
      completedAt: x.completedAt,
    })),
  };
});

export const PATCH = apiHandler(async (req: Request) => {
  const user = await requireRole();
  if (!user.karyawanId) throw new Error("Akun tidak terhubung ke karyawan");
  const body = await req.json();

  const data: { photoUrl?: string | null; bio?: string | null; availability?: string } = {};
  if (typeof body.photoUrl === "string") data.photoUrl = body.photoUrl;
  if (typeof body.bio === "string") data.bio = body.bio;
  if (typeof body.availability === "string") data.availability = body.availability;

  const existing = await db.streamerProfile.findUnique({ where: { karyawanId: user.karyawanId } });
  if (existing) {
    return db.streamerProfile.update({ where: { id: existing.id }, data });
  }
  return db.streamerProfile.create({
    data: { tenantId: user.tenantId ?? undefined, karyawanId: user.karyawanId, ...data },
  });
});
