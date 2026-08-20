import { apiHandler } from "@/lib/api-handler";
import {
  mySchedules,
  kpiDashboard,
  proposePromoJadwal,
  myApprovals,
  submitFeedback,
  listMyFeedback,
  listFeedbackForAdmin,
} from "@/lib/services/client-portal";

export const GET = apiHandler(async (req: Request) => {
  const url = new URL(req.url);
  const view = url.searchParams.get("view") ?? "schedules";
  if (view === "kpi") return kpiDashboard();
  if (view === "approvals") return myApprovals();
  if (view === "feedback") return listMyFeedback();
  if (view === "admin-feedback") return listFeedbackForAdmin();
  return mySchedules();
});

export const POST = apiHandler(async (req: Request) => {
  const body = await req.json();
  const action = body.action as string | undefined;
  if (action === "propose") return proposePromoJadwal(body);
  if (action === "feedback") return submitFeedback(body.feedback ?? body);
  throw new Error("unknown client-portal action");
});