import { AppError } from "@/lib/errors";
import type { Role } from "@/generated/prisma/enums";

/**
 * Pure tenant-scoping helpers. Kept free of auth/db imports so they can be
 * unit-tested without the next-auth import chain.
 */

/**
 * Returns a tenant-scoped `where` fragment (for Prisma queries) restricting
 * reads/writes to the current user's tenant. Throws if the user has no tenant.
 */
export function tenantWhere(
  user: { tenantId: string; role: Role },
  field: string = "tenantId"
): Record<string, string> {
  if (user.role === "SUPER_ADMIN") return {}; // super admin sees all tenants
  if (!user.tenantId) throw AppError.forbidden("Akun tidak terkait tenant");
  return { [field]: user.tenantId };
}

/**
 * Enforces that the target tenantId is within the user's scope.
 * SUPER_ADMIN may pass any; others must match their tenant.
 */
export function assertTenantScope(
  user: { tenantId: string; role: Role },
  targetTenantId: string
) {
  if (user.role === "SUPER_ADMIN") return;
  if (!targetTenantId || targetTenantId !== user.tenantId) {
    throw AppError.forbidden("Akses lintas-tenant ditolak");
  }
}