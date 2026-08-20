import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import type { Role } from "@/generated/prisma/enums";

/**
 * Edge-safe Auth config for middleware.
 * Does NOT import Prisma/adapter (not available in Edge runtime).
 * Only used for route protection in middleware.
 */
const hasGoogleCreds = Boolean(
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_SECRET &&
  process.env.GOOGLE_CLIENT_ID !== "" &&
  process.env.GOOGLE_CLIENT_SECRET !== ""
);

export const authConfig = {
  providers: [
    ...(hasGoogleCreds
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
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
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) ?? (token.sub as string) ?? "";
        session.user.role = token.role as Role;
        session.user.karyawanId = (token.karyawanId as string | null) ?? null;
        session.user.tenantId = (token.tenantId as string) ?? "";
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
