import { apiHandler } from "@/lib/api-handler";
import { getHelperStaff, getMySesiAktif } from "@/lib/services/staff";

export const GET = apiHandler(async (req: Request) => {
  const url = new URL(req.url);
  const view = url.searchParams.get("view") ?? "helper";
  if (view === "sesi") return getMySesiAktif();
  return getHelperStaff();
});
