"use client";

import { useEffect } from "react";
import { SessionProvider } from "next-auth/react";
import { LoadingProvider } from "@/components/loading-provider";
import { CustomAlertProvider } from "@/components/ui/custom-alert";
import { ToastProvider } from "@/components/ui/toast";

export default function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Universal date & time input click handler: opens picker on click anywhere in field
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        target.tagName === "INPUT" &&
        ["date", "time", "datetime-local", "month"].includes(target.getAttribute("type") || "")
      ) {
        try {
          (target as HTMLInputElement).showPicker?.();
        } catch {
          // Fallback if browser does not support showPicker or already open
        }
      }
    };

    document.addEventListener("click", handleGlobalClick, { capture: true });
    return () => {
      document.removeEventListener("click", handleGlobalClick, { capture: true });
    };
  }, []);

  return (
    <SessionProvider>
      <LoadingProvider>
        <CustomAlertProvider>
          <ToastProvider>{children}</ToastProvider>
        </CustomAlertProvider>
      </LoadingProvider>
    </SessionProvider>
  );
}
