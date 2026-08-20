import { apiHandler } from "@/lib/api-handler";
import {
  listPayroll,
  computePayroll,
  computePeriodBatchPayroll,
  getPayrollSummary,
  listTiering,
  upsertTiering,
} from "@/lib/services/payroll";

export const GET = apiHandler(async (req: Request) => {
  const url = new URL(req.url);
  const periode = url.searchParams.get("periode") ?? undefined;
  const tiering = url.searchParams.get("tiering");
  const summary = url.searchParams.get("summary");

  if (tiering === "1") return listTiering();
  if (summary === "1" && periode) return getPayrollSummary(periode);
  return listPayroll({ periode });
});

export const POST = apiHandler(async (req: Request) => {
  const body = await req.json();
  if (body.tiering) return upsertTiering(body.tiering);
  if (body.action === "compute-batch" && body.periode) {
    return computePeriodBatchPayroll(body.periode);
  }
  return computePayroll(
    body.karyawanId,
    body.periode,
    Number(body.deductions ?? 0),
    Number(body.bonus ?? 0)
  );
});
