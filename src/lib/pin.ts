import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LEN = 64;
const SALT_LEN = 16;

/**
 * Generate a random salt (hex).
 */
export function generateSalt(): string {
  return randomBytes(SALT_LEN).toString("hex");
}

/**
 * Hash a PIN with the given salt using scrypt.
 * Returns a hex string of length KEY_LEN*2.
 */
export function hashPin(pin: string, salt: string): string {
  return scryptSync(pin, salt, KEY_LEN).toString("hex");
}

/**
 * Timing-safe comparison of a plaintext PIN against a stored hash+salt.
 */
export function verifyPin(pin: string, salt: string, expectedHash: string): boolean {
  if (!pin || !salt || !expectedHash) return false;
  const actual = Buffer.from(hashPin(pin, salt), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

/** Max consecutive failed logins before lockout. */
export const MAX_FAILED_LOGINS = 5;
/** Lockout duration in milliseconds (30 minutes). */
export const LOCKOUT_MS = 30 * 60 * 1000;
