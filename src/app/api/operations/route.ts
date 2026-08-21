import { apiHandler } from "@/lib/api-handler";
import { transitionSession, liveBoard } from "@/lib/services/operations";

export const GET = apiHandler(async (req: Request) => {
  const url = new URL(req.url);
  const status = url.searchParams.get("status") as any;
  return liveBoard(status ? { status } : undefined);
});

export const PATCH = apiHandler(async (req: Request) => {
  const body = await req.json();
  return transitionSession(body.jadwalId, body.toState, body.note);
});