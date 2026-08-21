import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { logAktivitas } from "@/lib/audit";
import { getTelegramConfig, sendTelegramMessage } from "@/lib/services/telegram";
import { lastCheckOutTime } from "@/lib/services/absensi";

type AbsensiState = {
  tipe: "CHECK_IN" | "CHECK_OUT";
  step: "awaiting_photo" | "awaiting_location";
  photoUrl?: string;
};

export async function handleTelegramAbsensiMessage(
  chatId: number,
  text: string,
  cfg: Awaited<ReturnType<typeof getTelegramConfig>>,
  photoFileId?: string,
  location?: { latitude: number; longitude: number }
) {
  const user = await db.user.findUnique({ where: { telegramChatId: String(chatId) }, include: { karyawan: true } });
  if (!user) {
    await sendTelegramMessage(String(chatId), "Akun belum terhubung ke aplikasi HRIS.", cfg);
    return;
  }
  const state = (user.telegramAbsensiState ?? {}) as AbsensiState;

  if (!state?.step) {
    // Fresh interaction: offer check-in / check-out buttons.
    const kb = {
      inline_keyboard: [
        [{ text: "✅ Absen Masuk", callback_data: "ABSEN_IN" }],
        [{ text: "🚪 Absen Pulang", callback_data: "ABSEN_OUT" }],
      ],
    };
    await sendTelegramKeyboard(String(chatId), "Absensi HRIS. Pilih aksi:", kb, cfg);
    return;
  }

  if (state.step === "awaiting_photo") {
    if (!photoFileId) {
      await sendTelegramMessage(String(chatId), "Kirim foto selfie kamu untuk bukti absensi.", cfg);
      return;
    }
    const photoUrl = await resolvePhotoUrl(photoFileId, cfg);
    await db.user.update({
      where: { id: user.id },
      data: { telegramAbsensiState: { ...state, step: "awaiting_location", photoUrl: photoUrl ?? null } },
    });
    await sendTelegramMessage(
      String(chatId),
      "Foto diterima ✅\nSekarang bagikan lokasi kamu: tekan ikon 📎 → Lokasi.",
      cfg
    );
    return;
  }

  if (state.step === "awaiting_location") {
    if (!location) {
      await sendTelegramMessage(String(chatId), "Bagikan lokasi kamu: tekan ikon 📎 → Lokasi.", cfg);
      return;
    }
    const result = await recordAbsensi(user, state, location, cfg);
    await db.user.update({ where: { id: user.id }, data: { telegramAbsensiState: Prisma.DbNull } });
    await sendTelegramMessage(String(chatId), result.message, cfg);
  }
}

async function recordAbsensi(
  user: { id: string; karyawan: { id: string } | null; role?: string; tenantId?: string | null },
  state: AbsensiState,
  location: { latitude: number; longitude: number },
  cfg: Awaited<ReturnType<typeof getTelegramConfig>>
) {
  const karyawanId = user.karyawan?.id ?? null;
  if (!karyawanId) return { message: "Akun tidak terhubung ke karyawan. Hubungi admin." };

  const tipe = state.tipe === "CHECK_IN" ? "CHECK_IN" : "CHECK_OUT";
  const catatan = `Telegram: ${location.latitude},${location.longitude} · via bot`;
  const kategori = (await resolveKategori(user.role)) as any;

  if (tipe === "CHECK_IN") {
    const open = await db.absensi.findFirst({
      where: {
        karyawanId,
        tipe: "CHECK_IN",
        waktu: { gte: await lastCheckOutTime(karyawanId) },
      },
      orderBy: { waktu: "desc" },
    });
    if (open) return { message: "Sesi absensi masih aktif. Lakukan check-out terlebih dahulu." };
    const record = await db.absensi.create({
      data: {
        tenantId: user.tenantId ?? undefined,
        karyawanId,
        tipe: "CHECK_IN",
        kategori,
        buktiDriveId: state.photoUrl ?? null,
        catatan,
      },
    });
    // Sync any SCHEDULED session for this karyawan to LIVE (mirrors web check-in).
    await syncLiveStateOnCheckIn(record.jadwalId, user.id, user.tenantId ?? undefined).catch(() => undefined);
    await logAktivitas({ userId: user.id, tenantId: user.tenantId ?? null, aksi: "TELEGRAM_ABSENSI", detail: JSON.stringify({ tipe: "CHECK_IN", karyawanId, lat: location.latitude, lon: location.longitude }) });
    return { message: "✅ Absen Masuk tercatat!\nLokasi: " + `${location.latitude},${location.longitude}` };
  }

  const openIn = await db.absensi.findFirst({
    where: { karyawanId, tipe: "CHECK_IN" },
    orderBy: { waktu: "desc" },
  });
  if (!openIn) return { message: "Belum ada check-in hari ini. Lakukan Absen Masuk dulu." };
  await db.absensi.create({
    data: {
      tenantId: user.tenantId ?? undefined,
      karyawanId,
      jadwalId: openIn.jadwalId ?? null,
      tipe: "CHECK_OUT",
      kategori,
      buktiDriveId: state.photoUrl ?? null,
      catatan,
    },
  });
  // Sync the session to REVIEW on check-out (mirrors web check-out).
  if (openIn.jadwalId) {
    await syncLiveStateOnCheckOut(openIn.jadwalId, user.id, user.tenantId ?? undefined).catch(() => undefined);
  }
  await logAktivitas({ userId: user.id, tenantId: user.tenantId ?? null, aksi: "TELEGRAM_ABSENSI", detail: JSON.stringify({ tipe: "CHECK_OUT", karyawanId, lat: location.latitude, lon: location.longitude }) });
  return { message: "🚪 Absen Pulang tercatat!\nLokasi: " + `${location.latitude},${location.longitude}` };
}

async function syncLiveStateOnCheckIn(jadwalId: string | null, userId: string, tenantId?: string) {
  if (!jadwalId) return;
  const j = await db.jadwal.findUnique({ where: { id: jadwalId } });
  if (j && j.liveState === "SCHEDULED") {
    await db.jadwal.update({ where: { id: jadwalId }, data: { liveState: "LIVE" } });
    await db.sessionStateLog.create({
      data: {
        tenantId: tenantId ?? undefined,
        jadwalId,
        fromState: "SCHEDULED",
        toState: "LIVE",
        changedById: userId,
        note: "Auto-transition on Telegram Check-In",
      },
    });
  }
}

async function syncLiveStateOnCheckOut(jadwalId: string, userId: string, tenantId?: string) {
  const j = await db.jadwal.findUnique({ where: { id: jadwalId } });
  if (j && (j.liveState === "LIVE" || j.liveState === "SCHEDULED")) {
    await db.jadwal.update({ where: { id: jadwalId }, data: { liveState: "REVIEW", status: "SELESAI" } });
    await db.sessionStateLog.create({
      data: {
        tenantId: tenantId ?? undefined,
        jadwalId,
        fromState: j.liveState,
        toState: "REVIEW",
        changedById: userId,
        note: "Auto-transition on Telegram Check-Out",
      },
    });
  }
}

async function resolveKategori(role?: string) {
  if (role === "STREAMER" || role === "OTS") return "STREAMER";
  if (role === "FINANCE" || role === "OPERATION") return "STAFF";
  return "STAFF";
}

async function resolvePhotoUrl(fileId: string, cfg: Awaited<ReturnType<typeof getTelegramConfig>>) {
  if (!cfg.botToken) return null;
  try {
    const r = await fetch(`https://api.telegram.org/bot${cfg.botToken}/getFile?file_id=${fileId}`, { cache: "no-store" });
    const d = await r.json();
    if (d?.ok && d.result?.file_path) {
      return `https://api.telegram.org/file/bot${cfg.botToken}/${d.result.file_path}`;
    }
  } catch {
    // ignore
  }
  return null;
}

async function sendTelegramKeyboard(
  chatId: string,
  text: string,
  kb: { inline_keyboard: { text: string; callback_data: string }[][] },
  cfg: Awaited<ReturnType<typeof getTelegramConfig>>
) {
  if (!cfg.botToken) return;
  try {
    await fetch(`https://api.telegram.org/bot${cfg.botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, reply_markup: kb }),
      cache: "no-store",
    });
  } catch {
    // ignore
  }
}
