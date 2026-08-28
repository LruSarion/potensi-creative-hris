import { apiHandler } from "@/lib/api-handler";
import {
  requestTukarShift,
  confirmTukarShift,
  processTukarShift,
  listTukarShift,
  getTukarShiftFormData,
  cekBentrokJadwal,
} from "@/lib/services/tukar-shift";

export const GET = apiHandler(async (req: Request) => {
  const url = new URL(req.url);
  const view = url.searchParams.get("view");
  const karyawanId = url.searchParams.get("karyawanId") ?? undefined;
  const roleType = url.searchParams.get("roleType") ?? undefined;

  if (view === "form_data" || view === "initial") {
    return getTukarShiftFormData(roleType);
  }

  return listTukarShift({ karyawanId, roleType });
});

export const POST = apiHandler(async (req: Request) => {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  const body = await req.json();

  if (action === "cek_bentrok" || body.action === "cekBentrok") {
    return cekBentrokJadwal({
      tanggal: body.Tanggal || body.tanggal,
      idHost: body.ID_Host || body.idHost || body.idPengganti,
      jamMulai: body.Jam_Mulai || body.jamMulai,
      jamSelesai: body.Jam_Selesai || body.jamSelesai,
    });
  }

  return requestTukarShift(body);
});

export const PATCH = apiHandler(async (req: Request) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const approve = url.searchParams.get("approve");
  const action = url.searchParams.get("action");

  if (!id) throw new Error("ID Pengajuan required");
  if (action === "confirm") return confirmTukarShift(id);
  if (approve !== null) return processTukarShift(id, approve === "true");
  throw new Error("Unknown action");
});
