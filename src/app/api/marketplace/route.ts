import { apiHandler } from "@/lib/api-handler";
import { importJadwalBatch, getMarketplaceOverview } from "@/lib/services/marketplace";

export const GET = apiHandler(async () => {
  return getMarketplaceOverview();
});

export const POST = apiHandler(async (req: Request) => {
  const body = await req.json();
  return importJadwalBatch(body.batch ?? body);
});
