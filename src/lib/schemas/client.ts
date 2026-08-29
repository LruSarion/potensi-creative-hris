import { z } from "zod";

export const clientSchema = z.object({
  namaClient: z.string().min(1, "Nama Merk / Client wajib diisi (minimal 1 karakter)"),
  platform: z.string().optional().nullable(),
  pic: z.string().optional().nullable(),
  kontak: z.string().optional().nullable().refine(
    (val) => !val || /^[0-9+() -]{8,20}$/.test(val),
    { message: "Format nomor WhatsApp tidak valid (minimal 8 digit)" }
  ),
  namaPerusahaan: z.string().optional().nullable(),
  namaMerk: z.string().optional().nullable(),
  penanggungJawab: z.string().optional().nullable(),
  kategori: z.string().optional().nullable(),
  email: z.string().optional().nullable().refine(
    (val) => !val || z.string().email().safeParse(val).success,
    { message: "Format email tidak valid" }
  ),
  alamat: z.string().optional().nullable(),
  marketplace1: z.string().optional().nullable(),
  marketplace2: z.string().optional().nullable(),
  marketplace3: z.string().optional().nullable(),
  catatan: z.string().optional().nullable(),
});

export const clientKetentuanSchema = z.object({
  clientId: z.string().min(1, "Client ID wajib ada"),
  platform: z.string().min(1, "Platform wajib dipilih"),
  blacklist: z.string().optional().nullable(),
  prioritasPlatform: z.string().optional().nullable(),
  namaPerusahaan: z.string().optional().nullable(),
  kategori: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  alamat: z.string().optional().nullable(),
  marketplace1: z.string().optional().nullable(),
  marketplace2: z.string().optional().nullable(),
  marketplace3: z.string().optional().nullable(),
  catatan: z.string().optional().nullable(),
});

export const produkSchema = z.object({
  clientId: z.string().min(1, "Platform Client target wajib dipilih"),
  namaProduk: z.string().min(2, "Nama produk wajib diisi (minimal 2 karakter)"),
  idProduk: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  sellerSku: z.string().optional().nullable(),
  brand: z.string().optional().nullable(),
  varian: z.union([z.array(z.string()), z.string()]).optional().nullable(),
  varianList: z.array(z.string()).optional().nullable(),
  link: z.string().optional().nullable().refine(
    (val) => !val || val === "-" || /^(https?:\/\/|\/)/i.test(val),
    { message: "Link produk harus berupa URL valid (diawali https:// atau http://)" }
  ),
  linkProduk: z.string().optional().nullable().refine(
    (val) => !val || val === "-" || /^(https?:\/\/|\/)/i.test(val),
    { message: "Link produk harus berupa URL valid (diawali https:// atau http://)" }
  ),
  catatan: z.string().optional().nullable(),
  kategori: z.string().optional().nullable(),
  harga: z.number().nonnegative("Harga tidak boleh negatif").optional().nullable(),
  status: z.enum(["DRAFT", "APPROVED", "ONLINE", "CLEANING", "ARCHIVED"]).optional().nullable(),
});

export type ClientInput = z.infer<typeof clientSchema>;
export type ClientKetentuanInput = z.infer<typeof clientKetentuanSchema>;
export type ProdukInput = z.infer<typeof produkSchema>;
