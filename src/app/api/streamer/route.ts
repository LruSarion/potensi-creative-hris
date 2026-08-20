import { apiHandler } from "@/lib/api-handler";
import { getMyJadwal, getMyAbsensi, getMyReport } from "@/lib/services/streamer";

export const GET = apiHandler(async (req: Request) => {
  const url = new URL(req.url);
  const view = url.searchParams.get("view") ?? "jadwal";
  const periode = url.searchParams.get("periode") ?? undefined;
  if (view === "absensi") return getMyAbsensi();
  if (view === "report") return getMyReport(periode);
  return getMyJadwal();
});
