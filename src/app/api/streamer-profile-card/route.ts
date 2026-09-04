import { apiHandler } from "@/lib/api-handler";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";

export const GET = apiHandler(async (req: Request) => {
  const user = await getCurrentUser();
  const url = new URL(req.url);
  const requestedKaryawanId = url.searchParams.get("karyawanId") || url.searchParams.get("id");

  let targetKaryawanId = requestedKaryawanId;

  // Streamer role can only view their own profile
  if (user?.role === "STREAMER") {
    targetKaryawanId = user.karyawanId;
    if (!targetKaryawanId && user.email) {
      const k = await db.karyawan.findFirst({ where: { email: user.email } });
      targetKaryawanId = k?.id ?? null;
    }
  } else if (!targetKaryawanId) {
    // If not specified, use the logged-in user's karyawan ID or email or first streamer
    if (user?.karyawanId) {
      targetKaryawanId = user.karyawanId;
    } else if (user?.email) {
      const k = await db.karyawan.findFirst({ where: { email: user.email } });
      targetKaryawanId = k?.id ?? null;
    }
    if (!targetKaryawanId) {
      const firstStreamer = await db.karyawan.findFirst({
        where: {
          OR: [
            { jabatan: { contains: "STREAMER", mode: "insensitive" } },
            { jabatan: { contains: "HOST", mode: "insensitive" } },
            { idKaryawan: { startsWith: "HST" } },
            { idKaryawan: { startsWith: "PCS" } },
          ],
        },
      });
      targetKaryawanId = firstStreamer?.id ?? null;
    }
  }

  if (!targetKaryawanId) {
    return {
      karyawan: null,
      message: "Data streamer tidak ditemukan",
    };
  }

  const karyawan = await db.karyawan.findFirst({
    where: {
      OR: [
        { id: targetKaryawanId },
        { idKaryawan: targetKaryawanId },
      ],
    },
    include: { user: true, streamerProfile: true },
  });

  if (!karyawan) {
    return {
      karyawan: null,
      message: "Karyawan tidak ditemukan",
    };
  }

  const actualKaryawanId = karyawan.id;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];
  const currentMonthLabel = `${months[now.getMonth()]} ${now.getFullYear()}`;
  const prevMonthLabel = `${months[(now.getMonth() + 11) % 12]} ${now.getFullYear()}`;

  const [
    jadwalBulanIni,
    jadwalBatal,
    absensiBulanIni,
    absensiBulanLalu,
    qcViolations,
    incidents,
    tieringList,
    penilaianBulanLalu,
    revenueCurrentMonth,
    revenuePrevMonth,
  ] = await Promise.all([
    db.jadwal.findMany({
      where: {
        streamerKaryawanId: actualKaryawanId,
        tanggal: { gte: startOfMonth, lt: endOfMonth },
        status: { in: ["SELESAI", "TERJADWAL", "APPROVED"] },
      },
    }),
    db.jadwal.findMany({
      where: {
        streamerKaryawanId: actualKaryawanId,
        tanggal: { gte: startOfMonth, lt: endOfMonth },
        status: { in: ["DIBATALKAN", "REJECTED"] },
      },
    }),
    db.absensi.findMany({
      where: {
        karyawanId: actualKaryawanId,
        waktu: { gte: startOfMonth, lt: endOfMonth },
      },
    }),
    db.absensi.findMany({
      where: {
        karyawanId: actualKaryawanId,
        waktu: { gte: startOfPrevMonth, lt: startOfMonth },
      },
    }),
    db.qcViolation.findMany({
      where: { streamerKaryawanId: actualKaryawanId },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    db.incident.findMany({
      where: { streamerKaryawanId: actualKaryawanId },
      include: { category: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    db.tiering.findMany({ orderBy: { jamMinimal: "asc" } }),
    db.penilaianSDM.findFirst({
      where: { karyawanId: actualKaryawanId },
      orderBy: { createdAt: "desc" },
    }),
    db.revenueEntry.findMany({
      where: {
        streamerKaryawanId: actualKaryawanId,
        eventAt: { gte: startOfMonth, lt: endOfMonth },
      },
      select: { grossAmount: true },
    }),
    db.revenueEntry.findMany({
      where: {
        streamerKaryawanId: actualKaryawanId,
        eventAt: { gte: startOfPrevMonth, lt: startOfMonth },
      },
      select: { grossAmount: true },
    }),
  ]);

  // Calculate total live hours from jadwal
  const totalMinutes = jadwalBulanIni.reduce((s, j) => {
    if (j.durationSec && j.durationSec > 0) return s + j.durationSec / 60;
    if (j.jamMulaiLive && j.jamSelesaiLive) {
      const d1 = new Date(j.jamMulaiLive).getTime();
      const d2 = new Date(j.jamSelesaiLive).getTime();
      let diff = Math.floor((d2 - d1) / 60000);
      if (diff < 0) diff += 1440;
      return s + diff;
    }
    return s;
  }, 0);
  const totalJam = Math.round((totalMinutes / 60) * 10) / 10;

  // Find applicable tier
  const activeTier =
    tieringList.slice().reverse().find((t) => totalJam >= t.jamMinimal) ??
    tieringList[0] ??
    { tier: "Basic", ratePerJam: 25000 };

  const ratePerJam = Number(activeTier.ratePerJam ?? 25000);
  const grossPay = Math.round(totalJam * ratePerJam);

  // Total GMV from check-out records with reportedGmv + revenue entries (exact real database data)
  const gmvFromAbsensi = absensiBulanIni
    .filter((a) => a.tipe === "CHECK_OUT" && a.reportedGmv)
    .reduce((s, a) => s + Number(a.reportedGmv), 0);
  const gmvFromRevenue = revenueCurrentMonth.reduce((s, r) => s + Number(r.grossAmount), 0);
  const totalGmv = gmvFromAbsensi + gmvFromRevenue;

  const prevGmvFromAbsensi = absensiBulanLalu
    .filter((a) => a.tipe === "CHECK_OUT" && a.reportedGmv)
    .reduce((s, a) => s + Number(a.reportedGmv), 0);
  const prevGmvFromRevenue = revenuePrevMonth.reduce((s, r) => s + Number(r.grossAmount), 0);
  const prevGmv = prevGmvFromAbsensi + prevGmvFromRevenue;

  // Estimasi THP based on actual hours calculated (Rp 0 if no hours completed)
  const estimasiThp = grossPay;

  // Build violation logs (merging qcViolations and incidents)
  const violationLogs: Array<{
    tanggal: string;
    sesi: string;
    jenisPelanggaran: string;
    sanksi: string;
    status: string;
  }> = [];

  for (const q of qcViolations) {
    const dt = new Date(q.occurredAt ?? q.createdAt);
    const dateFormatted = dt.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const timeFormatted = dt.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
    violationLogs.push({
      tanggal: dateFormatted,
      sesi: timeFormatted,
      jenisPelanggaran: q.description || q.categoryLabel || q.category.replace(/_/g, " ") || "SOP Breach",
      sanksi: q.severity === "CRITICAL" ? "SP 1" : "Teguran Ringan",
      // OPEN = menunggu konfirmasi QC Manager (belum resmi); CONFIRMED/CLOSED = resmi.
      status: q.status === "OPEN" ? "Menunggu Konfirmasi" : "Resolved",
    });
  }

  for (const inc of incidents) {
    const dt = new Date(inc.createdAt);
    const dateFormatted = dt.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const timeFormatted = dt.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
    violationLogs.push({
      tanggal: dateFormatted,
      sesi: timeFormatted,
      jenisPelanggaran: inc.title || inc.category?.name || "Dead Air Berulang",
      sanksi: inc.fineApplied && Number(inc.fineApplied) > 0 ? "SP 1" : "Teguran Ringan",
      status: inc.status === "RESOLVED" || inc.status === "CLOSED" ? "Resolved" : "Pending",
    });
  }

  let salesTargetText = "-";
  let retentionRate: number | string = "-";
  let conversionRate: number | string = "-";

  if (penilaianBulanLalu) {
    try {
      const parsed = JSON.parse(penilaianBulanLalu.komentar || "{}");
      salesTargetText = parsed.salesTargetText || `${penilaianBulanLalu.skor}% Target`;
      retentionRate = typeof parsed.retentionRate === "number" ? parsed.retentionRate : penilaianBulanLalu.skor;
      conversionRate = typeof parsed.conversionRate === "number" ? parsed.conversionRate : (penilaianBulanLalu.skor / 20).toFixed(1);
    } catch {
      salesTargetText = `${penilaianBulanLalu.skor}% Skor`;
      retentionRate = penilaianBulanLalu.skor;
      conversionRate = "-";
    }
  }

  const startDateFmt = karyawan.startDate
    ? new Date(karyawan.startDate).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : `01 Jan ${now.getFullYear()}`;

  const endDateFmt = karyawan.endDate
    ? new Date(karyawan.endDate).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : `31 Des ${now.getFullYear()}`;
  const profilePhoto = karyawan.streamerProfile?.photoUrl;
  const userImage = karyawan.user?.image;
  // If profilePhoto is a dummy unsplash seed URL, prioritize userImage (e.g. from Google OAuth) if present
  const isSeedDummyPhoto = profilePhoto && profilePhoto.includes("unsplash.com");
  const resolvedPhoto = isSeedDummyPhoto && userImage ? userImage : (profilePhoto || userImage || null);

  return {
    karyawan: {
      id: karyawan.id,
      idKaryawan: karyawan.idKaryawan,
      namaLengkap: karyawan.namaLengkap,
      namaPanggilan: karyawan.namaPanggilan,
      fotoUrl: resolvedPhoto,
      jabatan: karyawan.jabatan || "Host Streamer",
      kategori: karyawan.kategori || "STREAMER",
      startDate: startDateFmt,
      endDate: endDateFmt,
      statusAktif: karyawan.statusAktif || "AKTIF",
      email: karyawan.email || null,
      nomorTelepon: karyawan.nomorTelepon || null,
    },
    gmv: {
      currentMonthLabel,
      totalGmv,
      prevMonthGmv: prevGmv,
      completedSessions: jadwalBulanIni.filter((j) => j.status === "SELESAI").length,
      cancelledSessions: jadwalBatal.length > 0 ? String(jadwalBatal.length) : "-",
      totalLiveHours: totalJam,
    },
    thp: {
      estimasiThp,
      tierName: activeTier.tier || "Basic",
      ratePerJam,
      totalJamLive: totalJam,
    },
    kpi: {
      periode: penilaianBulanLalu?.periode || prevMonthLabel,
      salesTargetText,
      retentionRate,
      conversionRate,
    },
    jobDesk: [
      "Host Live: 4 Sesi/Minggu",
      "Promosi Produk Utama",
      "Interaksi Audien & Closing Sales",
      "Laporan GMV & Performa Sesi",
    ],
    workflow: [
      { step: 1, title: "Briefing Produk", icon: "fa-clipboard-list" },
      { step: 2, title: "Setup Studio", icon: "fa-sliders" },
      { step: 3, title: "Live Sesi", icon: "fa-video" },
      { step: 4, title: "Interaksi & Closing", icon: "fa-comments-dollar" },
      { step: 5, title: "Post-Sesi Report", icon: "fa-file-signature" },
    ],
    doAndDonts: {
      dos: [
        "Interaksi Aktif",
        "Grooming Rapi",
        "Gunakan CTA Jelas",
        "Senyum",
      ],
      donts: [
        "Dead Air > 3s",
        "Sebut Platform Lain",
        "Gunakan SARA/Kasar",
        "Off-Frame Tanpa Izin",
      ],
    },
    violations: violationLogs,
  };
});
