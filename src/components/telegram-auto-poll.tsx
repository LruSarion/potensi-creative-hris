"use client";

import { useEffect, useRef } from "react";
import { fetchJson } from "@/lib/api-client";

/**
 * Dev-only helper that polls Telegram updates every few seconds so /start,
 * absensi buttons, photos, and locations are processed without a public webhook
 * or a manual cron trigger. It no-ops in production (public deploy uses the
 * webhook). Renders nothing.
 */
export default function TelegramAutoPoll() {
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    // Only poll in non-production; production uses the webhook instead.
    if (process.env.NODE_ENV === "production") return;

    const poll = async () => {
      try {
        await fetchJson("/api/telegram/poll", { method: "POST", cache: "no-store" });
      } catch {
        // endpoint unavailable; ignore
      }
    };
    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, []);

  return null;
}
