import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/errors";
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

export async function handleTelegramAbsensiCallback(
  chatId: number,
  callbackData: string,
  cfg: Awaited<ReturnType<typeof getTelegramConfig>>
) {
  const user = await db.user.findUnique({ where: { telegramChatId: String(chatId) } });
  if (!user) {
    await sendTelegramMessage(String(chatId), "Akun belum terhubung ke aplikasi HRIS.", cfg);
    return;
  }
  if (callbackData === "ABSEN_IN" || callbackData === "ABSEN_OUT") {
    const tipe = callbackData === "ABSEN_IN" ? "CHECK_IN" : "CHECK_OUT";
    await db.user.update({
      where: { id: user.id },
      data: { telegramAbsensiState: { tipe, step: "awaiting_photo" } },
    });
    await sendTelegramMessage(String(chatId), `${tipe === "CHECK_IN" ? "Absen Masuk" : "Absen Pulang"}\nKirim foto selfie kamu.`, cfg);
    await answerCallback(chatId, cfg);
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
    await db.absensi.create({
      data: {
        tenantId: user.tenantId ?? undefined,
        karyawanId,
        tipe: "CHECK_IN",
        kategori: (await resolveKategori(user.role)) as any,
        buktiDriveId: state.photoUrl ?? null,
        catatan,
      },
    });
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
      tipe: "CHECK_OUT",
      kategori: (await resolveKategori(user.role)) as any,
      buktiDriveId: state.photoUrl ?? null,
      catatan,
    },
  });
  return { message: "🚪 Absen Pulang tercatat!\nLokasi: " + `${location.latitude},${location.longitude}` };
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

async function answerCallback(chatId: number, cfg: Awaited<ReturnType<typeof getTelegramConfig>>) {
  if (!cfg.botToken) return;
  try {
    await fetch(`https://api.telegram.org/bot${cfg.botToken}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: "placeholder" }),
      cache: "no-store",
    });
  } catch {
    // ignore
  }
}
