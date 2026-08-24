import { apiHandler } from "@/lib/api-handler";
import { getHelperStaff, getMySesiAktif, getStaffStats } from "@/lib/services/staff";

export const GET = apiHandler(async (req: Request) => {
  const url = new URL(req.url);
  const view = url.searchParams.get("view") ?? "helper";
  if (view === "sesi") return getMySesiAktif();
  if (view === "stats") return getStaffStats();
  return getHelperStaff();
});
