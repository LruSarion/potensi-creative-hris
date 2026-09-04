import { apiHandler } from "@/lib/api-handler";
import {
  createViolation,
  listViolations,
  updateViolationStatus,
  myViolationSummary,
  listLiveStreamers,
  VIOLATION_LABELS,
} from "@/lib/services/qc-violation";

export const GET = apiHandler(async (req: Request) => {
  const url = new URL(req.url);
  const view = url.searchParams.get("view") ?? "list";
  const streamerKaryawanId = url.searchParams.get("streamerKaryawanId") ?? undefined;
  if (view === "live") return { liveStreamers: await listLiveStreamers() };
  if (view === "summary") return myViolationSummary();
  if (view === "labels") return VIOLATION_LABELS;
  return listViolations({ streamerKaryawanId });
});

export const POST = apiHandler(async (req: Request) => {
  const body = await req.json();
  return createViolation(body);
});

export const PATCH = apiHandler(async (req: Request) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const body = await req.json();
  if (!id) throw new Error("id required");
  const action = body.action === "close" ? "close" : body.action === "confirm" ? "confirm" : null;
  if (!action) throw new Error("action must be 'confirm' or 'close'");
  return updateViolationStatus(id, action);
});
