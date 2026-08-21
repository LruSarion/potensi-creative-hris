import { z } from "zod";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireRole, tenantWhere } from "@/lib/auth-helpers";

const CLIENT_ROLES = ["CLIENT", "CLIENT_ADMIN", "SUPER_ADMIN"] as const;

// ---------- T28: Own schedules ----------

export async function mySchedules() {
  const user = await requireRole(...CLIENT_ROLES);
  // CLIENT tenant is the brand tenant; their schedules = jadwal for their clients.
  return db.jadwal.findMany({
    where: tenantWhere(user),
    orderBy: { tanggal: "desc" },
    include: { streamerKaryawan: true, client: true },
    take: 100,
  });
}

export async function myClients() {
  const user = await requireRole(...CLIENT_ROLES);
  return db.client.findMany({ where: tenantWhere(user), include: { ketentuan: true } });
}

// ---------- T29: KPI dashboard ----------

export async function kpiDashboard() {
  const user = await requireRole(...CLIENT_ROLES);
  const [jadwal, produk] = await Promise.all([
    db.jadwal.findMany({ where: tenantWhere(user), select: { status: true, platform: true } }),
    db.produk.findMany({ where: tenantWhere(user), select: { status: true } }),
  ]);
  const total = jadwal.length;
  const selesai = jadwal.filter((j) => j.status === "SELESAI").length;
  const byPlatform: Record<string, number> = {};
  for (const j of jadwal) byPlatform[j.platform ?? "unknown"] = (byPlatform[j.platform ?? "unknown"] ?? 0) + 1;
  return {
    totalSessions: total,
    completedSessions: selesai,
    completionRate: total ? Math.round((selesai / total) * 100) : 0,
    sessionsByPlatform: byPlatform,
    products: produk.length,
    onlineProducts: produk.filter((p) => p.status === "ONLINE").length,
  };
}

// ---------- T30: Marketing/promo approval (via jadwal approval workflow) ----------

const promoApprovalSchema = z.object({
  idJadwal: z.string().min(1),
  tanggal: z.string().min(1),
  platform: z.string().optional().nullable(),
  judulLive: z.string().optional().nullable(),
  promoLive: z.string().optional().nullable(),
  catatan: z.string().optional().nullable(),
  clientId: z.string().optional().nullable(),
});

/** CLIENT proposes a marketing-ready jadwal for ops approval (PENDING). */
export async function proposePromoJadwal(input: z.infer<typeof promoApprovalSchema>) {
  const user = await requireRole(...CLIENT_ROLES);
  const parsed = promoApprovalSchema.parse(input);
  const tanggal = new Date(parsed.tanggal);
  const existing = await db.jadwal.findUnique({ where: { idJadwal: parsed.idJadwal } });
  if (existing) throw AppError.conflict("ID Jadwal sudah terdaftar");

  // Resolve the brand client for the marketplace listing: prefer the explicit
  // clientId, else the client record owned by the current tenant.
  const clientId =
    parsed.clientId ??
    (user.tenantId
      ? (await db.client.findFirst({ where: { tenantId: user.tenantId } }))?.id ?? null
      : null);

  return db.$transaction(async (tx) => {
    const jadwal = await tx.jadwal.create({
      data: {
        idJadwal: parsed.idJadwal,
        tenantId: user.tenantId || undefined,
        tanggal,
        platform: parsed.platform ?? null,
        judulLive: parsed.judulLive ?? null,
        promoLive: parsed.promoLive ?? null,
        catatanOts: parsed.catatan ?? null,
        clientId,
        status: "PENDING",
        jamMulaiLive: tanggal,
        jamSelesaiLive: tanggal,
        periodeBulan: `${["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"][tanggal.getMonth()]} ${tanggal.getFullYear()}`,
      },
    });

    // Auto-create a marketplace listing so streamers can apply to this project.
    if (clientId) {
      await tx.marketplaceListing.create({
        data: {
          tenantId: user.tenantId || undefined,
          clientId,
          jadwalId: jadwal.id,
          title: parsed.judulLive || parsed.idJadwal,
          description: parsed.promoLive || null,
          platform: parsed.platform ?? null,
          quota: 1,
          status: "OPEN",
        },
      });
    }

    return jadwal;
  });
}

export async function myApprovals() {
  const user = await requireRole(...CLIENT_ROLES);
  return db.jadwal.findMany({
    where: { ...tenantWhere(user), status: { in: ["PENDING", "APPROVED"] } },
    orderBy: { createdAt: "desc" },
    include: { streamerKaryawan: true },
  });
}

// ---------- T31: Feedback loop ----------

const feedbackSchema = z.object({
  clientId: z.string().optional().nullable(),
  targetType: z.enum(["STREAMER", "SERVICE", "OVERALL"]).optional().default("OVERALL"),
  targetName: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  rating: z.number().int().min(1).max(5).optional().default(5),
  message: z.string().min(1),
  suggestions: z.string().optional().nullable(),
});

export async function submitFeedback(input: z.infer<typeof feedbackSchema>) {
  const user = await requireRole(...CLIENT_ROLES);
  const parsed = feedbackSchema.parse(input);
  return db.logAktivitas.create({
    data: {
      tenantId: user.tenantId || undefined,
      userId: user.id,
      aksi: "CLIENT_FEEDBACK",
      detail: JSON.stringify({
        ...parsed,
        submittedByEmail: user.email,
        submittedByName: user.name,
      }),
    },
  });
}

export async function listMyFeedback() {
  const user = await requireRole(...CLIENT_ROLES);
  const logs = await db.logAktivitas.findMany({
    where: {
      aksi: "CLIENT_FEEDBACK",
      ...tenantWhere(user),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return logs.map((l) => {
    let parsedDetail: any = {};
    try {
      parsedDetail = JSON.parse(l.detail || "{}");
    } catch {
      parsedDetail = { message: l.detail };
    }
    return {
      id: l.id,
      createdAt: l.createdAt,
      ...parsedDetail,
    };
  });
}

export async function listFeedbackForAdmin() {
  const user = await requireRole("SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION");
  const logs = await db.logAktivitas.findMany({
    where: { aksi: "CLIENT_FEEDBACK" },
    orderBy: { createdAt: "desc" },
    include: { user: true },
    take: 100,
  });

  return logs.map((l) => {
    let parsedDetail: any = {};
    try {
      parsedDetail = JSON.parse(l.detail || "{}");
    } catch {
      parsedDetail = { message: l.detail };
    }
    return {
      id: l.id,
      createdAt: l.createdAt,
      user: l.user,
      ...parsedDetail,
    };
  });
}