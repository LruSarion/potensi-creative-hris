import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../src/generated/prisma/client";

/**
 * E2E cleanup helper (run via `npx tsx`).
 * Deletes a test Karyawan row by its idKaryawan.
 *
 * Usage: npx tsx tests/e2e/helpers/cleanup-karyawan.ts --id=PCE2E...
 */

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const args = process.argv.slice(2);
  const idArg = args.find((a) => a.startsWith("--id="));
  if (!idArg) throw new Error("Missing --id=<idKaryawan>");
  const idKaryawan = idArg.split("=")[1];

  const k = await prisma.karyawan.findFirst({ where: { idKaryawan } });
  if (k) {
    await prisma.karyawan.delete({ where: { id: k.id } });
    console.log(`deleted: ${idKaryawan}`);
  } else {
    console.log(`not-found: ${idKaryawan}`);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(String(e));
  process.exit(1);
});
