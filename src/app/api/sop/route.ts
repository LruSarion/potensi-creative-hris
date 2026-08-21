import { apiHandler } from "@/lib/api-handler";
import {
  listTemplates,
  createTemplate,
  deactivateTemplate,
  getTodayChecklist,
  completeTask,
  listCompletions,
} from "@/lib/services/sop";

export const GET = apiHandler(async (req: Request) => {
  const url = new URL(req.url);
  const view = url.searchParams.get("view") ?? "checklist";
  const tanggal = url.searchParams.get("tanggal") ?? undefined;
  if (view === "templates") return listTemplates();
  if (view === "completions") return listCompletions({ tanggal });
  return getTodayChecklist();
});

export const POST = apiHandler(async (req: Request) => {
  const body = await req.json();
  const action = body.action as string | undefined;
  if (action === "create-template") return createTemplate(body.template);
  if (action === "complete-task") return completeTask(body.taskId, body);
  if (action === "deactivate-template") return deactivateTemplate(body.id);
  throw new Error("unknown sop action");
});
