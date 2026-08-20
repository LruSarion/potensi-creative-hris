import { apiHandler } from "@/lib/api-handler";
import { submitPenilaian, listPenilaian } from "@/lib/services/penilaian-sdm";

export const GET = apiHandler(async (req: Request) => {
  const url = new URL(req.url);
  const karyawanId = url.searchParams.get("karyawanId") ?? undefined;
  const leaderboard = url.searchParams.get("leaderboard") === "1";
  return listPenilaian({ karyawanId, leaderboard });
});

export const POST = apiHandler(async (req: Request) => {
  const body = await req.json();
  return submitPenilaian(body);
});
