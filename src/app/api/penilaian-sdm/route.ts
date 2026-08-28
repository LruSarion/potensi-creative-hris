import { apiHandler } from "@/lib/api-handler";
import { submitPenilaian, submitBatchPenilaian, listPenilaian } from "@/lib/services/penilaian-sdm";

export const GET = apiHandler(async (req: Request) => {
  const url = new URL(req.url);
  const karyawanId = url.searchParams.get("karyawanId") ?? undefined;
  const leaderboard = url.searchParams.get("leaderboard") === "1";
  const view = url.searchParams.get("view") ?? undefined;
  const periode = url.searchParams.get("periode") ?? undefined;
  const targetRole = url.searchParams.get("role") ?? undefined;

  return listPenilaian({ karyawanId, leaderboard, view, periode, targetRole });
});

export const POST = apiHandler(async (req: Request) => {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  const body = await req.json();

  if (action === "batch") {
    return submitBatchPenilaian(body.items || []);
  }

  return submitPenilaian(body);
});
