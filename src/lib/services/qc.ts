import { z } from "zod";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireRole, tenantWhere, requirePortal } from "@/lib/auth-helpers";
import type { Role } from "@/generated/prisma/enums";

const QC_ROLES: Role[] = ["QC_MANAGER", "QC_REVIEWER", "SUPER_ADMIN"];
const MANAGER_ROLES: Role[] = ["QC_MANAGER", "SUPER_ADMIN"];

// ---------- T23: Rubric builder ----------

const rubricSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  dimensions: z.array(
    z.object({ name: z.string().min(1), weight: z.number().int().min(1).max(10), scaleMax: z.number().int().min(1).max(20) })
  ).min(1),
});

export async function createRubric(input: z.infer<typeof rubricSchema>) {
  const user = await requireRole(...MANAGER_ROLES);
  const parsed = rubricSchema.parse(input);
  return db.$transaction(async (tx) => {
    const rubric = await tx.qCRubric.create({
      data: { tenantId: user.tenantId || undefined, name: parsed.name, description: parsed.description ?? null },
    });
    for (const d of parsed.dimensions) {
      await tx.qCRubricDimension.create({ data: { rubricId: rubric.id, ...d } });
    }
    return tx.qCRubric.findUnique({ where: { id: rubric.id }, include: { dimensions: true } });
  });
}

export async function listRubrics() {
  const user = await requireRole(...QC_ROLES);
  return db.qCRubric.findMany({ where: tenantWhere(user), include: { dimensions: true } });
}

// ---------- T24: Session review workflow ----------

export async function createReview(input: { jadwalId: string; rubricId: string; recordingDriveId?: string }) {
  const user = await requireRole(...QC_ROLES);
  const jadwal = await db.jadwal.findFirst({ where: { id: input.jadwalId, ...tenantWhere(user) } });
  if (!jadwal) throw AppError.notFound("Jadwal tidak ditemukan");
  const rubric = await db.qCRubric.findFirst({ where: { id: input.rubricId, ...tenantWhere(user) } });
  if (!rubric) throw AppError.notFound("Rubrik tidak ditemukan");
  return db.sessionReview.create({
    data: {
      tenantId: user.tenantId || undefined,
      jadwalId: input.jadwalId,
      rubricId: input.rubricId,
      reviewerId: user.id,
      recordingDriveId: input.recordingDriveId ?? null,
      status: "PENDING",
    },
  });
}

/** QC reviewer scores a review: arrays of {dimensionId, score}. Weighted total. */
export async function scoreReview(reviewId: string, scores: { dimensionId: string; score: number }[], remarks?: string) {
  const user = await requireRole(...QC_ROLES);
  const review = await db.sessionReview.findFirst({
    where: { id: reviewId, ...tenantWhere(user) },
    include: { rubric: { include: { dimensions: true } } },
  });
  if (!review) throw AppError.notFound("Review tidak ditemukan");

  const dims = review.rubric.dimensions;
  let weighted = 0;
  let totalWeight = 0;
  for (const s of scores) {
    const dim = dims.find((d) => d.id === s.dimensionId);
    if (!dim) throw AppError.badRequest(`Dimensi ${s.dimensionId} tidak ada di rubrik`);
    weighted += s.score * dim.weight;
    totalWeight += dim.weight;
    const existing = await db.reviewScore.findFirst({ where: { reviewId, dimensionId: dim.id } });
    if (existing) {
      await db.reviewScore.update({ where: { id: existing.id }, data: { score: s.score } });
    } else {
      await db.reviewScore.create({ data: { reviewId, dimensionId: dim.id, score: s.score } });
    }
  }
  const totalScore = totalWeight > 0 ? Math.round(weighted / totalWeight) : 0;
  const passed = totalScore >= 70; // threshold
  return db.sessionReview.update({
    where: { id: reviewId },
    data: { totalScore, status: passed ? "PASS" : "FAIL", remarks: remarks ?? null, reviewedAt: new Date() },
  });
}

export async function listReviews(status?: string) {
  const user = await requireRole(...QC_ROLES);
  return db.sessionReview.findMany({
    where: { ...tenantWhere(user), ...(status ? { status: status as any } : {}) },
    include: { jadwal: { include: { streamerKaryawan: true } }, rubric: { include: { dimensions: true } }, scores: true, actionItems: true },
    orderBy: { createdAt: "desc" },
  });
}

// ---------- T25: Action items ----------

const actionSchema = z.object({
  reviewId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
});

export async function createActionItem(input: z.infer<typeof actionSchema>) {
  const user = await requireRole(...QC_ROLES);
  const parsed = actionSchema.parse(input);
  const review = await db.sessionReview.findFirst({ where: { id: parsed.reviewId, ...tenantWhere(user) } });
  if (!review) throw AppError.notFound("Review tidak ditemukan");
  return db.actionItem.create({
    data: { reviewId: parsed.reviewId, title: parsed.title, description: parsed.description ?? null, assigneeId: parsed.assigneeId ?? null },
  });
}

export async function updateActionItemStatus(id: string, status: "OPEN" | "IN_PROGRESS" | "RESOLVED") {
  await requireRole(...QC_ROLES);
  return db.actionItem.update({
    where: { id },
    data: { status, resolvedAt: status === "RESOLVED" ? new Date() : undefined },
  });
}

/** Streamer-facing: action items assigned to me (reward loop). */
export async function myActionItems() {
  const user = await requirePortal("streamer");
  return db.actionItem.findMany({
    where: { assigneeId: user.karyawanId ?? "none", status: { in: ["OPEN", "IN_PROGRESS"] } },
    include: { review: { include: { jadwal: true } } },
    orderBy: { createdAt: "desc" },
  });
}

// ---------- T26: Trend reports ----------

export async function qcTrends(periode?: string) {
  const user = await requireRole(...MANAGER_ROLES);
  const reviews = await db.sessionReview.findMany({
    where: { ...tenantWhere(user), ...(periode ? { jadwal: { periodeBulan: periode } } : {}) },
    include: { jadwal: true, actionItems: true },
  });

  const passed = reviews.filter((r) => r.status === "PASS").length;
  const failed = reviews.filter((r) => r.status === "FAIL").length;
  const byPlatform: Record<string, { total: number; pass: number }> = {};
  for (const r of reviews) {
    const p = r.jadwal?.platform ?? "unknown";
    byPlatform[p] = byPlatform[p] ?? { total: 0, pass: 0 };
    byPlatform[p].total += 1;
    if (r.status === "PASS") byPlatform[p].pass += 1;
  }
  const actionable = reviews.filter((r) => r.actionItems.length > 0).length;

  return {
    total: reviews.length,
    passed,
    failed,
    passRate: reviews.length ? Math.round((passed / reviews.length) * 100) : 0,
    byPlatform,
    withActionItems: actionable,
  };
}