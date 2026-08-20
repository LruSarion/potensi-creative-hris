import { apiHandler } from "@/lib/api-handler";
import {
  listClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
  upsertKetentuan,
} from "@/lib/services/clients";

export const GET = apiHandler(async (req: Request) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (id) return getClient(id);
  return listClients();
});

export const POST = apiHandler(async (req: Request) => {
  const body = await req.json();
  return createClient(body);
});

export const PUT = apiHandler(async (req: Request) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) throw new Error("id required");
  const body = await req.json();
  return updateClient(id, body);
});

export const DELETE = apiHandler(async (req: Request) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) throw new Error("id required");
  return deleteClient(id);
});

// Ketentuan upsert
export const PATCH = apiHandler(async (req: Request) => {
  const body = await req.json();
  return upsertKetentuan(body);
});
