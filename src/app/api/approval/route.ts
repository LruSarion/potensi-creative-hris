import { apiHandler } from "@/lib/api-handler";
import {
  addPengajuanMarketplace,
  getApprovalList,
  processApproval,
  takeMarketplaceJob,
  cancelMarketplaceJob,
} from "@/lib/services/approval";

export const GET = apiHandler(async () => {
  return getApprovalList();
});

export const POST = apiHandler(async (req: Request) => {
  const body = await req.json();
  return addPengajuanMarketplace(body);
});

export const PATCH = apiHandler(async (req: Request) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const action = url.searchParams.get("action");
  if (!id) throw new Error("id required");
  if (action === "approve") return processApproval(id, true);
  if (action === "reject") return processApproval(id, false);
  if (action === "take") return takeMarketplaceJob(id);
  if (action === "cancel") return cancelMarketplaceJob(id);
  throw new Error("unknown action");
});
