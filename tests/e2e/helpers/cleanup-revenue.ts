import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../src/generated/prisma/client";

/**
 * E2E revenue cleanup helper (run via `npx tsx`).
 * Usage: npx tsx tests/e2e/helpers/cleanup-revenue.ts --streamer=<id>
 */

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const args = process.argv.slice(2);
  const sArg = args.find((a) => a.startsWith("--streamer="));
  const streamer = sArg ? sArg.split("=")[1] : undefined;
  const res = await prisma.revenueEntry.deleteMany({ where: streamer ? { streamerKaryawanId: streamer } : {} });
  console.log(JSON.stringify({ deleted: res.count }));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(String(e));
  process.exit(1);
});
