import { apiHandler } from "@/lib/api-handler";
import { listProduk, createProduk, updateProduk } from "@/lib/services/clients";

export const GET = apiHandler(async (req: Request) => {
  const url = new URL(req.url);
  const clientId = url.searchParams.get("clientId") ?? undefined;
  return listProduk(clientId);
});

export const POST = apiHandler(async (req: Request) => {
  const body = await req.json();
  return createProduk(body);
});

export const PUT = apiHandler(async (req: Request) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) throw new Error("id required");
  const body = await req.json();
  return updateProduk(id, body);
});
