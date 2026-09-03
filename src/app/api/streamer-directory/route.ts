import { apiHandler } from "@/lib/api-handler";
import { db } from "@/lib/db";
import { requireRole, tenantWhere } from "@/lib/auth-helpers";
import type { Role } from "@/generated/prisma/enums";

const VIEW_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION", "CLIENT", "CLIENT_ADMIN", "TRAINER", "STREAMER"];

/**
 * Streamer directory: all streamers with real database status, current month
 * completed sessions, and profile info.
 */
export const GET = apiHandler(async (req: Request) => {
  const user = await requireRole(...VIEW_ROLES);
  const url = new URL(req.url);
  const clientId = url.searchParams.get("clientId") ?? undefined;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  // Cross-tenant directory: clients pick agency streamers, so all streamers are
  // visible. Certification gating still scopes by client brand when requested.
  const where: Record<string, unknown> = {
    OR: [
      { kategori: "STREAMER" },
      { jabatan: { contains: "Streamer", mode: "insensitive" } },
      { jabatan: { contains: "Host", mode: "insensitive" } },
      { idKaryawan: { startsWith: "HST" } },
      { idKaryawan: { startsWith: "PCS" } },
    ],
    ...(user.role === "SUPER_ADMIN" ? {} : user.role === "CLIENT" || user.role === "CLIENT_ADMIN"
      ? {} // clients see all streamers
      : { tenantId: user.tenantId }), // HR/ops/trainer scoped to own tenant
  };

  const streamers = await db.karyawan.findMany({
    where,
    include: {
      streamerProfile: { include: { experiences: { orderBy: { completedAt: "desc" } } } },
      jadwalStreamer: {
        where: {
          tanggal: { gte: startOfMonth, lt: endOfMonth },
          status: "SELESAI",
        },
        select: { id: true, durationSec: true },
      },
      certificates: {
        where: { revokedAt: null, ...(clientId ? { clientId } : {}) },
        include: { client: true, course: true },
      },
    },
    orderBy: { namaLengkap: "asc" },
  });

  return streamers.map((s) => {
    const totalSessionsMonth = s.jadwalStreamer?.length ?? 0;
    const totalSec = (s.jadwalStreamer || []).reduce((sum, j) => sum + (j.durationSec || 0), 0);
    const totalHoursMonth = Number((totalSec / 3600).toFixed(1));

    return {
      id: s.id,
      idKaryawan: s.idKaryawan,
      namaLengkap: s.namaLengkap,
      namaPanggilan: s.namaPanggilan ?? null,
      email: s.email ?? null,
      nomorTelepon: s.nomorTelepon ?? null,
      jabatan: s.jabatan ?? "Host Streamer",
      kategori: s.kategori ?? "STREAMER",
      statusAktif: s.statusAktif || "AKTIF",
      kontrakType: s.kontrakType ?? null,
      photoUrl: s.streamerProfile?.photoUrl ?? null,
      rating: Number(s.streamerProfile?.rating ?? 0),
      totalSessions: totalSessionsMonth,
      totalSessionsMonth,
      totalHoursMonth,
      availability: s.streamerProfile?.availability ?? "FLEXIBLE",
      bio: s.streamerProfile?.bio ?? null,
      experiences: (s.streamerProfile?.experiences ?? []).map((x) => ({
        id: x.id,
        title: x.title,
        platform: x.platform,
        periode: x.periode,
        result: x.result,
        status: x.status,
        clientRating: x.clientRating ? Number(x.clientRating) : null,
        clientTestimonial: x.clientTestimonial,
        completedAt: x.completedAt,
      })),
      certifiedFor: s.certificates.map((c) => ({
        clientId: c.clientId,
        clientName: c.client?.namaClient ?? null,
        courseId: c.courseId,
        courseTitle: c.course?.title ?? null,
        validTo: c.validTo,
        active: c.validTo ? c.validTo > new Date() : true,
      })),
    };
  });
});
