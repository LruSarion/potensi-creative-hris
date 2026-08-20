import { apiHandler } from "@/lib/api-handler";
import { checkIn, checkOut, listAbsensi, getSesiAktif } from "@/lib/services/absensi";

export const GET = apiHandler(async (req: Request) => {
  const url = new URL(req.url);
  const karyawanId = url.searchParams.get("karyawanId") ?? undefined;
  const sesi = url.searchParams.get("sesi");
  if (sesi === "aktif" && karyawanId) return getSesiAktif(karyawanId);
  return listAbsensi({ karyawanId });
});

export const POST = apiHandler(async (req: Request) => {
  const body = await req.json();
  if (body.tipe === "CHECK_OUT") return checkOut(body);
  return checkIn(body);
});
