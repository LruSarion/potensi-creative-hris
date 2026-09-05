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
 * for the given course/brand client. A listing with NO courseId (no cert
 * requirement) is eligible for every streamer.
 */
export async function hasValidCertification(streamerKaryawanId: string, courseId: string | null | undefined): Promise<boolean> {
  if (!courseId) return true;
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

/** Streamer-facing: list OPEN listings (across tenants) the streamer can apply to. */
export async function listEligibleListings() {
  const user = await requireRole();
  if (!user.karyawanId) return [];
  // Cross-tenant marketplace: streamers see ALL open listings (any client brand),
  // gated by their certification below.
  const listings = await db.marketplaceListing.findMany({
    where: { status: "OPEN" },
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

  // If already decided, prevent re-decision.
  if (app.status !== "APPLIED") {
    throw AppError.conflict(`Aplikasi sudah berstatus ${app.status}`);
  }

  const updated = await db.$transaction(async (tx) => {
    const res = await tx.projectApplication.update({
      where: { id: applicationId },
      data: { status: decision },
    });
    // When quota is reached, auto-mark the listing FILLED so it stops accepting.
    if (decision === "PICKED") {
      const pickedCount = await tx.projectApplication.count({
        where: { listingId: app.listingId, status: "PICKED" },
      });
      if (pickedCount >= app.listing.quota) {
        await tx.marketplaceListing.update({
          where: { id: app.listingId },
          data: { status: "FILLED" },
        });
      }
      // Assign the picked streamer to the linked jadwal so the approved
      // schedule actually has a host (closes the client->streamer dataflow).
      if (app.listing.jadwalId) {
        const linked = await tx.jadwal.findUnique({ where: { id: app.listing.jadwalId } });
        if (linked) {
          await tx.jadwal.update({
            where: { id: app.listing.jadwalId },
            data: { streamerKaryawanId: app.streamerKaryawanId },
          });
        }
      }
    }
    return res;
  });

  return updated;
}

// ---------- Keranjang / History Market (ref-deploy sub-tab) ----------

const KERANJANG_EXPIRE_MS = 15 * 60 * 1000;

async function expireStaleBookingsForUser(karyawanId: string) {
  const cutoff = new Date(Date.now() - KERANJANG_EXPIRE_MS);
  // Mark stale APPLIED as DECLINED (expired) so they move to history
  await db.projectApplication.updateMany({
    where: { streamerKaryawanId: karyawanId, status: "APPLIED", createdAt: { lt: cutoff } },
    data: { status: "DECLINED" },
  });
}

/** Streamer: list keranjang (APPLIED = BOOKED) — buku 15 menit sebelum expired */
export async function getKeranjangJobs(hostKaryawanId?: string) {
  const user = await requireRole();
  const isAdmin = ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION"].includes(user.role);
  const targetId = isAdmin && hostKaryawanId ? hostKaryawanId : user.karyawanId!;
  if (!targetId) return [];
  // Auto-expire stale before returning so timer matches DB
  await expireStaleBookingsForUser(targetId);
  const apps = await db.projectApplication.findMany({
    where: { streamerKaryawanId: targetId, status: "APPLIED" },
    include: {
      listing: {
        include: {
          client: true,
          jadwal: { select: { id: true, idJadwal: true, tanggal: true, jamMulaiLive: true, jamSelesaiLive: true, cabangStudio: true, nomorStudio: true, judulLive: true, platform: true } },
        },
      },
      streamer: { select: { id: true, idKaryawan: true, namaLengkap: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return apps.map((a) => ({
    id: a.id,
    listingId: a.listingId,
    status: a.status,
    note: a.note,
    createdAt: a.createdAt,
    // WAKTU_BOOKING in ref = booking timestamp
    waktuBooking: a.createdAt,
    expireAt: new Date(new Date(a.createdAt).getTime() + KERANJANG_EXPIRE_MS),
    listing: a.listing
      ? {
          id: a.listing.id,
          title: a.listing.title,
          platform: a.listing.platform,
          ratePerSesi: Number(a.listing.ratePerSesi),
          quota: a.listing.quota,
          status: a.listing.status,
          client: a.listing.client ? { id: a.listing.client.id, namaClient: a.listing.client.namaClient } : null,
          jadwal: a.listing.jadwal,
        }
      : null,
    streamer: a.streamer,
  }));
}

/** Streamer: history market (PICKED/DECLINED — termasuk expired) */
export async function getHistoryMarketJobs(hostKaryawanId?: string) {
  const user = await requireRole();
  const isAdmin = ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION"].includes(user.role);
  const targetId = isAdmin && hostKaryawanId ? hostKaryawanId : user.karyawanId!;
  if (!targetId) return [];
  const apps = await db.projectApplication.findMany({
    where: { streamerKaryawanId: targetId, status: { in: ["PICKED", "DECLINED"] } },
    include: {
      listing: {
        include: {
          client: true,
          jadwal: { select: { id: true, idJadwal: true, tanggal: true, jamMulaiLive: true, jamSelesaiLive: true, cabangStudio: true, nomorStudio: true, judulLive: true, platform: true, status: true } },
        },
      },
      streamer: { select: { id: true, idKaryawan: true, namaLengkap: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  // Limit 36 like ref
  return apps.slice(0, 36).map((a) => ({
    id: a.id,
    listingId: a.listingId,
    status: a.status,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    listing: a.listing
      ? {
          id: a.listing.id,
          title: a.listing.title,
          platform: a.listing.platform,
          status: a.listing.status,
          client: a.listing.client ? { id: a.listing.client.id, namaClient: a.listing.client.namaClient } : null,
          jadwal: a.listing.jadwal,
        }
      : null,
    streamer: a.streamer,
  }));
}

/** Streamer: ambil jadwal marketplace (BOOKED) — alias takeMarketplaceJob */
export async function takeMarketplaceJob(listingId: string) {
  // Reuse eligibility & quota checks from applyToListing
  return applyToListing(listingId);
}

/** Streamer: batal ambil (hapus BOOKED) */
export async function cancelMarketplaceJob(listingId: string) {
  const user = await requireRole();
  if (!user.karyawanId) throw AppError.forbidden("Akun tidak terhubung ke karyawan");
  const app = await db.projectApplication.findUnique({
    where: { listingId_streamerKaryawanId: { listingId, streamerKaryawanId: user.karyawanId } },
  });
  if (!app) throw AppError.notFound("Booking tidak ditemukan");
  if (app.status !== "APPLIED") throw AppError.conflict(`Booking sudah berstatus ${app.status}, tidak bisa dibatalkan`);
  await db.projectApplication.delete({ where: { id: app.id } });
  return { success: true, listingId };
}

/** Streamer: finalisasi massal keranjang → JADWAL FIX (PICKED) */
export async function finalizeKeranjangMassal(listingIds: string[]) {
  const user = await requireRole();
  if (!user.karyawanId) throw AppError.forbidden("Akun tidak terhubung ke karyawan");
  if (!Array.isArray(listingIds) || listingIds.length === 0) throw AppError.badRequest("Tidak ada jadwal terpilih");
  // Expire stale first so expired ids cannot be finalized
  await expireStaleBookingsForUser(user.karyawanId);

  const results: { listingId: string; status: string }[] = [];
  for (const listingId of listingIds) {
    const app = await db.projectApplication.findUnique({
      where: { listingId_streamerKaryawanId: { listingId, streamerKaryawanId: user.karyawanId } },
      include: { listing: true },
    });
    if (!app) throw AppError.notFound(`Booking ${listingId} tidak ditemukan`);
    if (app.status !== "APPLIED") throw AppError.conflict(`Booking ${listingId} sudah berstatus ${app.status}`);
    // Transaction per listing (quota + jadwal assignment)
    await db.$transaction(async (tx) => {
      await tx.projectApplication.update({ where: { id: app.id }, data: { status: "PICKED" } });
      const pickedCount = await tx.projectApplication.count({ where: { listingId, status: "PICKED" } });
      if (pickedCount >= app.listing.quota) {
        await tx.marketplaceListing.update({ where: { id: listingId }, data: { status: "FILLED" } });
      }
      if (app.listing.jadwalId) {
        const linked = await tx.jadwal.findUnique({ where: { id: app.listing.jadwalId } });
        if (linked && !linked.streamerKaryawanId) {
          await tx.jadwal.update({ where: { id: app.listing.jadwalId }, data: { streamerKaryawanId: user.karyawanId! } });
        }
      }
    });
    results.push({ listingId, status: "PICKED" });
  }
  return { success: true, finalized: results.length, results };
}

// ---------- Client/HR: listing management ----------

/** HR/ops pipeline view: every listing with its applications and the linked
 *  jadwal's approval status, so operations can manage the whole flow. */
export async function listPipeline() {
  const user = await requireRole(...HR_ROLES, ...CLIENT_ROLES);
  const listings = await db.marketplaceListing.findMany({
    where: { ...tenantWhere(user) },
    include: {
      client: true,
      course: true,
      jadwal: { select: { id: true, idJadwal: true, status: true, streamerKaryawanId: true } },
      applications: {
        include: { streamer: { select: { id: true, idKaryawan: true, namaLengkap: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return listings.map((l) => ({
    id: l.id,
    title: l.title,
    platform: l.platform,
    status: l.status,
    client: l.client ? { id: l.client.id, namaClient: l.client.namaClient } : null,
    jadwal: l.jadwal
      ? {
          id: l.jadwal.id,
          idJadwal: l.jadwal.idJadwal,
          status: l.jadwal.status,
          hasHost: !!l.jadwal.streamerKaryawanId,
        }
      : null,
    applications: l.applications.map((a) => ({
      id: a.id,
      status: a.status,
      streamer: a.streamer ? { id: a.streamer.id, namaLengkap: a.streamer.namaLengkap } : null,
    })),
  }));
}

export async function listListings() {
  const user = await requireRole(...CLIENT_ROLES, ...HR_ROLES);
  return db.marketplaceListing.findMany({
    where: { ...tenantWhere(user) },
    include: {
      client: true,
      course: true,
      applications: {
        include: { streamer: { select: { id: true, idKaryawan: true, namaLengkap: true, email: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
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

// ---------- Client shortlist ----------

/** Resolve the client record for the current user (needed for shortlist FK). */
async function resolveClientRecord() {
  const user = await requireRole(...CLIENT_ROLES);
  if (!user.tenantId) return null;
  return db.client.findFirst({ where: { tenantId: user.tenantId } });
}

/** List the current client's shortlisted streamers. */
export async function listShortlist() {
  const user = await requireRole(...CLIENT_ROLES);
  if (!user.tenantId) return [];
  const client = await db.client.findFirst({ where: { tenantId: user.tenantId } });
  if (!client) return [];
  const rows = await db.clientShortlist.findMany({
    where: { clientId: client.id },
    include: { streamer: { include: { streamerProfile: true } } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    streamerId: r.streamerKaryawanId,
    idKaryawan: r.streamer.idKaryawan,
    namaLengkap: r.streamer.namaLengkap,
    photoUrl: r.streamer.streamerProfile?.photoUrl ?? null,
    rating: Number(r.streamer.streamerProfile?.rating ?? 0),
  }));
}

/** Toggle a streamer in/out of the client's shortlist. */
export async function toggleShortlist(streamerKaryawanId: string): Promise<{ shortlisted: boolean }> {
  const user = await requireRole(...CLIENT_ROLES);
  if (!user.tenantId) throw AppError.forbidden("Akun tidak terkait tenant");
  const client = await db.client.findFirst({ where: { tenantId: user.tenantId } });
  if (!client) throw AppError.notFound("Klien tidak ditemukan");

  const existing = await db.clientShortlist.findUnique({
    where: { clientId_streamerKaryawanId: { clientId: client.id, streamerKaryawanId } },
  });
  if (existing) {
    await db.clientShortlist.delete({ where: { id: existing.id } });
    return { shortlisted: false };
  }
  await db.clientShortlist.create({
    data: { clientId: client.id, streamerKaryawanId },
  });
  return { shortlisted: true };
}
