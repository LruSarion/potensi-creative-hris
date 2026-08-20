import { describe, it, expect } from "vitest";
import { clientSchema, clientKetentuanSchema, produkSchema } from "@/lib/schemas/client";

describe("clientSchema", () => {
  it("accepts valid client", () => {
    expect(clientSchema.safeParse({ namaClient: "Vegeta Shopee" }).success).toBe(true);
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
  it("rejects missing platform", () => {
    expect(clientKetentuanSchema.safeParse({ clientId: "c1" }).success).toBe(false);
  });
});

describe("produkSchema", () => {
  it("accepts valid produk", () => {
    expect(
      produkSchema.safeParse({ clientId: "c1", namaProduk: "Produk A" }).success
    ).toBe(true);
  });
  it("rejects invalid status enum", () => {
    expect(
      produkSchema.safeParse({ clientId: "c1", namaProduk: "A", status: "NOPE" }).success
    ).toBe(false);
  });
});
