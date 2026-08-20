import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requirePermission, requireRole, tenantWhere, assertTenantScope } from "@/lib/auth-helpers";
import {
  clientSchema,
  clientKetentuanSchema,
  produkSchema,
  type ClientInput,
  type ClientKetentuanInput,
  type ProdukInput,
} from "@/lib/schemas/client";

// ---------- CLIENT ----------
export async function listClients() {
  const user = await requirePermission("client:read");
  return db.client.findMany({
    where: tenantWhere(user),
    orderBy: { namaClient: "asc" },
    include: { ketentuan: true },
  });
}

export async function getClient(id: string) {
  const user = await requirePermission("client:read");
  const row = await db.client.findFirst({
    where: { id, ...tenantWhere(user) },
    include: { ketentuan: true, produk: true },
  });
  if (!row) throw AppError.notFound("Client tidak ditemukan");
  return row;
}

export async function createClient(input: ClientInput) {
  const user = await requirePermission("client:write");
  const parsed = clientSchema.parse(input);
  if (!user.tenantId) throw AppError.forbidden("Akun tidak terkait tenant");
  return db.client.create({ data: { ...parsed, tenantId: user.tenantId } });
}

export async function updateClient(id: string, input: ClientInput) {
  const user = await requirePermission("client:write");
  const parsed = clientSchema.parse(input);
  const existing = await db.client.findFirst({ where: { id, ...tenantWhere(user) } });
  if (!existing) throw AppError.notFound("Client tidak ditemukan");
  assertTenantScope(user, existing.tenantId ?? "");
  return db.client.update({ where: { id }, data: parsed });
}

export async function deleteClient(id: string) {
  const user = await requirePermission("client:write");
  const existing = await db.client.findFirst({ where: { id, ...tenantWhere(user) } });
  if (!existing) throw AppError.notFound("Client tidak ditemukan");
  await db.client.delete({ where: { id } });
  return { deleted: true };
}

// ---------- CLIENT KETENTUAN ----------
export async function upsertKetentuan(input: ClientKetentuanInput) {
  const user = await requirePermission("client:write");
  const parsed = clientKetentuanSchema.parse(input);
  const client = await db.client.findFirst({
    where: { id: parsed.clientId, ...tenantWhere(user) },
  });
  if (!client) throw AppError.notFound("Client tidak ditemukan");
  return db.clientKetentuan.upsert({
    where: { clientId_platform: { clientId: parsed.clientId, platform: parsed.platform } },
    update: { blacklist: parsed.blacklist, prioritasPlatform: parsed.prioritasPlatform },
    create: { ...parsed, tenantId: user.tenantId || undefined },
  });
}

// ---------- PRODUK ----------
export async function listProduk(clientId?: string) {
  const user = await requirePermission("produk:read");
  return db.produk.findMany({
    where: {
      ...tenantWhere(user),
      ...(clientId ? { clientId } : {}),
    },
    orderBy: { namaProduk: "asc" },
  });
}

export async function createProduk(input: ProdukInput) {
  const user = await requirePermission("produk:write");
  const parsed = produkSchema.parse(input);
  const client = await db.client.findFirst({ where: { id: parsed.clientId, ...tenantWhere(user) } });
  if (!client) throw AppError.notFound("Client tidak ditemukan");
  return db.produk.create({
    data: {
      ...parsed,
      status: parsed.status ?? undefined,
      harga: parsed.harga ?? undefined,
    },
  });
}

export async function updateProduk(id: string, input: ProdukInput) {
  const user = await requirePermission("produk:write");
  const parsed = produkSchema.parse(input);
  const existing = await db.produk.findFirst({ where: { id, ...tenantWhere(user) } });
  if (!existing) throw AppError.notFound("Produk tidak ditemukan");
  return db.produk.update({
    where: { id },
    data: {
      ...parsed,
      status: parsed.status ?? undefined,
      harga: parsed.harga ?? undefined,
    },
  });
}