"use client";

import React, { useEffect, useRef } from "react";
import flatpickr from "flatpickr";
import { BaseOptions } from "flatpickr/dist/types/options";

export interface FlatpickrPickerProps {
  value?: string | string[] | Date | Date[];
  onChange?: (dateStr: string, dates: Date[]) => void;
  options?: Partial<BaseOptions>;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  name?: string;
}

export const FlatpickrPicker: React.FC<FlatpickrPickerProps> = ({
  value,
  onChange,
  options = {},
  placeholder = "Pilih tanggal...",
  className = "w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-medium text-black outline-none focus:ring-2 focus:ring-[#941A0B] bg-white transition cursor-pointer shadow-sm",
  disabled = false,
  required = false,
  id,
  name,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const fpRef = useRef<flatpickr.Instance | null>(null);

  useEffect(() => {
    if (!inputRef.current) return;

    const fp = flatpickr(inputRef.current, {
      dateFormat: "Y-m-d",
      disableMobile: true,
      ...options,
      onChange: (selectedDates, dateStr) => {
        if (onChange) {
          onChange(dateStr, selectedDates);
        }
      },
    });

    fpRef.current = fp;

    return () => {
      fp.destroy();
    };
  }, []);

  // Sync value if changed from outside
  useEffect(() => {
    if (fpRef.current && value !== undefined) {
      fpRef.current.setDate(value as any, false);
    }
  }, [value]);

  return (
    <input
      ref={inputRef}
      id={id}
      name={name}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
      required={required}
      readOnly
      suppressHydrationWarning
    />
  );
};

export default FlatpickrPicker;
