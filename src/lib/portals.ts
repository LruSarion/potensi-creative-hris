import type { Role } from "@/generated/prisma/enums";

/**
 * Central portal registry — single source of truth for slug, label, icon,
 * tint, and the roles that own each portal. Consumed by middleware, the
 * portal shell, requirePortal(), and the sidebar. Kept DOM-free (no JSX)
 * so it can be imported from Edge middleware and pure modules.
 */
export interface PortalDef {
  slug: string;
  label: string;
  icon: string;
  tint: string;
  roles: Role[];
}

export const PORTALS: PortalDef[] = [
  { slug: "client", label: "Client Portal", icon: "fa-building", tint: "bg-indigo-600", roles: ["CLIENT", "CLIENT_ADMIN", "SUPER_ADMIN"] },
  { slug: "streamer", label: "Streamer Portal", icon: "fa-video", tint: "bg-emerald-600", roles: ["STREAMER", "OTS", "SUPER_ADMIN"] },
  { slug: "operation", label: "Operation Portal", icon: "fa-gears", tint: "bg-amber-600", roles: ["OPERATION", "ADMIN_OPERASIONAL", "SUPER_ADMIN"] },
  { slug: "trainer", label: "Trainer Portal", icon: "fa-graduation-cap", tint: "bg-purple-600", roles: ["TRAINER", "SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION"] },
  { slug: "qc", label: "QC Portal", icon: "fa-magnifying-glass-chart", tint: "bg-rose-600", roles: ["QC_MANAGER", "QC_REVIEWER", "SUPER_ADMIN", "ADMIN_OPERASIONAL"] },
  { slug: "finance", label: "Finance Portal", icon: "fa-coins", tint: "bg-teal-600", roles: ["FINANCE", "FINANCE_MANAGER", "SUPER_ADMIN"] },
];

export type PortalSlug = (typeof PORTALS)[number]["slug"];

export const PORTAL_ROLES: Record<PortalSlug, Role[]> = Object.fromEntries(
  PORTALS.map((p) => [p.slug, p.roles])
) as Record<PortalSlug, Role[]>;

export function getPortal(slug: string): PortalDef | undefined {
  return PORTALS.find((p) => p.slug === slug);
}