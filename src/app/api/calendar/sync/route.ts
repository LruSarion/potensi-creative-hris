import { apiHandler } from "@/lib/api-handler";
import { getCurrentUser } from "@/lib/auth-helpers";
import { generateGoogleCalendarUrl, createGoogleCalendarEventServer } from "@/lib/services/google-calendar";
import { AppError } from "@/lib/errors";

export const POST = apiHandler(async (req: Request) => {
  const user = await getCurrentUser();
  if (!user) throw AppError.unauthorized("Harus login terlebih dahulu");

  const body = await req.json();
  const { title, description, location, startTime, endTime, reminderMinutes, googleAccessToken } = body;

  if (!title || !startTime || !endTime) {
    throw AppError.badRequest("Judul, waktu mulai, dan waktu selesai wajib diisi");
  }

  const options = {
    title: title ?? "Siaran Live Streaming Potensi Creative",
    description: description ?? "Jadwal Siaran Live Streaming Agency Potensi Creative",
    location: location ?? "Studio Potensi Creative",
    startTime,
    endTime,
    reminderMinutes: reminderMinutes ?? [30, 15],
  };

  // If user has active Google OAuth access token, sync via Google REST API directly
  if (googleAccessToken) {
    try {
      const gcalResult = await createGoogleCalendarEventServer(googleAccessToken, options);
      return {
        synced: true,
        method: "api",
        eventId: gcalResult.id,
        htmlLink: gcalResult.htmlLink,
      };
    } catch (err: any) {
      console.warn("Direct Google API sync failed, falling back to Web URL:", err.message);
    }
  }

  // Fallback to one-click URL
  const webUrl = generateGoogleCalendarUrl(options);
  return {
    synced: false,
    method: "web_url",
    webUrl,
  };
});
