import { apiHandler } from "@/lib/api-handler";
import {
  getMyJadwal,
  getMyAbsensi,
  getMyReport,
  getMySesiAktif,
  getMyDashboard,
  getMyLiburCalendar,
  getPendingGmv,
  getTerbatasData,
  getStreamerRequestStatus,
  getStudioList,
  getStreamerHostList,
  submitLeaveRequest,
  submitShiftRequest,
  submitShiftBatch,
} from "@/lib/services/streamer";
import {
  checkLiburEligibility,
  cekKuotaMingguanBatch,
  getKuotaBulan,
  mapShiftLabel,
  requireStreamerIdentity,
} from "@/lib/services/kuota-libur";

export const GET = apiHandler(async (req: Request) => {
  const url = new URL(req.url);
  const view = url.searchParams.get("view") ?? "jadwal";
  const periode = url.searchParams.get("periode") ?? undefined;
  const hostId = url.searchParams.get("hostId") ?? url.searchParams.get("karyawanId") ?? undefined;
  if (view === "kuota-libur") {
    const tanggal = url.searchParams.get("tanggal") ?? "";
    const user = await requireStreamerIdentity();
    return checkLiburEligibility(tanggal, user.karyawanId!, user.tenantId);
  }
  if (view === "kuota-bulan") {
    const bulan = url.searchParams.get("bulan") ?? "";
    const user = await requireStreamerIdentity();
    return getKuotaBulan(bulan, user.tenantId);
  }
  if (view === "cek-kuota-mingguan") {
    const raw = url.searchParams.get("requests") ?? "[]";
    const user = await requireStreamerIdentity();
    const parsed = JSON.parse(raw) as { tanggal: string; shift: string }[];
    const requests = parsed.map((r) => ({ tanggal: r.tanggal, sesi: mapShiftLabel(r.shift) }));
    return cekKuotaMingguanBatch(requests, user.karyawanId!, user.tenantId);
  }
  if (view === "absensi") return getMyAbsensi();
  if (view === "report") return getMyReport(periode);
  if (view === "sesi") return getMySesiAktif();
  if (view === "dashboard") return getMyDashboard(periode, hostId);
  if (view === "hosts") return getStreamerHostList();
  if (view === "pending-gmv") return getPendingGmv();
  if (view === "terbatas") return getTerbatasData();
  if (view === "studios") return getStudioList();
  if (view === "request-status") return getStreamerRequestStatus();
  if (view === "libur") return getMyLiburCalendar();
  return getMyJadwal();
});

export const POST = apiHandler(async (req: Request) => {
  const body = await req.json();
  if (body.action === "leave-request" || body.action === "libur") {
    return submitLeaveRequest({ tanggal: body.tanggal, alasan: body.alasan });
  }
  if (body.action === "shift-request" || body.action === "sesi") {
    return submitShiftRequest({ tanggal: body.tanggal, sesi: body.sesi, catatan: body.catatan });
  }
  if (body.action === "shift-request-batch") {
    const requests = (body.requests as { tanggal: string; shift: string; catatan?: string }[]).map((r) => ({
      tanggal: r.tanggal,
      sesi: mapShiftLabel(r.shift),
      catatan: r.catatan,
    }));
    return submitShiftBatch(requests);
  }
  throw new Error("Action tidak dikenali");
});
