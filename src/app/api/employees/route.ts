import { apiHandler } from "@/lib/api-handler";
import {
  listEmployees,
  getEmployee,
  createEmployee,
  createBulkEmployees,
  updateEmployee,
  deactivateEmployee,
  deleteEmployee,
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
  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  const body = await req.json();

  if (action === "bulk" || Array.isArray(body.items)) {
    return createBulkEmployees(body.items || []);
  }

  return createEmployee(body);
});

export const PUT = apiHandler(async (req: Request) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) throw new Error("id required");
  const body = await req.json();
  return updateEmployee(id, body);
});

export const PATCH = apiHandler(async (req: Request) => {
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
  const permanent = url.searchParams.get("permanent") === "true";
  if (permanent) {
    return deleteEmployee(id);
  }
  return deactivateEmployee(id);
});
