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

async function resolveTenantId(user: { tenantId?: string | null; role?: string }): Promise<string | undefined> {
  if (user.tenantId) return user.tenantId;
  const agency = await db.tenant.findFirst({ where: { type: "AGENCY" } });
  if (agency) return agency.id;
  const first = await db.tenant.findFirst();
  return first?.id ?? undefined;
}

function hydrateKetentuan(k: any) {
  if (!k) return k;
  let meta: any = {};
  try {
    if (k.prioritasPlatform && (k.prioritasPlatform.startsWith("{") || k.prioritasPlatform.startsWith("["))) {
      meta = JSON.parse(k.prioritasPlatform);
    }
  } catch {}
  return {
    ...k,
    kategori: meta.kategori || k.prioritasPlatform || "Beauty",
    namaPerusahaan: meta.namaPerusahaan || null,
    namaMerk: meta.namaMerk || null,
    penanggungJawab: meta.penanggungJawab || null,
    email: meta.email || null,
    alamat: meta.alamat || null,
    marketplace1: meta.marketplace1 || k.platform || null,
    marketplace2: meta.marketplace2 || null,
    marketplace3: meta.marketplace3 || null,
    catatan: meta.catatan || k.blacklist || null,
    ...meta,
  };
}

function hydrateClient(c: any) {
  if (!c) return c;
  return {
    ...c,
    ketentuan: Array.isArray(c.ketentuan) ? c.ketentuan.map(hydrateKetentuan) : [],
    produk: Array.isArray(c.produk) ? c.produk.map((p: any, idx: number) => hydrateProduk(p, idx)) : [],
  };
}

function hydrateProduk(p: any, idx?: number) {
  if (!p) return p;
  let meta: any = {};
  try {
    if (p.kategori && (p.kategori.startsWith("{") || p.kategori.startsWith("["))) {
      meta = JSON.parse(p.kategori);
    }
  } catch {}
  return {
    id: p.id,
    no: idx !== undefined ? idx + 1 : undefined,
    idProduk: meta.idProduk || `PRD-${String((idx ?? 0) + 1).padStart(3, "0")}`,
    sku: meta.sku || meta.sellerSku || "-",
    sellerSku: meta.sellerSku || meta.sku || "-",
    brand: meta.brand || p.client?.namaClient || "Brand",
    namaProduk: p.namaProduk,
    varian: Array.isArray(meta.varian)
      ? meta.varian
      : Array.isArray(meta.varianList)
      ? meta.varianList
      : meta.varian
      ? String(meta.varian).split(",").map((s: string) => s.trim()).filter(Boolean)
      : [],
    link: meta.link || meta.linkProduk || "",
    catatan: meta.catatan || "-",
    kategori: meta.kategori || "General",
    harga: p.harga ? Number(p.harga) : undefined,
    status: p.status,
    clientId: p.clientId,
  };
}

// ---------- CLIENT ----------
export async function listClients() {
  const user = await requirePermission("client:read");
  const rows = await db.client.findMany({
    where: tenantWhere(user),
    orderBy: { namaClient: "asc" },
    include: { ketentuan: true, produk: true },
  });
  return rows.map(hydrateClient);
}

export async function getClient(id: string) {
  const user = await requirePermission("client:read");
  const row = await db.client.findFirst({
    where: { id, ...tenantWhere(user) },
    include: { ketentuan: true, produk: true },
  });
  if (!row) throw AppError.notFound("Client tidak ditemukan");
  return hydrateClient(row);
}

export async function createClient(input: ClientInput) {
  const user = await requirePermission("client:write");
  const parsed = clientSchema.parse(input);
  const tenantId = await resolveTenantId(user);
  if (!tenantId && user.role !== "SUPER_ADMIN") throw AppError.forbidden("Akun tidak terkait tenant");

  const namaClient = (parsed.namaMerk || parsed.namaClient).trim();
  const platform = parsed.marketplace1 || parsed.platform || "Shopee";
  const pic = parsed.penanggungJawab || parsed.pic || "-";
  const kontak = parsed.kontak || null;

  const client = await db.client.create({
    data: {
      namaClient,
      platform,
      pic,
      kontak,
      tenantId: tenantId ?? null,
    },
  });

  const metaKetentuan = {
    namaPerusahaan: parsed.namaPerusahaan || namaClient,
    namaMerk: namaClient,
    penanggungJawab: pic,
    kategori: parsed.kategori || "Beauty",
    email: parsed.email || null,
    alamat: parsed.alamat || null,
    marketplace1: platform,
    marketplace2: parsed.marketplace2 || null,
    marketplace3: parsed.marketplace3 || null,
    catatan: parsed.catatan || null,
  };

  await db.clientKetentuan.upsert({
    where: { clientId_platform: { clientId: client.id, platform } },
    update: {
      prioritasPlatform: JSON.stringify(metaKetentuan),
      blacklist: parsed.catatan || null,
      tenantId: tenantId ?? null,
    },
    create: {
      clientId: client.id,
      platform,
      prioritasPlatform: JSON.stringify(metaKetentuan),
      blacklist: parsed.catatan || null,
      tenantId: tenantId ?? null,
    },
  });

  return getClient(client.id);
}

export async function updateClient(id: string, input: ClientInput) {
  const user = await requirePermission("client:write");
  const parsed = clientSchema.parse(input);
  const existing = await db.client.findFirst({
    where: { id, ...tenantWhere(user) },
    include: { ketentuan: true },
  });
  if (!existing) throw AppError.notFound("Client tidak ditemukan");
  assertTenantScope(user, existing.tenantId ?? "");

  const namaClient = (parsed.namaMerk || parsed.namaClient || existing.namaClient).trim();
  const platform = parsed.marketplace1 || parsed.platform || existing.platform || "Shopee";
  const pic = parsed.penanggungJawab || parsed.pic || existing.pic || "-";
  const kontak = parsed.kontak !== undefined ? parsed.kontak : existing.kontak;

  await db.client.update({
    where: { id },
    data: {
      namaClient,
      platform,
      pic,
      kontak,
    },
  });

  const existingMeta = (() => {
    try {
      const p = existing.ketentuan?.[0]?.prioritasPlatform;
      return p && p.startsWith("{") ? JSON.parse(p) : {};
    } catch {
      return {};
    }
  })();

  const metaKetentuan = {
    ...existingMeta,
    namaPerusahaan: parsed.namaPerusahaan !== undefined ? parsed.namaPerusahaan : existingMeta.namaPerusahaan || namaClient,
    namaMerk: namaClient,
    penanggungJawab: pic,
    kategori: parsed.kategori !== undefined ? parsed.kategori : existingMeta.kategori || "Beauty",
    email: parsed.email !== undefined ? parsed.email : existingMeta.email,
    alamat: parsed.alamat !== undefined ? parsed.alamat : existingMeta.alamat,
    marketplace1: platform,
    marketplace2: parsed.marketplace2 !== undefined ? parsed.marketplace2 : existingMeta.marketplace2,
    marketplace3: parsed.marketplace3 !== undefined ? parsed.marketplace3 : existingMeta.marketplace3,
    catatan: parsed.catatan !== undefined ? parsed.catatan : existingMeta.catatan,
  };

  await db.clientKetentuan.upsert({
    where: { clientId_platform: { clientId: id, platform } },
    update: {
      prioritasPlatform: JSON.stringify(metaKetentuan),
      blacklist: metaKetentuan.catatan || null,
    },
    create: {
      clientId: id,
      platform,
      prioritasPlatform: JSON.stringify(metaKetentuan),
      blacklist: metaKetentuan.catatan || null,
      tenantId: existing.tenantId,
    },
  });

  return getClient(id);
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

  const metaKetentuan = {
    namaPerusahaan: parsed.namaPerusahaan,
    kategori: parsed.kategori,
    email: parsed.email,
    alamat: parsed.alamat,
    marketplace1: parsed.marketplace1 || parsed.platform,
    marketplace2: parsed.marketplace2,
    marketplace3: parsed.marketplace3,
    catatan: parsed.catatan || parsed.blacklist,
  };

  return db.clientKetentuan.upsert({
    where: { clientId_platform: { clientId: parsed.clientId, platform: parsed.platform } },
    update: {
      blacklist: parsed.blacklist || parsed.catatan,
      prioritasPlatform: JSON.stringify(metaKetentuan),
    },
    create: {
      clientId: parsed.clientId,
      platform: parsed.platform,
      blacklist: parsed.blacklist || parsed.catatan,
      prioritasPlatform: JSON.stringify(metaKetentuan),
      tenantId: user.tenantId || undefined,
    },
  });
}

// ---------- PRODUK ----------
export async function listProduk(clientId?: string) {
  const user = await requirePermission("produk:read");
  const rows = await db.produk.findMany({
    where: {
      ...tenantWhere(user),
      ...(clientId ? { clientId } : {}),
    },
    include: { client: true },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((p, idx) => hydrateProduk(p, idx));
}

export async function createProduk(input: ProdukInput) {
  const user = await requirePermission("produk:write");
  const parsed = produkSchema.parse(input);
  const client = await db.client.findFirst({ where: { id: parsed.clientId, ...tenantWhere(user) } });
  if (!client) throw AppError.notFound("Client tidak ditemukan");

  const varianArr = Array.isArray(parsed.varian)
    ? parsed.varian
    : Array.isArray(parsed.varianList)
    ? parsed.varianList
    : parsed.varian
    ? [String(parsed.varian)]
    : [];

  const metaProduk = {
    idProduk: parsed.idProduk || undefined,
    sku: parsed.sku || parsed.sellerSku || undefined,
    sellerSku: parsed.sellerSku || parsed.sku || undefined,
    brand: parsed.brand || client.namaClient,
    varian: varianArr,
    varianList: varianArr,
    link: parsed.link || parsed.linkProduk || undefined,
    linkProduk: parsed.link || parsed.linkProduk || undefined,
    catatan: parsed.catatan || undefined,
    kategori: parsed.kategori || "General",
  };

  const created = await db.produk.create({
    data: {
      clientId: parsed.clientId,
      namaProduk: parsed.namaProduk,
      kategori: JSON.stringify(metaProduk),
      harga: parsed.harga ?? undefined,
      status: parsed.status ?? undefined,
      tenantId: client.tenantId,
    },
    include: { client: true },
  });

  return hydrateProduk(created, 0);
}

export async function updateProduk(id: string, input: any) {
  const user = await requirePermission("produk:write");
  const existing = await db.produk.findFirst({
    where: { id, ...tenantWhere(user) },
    include: { client: true },
  });
  if (!existing) throw AppError.notFound("Produk tidak ditemukan");

  let metaExisting: any = {};
  try {
    if (existing.kategori && existing.kategori.startsWith("{")) {
      metaExisting = JSON.parse(existing.kategori);
    }
  } catch {}

  const namaProduk = input.namaProduk || input.NAMA_PRODUK || metaExisting.namaProduk || existing.namaProduk;
  const brand = input.brand || input.BRAND || metaExisting.brand || existing.client?.namaClient || "-";
  const sku = input.sku || input.SELLER_SKU || input.sellerSku || metaExisting.sku || metaExisting.sellerSku || "-";
  const idProduk = input.idProduk || input.ID_PRODUK || metaExisting.idProduk || undefined;
  const varian = input.varian || input.VARIANT || input.varianList || metaExisting.varian || [];
  const link = input.link || input.LINK_PRODUK || input.linkProduk || metaExisting.link || metaExisting.linkProduk || "";
  const catatan = input.catatan || input.CATATAN || metaExisting.catatan || "";

  const varianArr = Array.isArray(varian)
    ? varian
    : typeof varian === "string"
    ? varian.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const metaProduk = {
    ...metaExisting,
    idProduk,
    sku,
    sellerSku: sku,
    brand,
    varian: varianArr,
    varianList: varianArr,
    link,
    linkProduk: link,
    catatan,
  };

  const updated = await db.produk.update({
    where: { id },
    data: {
      namaProduk,
      kategori: JSON.stringify(metaProduk),
      harga: input.harga !== undefined ? input.harga : existing.harga,
      status: input.status ?? existing.status,
    },
    include: { client: true },
  });

  return hydrateProduk(updated);
}