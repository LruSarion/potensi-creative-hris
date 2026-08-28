import { apiHandler } from "@/lib/api-handler";
import {
  addPengajuanMarketplace,
  getApprovalList,
  processApproval,
  bulkApproveJadwal,
  publishToMarketplace,
  sendToCleaning,
  pullToApproved,
  updateJadwalDetails,
} from "@/lib/services/approval";
import { approveIzin, approveLembur } from "@/lib/services/lembur-izin";

export const GET = apiHandler(async () => {
  return getApprovalList();
});

export const POST = apiHandler(async (req: Request) => {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  const body = await req.json();

  if (action === "bulk_approve") {
    return bulkApproveJadwal(body.items || []);
  }
  if (action === "publish") {
    return publishToMarketplace(body.ids || []);
  }
  if (action === "send_cleaning") {
    return sendToCleaning(body.ids || []);
  }
  if (action === "pull_approved") {
    return pullToApproved(body.ids || []);
  }
  if (action === "update_details") {
    return updateJadwalDetails(body.id, body.data || {});
  }

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

  if (type === "izin") return approveIzin(id, approve);
  if (type === "lembur") return approveLembur(id, approve);

  return processApproval(id, approve);
});
