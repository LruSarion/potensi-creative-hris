import { z } from "zod";

export const clientSchema = z.object({
  namaClient: z.string().min(1),
  platform: z.string().optional().nullable(),
  pic: z.string().optional().nullable(),
  kontak: z.string().optional().nullable(),
});

export const clientKetentuanSchema = z.object({
  clientId: z.string().min(1),
  platform: z.string().min(1),
  blacklist: z.string().optional().nullable(),
  prioritasPlatform: z.string().optional().nullable(),
});

export const produkSchema = z.object({
  clientId: z.string().min(1),
  namaProduk: z.string().min(1),
  kategori: z.string().optional().nullable(),
  harga: z.number().optional().nullable(),
  status: z.enum(["DRAFT", "APPROVED", "ONLINE", "CLEANING", "ARCHIVED"]).optional().nullable(),
});

export type ClientInput = z.infer<typeof clientSchema>;
export type ClientKetentuanInput = z.infer<typeof clientKetentuanSchema>;
export type ProdukInput = z.infer<typeof produkSchema>;
