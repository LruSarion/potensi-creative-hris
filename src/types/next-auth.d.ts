import type { DefaultSession } from "next-auth";
import type { Role } from "@/generated/prisma/enums";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      karyawanId: string | null;
      tenantId: string;
      jabatan?: string | null;
      nik?: string | null;
      idKaryawan?: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: Role;
    karyawanId?: string | null;
    tenantId?: string;
    jabatan?: string | null;
    nik?: string | null;
    idKaryawan?: string | null;
  }
}
