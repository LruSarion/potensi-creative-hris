import { describe, it, expect } from "vitest";
import { clientSchema, clientKetentuanSchema, produkSchema } from "@/lib/schemas/client";

describe("clientSchema", () => {
  it("accepts valid minimal client", () => {
    expect(clientSchema.safeParse({ namaClient: "Vegeta Shopee" }).success).toBe(true);
  });

  it("accepts full registration client data", () => {
    const res = clientSchema.safeParse({
      namaClient: "Glow Skin",
      namaMerk: "Glow Skin",
      namaPerusahaan: "PT Glow Indonesia",
      penanggungJawab: "Budi",
      kategori: "Beauty",
      kontak: "628123456789",
      email: "info@glow.com",
      alamat: "Jakarta",
      marketplace1: "Shopee",
      marketplace2: "TikTok",
      marketplace3: "Lazada",
      catatan: "VIP Client",
    });
    expect(res.success).toBe(true);
  });

  it("rejects missing namaClient", () => {
    expect(clientSchema.safeParse({}).success).toBe(false);
  });
});

describe("clientKetentuanSchema", () => {
  it("accepts valid ketentuan", () => {
    expect(
      clientKetentuanSchema.safeParse({ clientId: "c1", platform: "Shopee" }).success
    ).toBe(true);
  });

  it("accepts ketentuan with full metadata", () => {
    expect(
      clientKetentuanSchema.safeParse({
        clientId: "c1",
        platform: "Shopee",
        kategori: "Beauty",
        namaPerusahaan: "PT Glow",
        email: "test@glow.com",
        alamat: "Jakarta",
        marketplace1: "Shopee",
        marketplace2: "TikTok",
        catatan: "Khusus live pagi",
      }).success
    ).toBe(true);
  });

  it("rejects missing platform", () => {
    expect(clientKetentuanSchema.safeParse({ clientId: "c1" }).success).toBe(false);
  });
});

describe("produkSchema", () => {
  it("accepts valid minimal produk", () => {
    expect(
      produkSchema.safeParse({ clientId: "c1", namaProduk: "Produk A" }).success
    ).toBe(true);
  });

  it("accepts full product metadata", () => {
    expect(
      produkSchema.safeParse({
        clientId: "c1",
        namaProduk: "Serum Wajah Glowing 30ml",
        idProduk: "PRD-001",
        sellerSku: "SKU-GLOW-01",
        brand: "Glow Skin",
        varianList: ["30ml", "50ml"],
        linkProduk: "https://shopee.co.id/serum",
        catatan: "Best Seller",
        kategori: "Beauty",
        harga: 75000,
        status: "ONLINE",
      }).success
    ).toBe(true);
  });

  it("accepts varian as string or array of strings", () => {
    expect(
      produkSchema.safeParse({
        clientId: "c1",
        namaProduk: "Produk B",
        varian: "30ml, 50ml",
      }).success
    ).toBe(true);

    expect(
      produkSchema.safeParse({
        clientId: "c1",
        namaProduk: "Produk C",
        varian: ["Merah", "Biru"],
      }).success
    ).toBe(true);
  });

  it("rejects invalid status enum", () => {
    expect(
      produkSchema.safeParse({ clientId: "c1", namaProduk: "A", status: "NOPE" }).success
    ).toBe(false);
  });
});
