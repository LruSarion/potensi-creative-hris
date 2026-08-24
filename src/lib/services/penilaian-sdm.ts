import { z } from "zod";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireRole } from "@/lib/auth-helpers";
import type { Role } from "@/generated/prisma/enums";

const RATER_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION", "QC_MANAGER", "QC_REVIEWER", "TRAINER"];

const penilaianSchema = z.object({
  karyawanId: z.string().min(1),
  skor: z.number().int().min(0).max(100).optional(),
  productKnowledge: z.number().int().min(0).max(100).optional(),
  interaksiPenampilan: z.number().int().min(0).max(100).optional(),
  metrikObjektif: z.number().int().min(0).max(100).optional(),
  keterampilanImprovisasi: z.number().int().min(0).max(100).optional(),
  kemampuanKomunikasi: z.number().int().min(0).max(100).optional(),
  professionalism: z.number().int().min(0).max(100).optional(),
  gmvGenerated: z.number().min(0).optional(),
  komentar: z.string().optional().nullable(),
  periode: z.string().optional().nullable(),
});

export type PenilaianInput = z.infer<typeof penilaianSchema>;

/**
 * Submit an SDM/Streamer KPI rating using ref-deploy 6-indicator weighted scoring system:
 * 1. Product Knowledge (20%)
 * 2. Interaksi & Penampilan (20%)
 * 3. Metrik Objektif (20%)
 * 4. Keterampilan Improvisasi (15%)
 * 5. Kemampuan Komunikasi (15%)
 * 6. Professionalism & Organization (10%)
 */
export async function submitPenilaian(input: PenilaianInput) {
  const user = await requireRole(...RATER_ROLES);
  const parsed = penilaianSchema.parse(input);

  if (user.karyawanId === parsed.karyawanId) {
    throw AppError.forbidden("Tidak dapat menilai diri sendiri");
  }

  // Calculate Weighted Composite Total Score (ref-deploy formula)
  const valProd = parsed.productKnowledge ?? 80;
  const valInteraksi = parsed.interaksiPenampilan ?? 80;
  const valMetrik = parsed.metrikObjektif ?? 80;
  const valImprovisasi = parsed.keterampilanImprovisasi ?? 80;
  const valKomunikasi = parsed.kemampuanKomunikasi ?? 80;
  const valProfesionalisme = parsed.professionalism ?? 80;

  const bobotTotal =
    valProd * 0.2 +
    valInteraksi * 0.2 +
    valMetrik * 0.2 +
    valImprovisasi * 0.15 +
    valKomunikasi * 0.15 +
    valProfesionalisme * 0.1;

  const compositeScore = parsed.skor ?? Math.round(bobotTotal);

  const detailObj = {
    productKnowledge: valProd,
    interaksiPenampilan: valInteraksi,
    metrikObjektif: valMetrik,
    keterampilanImprovisasi: valImprovisasi,
    kemampuanKomunikasi: valKomunikasi,
    professionalism: valProfesionalisme,
    totalSkor: compositeScore,
    gmvGenerated: parsed.gmvGenerated ?? 0,
    note: parsed.komentar ?? "",
  };

  const defaultPeriode = `${new Date().toLocaleString("id-ID", { month: "long" })} ${new Date().getFullYear()}`;

  return db.penilaianSDM.create({
    data: {
      karyawanId: parsed.karyawanId,
      penilaiId: user.karyawanId ?? user.id,
      skor: compositeScore,
      komentar: JSON.stringify(detailObj),
      periode: parsed.periode ?? defaultPeriode,
    },
    include: {
      karyawan: true,
    },
  });
}

/**
 * View ratings. Raters see all; employees see only their own aggregate.
 */
export async function listPenilaian(params?: { karyawanId?: string; leaderboard?: boolean }) {
  const user = await requireRole();
  const isRater = RATER_ROLES.includes(user.role);

  if (params?.leaderboard) {
    const all = await db.penilaianSDM.findMany({
      include: { karyawan: true },
      orderBy: { createdAt: "desc" },
    });

    const map = new Map<string, { karyawanId: string; namaLengkap: string; scores: number[] }>();
    for (const r of all) {
      const entry = map.get(r.karyawanId) ?? {
        karyawanId: r.karyawanId,
        namaLengkap: r.karyawan?.namaLengkap ?? r.karyawanId,
        scores: [],
      };
      entry.scores.push(r.skor);
      map.set(r.karyawanId, entry);
    }

    const leaderboard = Array.from(map.values())
      .map((e) => {
        const avg = Math.round((e.scores.reduce((a, b) => a + b, 0) / e.scores.length) * 10) / 10;
        let tierRecommendation = "Standard";
        if (avg >= 90) tierRecommendation = "High Performer";
        else if (avg >= 80) tierRecommendation = "Advance";
        else if (avg >= 70) tierRecommendation = "Optimal";
        else if (avg >= 60) tierRecommendation = "Standard";
        else tierRecommendation = "Basic";

        return {
          karyawanId: e.karyawanId,
          namaLengkap: e.namaLengkap,
          reviewCount: e.scores.length,
          averageScore: avg,
          tierRecommendation,
        };
      })
      .sort((a, b) => b.averageScore - a.averageScore);

    return leaderboard;
  }

  // Non-rater can only see their own aggregate.
  if (!isRater) {
    const targetId = params?.karyawanId ?? user.karyawanId;
    if (!targetId) return [];
    const rows = await db.penilaianSDM.findMany({ where: { karyawanId: targetId }, orderBy: { createdAt: "desc" } });
    const avg = rows.length ? rows.reduce((s, r) => s + r.skor, 0) / rows.length : 0;
    return { karyawanId: targetId, count: rows.length, average: Math.round(avg * 10) / 10, rows };
  }

  if (params?.karyawanId) {
    const rows = await db.penilaianSDM.findMany({ where: { karyawanId: params.karyawanId }, orderBy: { createdAt: "desc" } });
    const avg = rows.length ? rows.reduce((s, r) => s + r.skor, 0) / rows.length : 0;
    return { karyawanId: params.karyawanId, count: rows.length, average: Math.round(avg * 10) / 10, rows };
  }

  return db.penilaianSDM.findMany({ orderBy: { createdAt: "desc" }, include: { karyawan: true } });
}
