import { z } from "zod";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireRole } from "@/lib/auth-helpers";
import type { Role } from "@/generated/prisma/enums";

const RATER_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION", "QC_MANAGER", "QC_REVIEWER", "TRAINER"];

const penilaianSchema = z.object({
  id: z.string().optional(),
  karyawanId: z.string().min(1),
  tipeRole: z.enum(["STREAMER", "OTS"]).optional(),
  skor: z.number().int().min(0).max(100).optional(),
  // Streamer Indicators
  productKnowledge: z.number().int().min(0).max(100).optional(),
  interaksiPenampilan: z.number().int().min(0).max(100).optional(),
  metrikObjektif: z.number().int().min(0).max(100).optional(),
  keterampilanImprovisasi: z.number().int().min(0).max(100).optional(),
  kemampuanKomunikasi: z.number().int().min(0).max(100).optional(),
  professionalism: z.number().int().min(0).max(100).optional(),
  // OTS Indicators
  setupTeknis: z.number().int().min(0).max(100).optional(),
  kedisiplinanWaktu: z.number().int().min(0).max(100).optional(),
  troubleshooting: z.number().int().min(0).max(100).optional(),
  kerjasamaTim: z.number().int().min(0).max(100).optional(),
  kebersihanStudio: z.number().int().min(0).max(100).optional(),
  dokumentasiQc: z.number().int().min(0).max(100).optional(),
  // Extra
  gmvGenerated: z.number().min(0).optional(),
  komentar: z.string().optional().nullable(),
  periode: z.string().optional().nullable(),
});

export type PenilaianInput = z.infer<typeof penilaianSchema>;

/**
 * Submit an SDM/Streamer/OTS KPI rating using 6-indicator weighted scoring:
 * - Streamer: Product (20%), Interaksi (20%), Metrik (20%), Improvisasi (15%), Komunikasi (15%), Pro (10%)
 * - OTS: Setup Teknis (20%), Disiplin Waktu (20%), Troubleshooting (20%), Kerjasama (15%), Kebersihan (15%), Dok QC (10%)
 */
export async function submitPenilaian(input: PenilaianInput) {
  const user = await requireRole(...RATER_ROLES);
  const parsed = penilaianSchema.parse(input);

  if (user.karyawanId === parsed.karyawanId) {
    throw AppError.forbidden("Tidak dapat menilai diri sendiri");
  }

  const isOTS = parsed.tipeRole === "OTS";

  let compositeScore = 0;
  let detailObj: any = {};

  if (isOTS) {
    const valSetup = parsed.setupTeknis ?? parsed.productKnowledge ?? 80;
    const valDisiplin = parsed.kedisiplinanWaktu ?? parsed.interaksiPenampilan ?? 80;
    const valTrouble = parsed.troubleshooting ?? parsed.metrikObjektif ?? 80;
    const valTim = parsed.kerjasamaTim ?? parsed.keterampilanImprovisasi ?? 80;
    const valBersih = parsed.kebersihanStudio ?? parsed.kemampuanKomunikasi ?? 80;
    const valDok = parsed.dokumentasiQc ?? parsed.professionalism ?? 80;

    const bobot =
      valSetup * 0.2 +
      valDisiplin * 0.2 +
      valTrouble * 0.2 +
      valTim * 0.15 +
      valBersih * 0.15 +
      valDok * 0.1;

    compositeScore = parsed.skor ?? Math.round(bobot);

    detailObj = {
      tipeRole: "OTS",
      setupTeknis: valSetup,
      kedisiplinanWaktu: valDisiplin,
      troubleshooting: valTrouble,
      kerjasamaTim: valTim,
      kebersihanStudio: valBersih,
      dokumentasiQc: valDok,
      totalSkor: compositeScore,
      note: parsed.komentar ?? "",
    };
  } else {
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

    compositeScore = parsed.skor ?? Math.round(bobotTotal);

    detailObj = {
      tipeRole: "STREAMER",
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
  }

  const defaultPeriode = `${new Date().toLocaleString("id-ID", { month: "long" })} ${new Date().getFullYear()}`;
  const targetPeriode = parsed.periode ?? defaultPeriode;

  // Check if evaluation already exists for this employee + period
  const existing = await db.penilaianSDM.findFirst({
    where: {
      karyawanId: parsed.karyawanId,
      periode: targetPeriode,
    },
  });

  if (existing) {
    return db.penilaianSDM.update({
      where: { id: existing.id },
      data: {
        penilaiId: user.karyawanId ?? user.id,
        skor: compositeScore,
        komentar: JSON.stringify(detailObj),
      },
      include: { karyawan: true },
    });
  }

  return db.penilaianSDM.create({
    data: {
      karyawanId: parsed.karyawanId,
      penilaiId: user.karyawanId ?? user.id,
      skor: compositeScore,
      komentar: JSON.stringify(detailObj),
      periode: targetPeriode,
    },
    include: { karyawan: true },
  });
}

/**
 * Submit batch KPI ratings
 */
export async function submitBatchPenilaian(items: PenilaianInput[]) {
  await requireRole(...RATER_ROLES);
  const results = [];
  for (const item of items) {
    const res = await submitPenilaian(item);
    results.push(res);
  }
  return results;
}

/**
 * Get matrix KPI Streamers
 */
export async function getMatrixKPIStreamer(filterPeriode?: string) {
  await requireRole();

  const activeStreamers = await db.karyawan.findMany({
    where: {
      statusAktif: "AKTIF",
      OR: [
        { kategori: "STREAMER" },
        { jabatan: { contains: "Host", mode: "insensitive" } },
        { jabatan: { contains: "Streamer", mode: "insensitive" } },
      ],
    },
    orderBy: { namaLengkap: "asc" },
  });

  const allPeriodsRaw = await db.penilaianSDM.findMany({
    select: { periode: true },
    distinct: ["periode"],
    orderBy: { periode: "desc" },
  });
  const uniquePeriods = allPeriodsRaw.map((p) => p.periode).filter(Boolean);

  const currentMonthName = new Date().toLocaleString("id-ID", { month: "long" });
  const currentYear = new Date().getFullYear();
  const defaultPeriod = `${currentMonthName} ${currentYear}`;

  if (!uniquePeriods.includes(defaultPeriod)) {
    uniquePeriods.unshift(defaultPeriod);
  }

  const ratings = await db.penilaianSDM.findMany({
    where: filterPeriode ? { periode: filterPeriode } : undefined,
    include: { karyawan: true },
    orderBy: { createdAt: "desc" },
  });

  const ratingMap = new Map<string, any>();
  for (const r of ratings) {
    if (!ratingMap.has(r.karyawanId)) {
      ratingMap.set(r.karyawanId, r);
    }
  }

  const rows = activeStreamers.map((s, idx) => {
    const rating = ratingMap.get(s.id);
    let details: any = {};
    if (rating?.komentar) {
      try {
        details = JSON.parse(rating.komentar);
      } catch {
        details = { note: rating.komentar };
      }
    }

    const prod = details.productKnowledge ?? (rating ? 80 : 0);
    const interaksi = details.interaksiPenampilan ?? (rating ? 80 : 0);
    const metrik = details.metrikObjektif ?? (rating ? 80 : 0);
    const improvisasi = details.keterampilanImprovisasi ?? (rating ? 80 : 0);
    const komunikasi = details.kemampuanKomunikasi ?? (rating ? 80 : 0);
    const profesionalisme = details.professionalism ?? (rating ? 80 : 0);
    const total = rating ? rating.skor : (prod ? Math.round(prod * 0.2 + interaksi * 0.2 + metrik * 0.2 + improvisasi * 0.15 + komunikasi * 0.15 + profesionalisme * 0.1) : 0);

    return {
      rowIndex: idx + 1,
      id: rating?.id ?? `TEMP_${s.id}`,
      idKaryawan: s.idKaryawan,
      karyawanDbId: s.id,
      namaLengkap: s.namaLengkap,
      jabatan: s.jabatan || "Live Host",
      periode: filterPeriode || rating?.periode || defaultPeriod,
      productKnowledge: prod,
      interaksiDanPenampilan: interaksi,
      metrikObjektif: metrik,
      keterampilanImprovisasi: improvisasi,
      kemampuanKomunikasi: komunikasi,
      professionalismDanOrganism: profesionalisme,
      totalSkor: total,
      catatanEvaluasi: details.note || "",
      idPenilaian: rating?.id ? `KPI-${rating.id.slice(0, 6).toUpperCase()}` : "–",
      penilai: rating?.penilaiId || "SPV Operasional",
      hasRating: Boolean(rating),
    };
  });

  return {
    rows,
    periods: uniquePeriods,
  };
}

/**
 * Get matrix KPI OTS
 */
export async function getMatrixKPIOTS(filterPeriode?: string) {
  await requireRole();

  const activeOTS = await db.karyawan.findMany({
    where: {
      statusAktif: "AKTIF",
      OR: [
        { kategori: "OTS" },
        { kategori: "STAFF" },
        { jabatan: { contains: "OTS", mode: "insensitive" } },
        { jabatan: { contains: "Operator", mode: "insensitive" } },
        { jabatan: { contains: "Technical", mode: "insensitive" } },
      ],
    },
    orderBy: { namaLengkap: "asc" },
  });

  const allPeriodsRaw = await db.penilaianSDM.findMany({
    select: { periode: true },
    distinct: ["periode"],
    orderBy: { periode: "desc" },
  });
  const uniquePeriods = allPeriodsRaw.map((p) => p.periode).filter(Boolean);

  const currentMonthName = new Date().toLocaleString("id-ID", { month: "long" });
  const currentYear = new Date().getFullYear();
  const defaultPeriod = `${currentMonthName} ${currentYear}`;

  if (!uniquePeriods.includes(defaultPeriod)) {
    uniquePeriods.unshift(defaultPeriod);
  }

  const ratings = await db.penilaianSDM.findMany({
    where: filterPeriode ? { periode: filterPeriode } : undefined,
    include: { karyawan: true },
    orderBy: { createdAt: "desc" },
  });

  const ratingMap = new Map<string, any>();
  for (const r of ratings) {
    if (!ratingMap.has(r.karyawanId)) {
      ratingMap.set(r.karyawanId, r);
    }
  }

  const rows = activeOTS.map((s, idx) => {
    const rating = ratingMap.get(s.id);
    let details: any = {};
    if (rating?.komentar) {
      try {
        details = JSON.parse(rating.komentar);
      } catch {
        details = { note: rating.komentar };
      }
    }

    const setup = details.setupTeknis ?? details.productKnowledge ?? (rating ? 80 : 0);
    const disiplin = details.kedisiplinanWaktu ?? details.interaksiPenampilan ?? (rating ? 80 : 0);
    const trouble = details.troubleshooting ?? details.metrikObjektif ?? (rating ? 80 : 0);
    const tim = details.kerjasamaTim ?? details.keterampilanImprovisasi ?? (rating ? 80 : 0);
    const bersih = details.kebersihanStudio ?? details.kemampuanKomunikasi ?? (rating ? 80 : 0);
    const dok = details.dokumentasiQc ?? details.professionalism ?? (rating ? 80 : 0);
    const total = rating ? rating.skor : (setup ? Math.round(setup * 0.2 + disiplin * 0.2 + trouble * 0.2 + tim * 0.15 + bersih * 0.15 + dok * 0.1) : 0);

    return {
      rowIndex: idx + 1,
      id: rating?.id ?? `TEMP_${s.id}`,
      idKaryawan: s.idKaryawan,
      karyawanDbId: s.id,
      namaLengkap: s.namaLengkap,
      jabatan: s.jabatan || "Operator Technical Support",
      periode: filterPeriode || rating?.periode || defaultPeriod,
      setupTeknis: setup,
      kedisiplinanWaktu: disiplin,
      troubleshooting: trouble,
      kerjasamaTim: tim,
      kebersihanStudio: bersih,
      dokumentasiQc: dok,
      totalSkor: total,
      catatanEvaluasi: details.note || "",
      idPenilaian: rating?.id ? `KPI-${rating.id.slice(0, 6).toUpperCase()}` : "–",
      penilai: rating?.penilaiId || "SPV Operasional",
      hasRating: Boolean(rating),
    };
  });

  return {
    rows,
    periods: uniquePeriods,
  };
}

/**
 * View ratings.
 */
export async function listPenilaian(params?: {
  karyawanId?: string;
  leaderboard?: boolean;
  view?: string;
  periode?: string;
  targetRole?: string;
}) {
  if (params?.view === "matrix") {
    if (params.targetRole === "OTS") {
      return getMatrixKPIOTS(params.periode);
    }
    return getMatrixKPIStreamer(params.periode);
  }

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

    return Array.from(map.values())
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
