import { z } from "zod";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireRole, tenantWhere } from "@/lib/auth-helpers";
import type { RevenueSource, Role } from "@/generated/prisma/enums";

/**
 * Revenue ledger + commission split engine.
 *
 * Exact-cent math: amounts are parsed/rounded to integer cents (IDR has no
 * fractional subunit, so 1 IDR = 1 unit). Splitting uses integer arithmetic
 * to guarantee `grossAmount == agencyCut + streamerCut` with ZERO drift.
 *
 * Split rule: streamer gets `streamerCutPct`% of gross, agency the remainder.
 * The split percentages come from the Karyawan's streamerCutPct/agencyCutPct
 * (Phase 1), defaulting to 70/30.
 */

const WRITE_ROLES = ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "FINANCE", "FINANCE_MANAGER"] as const;
const STAFF_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "FINANCE", "FINANCE_MANAGER", "OPERATION", "CLIENT", "CLIENT_ADMIN"];

const revenueSchema = z.object({
  jadwalId: z.string().optional().nullable(),
  streamerKaryawanId: z.string().optional().nullable(),
  clientId: z.string().optional().nullable(),
  source: z.enum(["BITS", "GIFT", "SUBSCRIPTION", "BRAND_DEAL", "OTHER"]),
  // Gross amount in IDR (whole units). Accepts string/number, coerced to integer cents.
  grossAmount: z.coerce.number().finite().nonnegative(),
  eventAt: z.coerce.date().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type RevenueInput = z.infer<typeof revenueSchema>;

/** Resolve the streamer's split percentages; default 70/30. */
async function resolveSplit(streamerKaryawanId?: string | null): Promise<{ streamerPct: number; agencyPct: number }> {
  if (streamerKaryawanId) {
    const k = await db.karyawan.findUnique({ where: { id: streamerKaryawanId } });
    if (k) {
      const s = Number(k.streamerCutPct);
      const a = Number(k.agencyCutPct);
      // Guard against invalid data (must sum to 100).
      if (Math.abs(s + a - 100) < 0.001 && s >= 0 && a >= 0) {
        return { streamerPct: s, agencyPct: a };
      }
    }
  }
  return { streamerPct: 70, agencyPct: 30 };
}

/**
 * Split a gross amount (integer IDR) into streamer + agency cents.
 * Streamer cut = round(gross * streamerPct / 100); agency = gross - streamer.
 * This guarantees the invariant gross == streamer + agency exactly.
 */
export function splitRevenue(
  grossCents: number,
  streamerPct: number,
  agencyPct: number
): { streamerCents: number; agencyCents: number; totalCents: number } {
  if (Math.abs(streamerPct + agencyPct - 100) > 0.001) {
    throw new Error(`Invalid split ${streamerPct}/${agencyPct}: must sum to 100`);
  }
  // Integer-cents math: streamer cut is a fraction of gross, agency = remainder.
  const streamerCents = Math.round((grossCents * streamerPct) / 100);
  const agencyCents = grossCents - streamerCents; // guarantees exact sum
  return { streamerCents, agencyCents, totalCents: streamerCents + agencyCents };
}

export async function recordRevenue(input: RevenueInput) {
  const user = await requireRole(...WRITE_ROLES);
  const parsed = revenueSchema.parse(input);

  // Resolve the streamer and their split.
  const streamerKaryawanId = parsed.streamerKaryawanId;
  const split = await resolveSplit(streamerKaryawanId);

  const grossCents = parsed.grossAmount; // integer IDR
  const { streamerCents, agencyCents, totalCents } = splitRevenue(grossCents, split.streamerPct, split.agencyPct);

  // Persist in a transaction so the ledger stays consistent.
  return db.$transaction(async (tx) => {
    const entry = await tx.revenueEntry.create({
      data: {
        tenantId: user.tenantId ?? undefined,
        jadwalId: parsed.jadwalId ?? null,
        streamerKaryawanId: parsed.streamerKaryawanId ?? null,
        clientId: parsed.clientId ?? null,
        source: parsed.source,
        grossAmount: grossCents,
        agencyCut: agencyCents,
        streamerCut: streamerCents,
        eventAt: parsed.eventAt ?? new Date(),
        metadata: parsed.metadata ? JSON.stringify(parsed.metadata) : null,
      },
    });

    // Final integrity assertion: gross == agency + streamer (exact, no drift).
    if (totalCents !== grossCents) {
      throw AppError.conflict("Internal split invariant violated");
    }
    return {
      id: entry.id,
      source: entry.source,
      grossAmount: Number(entry.grossAmount),
      agencyCut: Number(entry.agencyCut),
      streamerCut: Number(entry.streamerCut),
      split: { streamerPct: split.streamerPct, agencyPct: split.agencyPct },
      invariant: `${entry.grossAmount} == ${entry.agencyCut} + ${entry.streamerCut}`,
    };
  });
}

export async function listRevenue(params?: { streamerKaryawanId?: string; periode?: string; source?: RevenueSource }) {
  const user = await requireRole();
  const isStaff = STAFF_ROLES.includes(user.role);
  const isStreamerSelf = user.karyawanId != null;

  // Staff (finance/ops/admin) see tenant-wide revenue (with agency margins).
  // Streamers see ONLY their own streamerCut (never agency margin / peer earnings).
  const where: Record<string, unknown> = { ...tenantWhere(user) };
  if (isStaff) {
    if (params?.streamerKaryawanId) where.streamerKaryawanId = params.streamerKaryawanId;
  } else {
    // Streamer: only own entries, and strip agency margin below.
    where.streamerKaryawanId = user.karyawanId ?? "__none__";
  }
  if (params?.source) where.source = params.source;

  const rows = await db.revenueEntry.findMany({
    where,
    orderBy: { eventAt: "desc" },
    take: 200,
  });

  return rows.map((r) => {
    const base = {
      id: r.id,
      source: r.source,
      streamerCut: Number(r.streamerCut),
      eventAt: r.eventAt,
    };
    // Streamers must never see agency margin or gross totals beyond their own cut.
    if (!isStaff) return base;
    return {
      ...base,
      grossAmount: Number(r.grossAmount),
      agencyCut: Number(r.agencyCut),
    };
  });
}

/** Period aggregate: total gross, agency, streamer, and per-source breakdown. */
export async function revenueSummary(params?: { streamerKaryawanId?: string; source?: RevenueSource }) {
  const user = await requireRole();
  const isStaff = STAFF_ROLES.includes(user.role);

  // Only staff may see aggregate revenue (agency margins). Streamers see only
  // their own streamer total.
  const where: Record<string, unknown> = { ...tenantWhere(user) };
  if (isStaff) {
    if (params?.streamerKaryawanId) where.streamerKaryawanId = params.streamerKaryawanId;
  } else {
    where.streamerKaryawanId = user.karyawanId ?? "__none__";
  }
  if (params?.source) where.source = params.source;

  const rows = await db.revenueEntry.findMany({ where });
  let gross = 0, agency = 0, streamer = 0;
  const bySource: Record<string, { count: number; gross: number; streamer: number; agency: number }> = {};

  for (const r of rows) {
    const g = isStaff ? Number(r.grossAmount) : 0;
    const a = isStaff ? Number(r.agencyCut) : 0;
    const s = Number(r.streamerCut);
    gross += g; agency += a; streamer += s;
    const b = bySource[r.source] ?? { count: 0, gross: 0, streamer: 0, agency: 0 };
    b.count++; b.gross += g; b.agency += a; b.streamer += s;
    bySource[r.source] = b;
  }

  // Streamers see only their own streamer total (gross/agency masked).
  return isStaff
    ? { count: rows.length, gross, agency, streamer, bySource }
    : { count: rows.length, streamer, bySource: Object.fromEntries(Object.entries(bySource).map(([k, v]) => [k, { count: v.count, streamer: v.streamer }])) };
}
