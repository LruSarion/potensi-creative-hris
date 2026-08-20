import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../src/generated/prisma/client";

/**
 * E2E webhook verification helper (run via `npx tsx`).
 * Returns a jadwal's live state + durationSec + state-log count.
 *
 * Usage: npx tsx tests/e2e/helpers/verify-webhook.ts --id=JDS/...
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
    console.log(JSON.stringify({ found: false }));
    await prisma.$disconnect();
    process.exit(0);
  }

  const logs = await prisma.sessionStateLog.count({ where: { jadwalId: j.id } });

  console.log(JSON.stringify({
    found: true,
    id: j.id,
    idJadwal: j.idJadwal,
    liveState: j.liveState,
    status: j.status,
    durationSec: j.durationSec,
    stateLogCount: logs,
    jamMulaiLive: j.jamMulaiLive.toISOString(),
    jamSelesaiLive: j.jamSelesaiLive.toISOString(),
  }));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(JSON.stringify({ error: String(e) }));
  process.exit(1);
});
