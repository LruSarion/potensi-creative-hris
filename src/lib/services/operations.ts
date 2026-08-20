import { z } from "zod";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requirePermission, tenantWhere } from "@/lib/auth-helpers";
import { validateTokenJeda, computeDurationMinutes } from "@/lib/schedule-rules";
import { createNotification } from "@/lib/services/integration";
import type { Role, SessionLiveState, IncidentSeverity, IncidentStatus } from "@/generated/prisma/enums";

// ---------- Session lifecycle (T8) ----------

export const ALLOWED_TRANSITIONS: Partial<Record<SessionLiveState, SessionLiveState[]>> = {
  SCHEDULED: ["LIVE", "REVIEW", "CLOSED"],
  LIVE: ["REVIEW", "CLOSED"],
  REVIEW: ["CLOSED", "LIVE"],
  CLOSED: [],
};

export async function transitionSession(jadwalId: string, toState: SessionLiveState, note?: string) {
  const user = await requirePermission("operations:write");
  const jadwal = await db.jadwal.findFirst({ where: { id: jadwalId, ...tenantWhere(user) } });
  if (!jadwal) throw AppError.notFound("Jadwal tidak ditemukan");

  const current = jadwal.liveState;
  const allowed = ALLOWED_TRANSITIONS[current] ?? [];
  if (!allowed.includes(toState)) {
    throw AppError.conflict(`Transisi ${current} -> ${toState} tidak diizinkan`);
  }

  await db.jadwal.update({ where: { id: jadwalId }, data: { liveState: toState } });
  return db.sessionStateLog.create({
    data: {
      tenantId: user.tenantId || undefined,
      jadwalId,
      fromState: current,
      toState,
      changedById: user.id,
      note: note ?? null,
    },
  });
}

export async function listSessionLogs(jadwalId: string) {
  const user = await requirePermission("operations:read");
  return db.sessionStateLog.findMany({
    where: { jadwalId, ...tenantWhere(user) },
    orderBy: { createdAt: "asc" },
  });
}

// ---------- Incident ticketing (T9) ----------

const incidentSchema = z.object({
  jadwalId: z.string().optional().nullable(),
  streamerKaryawanId: z.string().optional().nullable(),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
});

export type IncidentInput = z.infer<typeof incidentSchema>;

/** SLA (minutes) per severity. 0 = none. */
export const INCIDENT_SLA_MIN: Record<IncidentSeverity, number> = {
  LOW: 0,
  MEDIUM: 4 * 60, // 4h
  HIGH: 60,
  CRITICAL: 15,
};

export async function createIncident(input: IncidentInput) {
  const user = await requirePermission("operations:write");
  const parsed = incidentSchema.parse(input);
  const inc = await db.incident.create({
    data: {
      tenantId: user.tenantId || undefined,
      jadwalId: parsed.jadwalId ?? null,
      streamerKaryawanId: parsed.streamerKaryawanId ?? null,
      title: parsed.title,
      description: parsed.description ?? null,
      severity: parsed.severity,
      reportedById: user.id,
    },
  });
  // Notify ops leads / assignees of the new incident.
  await createNotification({
    targetKaryawanId: parsed.streamerKaryawanId ?? null,
    title: `Insiden baru [${parsed.severity}]`,
    message: parsed.title,
    link: "/portal/operation",
  }).catch(() => undefined);
  return inc;
}

/** Calculate SLA state: overdue when a severitied incident exceeds its SLA and is unresolved. */
export function slaLate(createdAt: Date, severity: IncidentSeverity, status: IncidentStatus): boolean {
  const sla = INCIDENT_SLA_MIN[severity];
  if (!sla) return false;
  if (status === "RESOLVED" || status === "CLOSED") return false;
  return Date.now() - createdAt.getTime() > sla * 60 * 1000;
}

function incidentView(i: {
  createdAt: Date;
  severity: IncidentSeverity;
  status: IncidentStatus;
}) {
  return { slaLate: slaLate(i.createdAt, i.severity, i.status) };
}

export async function listIncidents(status?: IncidentStatus, severity?: IncidentSeverity) {
  const user = await requirePermission("incident:read");
  const rows = await db.incident.findMany({
    where: {
      ...tenantWhere(user),
      ...(status ? { status } : {}),
      ...(severity ? { severity } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { jadwal: { select: { idJadwal: true } }, streamer: { select: { namaLengkap: true } }, assignee: { select: { namaLengkap: true } } },
  });
  return rows.map((r) => ({ ...r, slaLate: incidentView(r).slaLate }));
}

export async function updateIncidentStatus(id: string, status: IncidentStatus, assigneeId?: string) {
  const user = await requirePermission("operations:write");
  const inc = await db.incident.findFirst({ where: { id, ...tenantWhere(user) } });
  if (!inc) throw AppError.notFound("Insiden tidak ditemukan");
  const updated = await db.incident.update({
    where: { id },
    data: { status, ...(assigneeId ? { assigneeId } : {}) },
  });
  if (assigneeId) {
    await createNotification({
      targetKaryawanId: assigneeId,
      title: "Insiden ditugaskan ke Anda",
      message: inc.title,
      link: "/portal/operation",
    }).catch(() => undefined);
  }
  return updated;
}

export async function escalateIncident(id: string) {
  const user = await requirePermission("operations:write");
  const inc = await db.incident.findFirst({ where: { id, ...tenantWhere(user) } });
  if (!inc) throw AppError.notFound("Insiden tidak ditemukan");
  const updated = await db.incident.update({ where: { id }, data: { status: "ESCALATED" } });
  await createNotification({
    targetKaryawanId: inc.assigneeId ?? inc.streamerKaryawanId ?? null,
    title: "Insiden dieskalasi",
    message: `${inc.title} (${inc.severity}) melewati SLA dan kini ESCALATED`,
    link: "/portal/operation",
  }).catch(() => undefined);
  return updated;
}

// ---------- Roster (T7) ----------

const rosterSchema = z.object({
  karyawanId: z.string().min(1),
  tanggal: z.string().min(1),
  jamMulai: z.string().min(1),
  jamSelesai: z.string().min(1),
  role: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});

export type RosterInput = z.infer<typeof rosterSchema>;

/**
 * Roster conflict guard — checked on create so we never roster someone
 * who is on leave (LiburStreamer) or whose shifts overlap in time.
 */
async function assertRosterOk(user: { tenantId: string; role: Role }, karyawanId: string, tanggal: Date, jamMulai: Date, jamSelesai: Date, excludeId?: string) {
  if (jamSelesai <= jamMulai) throw AppError.badRequest("jamSelesai harus setelah jamMulai");

  // Blocker 1: employee on leave that day.
  const onLeave = await db.liburStreamer.findFirst({
    where: { karyawanId, tanggal: { gte: startOfDay(tanggal), lt: addDays(startOfDay(tanggal), 1) }, ...tenantWhere(user) },
  });
  if (onLeave) throw AppError.conflict("Karyawan sedang cuti/libur pada tanggal tersebut");

  // Blocker 2: overlapping roster shifts for the same day.
  const overlaps = await db.rosterShift.findMany({
    where: { karyawanId, tanggal: { gte: startOfDay(tanggal), lt: addDays(startOfDay(tanggal), 1) }, status: "ACTIVE", ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { jamMulai: true, jamSelesai: true },
  });
  for (const o of overlaps) {
    if (jamMulai < o.jamSelesai && o.jamMulai < jamSelesai) {
      throw AppError.conflict("Shift bentrok dengan shift lain pada hari yang sama");
    }
  }
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export async function createRosterShift(input: RosterInput) {
  const user = await requirePermission("operations:write");
  const parsed = rosterSchema.parse(input);
  const tanggal = new Date(parsed.tanggal);
  const jamMulai = new Date(parsed.jamMulai);
  const jamSelesai = new Date(parsed.jamSelesai);
  if (!user.tenantId) throw AppError.forbidden("Akun tidak terkait tenant");
  await assertRosterOk(user, parsed.karyawanId, tanggal, jamMulai, jamSelesai);
  return db.rosterShift.create({
    data: {
      tenantId: user.tenantId,
      karyawanId: parsed.karyawanId,
      tanggal,
      jamMulai,
      jamSelesai,
      role: parsed.role ?? null,
      note: parsed.note ?? null,
    },
  });
}

export async function listRoster(params?: { karyawanId?: string; tanggal?: string }) {
  const user = await requirePermission("operations:read");
  return db.rosterShift.findMany({
    where: {
      ...tenantWhere(user),
      ...(params?.karyawanId ? { karyawanId: params.karyawanId } : {}),
      ...(params?.tanggal ? { tanggal: { gte: startOfDay(new Date(params.tanggal)), lt: addDays(startOfDay(new Date(params.tanggal)), 1) } } : {}),
    },
    orderBy: { tanggal: "asc" },
    include: { karyawan: true },
  });
}

export async function cancelRosterShift(id: string) {
  const user = await requirePermission("operations:write");
  const row = await db.rosterShift.findFirst({ where: { id, ...tenantWhere(user) } });
  if (!row) throw AppError.notFound("Shift tidak ditemukan");
  return db.rosterShift.update({ where: { id }, data: { status: "CANCELLED" } });
}

// ---------- Live session status board (T10 data) ----------

export async function liveBoard(params?: { status?: SessionLiveState | "OVERDUE"; date?: string }) {
  const user = await requirePermission("operations:read");
  const ref = params?.date ? startOfDay(new Date(params.date)) : startOfDay(new Date());
  const from = ref;
  const to = addDays(ref, 7); // show current day + next 7 days

  const rows = await db.jadwal.findMany({
    where: {
      ...tenantWhere(user),
      tanggal: { gte: from, lt: to },
    },
    orderBy: [{ tanggal: "asc" }, { jamMulaiLive: "asc" }],
    select: {
      id: true,
      idJadwal: true,
      tanggal: true,
      platform: true,
      jamMulaiLive: true,
      jamSelesaiLive: true,
      status: true,
      liveState: true,
      streamerKaryawan: { select: { namaLengkap: true, idKaryawan: true } },
      hostKaryawan: { select: { namaLengkap: true } },
      client: { select: { namaClient: true } },
    },
  });

  const now = Date.now();
  // Display state: prefer the real liveState, but auto-derive LIVE/OVERDUE from the clock.
  const board = rows.map((j) => {
    const s = j.liveState;
    let display: string = s;
    if (s === "SCHEDULED") {
      const start = j.jamMulaiLive.getTime();
      const end = j.jamSelesaiLive.getTime();
      if (now >= start && now <= end) display = "LIVE";
      else if (now > end) display = "OVERDUE";
    }
    const durMin = computeDurationMinutes(j.jamMulaiLive, j.jamSelesaiLive);
    return { ...j, displayState: display, durationMin: durMin };
  });

  const filtered = params?.status ? board.filter((r) => r.displayState === params.status) : board;
  return filtered;
}

// ---------- Batch conflict re-check (T11) ----------

/** Re-validate token-jeda + roster overlap for a streamer's given day. */
export async function recheckBatchConflicts(karyawanId: string, tanggal: Date) {
  const user = await requirePermission("operations:write");
  const dayStart = startOfDay(tanggal);
  const dayEnd = addDays(dayStart, 1);

  const rows = await db.jadwal.findMany({
    where: { tenantId: user.role === "SUPER_ADMIN" ? undefined : user.tenantId || undefined, streamerKaryawanId: karyawanId, tanggal: { gte: dayStart, lt: dayEnd } },
    orderBy: { jamMulaiLive: "asc" },
  });

  const conflicts: { idJadwal: string; reason: string }[] = [];
  for (let i = 0; i < rows.length; i++) {
    const others = rows.filter((_, idx) => idx !== i).map((r) => ({ start: r.jamMulaiLive, end: r.jamSelesaiLive }));
    if (validateTokenJeda(rows[i].jamMulaiLive, others) === "TIDAK") {
      conflicts.push({ idJadwal: rows[i].idJadwal, reason: "Bentrok jeda token (30 menit)" });
    }
  }

  // Also flag overlapping roster shifts for the day.
  const shifts = await db.rosterShift.findMany({
    where: { karyawanId, tanggal: { gte: dayStart, lt: dayEnd }, status: "ACTIVE" },
    select: { id: true, jamMulai: true, jamSelesai: true },
  });
  for (let i = 0; i < shifts.length; i++) {
    for (let j = i + 1; j < shifts.length; j++) {
      if (shifts[i].jamMulai < shifts[j].jamSelesai && shifts[j].jamMulai < shifts[i].jamSelesai) {
        conflicts.push({ idJadwal: `roster:${shifts[i].id}`, reason: "Shift roster saling bentrok" });
      }
    }
  }

  return { checked: rows.length, conflicts, ok: conflicts.length === 0 };
}
