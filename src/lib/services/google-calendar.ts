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
 * Automatically syncs a schedule item to the assigned streamer's AND OTS staff's Google Calendar
 * and creates activity logs & calendar invitation links.
 */
export async function syncJadwalToGoogleCalendar(jadwalId: string) {
  try {
    const jadwal = await db.jadwal.findUnique({
      where: { id: jadwalId },
      include: {
        streamerKaryawan: true,
        hostKaryawan: true,
        otsKaryawan: true,
        client: true,
      },
    });

    if (!jadwal) return null;

    const streamer = jadwal.streamerKaryawan ?? jadwal.hostKaryawan;
    const ots = jadwal.otsKaryawan;
    const clientNama = jadwal.client?.namaClient ?? "Potensi Creative Client";
    const studioInfo = `${jadwal.cabangStudio ?? "Studio"} (Room ${jadwal.nomorStudio ?? "01"})`;

    const targets = [];
    if (streamer) targets.push({ role: "STREAMER", karyawan: streamer });
    if (ots) targets.push({ role: "OTS", karyawan: ots });

    if (targets.length === 0) return null;

    const results = [];

    for (const target of targets) {
      const targetEmail = target.karyawan.email;
      const targetNama = target.karyawan.namaLengkap;

      const eventOptions: GoogleCalendarEventOptions = {
        title: `[Live Stream] ${clientNama} - ${target.role === "STREAMER" ? "Host" : "Operator"}: ${targetNama}`,
        description: `Jadwal Siaran Live Streaming Agency Potensi Creative.\nKlien: ${clientNama}\nRole: ${target.role}\nStudio: ${studioInfo}\nProduk Prioritas: ${jadwal.produkPrioritas ?? "-"}\nPromo Live: ${jadwal.promoLive ?? "-"}\nCatatan: ${jadwal.catatanHost ?? "-"}`,
        location: studioInfo,
        startTime: jadwal.jamMulaiLive,
        endTime: jadwal.jamSelesaiLive,
        reminderMinutes: [30, 15],
      };

      const gcalUrl = generateGoogleCalendarUrl(eventOptions);

      // Attempt background OAuth calendar insertion if access token is available
      if (targetEmail) {
        const dbUser = await db.user.findUnique({
          where: { email: targetEmail.toLowerCase() },
          include: { accounts: true },
        });

        const googleAccount = dbUser?.accounts?.find((a) => a.provider === "google");
        if (googleAccount?.access_token) {
          try {
            await createGoogleCalendarEventServer(googleAccount.access_token, eventOptions);
            console.log(`[Google Calendar Sync] Event otomatis ditambahkan ke Google Calendar: ${targetEmail}`);
          } catch (err) {
            console.warn(`[Google Calendar Sync] Direct OAuth insert fallback to Notification Link:`, err);
          }
        }
      }

      // Log In-App Notification and audit trail
      await db.logAktivitas.create({
        data: {
          tenantId: jadwal.tenantId,
          aksi: "JADWAL_SYNC_GCAL",
          detail: `Auto Sync Google Calendar untuk ${target.role} ${targetNama} (${clientNama} - ${studioInfo}). Link: ${gcalUrl}`,
        },
      });

      results.push({
        targetNama,
        targetEmail,
        gcalUrl,
      });
    }

    return {
      success: true,
      syncCount: results.length,
      items: results,
    };
  } catch (error) {
    console.error("Gagal melakukan otomatisasi sync Google Calendar:", error);
    return null;
  }
}
