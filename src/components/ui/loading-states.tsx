"use client";

import React from "react";

/**
 * Table Loading State - renders an animated loading row inside any table tbody.
 */
export function TableLoadingState({
  colSpan = 6,
  text = "Menarik data dari server...",
  subtext = "Menyelaraskan data terkini...",
}: {
  colSpan?: number;
  text?: string;
  subtext?: string;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="text-center py-16 px-4">
        <div className="flex flex-col items-center justify-center gap-3">
          <div className="relative flex items-center justify-center">
            <div className="w-10 h-10 rounded-full border-3 border-blue-100 border-t-blue-600 animate-spin"></div>
            <i className="fa-solid fa-database text-blue-600 text-xs absolute"></i>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-700">{text}</p>
            {subtext && <p className="text-xs text-slate-400">{subtext}</p>}
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
  className = "py-12",
}: {
  text?: string;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 text-center ${className}`}>
      <i className="fa-solid fa-circle-notch fa-spin text-3xl text-blue-600"></i>
      <p className="text-sm font-medium text-slate-600">{text}</p>
    </div>
  );
}

/**
 * Card Skeleton shimmer list for dashboard stats or listings.
 */
export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm animate-pulse space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="h-4 bg-slate-200 rounded w-1/3"></div>
            <div className="w-8 h-8 bg-slate-100 rounded-lg"></div>
          </div>
          <div className="h-7 bg-slate-200 rounded w-1/2"></div>
          <div className="h-3 bg-slate-100 rounded w-2/3"></div>
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
          <i className="fa-solid fa-circle-notch fa-spin text-sm"></i>
          <span>{loadingText}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
