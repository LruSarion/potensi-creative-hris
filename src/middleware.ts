import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";
import { PORTALS } from "@/lib/portals";

// Public routes that don't require auth.
const PUBLIC_ROUTES = ["/login"];

// Portal route prefixes -> allowed roles, derived from the central registry.
const PORTAL_ROUTES: Record<string, string[]> = Object.fromEntries(
  PORTALS.map((p) => [`/portal/${p.slug}`, p.roles as string[]])
);

// Legacy admin routes -> allowed roles.
const ROLE_ROUTES: Record<string, string[]> = {
  "/payroll": ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "FINANCE", "FINANCE_MANAGER"],
  "/view-data": ["SUPER_ADMIN", "ADMIN_OPERASIONAL"],
  "/input-karyawan": ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION"],
  "/approval": ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "CLIENT", "CLIENT_ADMIN"],
  "/history-log": ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION"],
  "/streamer-directory": ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION", "TRAINER", "CLIENT", "CLIENT_ADMIN"],
  "/pipeline": ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION", "CLIENT", "CLIENT_ADMIN"],
};

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth?.user;
  const role = req.auth?.user?.role as string | undefined;

  // Allow public routes.
  if (PUBLIC_ROUTES.some((r) => pathname.startsWith(r))) {
    return NextResponse.next();
  }

  // API routes (except /api/auth) handle their own auth via requireRole -> 401 JSON.
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }
  if (pathname.startsWith("/api/")) {
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
      // Denied: redirect to dashboard (root app shell).
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  // Legacy admin route protection.
  for (const [route, roles] of Object.entries(ROLE_ROUTES)) {
    if (pathname.startsWith(route)) {
      if (role && roles.includes(role)) {
        return NextResponse.next();
      }
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
