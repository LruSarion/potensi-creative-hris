"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

interface LoadingContextType {
  isLoading: boolean;
  message: string;
  subtext: string;
  showLoading: (message?: string, subtext?: string) => void;
  hideLoading: () => void;
}

const LoadingContext = createContext<LoadingContextType>({
  isLoading: false,
  message: "Memuat data...",
  subtext: "",
  showLoading: () => {},
  hideLoading: () => {},
});

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("Memuat data...");
  const [subtext, setSubtext] = useState("");

  const showLoading = useCallback((msg = "Memuat data...", sub = "") => {
    setMessage(msg);
    setSubtext(sub);
    setIsLoading(true);
  }, []);

  const hideLoading = useCallback(() => {
    setIsLoading(false);
  }, []);

  // Global window bridge for non-React / legacy scripts & universal handlers
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).__showLoading = (msg?: string, sub?: string) => showLoading(msg, sub);
      (window as any).__hideLoading = () => hideLoading();
    }
    return () => {
      if (typeof window !== "undefined") {
        delete (window as any).__showLoading;
        delete (window as any).__hideLoading;
      }
    };
  }, [showLoading, hideLoading]);

  return (
    <LoadingContext.Provider
      value={{
        isLoading,
        message,
        subtext,
        showLoading,
        hideLoading,
      }}
    >
      {children}

      {/* Global Fullscreen Loading Overlay (#loadingOverlay) */}
      {isLoading && (
        <div
          id="loadingOverlay"
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-md transition-all duration-300 animate-fadeIn select-none p-4"
          aria-live="assertive"
          role="status"
        >
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-auto flex flex-col items-center text-center border border-slate-100 transform animate-scaleUp">
            {/* Animated Loading Spinner & Logo Badge */}
            <div className="relative mb-5 flex items-center justify-center">
              <div className="w-16 h-16 rounded-2xl bg-blue-600/10 flex items-center justify-center border border-blue-200">
                <span className="text-2xl font-black text-blue-600 font-sans">P</span>
              </div>
              <div className="absolute -inset-2 rounded-3xl border-2 border-blue-600 border-t-transparent animate-spin"></div>
            </div>

            {/* Title / Primary Text */}
            <h3 className="text-lg font-bold text-slate-800 tracking-tight">
              {message}
            </h3>

            {/* Subtext / Explanation */}
            {subtext ? (
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                {subtext}
              </p>
            ) : (
              <p className="text-xs text-slate-400 mt-1.5 font-medium flex items-center gap-1.5 justify-center">
                <i className="fa-solid fa-cloud-arrow-up text-blue-500 text-[10px] animate-pulse"></i>
                <span>Sinkronisasi database & sistem...</span>
              </p>
            )}

            {/* Shimmering Progress Bar */}
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-5 overflow-hidden">
              <div className="bg-blue-600 h-full w-full rounded-full animate-indeterminate"></div>
            </div>
          </div>
        </div>
      )}
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error("useLoading must be used within a LoadingProvider");
  }
  return context;
}
