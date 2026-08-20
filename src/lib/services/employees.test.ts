import { describe, it, expect } from "vitest";
import { karyawanSchema } from "@/lib/schemas/karyawan";

describe("karyawanSchema validation", () => {
  it("accepts a valid minimal payload", () => {
    const result = karyawanSchema.safeParse({
      idKaryawan: "PCS100",
      namaLengkap: "Test User",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing required fields", () => {
    const result = karyawanSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects invalid enum values", () => {
    const result = karyawanSchema.safeParse({
      idKaryawan: "PCS100",
      namaLengkap: "Test",
      gender: "INVALID",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = karyawanSchema.safeParse({
      idKaryawan: "PCS100",
      namaLengkap: "Test",
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid enum values", () => {
    const result = karyawanSchema.safeParse({
      idKaryawan: "PCS100",
      namaLengkap: "Test",
      gender: "PEREMPUAN",
      tipeJadwal: "LIVE",
      statusAktif: "AKTIF",
    });
    expect(result.success).toBe(true);
  });
});
