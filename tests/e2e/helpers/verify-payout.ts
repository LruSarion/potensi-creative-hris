import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../src/generated/prisma/client";

/**
 * E2E payout verification helper (run via `npx tsx`).
 * Returns payout runs + lines with exact reconciliation math.
 *
 * Usage: npx tsx tests/e2e/helpers/verify-payout.ts --periode="Agustus 2026"
 */

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const args = process.argv.slice(2);
  const pArg = args.find((a) => a.startsWith("--periode="));
  const periode = pArg ? pArg.split("=")[1] : "Agustus 2026";

  const runs = await prisma.payoutRun.findMany({
    where: { periode },
    include: { lines: true },
    orderBy: { createdAt: "desc" },
  });

  const result = runs.map((r) => {
    // Reconciliation invariant: SUM(line.amount) == run.totalAmount
    // and each line.amount == streamerCut - deductions.
    const sumLines = r.lines.reduce((s, l) => s + Number(l.amount), 0);
    const sumStreamerCut = r.lines.reduce((s, l) => s + Number(l.streamerCut), 0);
    const sumDeductions = r.lines.reduce((s, l) => s + Number(l.deductions), 0);
    return {
      id: r.id,
      status: r.status,
      periode: r.periode,
      totalAmount: Number(r.totalAmount),
      deductions: Number(r.deductions),
      lineCount: r.lines.length,
      sumLines,
      sumStreamerCut,
      sumDeductions,
      linesReconcile: r.lines.every((l) => Number(l.amount) === Number(l.streamerCut) - Number(l.deductions)),
      totalReconcile: sumLines === Number(r.totalAmount),
    };
  });

  console.log(JSON.stringify({ count: result.length, runs: result }));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(JSON.stringify({ error: String(e) }));
  process.exit(1);
});
