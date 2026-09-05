import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";
import { PORTALS } from "@/lib/portals";

// Public routes that don't require auth.
const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/privacy",
  "/privacy-policy",
  "/terms",
  "/terms-of-service",
  "/about",
];

// Portal route prefixes -> allowed roles, derived from the central registry.
const PORTAL_ROUTES: Record<string, string[]> = Object.fromEntries(
  PORTALS.map((p) => [`/portal/${p.slug}`, p.roles as string[]])
);

// Legacy admin routes -> allowed roles.
const ROLE_ROUTES: Record<string, string[]> = {
  "/payroll": ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "FINANCE", "FINANCE_MANAGER"],
  "/view-data": ["SUPER_ADMIN", "ADMIN_OPERASIONAL"],
  "/input-karyawan": ["SUPER_ADMIN", "ADMIN_OPERASIONAL"],
  "/approval": ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "CLIENT", "CLIENT_ADMIN"],
  "/history-log": ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION"],
  "/streamer-directory": ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION", "TRAINER", "CLIENT", "CLIENT_ADMIN"],
  "/pipeline": ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION", "CLIENT", "CLIENT_ADMIN"],
  "/sop-management": ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION"],
  "/migration": ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "FINANCE", "FINANCE_MANAGER"],
  "/dashboard": ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION", "FINANCE", "FINANCE_MANAGER", "QC_MANAGER", "QC_REVIEWER", "STREAMER", "STAFF", "OTS", "CLIENT", "CLIENT_ADMIN"],
  "/qc-violations": ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "QC_MANAGER", "QC_REVIEWER"],
  "/input-jadwal": ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION", "CLIENT", "CLIENT_ADMIN"],
  "/client": ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION", "CLIENT", "CLIENT_ADMIN"],
  "/pengajuan-izin": ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION", "TRAINER", "STREAMER", "STAFF", "OTS"],
  "/pengajuan-lembur": ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION", "TRAINER", "STREAMER", "STAFF", "OTS"],
  "/tukar-shift": ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION", "STREAMER", "STAFF"],
  "/penilaian-sdm": ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION", "QC_MANAGER", "QC_REVIEWER"],
  "/suara-karyawan": ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION", "TRAINER", "FINANCE", "FINANCE_MANAGER", "QC_REVIEWER", "STREAMER", "STAFF", "OTS"],
  "/streamer-dashboard": ["STREAMER", "SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION"],
  "/staff-dashboard": ["STAFF", "OTS", "SUPER_ADMIN", "ADMIN_OPERASIONAL"],
};

const { auth } = NextAuth(authConfig);

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth?.user;
  const role = req.auth?.user?.role as string | undefined;

  // Always bypass API routes so they handle their own JSON responses and are never redirected to HTML /login
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Allow public routes (exact match for "/" or prefix for specific subpaths).
  if (pathname === "/" || PUBLIC_ROUTES.some((r) => r !== "/" && pathname.startsWith(r))) {
    return NextResponse.next();
  }

  // Redirect unauthenticated users to login.
  if (!isLoggedIn) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  // Portal route protection.
  for (const [route, roles] of Object.entries(PORTAL_ROUTES)) {
    if (pathname.startsWith(route)) {
      if (role && roles.includes(role)) {
        return NextResponse.next();
      }
      const redirectTarget = role === "TRAINER" ? "/portal/trainer" : "/dashboard";
      return NextResponse.redirect(new URL(redirectTarget, req.url));
    }
  }

  // Legacy admin route protection.
  for (const [route, roles] of Object.entries(ROLE_ROUTES)) {
    if (pathname.startsWith(route)) {
      if (role && roles.includes(role)) {
        return NextResponse.next();
      }
      const redirectTarget = role === "TRAINER" ? "/portal/trainer" : "/dashboard";
      return NextResponse.redirect(new URL(redirectTarget, req.url));
    }
  }

  return NextResponse.next();
});

export default proxy;

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
