"use client";

import { useSession, signOut } from "next-auth/react";

/**
 * Logout confirmation modal — shows the logged-in user's identity
 * (nama lengkap, jabatan, NIK) before signing out, so the user can
 * verify they're ending the right session (shared devices in studios).
 */
export default function LogoutConfirmModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { data: session } = useSession();

  if (!open) return null;

  const name = session?.user?.name ?? "-";
  const jabatan = session?.user?.jabatan || "-";
  const nik = session?.user?.nik || "-";
  const role = session?.user?.role ? String(session.user.role).replace(/_/g, " ") : "";

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <i className="fa-solid fa-arrow-right-from-bracket text-[#941A0B]" />
            Konfirmasi Keluar Akun
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Tutup">
            ✕
          </button>
        </div>

        {/* User identity card */}
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-2xl p-4">
          <div className="w-11 h-11 rounded-2xl bg-[#941A0B]/10 text-[#941A0B] flex items-center justify-center text-lg shrink-0">
            <i className="fa-solid fa-user" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-slate-900 truncate">{name}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Jabatan: <strong className="text-slate-700">{jabatan}</strong>
            </div>
            <div className="text-[11px] text-slate-500">
              NIK: <strong className="text-slate-700">{nik}</strong>
            </div>
            {role && (
              <div className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wide">{role}</div>
            )}
          </div>
        </div>

        <p className="text-xs text-slate-600 text-center">
          Yakin ingin keluar dari akun ini? Sesi Anda akan diakhiri dan kembali ke halaman login.
        </p>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 transition"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-[#941A0B] hover:bg-[#6D1207] text-white transition shadow-md"
          >
            <i className="fa-solid fa-arrow-right-from-bracket mr-1.5" />
            Ya, Keluar
          </button>
        </div>
      </div>
    </div>
  );
}