import { apiHandler, AppError } from "@/lib/api-handler";
import { storeAttachment, listAttachments } from "@/lib/services/attachments";

export const GET = apiHandler(async (req: Request) => {
  const url = new URL(req.url);
  const entityType = url.searchParams.get("entityType");
  const entityId = url.searchParams.get("entityId");
  if (!entityType || !entityId) throw AppError.badRequest("entityType + entityId required");
  return listAttachments(entityType, entityId);
});

export const POST = apiHandler(async (req: Request) => {
  const body = await req.json();
  return storeAttachment(body);
});