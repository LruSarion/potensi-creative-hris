import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../src/generated/prisma/client";

/**
 * E2E jadwal cleanup helper (run via `npx tsx`).
 * Deletes a test jadwal row by its idJadwal.
 *
 * Usage: npx tsx tests/e2e/helpers/cleanup-jadwal.ts --id=JDS/...
 */

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const args = process.argv.slice(2);
  const idArg = args.find((a) => a.startsWith("--id="));
  if (!idArg) throw new Error("Missing --id=<idJadwal>");
  const idJadwal = idArg.split("=")[1];

  const j = await prisma.jadwal.findFirst({ where: { idJadwal } });
  if (j) {
    await prisma.jadwal.delete({ where: { id: j.id } });
    console.log(`deleted: ${idJadwal}`);
  } else {
    console.log(`not-found: ${idJadwal}`);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(String(e));
  process.exit(1);
});
