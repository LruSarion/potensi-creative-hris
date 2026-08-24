import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/auth.config";
import { db } from "@/lib/db";
import { verifyPin, MAX_FAILED_LOGINS, LOCKOUT_MS } from "@/lib/pin";
import type { Role } from "@/generated/prisma/enums";

const hasGoogleCreds = Boolean(
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_SECRET &&
  process.env.GOOGLE_CLIENT_ID !== "" &&
  process.env.GOOGLE_CLIENT_SECRET !== ""
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID || "demo-google-client-id.apps.googleusercontent.com",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "demo-google-client-secret",
      allowDangerousEmailAccountLinking: true,
    }),
    Credentials({
      name: "Email & PIN",
      credentials: {
        email: { label: "Email", type: "email" },
        pin: { label: "PIN", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.pin) return null;
        const email = String(credentials.email).trim().toLowerCase();
        const pin = String(credentials.pin).trim();

        const user = await db.user.findUnique({
          where: { email },
          include: { karyawan: true },
        });

        if (!user || !user.pinHash || !user.pinSalt) return null;

        const now = new Date();
        if (user.blockedUntil && user.blockedUntil > now) {
          return null;
        }

        const valid = verifyPin(pin, user.pinSalt, user.pinHash);
        if (!valid) {
          const newFailed = user.failedLogins + 1;
          const blockedUntil = newFailed >= MAX_FAILED_LOGINS ? new Date(now.getTime() + LOCKOUT_MS) : null;
          await db.user.update({
            where: { id: user.id },
            data: { failedLogins: newFailed, blockedUntil },
          });
          return null;
        }

        await db.user.update({
          where: { id: user.id },
          data: { failedLogins: 0, blockedUntil: null },
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role as Role,
          karyawanId: user.karyawan?.id ?? null,
          tenantId: user.tenantId ?? "",
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, account, profile }) {
      if (account?.provider === "google" && profile?.email) {
        const userEmail = profile.email.toLowerCase();
        let dbUser = await db.user.findUnique({
          where: { email: userEmail },
          include: { karyawan: true },
        });

        // Auto-provision or link Google account to employee if user record doesn't exist yet
        if (!dbUser) {
          const karyawan = await db.karyawan.findFirst({
            where: { email: userEmail },
          });

          if (karyawan) {
            const role: Role = karyawan.kategori === "STREAMER" ? "STREAMER" : "STAFF";
            const newUser = await db.user.create({
              data: {
                email: userEmail,
                name: profile.name ?? karyawan.namaLengkap,
                image: (profile as { picture?: string }).picture ?? null,
                role,
                tenantId: karyawan.tenantId,
              },
            });
            await db.karyawan.update({
              where: { id: karyawan.id },
              data: { userId: newUser.id },
            });
            dbUser = await db.user.findUnique({
              where: { id: newUser.id },
              include: { karyawan: true },
            });
          }
        }

        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role as Role;
          token.karyawanId = dbUser.karyawan?.id ?? null;
          token.tenantId = dbUser.tenantId ?? "";
        }
      } else if (user) {
        token.id = user.id;
        token.role = (user as { role?: Role }).role;
        token.karyawanId = (user as { karyawanId?: string | null }).karyawanId;
        token.tenantId = (user as { tenantId?: string }).tenantId;
      }
      return token;
    },
  },
});
