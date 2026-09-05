import { apiHandler } from "@/lib/api-handler";
import { getHistory } from "@/lib/services/view-history";

export const GET = apiHandler(
  async (req: Request) => {
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId") ?? undefined;
    return getHistory({ userId });
  },
  { cacheControl: "private, max-age=15, stale-while-revalidate=60" }
);
