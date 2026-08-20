import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../src/generated/prisma/client";

/**
 * E2E helper to seed a webhook-completed session (liveState=REVIEW, durationSec set).
 * Usage: npx tsx tests/e2e/helpers/seed-uptime.ts --streamer=<id> --sec=<seconds>
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
  const durationSec = Number(arg("duration"));
  const start = new Date(Date.now() - 3_600_000);
  const end = new Date(start.getTime() + durationSec * 1000);

  const j = await prisma.jadwal.create({
    data: {
      idJadwal: `JDS/DASH${Math.floor(Math.random() * 9999)}`,
      tenantId: "tenant-agency",
      streamerKaryawanId: streamer,
      tanggal: start,
      cabangStudio: "Timoho",
      nomorStudio: "01",
      jamMulaiLive: start,
      jamSelesaiLive: end,
      status: "SELESAI",
      liveState: "REVIEW",
      durationSec,
      periodeBulan: "Agustus 2026",
    },
  });
  console.log(JSON.stringify({ idJadwal: j.idJadwal, id: j.id }));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(String(e));
  process.exit(1);
});
