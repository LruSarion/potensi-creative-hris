export type GoogleCalendarEventOptions = {
  title: string;
  description: string;
  location: string;
  startTime: string | Date; // ISO or YYYY-MM-DDTHH:mm:ss
  endTime: string | Date;
  reminderMinutes?: number[]; // e.g. [30, 15, 5]
};

/**
 * Generate a direct Google Calendar web URL to add event with automatic reminders.
 * Safe for client-side and browser execution (no Node.js dependencies).
 */
export function generateGoogleCalendarUrl(options: GoogleCalendarEventOptions): string {
  const start = new Date(options.startTime);
  const end = new Date(options.endTime);

  const formatGCalDate = (d: Date) =>
    d.toISOString().replace(/-|:|\.\d\d\d/g, "");

  const datesStr = `${formatGCalDate(start)}/${formatGCalDate(end)}`;

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: options.title,
    details: options.description,
    location: options.location,
    dates: datesStr,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Generate .ics iCalendar file content for universal calendar sync (Google Calendar, Apple Calendar, Outlook).
 * Safe for client-side and browser execution (no Node.js dependencies).
 */
export function generateIcsContent(options: GoogleCalendarEventOptions): string {
  const start = new Date(options.startTime);
  const end = new Date(options.endTime);

  const formatIcsDate = (d: Date) =>
    d.toISOString().replace(/-|:|\.\d\d\d/g, "");

  const reminders = (options.reminderMinutes ?? [30, 15]).map(
    (m) => `
BEGIN:VALARM
TRIGGER:-PT${m}M
ACTION:DISPLAY
DESCRIPTION:Peringatan Siaran Live Streaming Potensi Creative (${m} Menit Lagi)
END:VALARM`
  ).join("");

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Potensi Creative//HRIS Live Streaming System//ID
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:jadwal-${Date.now()}@potensicreative.com
DTSTAMP:${formatIcsDate(new Date())}
DTSTART:${formatIcsDate(start)}
DTEND:${formatIcsDate(end)}
SUMMARY:${options.title}
DESCRIPTION:${options.description.replace(/\n/g, "\\n")}
LOCATION:${options.location}
STATUS:CONFIRMED
${reminders}
END:VEVENT
END:VCALENDAR`;
}
