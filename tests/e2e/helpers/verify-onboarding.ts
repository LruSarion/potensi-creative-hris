import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../src/generated/prisma/client";

/**
 * E2E DB verification helper (run via `npx tsx`).
 * The Prisma client is generated as ESM; Playwright transpiles specs to CJS,
 * so we execute DB assertions in a separate tsx process to avoid ESM/CJS mismatch.
 *
 * Usage: npx tsx tests/e2e/helpers/verify-onboarding.ts --id=PCS-E2E123
 */

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const args = process.argv.slice(2);
  const idArg = args.find((a) => a.startsWith("--id="));
  if (!idArg) throw new Error("Missing --id=<idKaryawan>");
  const idKaryawan = idArg.split("=")[1];

  const k = await prisma.karyawan.findFirst({
    where: { idKaryawan },
    include: { user: true, tenant: true },
  });

  if (!k) {
    console.log(JSON.stringify({ found: false, idKaryawan }));
    await prisma.$disconnect();
    process.exit(0);
  }

  const streamerCut = Number(k.streamerCutPct);
  const agencyCut = Number(k.agencyCutPct);

  const result = {
    found: true,
    id: k.id,
    idKaryawan: k.idKaryawan,
    namaLengkap: k.namaLengkap,
    email: k.email,
    kategori: k.kategori,
    statusAktif: k.statusAktif,
    tenantId: k.tenantId,
    streamerCutPct: streamerCut,
    agencyCutPct: agencyCut,
    sum: streamerCut + agencyCut,
    linkedUser: !!k.user,
  };

  console.log(JSON.stringify(result));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(JSON.stringify({ error: String(e) }));
  process.exit(1);
});
