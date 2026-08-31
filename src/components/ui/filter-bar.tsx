"use client";

import React from "react";
import FlatpickrPicker from "./flatpickr-picker";

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterBarProps {
  // Period filter
  periodValue?: string;
  onPeriodChange?: (value: string) => void;
  periodOptions?: FilterOption[];

  // Single date filter
  dateValue?: string;
  onDateChange?: (value: string) => void;

  // Status filter
  statusValue?: string;
  onStatusChange?: (value: string) => void;
  statusOptions?: FilterOption[];

  // Search filter
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;

  // Reset
  onReset?: () => void;

  // Extra custom controls
  children?: React.ReactNode;
  className?: string;
}

export function FilterBar({
  periodValue,
  onPeriodChange,
  periodOptions = [
    { label: "Semua Waktu", value: "ALL" },
    { label: "Hari Ini", value: "TODAY" },
    { label: "7 Hari Ke Belakang", value: "PREV_7" },
    { label: "7 Hari Ke Depan", value: "NEXT_7" },
    { label: "35 Hari Ke Depan", value: "NEXT_35" },
  ],
  dateValue,
  onDateChange,
  statusValue,
  onStatusChange,
  statusOptions,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Cari kata kunci...",
  onReset,
  children,
  className = "",
}: FilterBarProps) {
  return (
    <div
      className={`bg-white p-4 rounded-2xl border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end ${className}`}
    >
      {/* Period Filter */}
      {onPeriodChange && (
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Periode Waktu
          </label>
          <select
            value={periodValue}
            onChange={(e) => onPeriodChange(e.target.value)}
            className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium bg-white outline-none focus:ring-2 focus:ring-[#941A0B] transition"
          >
            {periodOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Date Picker */}
      {onDateChange && (
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Pilih Tanggal
          </label>
          <FlatpickrPicker
            value={dateValue || ""}
            placeholder="Pilih Tanggal..."
            options={{ mode: "single", dateFormat: "Y-m-d" }}
            onChange={(dateStr) => onDateChange(dateStr)}
          />
        </div>
      )}

      {/* Status Filter */}
      {onStatusChange && statusOptions && (
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Status
          </label>
          <select
            value={statusValue}
            onChange={(e) => onStatusChange(e.target.value)}
            className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium bg-white outline-none focus:ring-2 focus:ring-[#941A0B] transition"
          >
            <option value="">Semua Status</option>
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Search Input */}
      {onSearchChange && (
        <div className="relative">
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Pencarian
          </label>
          <div className="relative">
            <input
              type="text"
              value={searchValue || ""}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 pr-8 text-xs font-medium bg-white outline-none focus:ring-2 focus:ring-[#941A0B] transition"
            />
            {searchValue && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500"
              >
                <i className="fa-solid fa-circle-xmark text-xs" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Custom children */}
      {children}

      {/* Reset Button */}
      {onReset && (
        <div>
          <button
            type="button"
            onClick={onReset}
            className="w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
          >
            <i className="fa-solid fa-rotate-left" />
            <span>Reset Filter</span>
          </button>
        </div>
      )}
    </div>
  );
}
