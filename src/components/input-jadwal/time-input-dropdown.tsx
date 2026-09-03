"use client";

import React from "react";
import { FlatpickrTimeInput, type FlatpickrTimeInputProps } from "./flatpickr-time-input";

export type TimeInputDropdownProps = FlatpickrTimeInputProps;

/**
 * TimeInputDropdown
 * Backward-compatible wrapper that now renders FlatpickrTimeInput (format-24jam),
 * matching the exact Flatpickr behavior from ref-deploy input-jadwal.html.
 */
export function TimeInputDropdown(props: TimeInputDropdownProps) {
  return <FlatpickrTimeInput {...props} />;
}

export default TimeInputDropdown;
