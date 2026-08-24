import { db } from "@/lib/db";
import {
  generateGoogleCalendarUrl,
  generateIcsContent,
  type GoogleCalendarEventOptions,
} from "@/lib/google-calendar-utils";

export { generateGoogleCalendarUrl, generateIcsContent, type GoogleCalendarEventOptions };

/**
 * Server-side Google Calendar API integration.
 * Creates an event on the user's primary Google Calendar using their Google OAuth Access Token.
 */
export async function createGoogleCalendarEventServer(
  accessToken: string,
  options: GoogleCalendarEventOptions
) {
  const start = new Date(options.startTime).toISOString();
  const end = new Date(options.endTime).toISOString();

  const reminderOverrides = (options.reminderMinutes ?? [30, 15]).map((m) => ({
    method: "popup",
    minutes: m,
  }));

  // Add email notification as well
  reminderOverrides.push({ method: "email", minutes: 30 });

  const eventBody = {
    summary: options.title,
    location: options.location,
    description: options.description,
    start: { dateTime: start, timeZone: "Asia/Jakarta" },
    end: { dateTime: end, timeZone: "Asia/Jakarta" },
    reminders: {
      useDefault: false,
      overrides: reminderOverrides,
    },
  };

  const response = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(eventBody),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gagal membuat Google Calendar Event: ${errText}`);
  }

  return response.json();
}

/**
 * Automatically syncs a schedule item to the assigned streamer's Google Calendar
 * and sends email & in-app notification alerts.
 */
export async function syncJadwalToGoogleCalendar(jadwalId: string) {
  try {
    const jadwal = await db.jadwal.findUnique({
      where: { id: jadwalId },
      include: {
        streamerKaryawan: true,
        hostKaryawan: true,
        client: true,
      },
    });

    if (!jadwal) return null;

    const targetKaryawan = jadwal.streamerKaryawan ?? jadwal.hostKaryawan;
    if (!targetKaryawan) return null;

    const streamerEmail = targetKaryawan.email;
    const streamerNama = targetKaryawan.namaLengkap;
    const clientNama = jadwal.client?.namaClient ?? "Potensi Creative Client";
    const studioInfo = `${jadwal.cabangStudio ?? "Studio"} (Room ${jadwal.nomorStudio ?? "01"})`;

    const eventOptions: GoogleCalendarEventOptions = {
      title: `[Live Stream] ${clientNama} - ${streamerNama}`,
      description: `Jadwal Siaran Live Streaming Agency Potensi Creative.\nKlien: ${clientNama}\nProduk Prioritas: ${jadwal.produkPrioritas ?? "-"}\nPromo Live: ${jadwal.promoLive ?? "-"}\nCatatan: ${jadwal.catatanHost ?? "-"}`,
      location: studioInfo,
      startTime: jadwal.jamMulaiLive,
      endTime: jadwal.jamSelesaiLive,
      reminderMinutes: [30, 15],
    };

    const gcalUrl = generateGoogleCalendarUrl(eventOptions);

    // Try to find if user has a Google Account OAuth token
    if (streamerEmail) {
      const dbUser = await db.user.findUnique({
        where: { email: streamerEmail.toLowerCase() },
        include: { accounts: true },
      });

      const googleAccount = dbUser?.accounts?.find((a) => a.provider === "google");
      if (googleAccount?.access_token) {
        try {
          await createGoogleCalendarEventServer(googleAccount.access_token, eventOptions);
          console.log(`[Google Calendar Sync] Event otomatis ditambahkan ke Google Calendar: ${streamerEmail}`);
        } catch (err) {
          console.warn(`[Google Calendar Sync] Direct OAuth insert failed, fallback to Notification Link:`, err);
        }
      }
    }

    // Always log In-App Notification and log activity
    await db.logAktivitas.create({
      data: {
        tenantId: jadwal.tenantId,
        aksi: "JADWAL_SYNC_GCAL",
        detail: `Auto Sync Google Calendar untuk ${streamerNama} (${clientNama} - ${studioInfo}). Link: ${gcalUrl}`,
      },
    });

    return {
      success: true,
      gcalUrl,
      streamerNama,
      streamerEmail,
    };
  } catch (error) {
    console.error("Gagal melakukan otomatisasi sync Google Calendar:", error);
    return null;
  }
}

