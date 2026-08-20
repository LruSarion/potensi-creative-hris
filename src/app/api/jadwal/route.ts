import { apiHandler } from "@/lib/api-handler";
import {
  listJadwal,
  getJadwal,
  createJadwal,
  updateJadwal,
  createJadwalBatch,
} from "@/lib/services/jadwal";

export const GET = apiHandler(async (req: Request) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (id) return getJadwal(id);
  const streamerKaryawanId = url.searchParams.get("streamerKaryawanId") ?? undefined;
  const tanggal = url.searchParams.get("tanggal") ?? undefined;
  return listJadwal({ streamerKaryawanId, tanggal });
});

export const POST = apiHandler(async (req: Request) => {
  const body = await req.json();
  // Batch mode: { batch: [...] }
  if (Array.isArray(body)) return createJadwalBatch(body);
  if (body && Array.isArray(body.batch)) return createJadwalBatch(body.batch);
  return createJadwal(body);
});

export const PUT = apiHandler(async (req: Request) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) throw new Error("id required");
  const body = await req.json();
  return updateJadwal(id, body);
});
