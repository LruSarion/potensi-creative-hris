import { z } from "zod";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireRole, tenantWhere } from "@/lib/auth-helpers";
import type { Role } from "@/generated/prisma/enums";

const CLIENT_ROLES: Role[] = ["CLIENT", "CLIENT_ADMIN", "SUPER_ADMIN"];
const HR_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION"];

const listingSchema = z.object({
  clientId: z.string().min(1),
  courseId: z.string().optional().nullable(),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  platform: z.string().optional().nullable(),
  ratePerSesi: z.coerce.number().min(0).default(0),
  quota: z.coerce.number().int().min(1).default(1),
});

export type ListingInput = z.infer<typeof listingSchema>;

/**
 * Check whether a streamer holds a valid (not revoked, not expired) certification
 * for the given course/brand client.
 */
export async function hasValidCertification(streamerKaryawanId: string, courseId: string | null | undefined): Promise<boolean> {
  if (!courseId) return false;
  const now = new Date();
  const cert = await db.certificate.findFirst({
    where: {
      streamerKaryawanId,
      courseId,
      revokedAt: null,
      OR: [{ validTo: null }, { validTo: { gt: now } }],
    },
  });
  return !!cert;
}

/** Streamer-facing: list OPEN listings the current streamer is eligible to apply for. */
export async function listEligibleListings() {
  const user = await requireRole();
  if (!user.karyawanId) return [];
  const listings = await db.marketplaceListing.findMany({
    where: { status: "OPEN", tenantId: user.tenantId || undefined },
    include: { client: true, course: true, applications: true },
    orderBy: { createdAt: "desc" },
  });
  const enriched = [];
  for (const l of listings) {
    const eligible = await hasValidCertification(user.karyawanId, l.courseId);
    const alreadyApplied = l.applications.some((a) => a.streamerKaryawanId === user.karyawanId);
    const filled = (l.applications.filter((a) => a.status === "PICKED").length ?? 0) >= l.quota;
    enriched.push({
      id: l.id,
      title: l.title,
      description: l.description,
      platform: l.platform,
      ratePerSesi: Number(l.ratePerSesi),
      quota: l.quota,
      client: l.client ? { id: l.client.id, namaClient: l.client.namaClient } : null,
      course: l.course ? { id: l.course.id, title: l.course.title } : null,
      eligible,
      alreadyApplied,
      filled,
    });
  }
  return enriched;
}

/** Streamer: apply to a listing (only if they hold a valid certification for it). */
export async function applyToListing(listingId: string, note?: string) {
  const user = await requireRole();
  if (!user.karyawanId) throw AppError.forbidden("Akun tidak terhubung ke karyawan");

  const listing = await db.marketplaceListing.findUnique({ where: { id: listingId } });
  if (!listing) throw AppError.notFound("Listing tidak ditemukan");
  if (listing.status !== "OPEN") throw AppError.conflict("Listing sudah ditutup");

  const eligible = await hasValidCertification(user.karyawanId, listing.courseId);
  if (!eligible) {
    throw AppError.forbidden("Anda belum tersertifikasi untuk proyek brand ini.");
  }

  const existing = await db.projectApplication.findUnique({
    where: { listingId_streamerKaryawanId: { listingId, streamerKaryawanId: user.karyawanId } },
  });
  if (existing) throw AppError.conflict("Anda sudah melamar proyek ini");

  return db.projectApplication.create({
    data: { listingId, streamerKaryawanId: user.karyawanId, note: note ?? null },
  });
}

/** Client/HR: list applications for a listing, pick/decline a streamer. */
export async function listApplications(listingId: string) {
  const user = await requireRole(...CLIENT_ROLES, ...HR_ROLES);
  const listing = await db.marketplaceListing.findFirst({
    where: { id: listingId, ...tenantWhere(user) },
  });
  if (!listing) throw AppError.notFound("Listing tidak ditemukan");
  return db.projectApplication.findMany({
    where: { listingId },
    include: { streamer: { select: { id: true, idKaryawan: true, namaLengkap: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function decideApplication(applicationId: string, decision: "PICKED" | "DECLINED") {
  const user = await requireRole(...CLIENT_ROLES, ...HR_ROLES);
  const app = await db.projectApplication.findUnique({
    where: { id: applicationId },
    include: { listing: true },
  });
  if (!app) throw AppError.notFound("Aplikasi tidak ditemukan");
  if (app.listing.tenantId !== user.tenantId) throw AppError.forbidden("Akses lintas-tenant ditolak");
  return db.projectApplication.update({
    where: { id: applicationId },
    data: { status: decision },
  });
}

// ---------- Client/HR: listing management ----------

export async function listListings() {
  const user = await requireRole(...CLIENT_ROLES, ...HR_ROLES);
  return db.marketplaceListing.findMany({
    where: { ...tenantWhere(user) },
    include: { client: true, course: true, applications: { include: { streamer: { select: { id: true, namaLengkap: true } } } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function createListing(input: ListingInput) {
  const user = await requireRole(...CLIENT_ROLES);
  const parsed = listingSchema.parse(input);
  if (!user.tenantId) throw AppError.forbidden("Akun tidak terkait tenant");
  return db.marketplaceListing.create({
    data: {
      tenantId: user.tenantId,
      clientId: parsed.clientId,
      courseId: parsed.courseId ?? null,
      title: parsed.title,
      description: parsed.description ?? null,
      platform: parsed.platform ?? null,
      ratePerSesi: parsed.ratePerSesi,
      quota: parsed.quota,
    },
  });
}

export async function setListingStatus(id: string, status: "OPEN" | "CLOSED" | "FILLED") {
  const user = await requireRole(...CLIENT_ROLES);
  const listing = await db.marketplaceListing.findFirst({ where: { id, ...tenantWhere(user) } });
  if (!listing) throw AppError.notFound("Listing tidak ditemukan");
  return db.marketplaceListing.update({ where: { id }, data: { status } });
}

// ---------- Certification directory ----------

export async function listCertifications() {
  const user = await requireRole(...HR_ROLES, ...CLIENT_ROLES);
  const now = new Date();
  const certs = await db.certificate.findMany({
    where: { ...tenantWhere(user), revokedAt: null },
    include: {
      streamer: { select: { id: true, idKaryawan: true, namaLengkap: true } },
      course: { select: { id: true, title: true } },
      client: { select: { id: true, namaClient: true } },
    },
    orderBy: { issuedAt: "desc" },
  });
  return certs.map((c) => ({
    id: c.id,
    code: c.code,
    issuedAt: c.issuedAt,
    validTo: c.validTo,
    active: c.validTo ? c.validTo > now : true,
    streamer: c.streamer,
    course: c.course,
    client: c.client,
  }));
}
