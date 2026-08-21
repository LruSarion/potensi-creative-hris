import { apiHandler } from "@/lib/api-handler";
import {
  addPengajuanMarketplace,
  getApprovalList,
  processApproval,
  takeMarketplaceJob,
  cancelMarketplaceJob,
} from "@/lib/services/approval";
import { approveIzin, approveLembur } from "@/lib/services/lembur-izin";

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
  const type = url.searchParams.get("type") ?? "jadwal";
  if (!id) throw new Error("id required");
  if (action !== "approve" && action !== "reject") throw new Error("unknown action");
  const approve = action === "approve";
  // Dispatch by module type (izin/lembur are approved via their own services).
  if (type === "izin") return approveIzin(id, approve);
  if (type === "lembur") return approveLembur(id, approve);
  return processApproval(id, approve);
});
