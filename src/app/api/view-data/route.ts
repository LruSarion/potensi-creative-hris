import { apiHandler } from "@/lib/api-handler";
import { getViewData } from "@/lib/services/view-history";

export const GET = apiHandler(async () => {
  return getViewData();
});
