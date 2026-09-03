"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastOptions {
  title?: string;
  message: string;
  type?: ToastType;
  duration?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (messageOrOptions: string | ToastOptions) => void;
  showSuccess: (message: string, title?: string) => void;
  showError: (message: string, title?: string) => void;
  showWarning: (message: string, title?: string) => void;
  showInfo: (message: string, title?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_EVENT = "CUSTOM_TOAST_TRIGGER";

/** Auto-detect type from emoji/message prefix (mirrors custom-alert parseMessageToOptions). */
function parseMessageToOptions(msg: string): ToastOptions {
  let type: ToastType = "info";
  let title = "Pemberitahuan";
  let cleanMsg = msg;

  if (msg.startsWith("✅") || msg.toLowerCase().includes("berhasil")) {
    type = "success";
    title = "Berhasil";
    cleanMsg = msg.replace(/^✅\s*/, "");
  } else if (msg.startsWith("❌") || msg.toLowerCase().includes("gagal") || msg.toLowerCase().includes("error")) {
    type = "error";
    title = "Terjadi Kesalahan";
    cleanMsg = msg.replace(/^❌\s*/, "");
  } else if (msg.startsWith("⚠️") || msg.startsWith("🛡️") || msg.toLowerCase().includes("peringatan")) {
    type = "warning";
    title = "Perhatian";
    cleanMsg = msg.replace(/^[⚠️🛡️]\s*/, "");
  } else if (msg.startsWith("ℹ️") || msg.startsWith("📌")) {
    type = "info";
    title = "Informasi";
    cleanMsg = msg.replace(/^[ℹ️📌]\s*/, "");
  }

  return { title, message: cleanMsg, type };
}

/** Dispatch toast globally via event — usable even outside React tree. */
function dispatchToast(messageOrOptions: string | ToastOptions, forceType?: ToastType) {
  if (typeof window === "undefined") return;
  const options =
    typeof messageOrOptions === "string" ? parseMessageToOptions(messageOrOptions) : messageOrOptions;
  window.dispatchEvent(
    new CustomEvent(TOAST_EVENT, {
      detail: { options: { ...options, type: forceType || options.type || "info" } },
    })
  );
}

/** Namespace: toast.success(...) / toast.error(...) / toast.warning(...) / toast.info(...) */
export const toast = {
  show: (messageOrOptions: string | ToastOptions) => dispatchToast(messageOrOptions),
  success: (message: string, title = "Berhasil") => dispatchToast({ message, title, type: "success" }),
  error: (message: string, title = "Terjadi Kesalahan") => dispatchToast({ message, title, type: "error" }),
  warning: (message: string, title = "Perhatian") => dispatchToast({ message, title, type: "warning" }),
  info: (message: string, title = "Informasi") => dispatchToast({ message, title, type: "info" }),
};

const TOAST_STYLES: Record<ToastType, { icon: string; bar: string; iconBg: string; title: string }> = {
  success: { icon: "fa-solid fa-check", bar: "border-l-emerald-500", iconBg: "bg-emerald-100 text-emerald-600", title: "Berhasil" },
  error: { icon: "fa-solid fa-xmark", bar: "border-l-red-500", iconBg: "bg-red-100 text-[#941A0B]", title: "Terjadi Kesalahan" },
  warning: { icon: "fa-solid fa-triangle-exclamation", bar: "border-l-amber-500", iconBg: "bg-amber-100 text-amber-600", title: "Perhatian" },
  info: { icon: "fa-solid fa-circle-info", bar: "border-l-blue-500", iconBg: "bg-blue-100 text-blue-600", title: "Informasi" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idCounter = React.useRef(0);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (options: ToastOptions) => {
      const id = ++idCounter.current;
      const duration = options.duration ?? (options.type === "error" ? 7000 : 4500);
      setToasts((prev) => [...prev.slice(-4), { ...options, type: options.type || "info", id }]);
      setTimeout(() => removeToast(id), duration);
    },
    [removeToast]
  );

  useEffect(() => {
    const listener = (e: Event) => {
      const customEvent = e as CustomEvent<{ options: ToastOptions }>;
      if (customEvent.detail) pushToast(customEvent.detail.options);
    };
    window.addEventListener(TOAST_EVENT, listener);
    return () => window.removeEventListener(TOAST_EVENT, listener);
  }, [pushToast]);

  const showToast = useCallback(
    (messageOrOptions: string | ToastOptions) => {
      const options =
        typeof messageOrOptions === "string" ? parseMessageToOptions(messageOrOptions) : messageOrOptions;
      pushToast({ ...options, type: options.type || "info" });
    },
    [pushToast]
  );

  const showSuccess = useCallback((message: string, title = "Berhasil") => showToast({ message, title, type: "success" }), [showToast]);
  const showError = useCallback((message: string, title = "Terjadi Kesalahan") => showToast({ message, title, type: "error" }), [showToast]);
  const showWarning = useCallback((message: string, title = "Perhatian") => showToast({ message, title, type: "warning" }), [showToast]);
  const showInfo = useCallback((message: string, title = "Informasi") => showToast({ message, title, type: "info" }), [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, showSuccess, showError, showWarning, showInfo }}>
      {children}

      {/* TOAST CONTAINER: fixed top-right, below navbar, above content */}
      <div className="fixed top-4 right-4 z-[10000] flex flex-col gap-2 w-[calc(100vw-2rem)] max-w-sm pointer-events-none">
        {toasts.map((t) => {
          const style = TOAST_STYLES[t.type];
          return (
            <div
              key={t.id}
              className="pointer-events-auto bg-white border border-slate-200 border-l-4 shadow-2xl rounded-xl p-3.5 flex items-start gap-3 animate-in slide-in-from-top-2 fade-in duration-200"
            >
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-base shrink-0 ${style.iconBg}`}>
                <i className={style.icon} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-extrabold text-slate-800 leading-tight">
                  {t.title || style.title}
                </p>
                <p className="text-[11px] sm:text-xs text-slate-600 font-medium mt-0.5 leading-relaxed whitespace-pre-line break-words">
                  {t.message}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="text-slate-300 hover:text-slate-600 transition-colors cursor-pointer shrink-0 p-0.5"
                title="Tutup"
              >
                <i className="fa-solid fa-xmark text-xs" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    // Fallback outside provider: dispatch via window event
    return {
      showToast: toast.show,
      showSuccess: (msg: string, title?: string) => toast.success(msg, title),
      showError: (msg: string, title?: string) => toast.error(msg, title),
      showWarning: (msg: string, title?: string) => toast.warning(msg, title),
      showInfo: (msg: string, title?: string) => toast.info(msg, title),
    };
  }
  return context;
}