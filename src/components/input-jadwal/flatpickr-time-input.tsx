"use client";

import React, { useEffect, useRef } from "react";
import flatpickr from "flatpickr";

export interface FlatpickrTimeInputProps {
  id?: string;
  name?: string;
  value?: string;
  onChange?: (val: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
}

export function FlatpickrTimeInput({
  id,
  name,
  value,
  onChange,
  placeholder = "Pilih Jam",
  className,
  required = false,
  disabled = false,
}: FlatpickrTimeInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const fpRef = useRef<flatpickr.Instance | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!inputRef.current) return;

    // Exact configuration from ref-deploy: inisialisasiJam24()
    const fp = flatpickr(inputRef.current, {
      enableTime: true,
      noCalendar: true,
      dateFormat: "H:i",
      time_24hr: true,
      minuteIncrement: 5,
      disableMobile: true,
      defaultDate: value || undefined,
      onChange: (_selectedDates, dateStr) => {
        if (onChangeRef.current) {
          onChangeRef.current(dateStr);
        }
      },
      onClose: (_selectedDates, _dateStr, instance) => {
        let val = instance.input.value;
        if (val && val.includes(".")) {
          val = val.replace(/\.+/g, ":");
          instance.setDate(val, true, "H:i");
          if (onChangeRef.current) {
            onChangeRef.current(val);
          }
        }
      },
    });

    fpRef.current = fp;

    return () => {
      fp.destroy();
    };
  }, []);

  // Sync external value changes (such as calculateEndTime or shift selection)
  useEffect(() => {
    if (fpRef.current && value !== undefined) {
      const cur = fpRef.current.input.value;
      if (cur !== value) {
        fpRef.current.setDate(value || "", false, "H:i");
      }
    }
  }, [value]);

  const defaultCls =
    "format-24jam w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white cursor-pointer transition";

  return (
    <input
      ref={inputRef}
      id={id}
      name={name}
      type="text"
      defaultValue={value || ""}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      className={className ? `format-24jam ${className}` : defaultCls}
      autoComplete="off"
    />
  );
}

export default FlatpickrTimeInput;
