import { describe, it, expect } from "vitest";
import { tenantWhere, assertTenantScope } from "@/lib/tenant";

describe("tenantWhere", () => {
  const agencyUser = { tenantId: "tenant-agency", role: "OPERATION" as const };
  const brandUser = { tenantId: "tenant-brand1", role: "CLIENT" as const };
  const superAdmin = { tenantId: "", role: "SUPER_ADMIN" as const };

  it("scopes a normal user to their tenant", () => {
    expect(tenantWhere(agencyUser)).toEqual({ tenantId: "tenant-agency" });
    expect(tenantWhere(brandUser, "clientId")).toEqual({ clientId: "tenant-brand1" });
  });

  it("lets SUPER_ADMIN see all tenants (empty filter)", () => {
    expect(tenantWhere(superAdmin)).toEqual({});
  });

  it("throws for a user with no tenant", () => {
    const noTenant = { tenantId: "", role: "OPERATION" as const };
    expect(() => tenantWhere(noTenant)).toThrow();
  });
});

describe("assertTenantScope", () => {
  const agencyUser = { tenantId: "tenant-agency", role: "OPERATION" as const };

  it("allows access to own tenant", () => {
    expect(() => assertTenantScope(agencyUser, "tenant-agency")).not.toThrow();
  });

  it("rejects cross-tenant access", () => {
    expect(() => assertTenantScope(agencyUser, "tenant-brand1")).toThrow();
  });

  it("allows SUPER_ADMIN to access any tenant", () => {
    const superAdmin = { tenantId: "", role: "SUPER_ADMIN" as const };
    expect(() => assertTenantScope(superAdmin, "tenant-brand1")).not.toThrow();
  });
});