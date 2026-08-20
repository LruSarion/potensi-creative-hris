import { apiHandler } from "@/lib/api-handler";
import { createRosterShift, listRoster, cancelRosterShift } from "@/lib/services/operations";

export const GET = apiHandler(async (req: Request) => {
  const url = new URL(req.url);
  const karyawanId = url.searchParams.get("karyawanId") ?? undefined;
  const tanggal = url.searchParams.get("tanggal") ?? undefined;
  return listRoster({ karyawanId, tanggal });
});

export const POST = apiHandler(async (req: Request) => {
  const body = await req.json();
  return createRosterShift(body);
});

export const DELETE = apiHandler(async (req: Request) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) throw new Error("id required");
  return cancelRosterShift(id);
});