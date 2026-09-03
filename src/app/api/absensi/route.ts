import { apiHandler } from "@/lib/api-handler";
import { checkIn, checkOut, listAbsensi, getSesiAktif, submitAbsenTerbatas, updateGmv } from "@/lib/services/absensi";

export const GET = apiHandler(async (req: Request) => {
  const url = new URL(req.url);
  const karyawanId = url.searchParams.get("karyawanId") ?? undefined;
  const sesi = url.searchParams.get("sesi");
  const view = url.searchParams.get("view") ?? undefined;
  const kategori = url.searchParams.get("kategori") ?? undefined;
  if (sesi === "aktif" && karyawanId) return getSesiAktif(karyawanId);
  return listAbsensi({ karyawanId, view, kategori });
});

export const POST = apiHandler(async (req: Request) => {
  const body = await req.json();
  if (body.tipeForm === "PULANG_TELAT" || body.tipeForm === "MASUK_PULANG_TERBATAS") {
    return submitAbsenTerbatas(body);
  }
  if (body.tipe === "CHECK_OUT") return checkOut(body);
  return checkIn(body);
});

export const PATCH = apiHandler(async (req: Request) => {
  const body = await req.json();
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) throw new Error("ID Absensi required");
  return updateGmv(id, body);
});

