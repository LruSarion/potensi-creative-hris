import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../src/generated/prisma/client";

/**
 * E2E revenue seeding helper (run via `npx tsx`).
 * Creates a revenue entry directly for a streamer.
 * Usage: npx tsx tests/e2e/helpers/create-revenue.ts --streamer=<id> --gross=<amount> --source=<GIFT|BITS|...>
 */

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

function arg(name: string): string {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  if (!a) throw new Error(`Missing --${name}=`);
  return a.split("=")[1];
}

async function main() {
  const streamer = arg("streamer");
  const gross = Number(arg("gross"));
  const source = arg("source") as "BITS" | "GIFT" | "SUBSCRIPTION" | "BRAND_DEAL" | "OTHER";

  // Default split 70/30.
  const streamerCut = Math.round((gross * 70) / 100);
  const agencyCut = gross - streamerCut;

  const entry = await prisma.revenueEntry.create({
    data: {
      tenantId: "tenant-agency",
      streamerKaryawanId: streamer,
      source,
      grossAmount: gross,
      streamerCut,
      agencyCut,
    },
  });
  console.log(JSON.stringify({ id: entry.id, gross, streamerCut, agencyCut }));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(String(e));
  process.exit(1);
});
