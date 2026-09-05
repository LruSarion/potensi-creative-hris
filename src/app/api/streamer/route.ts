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
} from "@/lib/services/streamer";

export const GET = apiHandler(async (req: Request) => {
  const url = new URL(req.url);
  const view = url.searchParams.get("view") ?? "jadwal";
  const periode = url.searchParams.get("periode") ?? undefined;
  const hostId = url.searchParams.get("hostId") ?? url.searchParams.get("karyawanId") ?? undefined;
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
  throw new Error("Action tidak dikenali");
});
