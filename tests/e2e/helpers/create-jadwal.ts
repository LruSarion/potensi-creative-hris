import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../src/generated/prisma/client";

/**
 * E2E helper to create a scheduled session directly (run via `npx tsx`).
 * Usage: npx tsx tests/e2e/helpers/create-jadwal.ts --id=JDS/... --streamer=<id> --tenant=<id> --start=<ms> --end=<ms>
 */

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

function arg(name: string): string {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  if (!a) throw new Error(`Missing --${name}=`);
  return a.split("=")[1];
}

async function main() {
  const idJadwal = arg("id");
  const streamer = arg("streamer");
  const tenant = arg("tenant");
  const start = new Date(Number(arg("start")));
  const end = new Date(Number(arg("end")));

  const existing = await prisma.jadwal.findFirst({ where: { idJadwal } });
  if (existing) {
    console.log(JSON.stringify({ created: false, id: existing.id }));
    await prisma.$disconnect();
    process.exit(0);
  }

  const j = await prisma.jadwal.create({
    data: {
      idJadwal,
      tenantId: tenant,
      streamerKaryawanId: streamer,
      tanggal: start, // required date field
      cabangStudio: "Timoho",
      nomorStudio: "01",
      jamMulaiLive: start,
      jamSelesaiLive: end,
      status: "TERJADWAL",
      liveState: "SCHEDULED",
      periodeBulan: "Agustus 2026",
    },
  });
  console.log(JSON.stringify({ created: true, id: j.id }));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(String(e));
  process.exit(1);
});
