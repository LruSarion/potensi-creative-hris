// Check-in late validators shared by the streamer dashboard page (handleCheckIn)
// and the Check-In tab component. Extracted verbatim from page.tsx (refactor only).

import type { Jadwal } from "./types";
import {
  formatTimeSafe,
  formatDateOnly,
} from "@/lib/utils/date-format";

/** Format duration in human-readable Days, Hours, and Minutes (e.g. "1 Hari 2 Jam 15 Menit") */
export function formatLateDuration(totalMinutes: number): string {
  if (totalMinutes <= 0) return "0 Menit";

  const days = Math.floor(totalMinutes / 1440);
  const remainingMinutesAfterDays = totalMinutes % 1440;
  const hours = Math.floor(remainingMinutesAfterDays / 60);
  const minutes = remainingMinutesAfterDays % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} Hari`);
  if (hours > 0) parts.push(`${hours} Jam`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes} Menit`);

  return parts.join(" ");
}

/** Dynamic check-in late validator based on current time vs scheduled start time */
export function getLateCheckInStatus(jadwal: Jadwal | null): {
  isLate: boolean;
  minutesLate: number;
  lateDurationText: string;
  scheduledTimeText: string;
} {
  if (!jadwal || !jadwal.jamMulaiLive) {
    return { isLate: false, minutesLate: 0, lateDurationText: "", scheduledTimeText: "" };
  }

  const scheduledTimeText = formatTimeSafe(jadwal.jamMulaiLive);

  let scheduledStart: Date | null = null;
  if (jadwal.jamMulaiLive.includes("T")) {
    scheduledStart = new Date(jadwal.jamMulaiLive);
  } else if (jadwal.tanggal) {
    const dateStr = formatDateOnly(jadwal.tanggal) || String(jadwal.tanggal).slice(0, 10);
    scheduledStart = new Date(`${dateStr}T${jadwal.jamMulaiLive.length === 5 ? jadwal.jamMulaiLive + ":00" : jadwal.jamMulaiLive}+07:00`);
  }

  if (!scheduledStart || isNaN(scheduledStart.getTime())) {
    return { isLate: false, minutesLate: 0, lateDurationText: "", scheduledTimeText };
  }

  const now = new Date();
  const diffMs = now.getTime() - scheduledStart.getTime();
  const minutesLate = Math.floor(diffMs / 60000);
  const lateDurationText = formatLateDuration(minutesLate > 0 ? minutesLate : 0);

  return {
    isLate: minutesLate > 0,
    minutesLate: minutesLate > 0 ? minutesLate : 0,
    lateDurationText,
    scheduledTimeText,
  };
}