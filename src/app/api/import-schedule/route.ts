import { apiHandler } from "@/lib/api-handler";
import { importScheduleCsv } from "@/lib/services/csv-import";

/**
 * POST /api/import-schedule
 * Import schedule CSV in either the "ploting" (detailed) or "hybrid" (daily ops)
 * sheet format used by the client. Body: { format: "ploting"|"hybrid", csv: "..." }
 */
export const POST = apiHandler(async (req: Request) => {
  const body = await req.json();
  const format = body.format === "hybrid" ? "hybrid" : "ploting";
  if (typeof body.csv !== "string" || !body.csv.trim()) {
    throw new Error("csv wajib diisi");
  }
  return importScheduleCsv(format, body.csv);
});
