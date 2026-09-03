"use client";

import React from "react";

export type LoadingVariant = "brand" | "blue" | "neutral";

/**
 * Table Loading State - renders an animated, brand-aligned loading row inside any table tbody.
 */
export function TableLoadingState({
  colSpan = 6,
  text = "Menarik data dari server...",
  subtext = "Menyelaraskan data terkini...",
  variant = "brand",
}: {
  colSpan?: number;
  text?: string;
  subtext?: string;
  variant?: LoadingVariant;
}) {
  const ringColor =
    variant === "brand"
      ? "border-red-100 border-t-[#941A0B]"
      : variant === "blue"
      ? "border-blue-100 border-t-blue-600"
      : "border-slate-200 border-t-slate-700";

  const iconColor =
    variant === "brand"
      ? "text-[#941A0B]"
      : variant === "blue"
      ? "text-blue-600"
      : "text-slate-600";

  return (
    <tr>
      <td colSpan={colSpan} className="text-center py-16 px-4">
        <div className="flex flex-col items-center justify-center gap-3">
          <div className="relative flex items-center justify-center">
            <div className={`w-10 h-10 rounded-full border-3 ${ringColor} animate-spin`} />
            <i className={`fa-solid fa-cloud-arrow-down ${iconColor} text-xs absolute animate-pulse`} />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-bold text-slate-800 tracking-tight">{text}</p>
            {subtext && <p className="text-xs text-slate-400 font-medium">{subtext}</p>}
          </div>
        </div>
      </td>
    </tr>
  );
}

/**
 * Section / Card Loader - for inside container cards or panels.
 */
export function SectionLoader({
  text = "Memuat data...",
  subtext,
  className = "py-12",
  variant = "brand",
}: {
  text?: string;
  subtext?: string;
  className?: string;
  variant?: LoadingVariant;
}) {
  const spinnerColor =
    variant === "brand"
      ? "text-[#941A0B]"
      : variant === "blue"
      ? "text-blue-600"
      : "text-slate-600";

  return (
    <div className={`flex flex-col items-center justify-center gap-2.5 text-center ${className}`}>
      <i className={`fa-solid fa-circle-notch fa-spin text-3xl ${spinnerColor}`} />
      <p className="text-sm font-bold text-slate-800 mt-1">{text}</p>
      {subtext && <p className="text-xs text-slate-400 font-medium max-w-sm mx-auto">{subtext}</p>}
    </div>
  );
}

/**
 * Card Skeleton shimmer list for dashboard stats or grid listings.
 */
export function CardSkeleton({
  count = 3,
  gridCls = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4",
}: {
  count?: number;
  gridCls?: string;
}) {
  return (
    <div className={gridCls}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm animate-pulse space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="h-4 bg-slate-200 rounded w-1/3" />
            <div className="w-8 h-8 bg-slate-100 rounded-lg" />
          </div>
          <div className="h-7 bg-slate-200 rounded w-1/2" />
          <div className="h-3 bg-slate-100 rounded w-2/3" />
        </div>
      ))}
    </div>
  );
}

/**
 * Button Loading Spinner indicator with text.
 */
export function ButtonSpinner({
  loading,
  loadingText = "Memproses...",
  children,
  className = "",
  disabled = false,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  loadingText?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      {...props}
      disabled={loading || disabled}
      className={`relative transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${className}`}
    >
      {loading ? (
        <>
          <i className="fa-solid fa-circle-notch fa-spin text-sm" />
          <span>{loadingText}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
