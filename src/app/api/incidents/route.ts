import { apiHandler } from "@/lib/api-handler";
import {
  createIncident,
  listIncidents,
  updateIncidentStatus,
  escalateIncident,
  listViolationCategories,
  approveIncident,
} from "@/lib/services/operations";

export const GET = apiHandler(async (req: Request) => {
  const url = new URL(req.url);
  const view = url.searchParams.get("view");
  if (view === "categories") return listViolationCategories();
  const status = (url.searchParams.get("status") ?? undefined) as any;
  const severity = (url.searchParams.get("severity") ?? undefined) as any;
  return listIncidents(status, severity);
});

export const POST = apiHandler(async (req: Request) => {
  const body = await req.json();
  return createIncident(body);
});

export const PATCH = apiHandler(async (req: Request) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const action = url.searchParams.get("action");
  if (!id) throw new Error("id required");
  const body = await req.json().catch(() => ({}));
  if (action === "escalate") return escalateIncident(id);
  if (action === "approve") return approveIncident(id, body.fineApplied);
  return updateIncidentStatus(id, body.status, body.assigneeId);
});