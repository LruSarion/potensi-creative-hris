"use client";

import React from "react";

/* ------------------------------------------------------------------ */
/*  Modal — Generic modal dialog with overlay                         */
/* ------------------------------------------------------------------ */

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  /** Max-width class. Default: "max-w-lg". */
  maxWidth?: string;
  children: React.ReactNode;
  /** Optional footer content (buttons, etc.). */
  footer?: React.ReactNode;
}

export function Modal({
  isOpen,
  onClose,
  title,
  maxWidth = "max-w-lg",
  children,
  footer,
}: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Content */}
      <div
        className={`relative bg-white rounded-2xl shadow-2xl ${maxWidth} w-full max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95`}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
            <h3 className="text-lg font-extrabold text-slate-800">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
            >
              <i className="fa-solid fa-xmark text-lg" />
            </button>
          </div>
        )}

        {/* Body */}
        <div className="px-6 py-4 overflow-y-auto flex-1">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-3 border-t border-slate-200 flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  CrashResultModal — Specialised modal for crash check results      */
/* ------------------------------------------------------------------ */

interface CrashConflict {
  type: string;
  form1: number | string;
  form2: number | string;
  info1: string;
  info2: string;
}

interface CrashResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  isSafe: boolean;
  title: string;
  conflicts: CrashConflict[];
}

export function CrashResultModal({
  isOpen,
  onClose,
  isSafe,
  title,
  conflicts,
}: CrashResultModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isSafe ? "✅ Bebas Crash" : "⚠️ Bentrok Terdeteksi"}
      maxWidth="max-w-2xl"
      footer={
        <button
          type="button"
          onClick={onClose}
          className={`px-6 py-2.5 rounded-xl text-sm font-bold transition shadow-md ${
            isSafe
              ? "bg-emerald-600 text-white hover:bg-emerald-700"
              : "bg-red-600 text-white hover:bg-red-700"
          }`}
        >
          {isSafe ? "OK, Lanjutkan" : "Tutup & Perbaiki"}
        </button>
      }
    >
      <div
        className={`text-center mb-4 p-4 rounded-xl ${
          isSafe ? "bg-emerald-50" : "bg-red-50"
        }`}
      >
        <i
          className={`text-4xl mb-2 ${
            isSafe
              ? "fa-solid fa-shield-check text-emerald-500"
              : "fa-solid fa-triangle-exclamation text-red-500"
          }`}
        />
        <p
          className={`font-bold text-lg mt-2 ${
            isSafe ? "text-emerald-800" : "text-red-800"
          }`}
        >
          {title}
        </p>
      </div>

      {!isSafe && conflicts.length > 0 && (
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {conflicts.map((c, idx) => (
            <div
              key={idx}
              className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm"
            >
              <p className="font-bold text-red-800 mb-1">
                <i className="fa-solid fa-bolt mr-1" />
                {c.type}
              </p>
              <div className="text-red-700 text-xs space-y-0.5">
                <p>
                  Form #{c.form1}: {c.info1}
                </p>
                <p>
                  Form #{c.form2}: {c.info2}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
