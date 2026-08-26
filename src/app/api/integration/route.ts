import { apiHandler } from "@/lib/api-handler";
import {
  createNotification,
  myNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  clearAllNotifications,
  permissionMatrix,
  userPermissionsInfo,
  auditTrail,
  systemHealth,
} from "@/lib/services/integration";

export const GET = apiHandler(async (req: Request) => {
  const url = new URL(req.url);
  const view = url.searchParams.get("view") ?? "health";
  const aksi = url.searchParams.get("aksi") ?? undefined;
  if (view === "notifications") return myNotifications();
  if (view === "permissions") return permissionMatrix();
  if (view === "my-permissions") return userPermissionsInfo();
  if (view === "audit") return auditTrail(200, aksi);
  return systemHealth();
});

export const POST = apiHandler(async (req: Request) => {
  const body = await req.json();
  if (body.action === "notify") return createNotification(body);
  if (body.action === "markRead") return markNotificationRead(body.id);
  if (body.action === "markAllRead") return markAllNotificationsRead();
  if (body.action === "delete") return deleteNotification(body.id);
  if (body.action === "clearAll") return clearAllNotifications();
  throw new Error("unknown integration action");
});