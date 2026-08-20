import { describe, it, expect } from "vitest";
import {
  generateSalt,
  hashPin,
  verifyPin,
  MAX_FAILED_LOGINS,
  LOCKOUT_MS,
} from "@/lib/pin";

describe("pin hashing", () => {
  it("produces a deterministic hash for the same pin+salt", () => {
    const salt = generateSalt();
    expect(hashPin("1234", salt)).toBe(hashPin("1234", salt));
  });

  it("produces different hashes for different salts", () => {
    const saltA = generateSalt();
    const saltB = generateSalt();
    expect(hashPin("1234", saltA)).not.toBe(hashPin("1234", saltB));
  });

  it("verifies a correct pin", () => {
    const salt = generateSalt();
    const hash = hashPin("9876", salt);
    expect(verifyPin("9876", salt, hash)).toBe(true);
  });

  it("rejects a wrong pin", () => {
    const salt = generateSalt();
    const hash = hashPin("9876", salt);
    expect(verifyPin("0000", salt, hash)).toBe(false);
  });

  it("rejects empty/missing inputs", () => {
    expect(verifyPin("", "salt", "hash")).toBe(false);
    expect(verifyPin("1234", "", "hash")).toBe(false);
    expect(verifyPin("1234", "salt", "")).toBe(false);
  });

  it("does not store the plaintext pin in the hash", () => {
    const salt = generateSalt();
    const hash = hashPin("1234", salt);
    expect(hash).not.toContain("1234");
  });
});

describe("lockout constants", () => {
  it("has a sane threshold and duration", () => {
    expect(MAX_FAILED_LOGINS).toBe(5);
    expect(LOCKOUT_MS).toBe(30 * 60 * 1000);
  });
});
