"use client";

import { useState } from "react";
import { sendJson, errorMessage } from "@/lib/api-client";
import { toast } from "@/components/ui/toast";

export default function ChangePinModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPins, setShowPins] = useState(false);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPin.length !== 6) {
      toast.warning("PIN baru harus tepat 6 digit angka.");
      setError("PIN baru harus tepat 6 digit angka.");
      return;
    }

    if (newPin !== confirmPin) {
      toast.warning("Konfirmasi PIN baru tidak cocok.");
      setError("Konfirmasi PIN baru tidak cocok.");
      return;
    }

    setLoading(true);
    try {
      const data = await sendJson<{ message?: string }>("/api/auth/pin", "PUT", { currentPin, newPin });
      const msg = data.message || "PIN berhasil diubah!";
      toast.success(msg);
      setSuccess(msg);
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
      setTimeout(() => {
        onClose();
        setSuccess("");
      }, 1500);
    } catch (err) {
      const msg = errorMessage(err, "Gagal mengubah PIN.");
      toast.error(msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">
              <i className="fa-solid fa-key" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Ganti PIN Keamanan</h3>
              <p className="text-[11px] text-slate-400">PIN 6 digit untuk verifikasi login</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
          >
            <i className="fa-solid fa-xmark text-sm" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
            <i className="fa-solid fa-circle-exclamation flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl flex items-center gap-2">
            <i className="fa-solid fa-circle-check flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              PIN Lama (Default akun baru: 123456)
            </label>
            <input
              type={showPins ? "text" : "password"}
              maxLength={6}
              value={currentPin}
              onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ""))}
              placeholder="Masukkan PIN lama"
              required
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-center tracking-widest text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              PIN Baru (6 Digit Angka)
            </label>
            <input
              type={showPins ? "text" : "password"}
              maxLength={6}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
              placeholder="Contoh: 123456"
              required
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-center tracking-widest text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Konfirmasi PIN Baru (6 Digit)
            </label>
            <input
              type={showPins ? "text" : "password"}
              maxLength={6}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
              placeholder="Ulangi 6 digit PIN baru"
              required
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-center tracking-widest text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showPins}
                onChange={(e) => setShowPins(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-[11px]">Tampilkan Angka</span>
            </label>
            <span className="text-[10px] text-slate-400 font-mono">Default: 123456</span>
          </div>

          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 px-3 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm shadow-blue-600/20 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {loading ? (
                <>
                  <i className="fa-solid fa-circle-notch fa-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-check" />
                  <span>Simpan PIN</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
