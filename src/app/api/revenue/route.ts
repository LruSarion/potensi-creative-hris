import { apiHandler } from "@/lib/api-handler";
import { recordRevenue, listRevenue, revenueSummary } from "@/lib/services/revenue";
import type { RevenueSource } from "@/generated/prisma/enums";

export const GET = apiHandler(async (req: Request) => {
  const url = new URL(req.url);
  const streamerKaryawanId = url.searchParams.get("streamerKaryawanId") ?? undefined;
  const source = url.searchParams.get("source") ?? undefined;
  const view = url.searchParams.get("view") ?? "list";
  if (view === "summary") return revenueSummary({ streamerKaryawanId, source: source as RevenueSource | undefined });
  return listRevenue({ streamerKaryawanId, source: source as RevenueSource | undefined });
});

export const POST = apiHandler(async (req: Request) => {
  const body = await req.json();
  return recordRevenue(body);
});
