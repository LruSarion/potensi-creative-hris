import { db } from "@/lib/db";
import { verifyPin, MAX_FAILED_LOGINS, LOCKOUT_MS } from "@/lib/pin";

export type LoginResult =
  | { status: "success"; user: { id: string; email: string; role: string } }
  | { status: "error"; message: string };

/**
 * Verify a user's PIN as the second factor after Google Sign-In.
 * Enforces failed-attempt lockout (5 fails -> 30 min block).
 * Returns a generic error message to avoid user enumeration.
 */
export async function completeLogin(
  email: string,
  pin: string
): Promise<LoginResult> {
  const user = await db.user.findUnique({ where: { email } });

  // Generic error regardless of whether the user exists (anti-enumeration).
  if (!user || !user.pinHash || !user.pinSalt) {
    return { status: "error", message: "Email atau PIN tidak valid." };
  }

  const now = new Date();

  // Lockout check
  if (user.blockedUntil && user.blockedUntil > now) {
    return {
      status: "error",
      message: "Akun dikunci karena terlalu banyak percobaan gagal. Silakan tunggu 30 menit.",
    };
  }

  const valid = verifyPin(pin, user.pinSalt, user.pinHash);

  if (valid) {
    await db.user.update({
      where: { id: user.id },
      data: { failedLogins: 0, blockedUntil: null },
    });
    return {
      status: "success",
      user: { id: user.id, email: user.email, role: user.role },
    };
  }

  // Increment failed counter; lock if threshold reached
  const newFailed = user.failedLogins + 1;
  const blockedUntil = newFailed >= MAX_FAILED_LOGINS ? new Date(now.getTime() + LOCKOUT_MS) : null;
  await db.user.update({
    where: { id: user.id },
    data: { failedLogins: newFailed, blockedUntil },
  });

  return { status: "error", message: "Email atau PIN tidak valid." };
}
