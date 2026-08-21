import { apiHandler } from "@/lib/api-handler";
import {
  listEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  deactivateEmployee,
} from "@/lib/services/employees";

export const GET = apiHandler(async (req: Request) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const kategori = url.searchParams.get("kategori") ?? undefined;
  
  if (id) {
    return getEmployee(id);
  }
  return listEmployees({ kategori });
});

export const POST = apiHandler(async (req: Request) => {
  const body = await req.json();
  return createEmployee(body);
});

export const PUT = apiHandler(async (req: Request) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) throw new Error("id required");
  const body = await req.json();
  return updateEmployee(id, body);
});

export const DELETE = apiHandler(async (req: Request) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) throw new Error("id required");
  return deactivateEmployee(id);
});
