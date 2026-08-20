import { auth } from "@/auth";
import { AppError } from "@/lib/errors";
import { tenantWhere, assertTenantScope } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { PORTAL_ROLES, type PortalSlug } from "@/lib/portals";
import type { Role } from "@/generated/prisma/enums";

export { tenantWhere, assertTenantScope };

export type CurrentUser = {
  id: string;
  email: string;
  name?: string | null;
  role: Role;
  karyawanId: string | null;
  tenantId: string;
};

export type Portal = PortalSlug | "admin";

/** Allowed roles for the legacy "admin" pseudo-portal (SUPER_ADMIN + operations lead). */
const ADMIN_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN_OPERASIONAL"];

/**
 * Returns the currently authenticated user (with role + karyawanId + tenantId) or null.
 * Server-only.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth();
  if (!session?.user?.email) return null;
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
    karyawanId: session.user.karyawanId ?? null,
    tenantId: session.user.tenantId ?? "",
  };
}

/**
 * Throws if the current user is not authenticated or lacks one of the allowed roles.
 * Returns the user on success.
 */
export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw AppError.unauthorized();
  }
  if (roles.length > 0 && !roles.includes(user.role)) {
    throw AppError.forbidden("Forbidden: insufficient role");
  }
  return user;
}

/** Convenience: require any authenticated user. */
export async function requireAuth(): Promise<CurrentUser> {
  return requireRole();
}

/**
 * Capability-based guard. Throws unless the authenticated user's role grants
 * ALL of the required permissions (SUPER_ADMIN is granted everything).
 * Single source of truth is the PERMISSIONS map in lib/permissions.ts.
 */
export async function requirePermission(...perms: string[]): Promise<CurrentUser> {
  const user = await requireRole();
  if (perms.length > 0 && !perms.every((p) => hasPermission(user.role, p))) {
    throw AppError.forbidden(`Forbidden: missing permission(s) ${perms.join(", ")}`);
  }
  return user;
}

/**
 * Require membership in a portal (role-based), returns the user.
 * Role sets are sourced from the central portal registry (lib/portals.ts).
 * SUPER_ADMIN is a member of every portal; "admin" maps to SUPER_ADMIN/ADMIN_OPERASIONAL.
 */
export async function requirePortal(portal: Portal): Promise<CurrentUser> {
  const user = await requireRole();
  const allowed = portal === "admin" ? ADMIN_ROLES : PORTAL_ROLES[portal as PortalSlug] ?? [];
  if (!allowed.includes(user.role)) {
    throw AppError.forbidden(`Forbidden: not a member of the ${portal} portal`);
  }
  return user;
}