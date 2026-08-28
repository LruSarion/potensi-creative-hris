import { apiHandler } from "@/lib/api-handler";
import { getHelperStaff, getMySesiAktif, getStaffStats } from "@/lib/services/staff";

export const GET = apiHandler(async (req: Request) => {
  const url = new URL(req.url);
  const view = url.searchParams.get("view") ?? "helper";
  const search = url.searchParams.get("search") ?? url.searchParams.get("karyawanId") ?? undefined;
  if (view === "sesi") return getMySesiAktif(search);
  if (view === "stats") return getStaffStats(search);
  return getHelperStaff();
});

