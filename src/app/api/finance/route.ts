import { apiHandler } from "@/lib/api-handler";
import {
  computePayrollV2,
  createPayoutRun,
  setPayoutStatus,
  listPayoutRuns,
  createBillingDoc,
  setBillingStatus,
  listBilling,
  pnlSummary,
  reconcilePayoutRun,
} from "@/lib/services/finance";

export const GET = apiHandler(async (req: Request) => {
  const url = new URL(req.url);
  const view = url.searchParams.get("view") ?? "payouts";
  const periode = url.searchParams.get("periode") ?? undefined;
  const clientId = url.searchParams.get("clientId") ?? undefined;
  if (view === "billing") return listBilling(periode, clientId);
  if (view === "pnl") {
    if (!periode) throw new Error("periode required for pnl");
    return pnlSummary(periode);
  }
  return listPayoutRuns(periode);
});

export const POST = apiHandler(async (req: Request) => {
  const body = await req.json();
  const action = body.action as string | undefined;

  if (action === "payroll") {
    return computePayrollV2(body.karyawanId, body.periode, body.deductions ?? 0);
  }
  if (action === "payout-run") {
    return createPayoutRun(body.periode);
  }
  if (action === "reconcile") {
    return reconcilePayoutRun(body.periode, body.deductionsByKaryawan);
  }
  if (action === "billing") {
    return createBillingDoc(body.clientId, body.periode);
  }
  throw new Error("unknown finance action");
});

export const PATCH = apiHandler(async (req: Request) => {
  const body = await req.json();
  const action = body.action as string | undefined;
  if (action === "payout-status") return setPayoutStatus(body.id, body.status);
  if (action === "billing-status") return setBillingStatus(body.id, body.status);
  throw new Error("unknown finance patch action");
});