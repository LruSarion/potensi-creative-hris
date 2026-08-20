import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { sessionMetrics, absensiMetrics, tenantDashboard, toCsv } from "@/lib/services/analytics";
import type { AppError } from "@/lib/errors";

export const GET = apiHandler(async (req: Request) => {
  const url = new URL(req.url);
  const view = url.searchParams.get("view") ?? "dashboard";
  const periode = url.searchParams.get("periode") ?? undefined;
  const clientId = url.searchParams.get("clientId") ?? undefined;
  const streamerKaryawanId = url.searchParams.get("streamerKaryawanId") ?? undefined;

  if (view === "sessions") return sessionMetrics({ clientId, streamerKaryawanId, periode });
  if (view === "absensi") return absensiMetrics({ karyawanId: streamerKaryawanId, periode });
  return tenantDashboard();
});

// CSV export of session metrics.
export const POST = apiHandler(async (req: Request) => {
  const body = await req.json();
  if (body.export === "csv") {
    const data = (await sessionMetrics({
      clientId: body.clientId,
      streamerKaryawanId: body.streamerKaryawanId,
      periode: body.periode,
    })) as Awaited<ReturnType<typeof sessionMetrics>>;
    const csv = toCsv(["Metric", "Value"], [
      ["count", data.count],
      ["totalHours", data.totalHours],
      ...Object.entries(data.byStatus).map(([k, v]) => [`status:${k}`, v]),
    ]);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="sessions.csv"',
      },
    });
  }
  throw new Error("unknown export type") as unknown as AppError;
});