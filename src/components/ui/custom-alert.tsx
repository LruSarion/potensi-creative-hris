"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export type AlertType = "success" | "error" | "warning" | "info" | "confirm" | "prompt";

export interface AlertOptions {
  title?: string;
  message: string;
  type?: AlertType;
  confirmText?: string;
  cancelText?: string;
  defaultValue?: string;
  placeholder?: string;
}

interface AlertContextValue {
  showAlert: (messageOrOptions: string | AlertOptions) => Promise<void>;
  showConfirm: (messageOrOptions: string | AlertOptions) => Promise<boolean>;
  showPrompt: (messageOrOptions: string | AlertOptions, defaultValue?: string) => Promise<string | null>;
  showSuccess: (message: string, title?: string) => Promise<void>;
  showError: (message: string, title?: string) => Promise<void>;
  showWarning: (message: string, title?: string) => Promise<void>;
  showInfo: (message: string, title?: string) => Promise<void>;
}

const AlertContext = createContext<AlertContextValue | null>(null);

// Event based global dispatcher so it can be used even without hook
type AlertEventDetail = {
  options: AlertOptions;
  resolve: (value: any) => void;
};

const ALERT_EVENT = "CUSTOM_ALERT_TRIGGER";

export function customAlert(messageOrOptions: string | AlertOptions): Promise<void> {
  return new Promise((resolve) => {
    const options = typeof messageOrOptions === "string" ? parseMessageToOptions(messageOrOptions) : messageOrOptions;
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent<AlertEventDetail>(ALERT_EVENT, { detail: { options: { ...options, type: options.type || "info" }, resolve } }));
    } else {
      resolve();
    }
  });
}

export function customConfirm(messageOrOptions: string | AlertOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const options = typeof messageOrOptions === "string" ? { message: messageOrOptions, type: "confirm" as const } : { ...messageOrOptions, type: "confirm" as const };
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent<AlertEventDetail>(ALERT_EVENT, { detail: { options, resolve } }));
    } else {
      resolve(false);
    }
  });
}

export function customPrompt(messageOrOptions: string | AlertOptions, defaultValue = ""): Promise<string | null> {
  return new Promise((resolve) => {
    const options = typeof messageOrOptions === "string" ? { message: messageOrOptions, defaultValue, type: "prompt" as const } : { ...messageOrOptions, defaultValue: messageOrOptions.defaultValue ?? defaultValue, type: "prompt" as const };
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent<AlertEventDetail>(ALERT_EVENT, { detail: { options, resolve } }));
    } else {
      resolve(null);
    }
  });
}

function parseMessageToOptions(msg: string): AlertOptions {
  let type: AlertType = "info";
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

export function CustomAlertProvider({ children }: { children: React.ReactNode }) {
  const [activeAlert, setActiveAlert] = useState<{
    options: AlertOptions;
    resolve: (value: any) => void;
  } | null>(null);

  const [promptInput, setPromptInput] = useState("");

  const handleOpen = useCallback((options: AlertOptions, resolve: (val: any) => void) => {
    setActiveAlert({ options, resolve });
    if (options.type === "prompt") {
      setPromptInput(options.defaultValue || "");
    }
  }, []);

  useEffect(() => {
    const listener = (e: Event) => {
      const customEvent = e as CustomEvent<AlertEventDetail>;
      if (customEvent.detail) {
        handleOpen(customEvent.detail.options, customEvent.detail.resolve);
      }
    };
    window.addEventListener(ALERT_EVENT, listener);
    return () => window.removeEventListener(ALERT_EVENT, listener);
  }, [handleOpen]);

  const handleClose = (value: any) => {
    if (activeAlert) {
      activeAlert.resolve(value);
      setActiveAlert(null);
    }
  };

  const showAlert = useCallback(
    (messageOrOptions: string | AlertOptions) => {
      return new Promise<void>((resolve) => {
        const options = typeof messageOrOptions === "string" ? parseMessageToOptions(messageOrOptions) : messageOrOptions;
        handleOpen({ ...options, type: options.type || "info" }, resolve);
      });
    },
    [handleOpen]
  );

  const showConfirm = useCallback(
    (messageOrOptions: string | AlertOptions) => {
      return new Promise<boolean>((resolve) => {
        const options = typeof messageOrOptions === "string" ? { message: messageOrOptions, title: "Konfirmasi Tindakan", type: "confirm" as const } : { title: "Konfirmasi Tindakan", ...messageOrOptions, type: "confirm" as const };
        handleOpen(options, resolve);
      });
    },
    [handleOpen]
  );

  const showPrompt = useCallback(
    (messageOrOptions: string | AlertOptions, defaultValue = "") => {
      return new Promise<string | null>((resolve) => {
        const options = typeof messageOrOptions === "string" ? { message: messageOrOptions, title: "Input Data", defaultValue, type: "prompt" as const } : { title: "Input Data", ...messageOrOptions, defaultValue: messageOrOptions.defaultValue ?? defaultValue, type: "prompt" as const };
        handleOpen(options, resolve);
      });
    },
    [handleOpen]
  );

  const showSuccess = useCallback((message: string, title = "Berhasil") => showAlert({ message: message.replace(/^✅\s*/, ""), title, type: "success" }), [showAlert]);
  const showError = useCallback((message: string, title = "Terjadi Kesalahan") => showAlert({ message: message.replace(/^❌\s*/, ""), title, type: "error" }), [showAlert]);
  const showWarning = useCallback((message: string, title = "Perhatian") => showAlert({ message: message.replace(/^[⚠️🛡️]\s*/, ""), title, type: "warning" }), [showAlert]);
  const showInfo = useCallback((message: string, title = "Informasi") => showAlert({ message: message.replace(/^[ℹ️📌]\s*/, ""), title, type: "info" }), [showAlert]);

  return (
    <AlertContext.Provider value={{ showAlert, showConfirm, showPrompt, showSuccess, showError, showWarning, showInfo }}>
      {children}

      {/* MODAL DIALOG */}
      {activeAlert && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-sm w-full p-6 text-center transform transition-all duration-200 scale-100">
            {/* Header Icon */}
            <div className="flex justify-center mb-4">
              {activeAlert.options.type === "success" && (
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 ring-8 ring-emerald-50 flex items-center justify-center text-3xl shadow-sm">
                  <i className="fa-solid fa-check" />
                </div>
              )}
              {activeAlert.options.type === "error" && (
                <div className="w-16 h-16 rounded-full bg-red-100 text-[#941A0B] ring-8 ring-red-50 flex items-center justify-center text-3xl shadow-sm">
                  <i className="fa-solid fa-xmark" />
                </div>
              )}
              {activeAlert.options.type === "warning" && (
                <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-600 ring-8 ring-amber-50 flex items-center justify-center text-3xl shadow-sm">
                  <i className="fa-solid fa-triangle-exclamation" />
                </div>
              )}
              {activeAlert.options.type === "info" && (
                <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-600 ring-8 ring-blue-50 flex items-center justify-center text-3xl shadow-sm">
                  <i className="fa-solid fa-circle-info" />
                </div>
              )}
              {activeAlert.options.type === "confirm" && (
                <div className="w-16 h-16 rounded-full bg-red-100 text-[#941A0B] ring-8 ring-red-50 flex items-center justify-center text-3xl shadow-sm">
                  <i className="fa-solid fa-circle-question" />
                </div>
              )}
              {activeAlert.options.type === "prompt" && (
                <div className="w-16 h-16 rounded-full bg-indigo-100 text-indigo-600 ring-8 ring-indigo-50 flex items-center justify-center text-3xl shadow-sm">
                  <i className="fa-solid fa-pen-nib" />
                </div>
              )}
            </div>

            {/* Title */}
            <h3 className="text-lg font-extrabold text-slate-800 tracking-tight">
              {activeAlert.options.title || (activeAlert.options.type === "success" ? "Berhasil" : activeAlert.options.type === "error" ? "Kesalahan" : "Pemberitahuan")}
            </h3>

            {/* Message Body */}
            <p className="text-xs sm:text-sm text-slate-600 font-medium mt-2 mb-5 leading-relaxed whitespace-pre-line">
              {activeAlert.options.message}
            </p>

            {/* Prompt Input if applicable */}
            {activeAlert.options.type === "prompt" && (
              <div className="mb-5">
                <input
                  type="text"
                  autoFocus
                  value={promptInput}
                  onChange={(e) => setPromptInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleClose(promptInput);
                    if (e.key === "Escape") handleClose(null);
                  }}
                  placeholder={activeAlert.options.placeholder || "Ketik di sini..."}
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#941A0B] font-medium text-slate-900 shadow-sm"
                />
              </div>
            )}

            {/* Buttons */}
            {activeAlert.options.type === "confirm" ? (
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => handleClose(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition shadow-sm"
                >
                  {activeAlert.options.cancelText || "Batal"}
                </button>
                <button
                  type="button"
                  autoFocus
                  onClick={() => handleClose(true)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#941A0B] hover:bg-[#7D1509] text-white font-bold text-xs transition shadow-md"
                >
                  {activeAlert.options.confirmText || "Ya, Lanjutkan"}
                </button>
              </div>
            ) : activeAlert.options.type === "prompt" ? (
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => handleClose(null)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition shadow-sm"
                >
                  {activeAlert.options.cancelText || "Batal"}
                </button>
                <button
                  type="button"
                  onClick={() => handleClose(promptInput)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#941A0B] hover:bg-[#7D1509] text-white font-bold text-xs transition shadow-md"
                >
                  {activeAlert.options.confirmText || "Simpan"}
                </button>
              </div>
            ) : (
              <button
                type="button"
                autoFocus
                onClick={() => handleClose(true)}
                className={`w-full py-2.5 px-6 rounded-xl font-bold text-xs text-white transition shadow-md ${
                  activeAlert.options.type === "success"
                    ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200"
                    : activeAlert.options.type === "error"
                    ? "bg-[#941A0B] hover:bg-[#7D1509] shadow-red-200"
                    : activeAlert.options.type === "warning"
                    ? "bg-amber-600 hover:bg-amber-700 shadow-amber-200"
                    : "bg-[#941A0B] hover:bg-[#7D1509]"
                }`}
              >
                {activeAlert.options.confirmText || "Mengerti"}
              </button>
            )}
          </div>
        </div>
      )}
    </AlertContext.Provider>
  );
}

export function useAlert() {
  const context = useContext(AlertContext);
  if (!context) {
    // Fallback if component is used outside provider
    return {
      showAlert: customAlert,
      showConfirm: customConfirm,
      showPrompt: customPrompt,
      showSuccess: (msg: string, title?: string) => customAlert({ message: msg, title: title || "Berhasil", type: "success" }),
      showError: (msg: string, title?: string) => customAlert({ message: msg, title: title || "Terjadi Kesalahan", type: "error" }),
      showWarning: (msg: string, title?: string) => customAlert({ message: msg, title: title || "Perhatian", type: "warning" }),
      showInfo: (msg: string, title?: string) => customAlert({ message: msg, title: title || "Informasi", type: "info" }),
    };
  }
  return context;
}
