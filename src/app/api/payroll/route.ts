import { apiHandler } from "@/lib/api-handler";
import {
  listPayroll,
  computePayroll,
  computePeriodBatchPayroll,
  getPayrollSummary,
  listTiering,
  upsertTiering,
  listMasterGaji,
  upsertMasterGaji,
  listPayrollPeriode,
  listPayrollHistory,
  updatePayrollStatus,
  periodeLabelFromMonth,
} from "@/lib/services/payroll";

export const GET = apiHandler(async (req: Request) => {
  const url = new URL(req.url);
  const periode = url.searchParams.get("periode") ?? undefined;
  const tiering = url.searchParams.get("tiering");
  const summary = url.searchParams.get("summary");
  const master = url.searchParams.get("master");
  const history = url.searchParams.get("history");

  if (tiering === "1") return listTiering();
  if (master === "1") return listMasterGaji();
  if (history === "1") return listPayrollHistory();
  if (summary === "1" && periode) return getPayrollSummary(periode);
  if (periode) return listPayrollPeriode(periodeLabelFromMonth(periode));
  return listPayroll({ periode: periode ? periodeLabelFromMonth(periode) : undefined });
});

export const POST = apiHandler(async (req: Request) => {
  const body = await req.json();
  if (body.tiering) return upsertTiering(body.tiering);
  if (body.masterGaji) {
    return upsertMasterGaji({
      karyawanId: body.masterGaji.karyawanId,
      gajiPokok: Number(body.masterGaji.gajiPokok ?? 0),
      tunjTransport: Number(body.masterGaji.tunjTransport ?? 0),
      tunjMakan: Number(body.masterGaji.tunjMakan ?? 0),
    });
  }
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

export const PATCH = apiHandler(async (req: Request) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const body = await req.json();
  if (!id) throw new Error("ID payroll required");
  if (body.status === "DISETUJUI" || body.status === "REVISI") {
    return updatePayrollStatus(id, body.status);
  }
  throw new Error("Status tidak dikenali (DISETUJUI/REVISI)");
});
