import { z } from "zod";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireRole } from "@/lib/auth-helpers";
import type { Role } from "@/generated/prisma/enums";

const RATER_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION", "QC_MANAGER", "QC_REVIEWER", "TRAINER"];

const penilaianSchema = z.object({
  karyawanId: z.string().min(1),
  skor: z.number().int().min(1).max(100).optional(),
  sellingSkill: z.number().int().min(0).max(100).optional(),
  grooming: z.number().int().min(0).max(100).optional(),
  productKnowledge: z.number().int().min(0).max(100).optional(),
  engagement: z.number().int().min(0).max(100).optional(),
  gmvGenerated: z.number().min(0).optional(),
  komentar: z.string().optional().nullable(),
  periode: z.string().optional().nullable(),
});

export type PenilaianInput = z.infer<typeof penilaianSchema>;

/**
 * Submit an SDM/Streamer KPI rating across the 4 core live streaming agency dimensions.
 */
export async function submitPenilaian(input: PenilaianInput) {
  const user = await requireRole(...RATER_ROLES);
  const parsed = penilaianSchema.parse(input);

  if (user.karyawanId === parsed.karyawanId) {
    throw AppError.forbidden("Tidak dapat menilai diri sendiri");
  }

  // If sub-scores are provided, compute average composite score
  let compositeScore = parsed.skor ?? 80;
  if (
    parsed.sellingSkill !== undefined ||
    parsed.grooming !== undefined ||
    parsed.productKnowledge !== undefined ||
    parsed.engagement !== undefined
  ) {
    const s1 = parsed.sellingSkill ?? 80;
    const s2 = parsed.grooming ?? 80;
    const s3 = parsed.productKnowledge ?? 80;
    const s4 = parsed.engagement ?? 80;
    compositeScore = Math.round((s1 + s2 + s3 + s4) / 4);
  }

  const detailObj = {
    sellingSkill: parsed.sellingSkill ?? compositeScore,
    grooming: parsed.grooming ?? compositeScore,
    productKnowledge: parsed.productKnowledge ?? compositeScore,
    engagement: parsed.engagement ?? compositeScore,
    gmvGenerated: parsed.gmvGenerated ?? 0,
    note: parsed.komentar ?? "",
  };

  return db.penilaianSDM.create({
    data: {
      karyawanId: parsed.karyawanId,
      penilaiId: user.karyawanId ?? user.id,
      skor: compositeScore,
      komentar: JSON.stringify(detailObj),
      periode: parsed.periode ?? `${new Date().toLocaleString("id-ID", { month: "long" })} ${new Date().getFullYear()}`,
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
