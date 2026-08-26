import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateSalt, hashPin } from "@/lib/pin";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");

    // Basic protection (can pass ?key=potensi-cron-secret-2026 or auto-seed if user count is 0)
    const count = await db.user.count().catch(() => 0);
    if (count > 0 && key !== process.env.CRON_SECRET) {
      return NextResponse.json({
        success: true,
        message: "Database already contains users. Pass ?key=CRON_SECRET to force re-seed.",
        userCount: count,
      });
    }

    // 1. Tenants
    const agency = await db.tenant.upsert({
      where: { id: "tenant-agency" },
      update: { name: "Potensi Creative", type: "AGENCY" },
      create: { id: "tenant-agency", name: "Potensi Creative", type: "AGENCY" },
    });
    const brand = await db.tenant.upsert({
      where: { id: "tenant-brand1" },
      update: { name: "Demo Brand (Client)", type: "CLIENT_BRAND" },
      create: { id: "tenant-brand1", name: "Demo Brand (Client)", type: "CLIENT_BRAND" },
    });

    // 2. Demo Users
    const demoUsers = [
      { email: "admin@potensicreative.test", name: "Admin Utama", role: "SUPER_ADMIN", pin: "1234", tenantId: agency.id },
      { email: "ops@potensicreative.test", name: "Ops Lead", role: "OPERATION", pin: "1234", tenantId: agency.id },
      { email: "trainer@potensicreative.test", name: "Trainer Utama", role: "TRAINER", pin: "1234", tenantId: agency.id },
      { email: "qc@potensicreative.test", name: "QC Reviewer", role: "QC_REVIEWER", pin: "1234", tenantId: agency.id },
      { email: "qc-manager@potensicreative.test", name: "QC Manager", role: "QC_MANAGER", pin: "1234", tenantId: agency.id },
      { email: "finance@potensicreative.test", name: "Finance Staff", role: "FINANCE", pin: "1234", tenantId: agency.id },
      { email: "finance-manager@potensicreative.test", name: "Finance Manager", role: "FINANCE_MANAGER", pin: "1234", tenantId: agency.id },
      { email: "client@potensicreative.test", name: "Client Demo", role: "CLIENT", pin: "1234", tenantId: brand.id },
      { email: "client-admin@potensicreative.test", name: "Client Admin", role: "CLIENT_ADMIN", pin: "1234", tenantId: brand.id },
      { email: "streamer@potensicreative.test", name: "Streamer Demo", role: "STREAMER", pin: "1234", tenantId: agency.id },
      { email: "staff@potensicreative.test", name: "Staff Demo", role: "STAFF", pin: "1234", tenantId: agency.id },
      { email: "ots@potensicreative.test", name: "OTS Demo", role: "OTS", pin: "1234", tenantId: agency.id },
    ];

    for (const u of demoUsers) {
      const salt = generateSalt();
      const pinHash = hashPin(u.pin, salt);
      await db.user.upsert({
        where: { email: u.email },
        update: { name: u.name, role: u.role as any, pinHash, pinSalt: salt, tenantId: u.tenantId },
        create: {
          email: u.email,
          name: u.name,
          role: u.role as any,
          pinHash,
          pinSalt: salt,
          tenantId: u.tenantId,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Database demo users seeded successfully!",
      seededUsers: demoUsers.map((u) => u.email),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
