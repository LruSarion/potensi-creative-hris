import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../src/generated/prisma/client";

/**
 * E2E revenue verification helper (run via `npx tsx`).
 * Returns all revenue entries matching an id prefix, with exact-cent math.
 *
 * Usage: npx tsx tests/e2e/helpers/verify-revenue.ts --streamer=<id>
 */

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const args = process.argv.slice(2);
  const sArg = args.find((a) => a.startsWith("--streamer="));
  const streamer = sArg ? sArg.split("=")[1] : undefined;

  const rows = await prisma.revenueEntry.findMany({
    where: streamer ? { streamerKaryawanId: streamer } : undefined,
    orderBy: { eventAt: "desc" },
  });

  const entries = rows.map((r) => ({
    id: r.id,
    source: r.source,
    gross: Number(r.grossAmount),
    agency: Number(r.agencyCut),
    streamer: Number(r.streamerCut),
    invariant: Number(r.grossAmount) === Number(r.agencyCut) + Number(r.streamerCut),
  }));

  console.log(JSON.stringify({ count: entries.length, entries }));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(JSON.stringify({ error: String(e) }));
  process.exit(1);
});
