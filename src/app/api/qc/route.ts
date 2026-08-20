import { apiHandler } from "@/lib/api-handler";
import {
  createRubric,
  listRubrics,
  createReview,
  scoreReview,
  listReviews,
  createActionItem,
  updateActionItemStatus,
  qcTrends,
} from "@/lib/services/qc";

export const GET = apiHandler(async (req: Request) => {
  const url = new URL(req.url);
  const view = url.searchParams.get("view") ?? "reviews";
  const status = url.searchParams.get("status") ?? undefined;
  const periode = url.searchParams.get("periode") ?? undefined;
  if (view === "rubrics") return listRubrics();
  if (view === "trends") return qcTrends(periode);
  return listReviews(status);
});

export const POST = apiHandler(async (req: Request) => {
  const body = await req.json();
  const action = body.action as string | undefined;
  if (action === "rubric") return createRubric(body.rubric ?? body);
  if (action === "review") return createReview(body);
  if (action === "score") return scoreReview(body.reviewId, body.scores, body.remarks);
  if (action === "action-item") return createActionItem(body);
  if (action === "action-status") return updateActionItemStatus(body.id, body.status);
  throw new Error("unknown qc action");
});