import { apiHandler } from "@/lib/api-handler";
import { db } from "@/lib/db";
import { requireRole, tenantWhere } from "@/lib/auth-helpers";
import type { Role } from "@/generated/prisma/enums";

const VIEW_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION", "CLIENT", "CLIENT_ADMIN", "TRAINER"];

/**
 * Streamer directory for HR/Client/Trainer: all streamers with their certs
 * (badge) and profile stats, filtered by client brand when requested.
 */
export const GET = apiHandler(async (req: Request) => {
  const user = await requireRole(...VIEW_ROLES);
  const url = new URL(req.url);
  const clientId = url.searchParams.get("clientId") ?? undefined;

  const where: Record<string, unknown> = {
    ...tenantWhere(user),
    OR: [{ kategori: "STREAMER" }, { jabatan: { contains: "Streamer" } }],
  };

  const streamers = await db.karyawan.findMany({
    where,
    include: {
      streamerProfile: true,
      certificates: {
        where: { revokedAt: null, ...(clientId ? { clientId } : {}) },
        include: { client: true, course: true },
      },
    },
    orderBy: { namaLengkap: "asc" },
  });

  return streamers.map((s) => ({
    id: s.id,
    idKaryawan: s.idKaryawan,
    namaLengkap: s.namaLengkap,
    email: s.email,
    jabatan: s.jabatan,
    statusAktif: s.statusAktif,
    rating: Number(s.streamerProfile?.rating ?? 0),
    totalSessions: s.streamerProfile?.totalSessions ?? 0,
    availability: s.streamerProfile?.availability ?? "FLEXIBLE",
    bio: s.streamerProfile?.bio ?? null,
    certifiedFor: s.certificates.map((c) => ({
      clientId: c.clientId,
      clientName: c.client?.namaClient ?? null,
      courseId: c.courseId,
      courseTitle: c.course?.title ?? null,
      validTo: c.validTo,
      active: c.validTo ? c.validTo > new Date() : true,
    })),
  }));
});
