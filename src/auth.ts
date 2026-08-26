import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/auth.config";
import { db } from "@/lib/db";
import { verifyPin, MAX_FAILED_LOGINS, LOCKOUT_MS } from "@/lib/pin";
import type { Role } from "@/generated/prisma/enums";

const googleClientId = process.env.GOOGLE_CLIENT_ID || process.env.AUTH_GOOGLE_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.AUTH_GOOGLE_SECRET;

const hasGoogleCreds = Boolean(
  googleClientId &&
  googleClientSecret &&
  googleClientId !== "" &&
  googleClientSecret !== "" &&
  googleClientId !== "demo-google-client-id.apps.googleusercontent.com"
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    ...(hasGoogleCreds
      ? [
          Google({
            clientId: googleClientId,
            clientSecret: googleClientSecret,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
    Credentials({
      name: "Email & PIN",
      credentials: {
        email: { label: "Email", type: "email" },
        pin: { label: "PIN", type: "password" },
        isFirebaseAuth: { label: "Firebase Auth", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.pin) return null;
        const email = String(credentials.email).trim().toLowerCase();
        const pin = String(credentials.pin).trim();

        const user = await db.user.findUnique({
          where: { email },
          include: { karyawan: true, accounts: true },
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

        // Link Google account to employee if user record doesn't exist yet
        if (!dbUser) {
          const karyawan = await db.karyawan.findFirst({
            where: { email: userEmail },
          });

          if (!karyawan) {
            // STRICT: Unregistered user is forbidden from logging in
            return {};
          }

          const role: Role = karyawan.kategori === "STREAMER" ? "STREAMER" : "STAFF";
          const { generateSalt, hashPin } = await import("@/lib/pin");
          const defaultSalt = generateSalt();
          const defaultPinHash = hashPin("1234", defaultSalt);

          const newUser = await db.user.create({
            data: {
              email: userEmail,
              name: profile.name ?? karyawan.namaLengkap,
              image: (profile as { picture?: string }).picture ?? null,
              role,
              pinHash: defaultPinHash,
              pinSalt: defaultSalt,
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

        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role as Role;
          token.karyawanId = dbUser.karyawan?.id ?? null;
          token.tenantId = dbUser.tenantId ?? "";

          // Persist or update Google OAuth account tokens in DB
          if (account?.providerAccountId) {
            try {
              await db.account.upsert({
                where: {
                  provider_providerAccountId: {
                    provider: "google",
                    providerAccountId: account.providerAccountId,
                  },
                },
                create: {
                  userId: dbUser.id,
                  type: account.type ?? "oauth",
                  provider: "google",
                  providerAccountId: account.providerAccountId,
                  access_token: account.access_token ?? null,
                  refresh_token: account.refresh_token ?? null,
                  expires_at: account.expires_at ?? null,
                  token_type: account.token_type ?? null,
                  scope: account.scope ?? null,
                  id_token: account.id_token ?? null,
                  session_state: (account.session_state as string) ?? null,
                },
                update: {
                  userId: dbUser.id,
                  access_token: account.access_token ?? undefined,
                  refresh_token: account.refresh_token ?? undefined,
                  expires_at: account.expires_at ?? undefined,
                  id_token: account.id_token ?? undefined,
                },
              });
            } catch (err) {
              console.error("[Auth NextAuth] Failed to upsert Google Account tokens:", err);
            }
          }
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
