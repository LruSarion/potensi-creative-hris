import { apiHandler } from "@/lib/api-handler";
import { transitionSession, liveBoard } from "@/lib/services/operations";

export const GET = apiHandler(async () => {
  return liveBoard();
});

export const PATCH = apiHandler(async (req: Request) => {
  const body = await req.json();
  return transitionSession(body.jadwalId, body.toState, body.note);
});