import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import type { Role } from "@/generated/prisma/enums";

/**
 * Edge-safe Auth config for middleware/proxy.
 * Does NOT import Prisma/adapter (not available in Edge runtime).
 * Only used for route protection in proxy/middleware.
 */
const googleClientId = process.env.GOOGLE_CLIENT_ID || process.env.AUTH_GOOGLE_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.AUTH_GOOGLE_SECRET;

const hasGoogleCreds = Boolean(
  googleClientId &&
  googleClientSecret &&
  googleClientId !== "" &&
  googleClientSecret !== "" &&
  googleClientId !== "demo-google-client-id.apps.googleusercontent.com"
);

export const authConfig = {
  providers: [
    ...(hasGoogleCreds
      ? [
          Google({
            clientId: googleClientId,
            clientSecret: googleClientSecret,
          }),
        ]
      : [
          // Fallback provider to satisfy NextAuth config assertion in edge/proxy runtime
          Credentials({
            name: "Credentials",
            credentials: {},
            authorize: async () => null,
          }),
        ]),
  ],
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "ed98a06860607f40cb199700d73f54aaa3d68d79572a797e8233972e47282f71",
  session: { strategy: "jwt" },
  trustHost: true,
  pages: { signIn: "/login" },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: Role }).role;
        token.karyawanId = (user as { karyawanId?: string | null }).karyawanId;
        token.tenantId = (user as { tenantId?: string }).tenantId;
        token.jabatan = (user as { jabatan?: string | null }).jabatan ?? null;
        token.nik = (user as { nik?: string | null }).nik ?? null;
        token.idKaryawan = (user as { idKaryawan?: string | null }).idKaryawan ?? null;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) ?? (token.sub as string) ?? "";
        session.user.role = token.role as Role;
        session.user.karyawanId = (token.karyawanId as string | null) ?? null;
        session.user.tenantId = (token.tenantId as string) ?? "";
        session.user.jabatan = (token.jabatan as string | null) ?? null;
        session.user.nik = (token.nik as string | null) ?? null;
        session.user.idKaryawan = (token.idKaryawan as string | null) ?? null;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
