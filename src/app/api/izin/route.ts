import { apiHandler } from "@/lib/api-handler";
import { submitIzin, approveIzin, listIzin } from "@/lib/services/lembur-izin";

export const GET = apiHandler(async (req: Request) => {
  const url = new URL(req.url);
  const karyawanId = url.searchParams.get("karyawanId") ?? undefined;
  return listIzin({ karyawanId });
});

export const POST = apiHandler(async (req: Request) => {
  const body = await req.json();
  return submitIzin(body);
});

export const PATCH = apiHandler(async (req: Request) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const approve = url.searchParams.get("approve") === "true";
  if (!id) throw new Error("id required");
  return approveIzin(id, approve);
});
