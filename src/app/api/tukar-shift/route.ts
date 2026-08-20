import { apiHandler } from "@/lib/api-handler";
import { requestTukarShift, processTukarShift, listTukarShift } from "@/lib/services/tukar-shift";

export const GET = apiHandler(async (req: Request) => {
  const url = new URL(req.url);
  const karyawanId = url.searchParams.get("karyawanId") ?? undefined;
  return listTukarShift({ karyawanId });
});

export const POST = apiHandler(async (req: Request) => {
  const body = await req.json();
  return requestTukarShift(body);
});

export const PATCH = apiHandler(async (req: Request) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const approve = url.searchParams.get("approve") === "true";
  if (!id) throw new Error("id required");
  return processTukarShift(id, approve);
});
