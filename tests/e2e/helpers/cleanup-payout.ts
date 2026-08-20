import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../src/generated/prisma/client";

/**
 * E2E payout cleanup helper (run via `npx tsx`).
 * Usage: npx tsx tests/e2e/helpers/cleanup-payout.ts --id=<runId>
 */

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const args = process.argv.slice(2);
  const idArg = args.find((a) => a.startsWith("--id="));
  const id = idArg ? idArg.split("=")[1] : null;
  const periodeArg = args.find((a) => a.startsWith("--periode="));
  const periode = periodeArg ? periodeArg.split("=")[1] : null;

  const where = id ? { id } : periode ? { periode } : {};
  const res = await prisma.payoutRun.deleteMany({ where });
  console.log(JSON.stringify({ deleted: res.count }));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(String(e));
  process.exit(1);
});
