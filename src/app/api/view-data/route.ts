import { apiHandler } from "@/lib/api-handler";
import { getViewData } from "@/lib/services/view-history";

export const GET = apiHandler(async (req: Request) => {
  const url = new URL(req.url);
  const tab = url.searchParams.get("tab") ?? undefined;
  return getViewData(tab);
});
