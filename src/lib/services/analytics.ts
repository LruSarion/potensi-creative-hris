import { db } from "@/lib/db";
import { requireRole, tenantWhere } from "@/lib/auth-helpers";
import { computeDurationMinutes } from "@/lib/schedule-rules";

/**
 * Analytics aggregate service.
 * All queries are tenant-scoped and period-bounded.
 */

export interface PeriodRange {
  start: Date;
  end: Date;
}

/** First day of a "Bulan YYYY" period (day 1..22 mapping) — inclusive window. */
export function periodRange(periode: string): PeriodRange {
  const match = /^(\w+) (\d{4})$/.exec(periode);
  if (!match) {
    // Fallback: current month
    const now = new Date();
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 1),
    };
  }
  const monthNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];
  const month = monthNames.indexOf(match[1]);
  const year = parseInt(match[2], 10);
  const start = new Date(year, month, 22); // period starts day 22
  const end = new Date(year, month + 1, 22);
  return { start, end };
}

/**
 * Session metrics for a tenant (optionally a client/streamer).
 * Returns count, total hours, and per-status breakdown.
 */
export async function sessionMetrics(params?: { clientId?: string; streamerKaryawanId?: string; periode?: string }) {
  const user = await requireRole();
  const where: Record<string, unknown> = { ...tenantWhere(user) };
  if (params?.clientId) where.clientId = params.clientId;
  if (params?.streamerKaryawanId) where.streamerKaryawanId = params.streamerKaryawanId;
  if (params?.periode) {
    const { start, end } = periodRange(params.periode);
    where.tanggal = { gte: start, lt: end };
  }

  const rows = await db.jadwal.findMany({ where, select: { jamMulaiLive: true, jamSelesaiLive: true, status: true } });
  let totalMinutes = 0;
  const byStatus: Record<string, number> = {};
  for (const r of rows) {
    totalMinutes += computeDurationMinutes(r.jamMulaiLive, r.jamSelesaiLive);
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  }
  return {
    count: rows.length,
    totalHours: Math.round((totalMinutes / 60) * 100) / 100,
    byStatus,
  };
}

/** Absensi summary per karyawan for a period. */
export async function absensiMetrics(params?: { karyawanId?: string; periode?: string }) {
  const user = await requireRole();
  const where: Record<string, unknown> = { ...tenantWhere(user) };
  if (params?.karyawanId) where.karyawanId = params.karyawanId;
  if (params?.periode) {
    const { start, end } = periodRange(params.periode);
    where.waktu = { gte: start, lt: end };
  }
  const rows = await db.absensi.findMany({ where, select: { karyawanId: true, tipe: true } });
  const checkIns = rows.filter((r) => r.tipe === "CHECK_IN").length;
  const checkOuts = rows.filter((r) => r.tipe === "CHECK_OUT").length;
  return { total: rows.length, checkIns, checkOuts };
}

/** Simple count helper (metric primitives for dashboards). */
export async function countBy(tenantId: string, model: "jadwal" | "absensi" | "produk" | "payroll", filter?: Record<string, unknown>) {
  await requireRole();
  const where = { tenantId, ...filter } as Record<string, unknown>;
  const count =
    model === "jadwal" ? await db.jadwal.count({ where })
    : model === "absensi" ? await db.absensi.count({ where })
    : model === "produk" ? await db.produk.count({ where })
    : await db.payroll.count({ where });
  return { model, count };
}

/** Convert an array of objects to CSV text. */
export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.map(esc).join(",")];
  for (const row of rows) lines.push(row.map(esc).join(","));
  return lines.join("\n");
}

/** Dashboard counts for a tenant (used by admin/operation dashboards). */
export async function tenantDashboard() {
  const user = await requireRole();
  const where = tenantWhere(user);
  const [jadwal, absensi, karyawan, clients, produk] = await Promise.all([
    db.jadwal.count({ where }),
    db.absensi.count({ where }),
    db.karyawan.count({ where }),
    db.client.count({ where }),
    db.produk.count({ where }),
  ]);
  return { jadwal, absensi, karyawan, clients, produk };
}

/**
 * Schedule rollups matching the client's Sheet 1 (ID_HYBRID_LIVE):
 *  - per-studio total duration (Timoho, Berbah, ...) + total daily hours
 *  - per-streamer session count + total duration (COUNTIF/SUMIF equivalent)
 *  - per-platform total duration (SUMIF equivalent)
 * Optionally period-bounded.
 */
export async function scheduleRollup(params?: { tanggal?: string; periode?: string }) {
  const user = await requireRole();
  const where: Record<string, unknown> = { ...tenantWhere(user) };
  if (params?.tanggal) where.tanggal = new Date(params.tanggal);
  if (params?.periode) {
    const { start, end } = periodRange(params.periode);
    where.tanggal = { gte: start, lt: end };
  }

  const rows = await db.jadwal.findMany({
    where,
    select: {
      cabangStudio: true,
      nomorStudio: true,
      platform: true,
      streamerKaryawanId: true,
      jamMulaiLive: true,
      jamSelesaiLive: true,
      streamerKaryawan: { select: { namaLengkap: true, idKaryawan: true } },
    },
  });

  const byStudio: Record<string, { sessions: number; hours: number }> = {};
  const byStreamer: Record<string, { idKaryawan: string | null; namaLengkap: string | null; sessions: number; hours: number }> = {};
  const byPlatform: Record<string, { sessions: number; hours: number }> = {};
  let totalMinutes = 0;

  for (const r of rows) {
    const minutes = computeDurationMinutes(r.jamMulaiLive, r.jamSelesaiLive);
    totalMinutes += minutes;

    const studio = `${r.cabangStudio ?? ""} ${r.nomorStudio ?? ""}`.trim() || "Tanpa Studio";
    const s = byStudio[studio] ?? { sessions: 0, hours: 0 };
    s.sessions++; s.hours += minutes;
    byStudio[studio] = s;

    const platform = r.platform ?? "Lainnya";
    const p = byPlatform[platform] ?? { sessions: 0, hours: 0 };
    p.sessions++; p.hours += minutes;
    byPlatform[platform] = p;

    const skId = r.streamerKaryawanId;
    if (skId) {
      const st = byStreamer[skId] ?? {
        idKaryawan: r.streamerKaryawan?.idKaryawan ?? null,
        namaLengkap: r.streamerKaryawan?.namaLengkap ?? null,
        sessions: 0,
        hours: 0,
      };
      st.sessions++; st.hours += minutes;
      byStreamer[skId] = st;
    }
  }

  const hours = (m: number) => Math.round((m / 60) * 100) / 100;

  return {
    totalSessions: rows.length,
    totalHours: hours(totalMinutes),
    byStudio: Object.fromEntries(Object.entries(byStudio).map(([k, v]) => [k, { sessions: v.sessions, hours: hours(v.hours) }])),
    byStreamer: Object.fromEntries(Object.entries(byStreamer).map(([k, v]) => [k, { idKaryawan: v.idKaryawan, namaLengkap: v.namaLengkap, sessions: v.sessions, hours: hours(v.hours) }])),
    byPlatform: Object.fromEntries(Object.entries(byPlatform).map(([k, v]) => [k, { sessions: v.sessions, hours: hours(v.hours) }])),
  };
}

/**
 * GMV Analytics: aggregate reported GMV from absensi CHECK_OUT records.
 * Groups by client, platform, and streamer.
 */
export async function gmvAnalytics(params?: { periode?: string }) {
  const user = await requireRole();
  const where: Record<string, unknown> = { ...tenantWhere(user), tipe: "CHECK_OUT" };
  if (params?.periode) {
    const { start, end } = periodRange(params.periode);
    where.waktu = { gte: start, lt: end };
  }

  const rows = await db.absensi.findMany({
    where,
    select: {
      reportedGmv: true,
      karyawan: { select: { namaLengkap: true, idKaryawan: true } },
      jadwal: {
        select: {
          platform: true,
          client: { select: { namaClient: true } },
        },
      },
    },
  });

  const byClient: Record<string, { namaClient: string; totalGmv: number; sessions: number }> = {};
  const byPlatform: Record<string, { totalGmv: number; sessions: number }> = {};
  const byStreamer: Record<string, { namaLengkap: string; idKaryawan: string; totalGmv: number; sessions: number }> = {};
  let totalGmv = 0;

  for (const r of rows) {
    const gmv = Number(r.reportedGmv ?? 0);
    totalGmv += gmv;

    // By client
    const clientName = r.jadwal?.client?.namaClient ?? "Tanpa Klien";
    const c = byClient[clientName] ?? { namaClient: clientName, totalGmv: 0, sessions: 0 };
    c.totalGmv += gmv; c.sessions++;
    byClient[clientName] = c;

    // By platform
    const platform = r.jadwal?.platform ?? "Lainnya";
    const p = byPlatform[platform] ?? { totalGmv: 0, sessions: 0 };
    p.totalGmv += gmv; p.sessions++;
    byPlatform[platform] = p;

    // By streamer
    const nama = r.karyawan?.namaLengkap ?? "—";
    const s = byStreamer[nama] ?? { namaLengkap: nama, idKaryawan: r.karyawan?.idKaryawan ?? "—", totalGmv: 0, sessions: 0 };
    s.totalGmv += gmv; s.sessions++;
    byStreamer[nama] = s;
  }

  return {
    totalGmv,
    totalSessions: rows.length,
    byClient: Object.values(byClient).sort((a, b) => b.totalGmv - a.totalGmv),
    byPlatform: Object.values(Object.entries(byPlatform).reduce<Record<string, { platform: string; totalGmv: number; sessions: number }>>((acc, [k, v]) => {
      acc[k] = { platform: k, ...v };
      return acc;
    }, {})).sort((a, b) => b.totalGmv - a.totalGmv),
    byStreamer: Object.values(byStreamer).sort((a, b) => b.totalGmv - a.totalGmv).slice(0, 20),
  };
}