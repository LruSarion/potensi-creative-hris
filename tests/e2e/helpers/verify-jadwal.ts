import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../src/generated/prisma/client";

/**
 * E2E jadwal verification helper (run via `npx tsx`).
 * Returns a single jadwal row by idJadwal for exact DB assertions.
 *
 * Usage: npx tsx tests/e2e/helpers/verify-jadwal.ts --id=JDS/...
 */

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const args = process.argv.slice(2);
  const idArg = args.find((a) => a.startsWith("--id="));
  if (!idArg) throw new Error("Missing --id=<idJadwal>");
  const idJadwal = idArg.split("=")[1];

  const j = await prisma.jadwal.findFirst({ where: { idJadwal } });
  if (!j) {
    console.log(JSON.stringify({ found: false, idJadwal }));
    await prisma.$disconnect();
    process.exit(0);
  }

  console.log(JSON.stringify({
    found: true,
    id: j.id,
    idJadwal: j.idJadwal,
    tenantId: j.tenantId,
    platform: j.platform,
    streamerKaryawanId: j.streamerKaryawanId,
    cabangStudio: j.cabangStudio,
    nomorStudio: j.nomorStudio,
    status: j.status,
    jamMulaiLive: j.jamMulaiLive.toISOString(),
    jamSelesaiLive: j.jamSelesaiLive.toISOString(),
  }));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(JSON.stringify({ error: String(e) }));
  process.exit(1);
});
