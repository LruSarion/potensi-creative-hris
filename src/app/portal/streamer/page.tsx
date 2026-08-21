"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

export default function StreamerPortalPage() {
  const { data: session } = useSession();
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/marketplace?view=eligible");
      const d = await r.json();
      if (d.status === "success") setListings(d.data);
      else setError(d.message ?? "Gagal memuat marketplace");
    } catch {
      setError("Koneksi gagal");
    } finally {
      setLoading(false);
    }
  }

  async function apply(listingId: string) {
    setError("");
    setSuccess("");
    try {
      const r = await fetch("/api/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "apply", listingId }),
      });
      const d = await r.json();
      if (d.status === "success") {
        setSuccess("Lamaran Anda terkirim! Tunggu keputusan klien.");
        load();
      } else {
        setError(d.message ?? "Gagal melamar");
      }
    } catch {
      setError("Koneksi gagal");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Marketplace Proyek Livestream</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Temukan dan lamar proyek brand yang sesuai dengan sertifikasi Anda.
        </p>
      </div>

      {success && (
        <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
          ✓ {success}
        </div>
      )}
      {error && (
        <div className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-2xl p-4">
          ⚠ {error}
        </div>
      )}

      {loading ? (
        <p className="text-xs text-slate-500">Memuat marketplace...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {listings.map((l) => (
            <div key={l.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center justify-between">
                <div className="font-bold text-slate-900">{l.title}</div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border border-emerald-200 bg-emerald-50 text-emerald-700">
                  {l.client?.namaClient}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">{l.description}</p>
              <div className="flex flex-wrap gap-3 mt-3 text-[11px] text-slate-600">
                <span className="px-2 py-0.5 rounded-md bg-slate-100">{l.platform ?? "-"}</span>
                <span className="font-mono">Rp {Number(l.ratePerSesi).toLocaleString("id-ID")}/sesi</span>
                <span>Kuota: {l.quota}</span>
              </div>

              <div className="mt-3 text-[11px]">
                {l.course ? (
                  <span className="text-slate-500">
                    Sertifikasi dibutuhkan: <span className="font-semibold text-slate-700">{l.course.title}</span>
                  </span>
                ) : (
                  <span className="text-slate-400">Tanpa syarat sertifikasi</span>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                {l.alreadyApplied ? (
                  <span className="text-xs font-bold text-blue-600">✓ Sudah Dilamar</span>
                ) : l.filled ? (
                  <span className="text-xs font-bold text-slate-400">Kuota Terisi</span>
                ) : l.eligible ? (
                  <button
                    onClick={() => apply(l.id)}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition"
                  >
                    Lamar Proyek Ini
                  </button>
                ) : (
                  <span className="text-xs font-bold text-amber-600">
                    Belum tersertifikasi untuk brand ini
                  </span>
                )}
                {l.filled && <span className="text-[10px] text-slate-400">Status: terisi</span>}
              </div>
            </div>
          ))}
          {listings.length === 0 && (
            <div className="col-span-2 p-12 text-center text-slate-400 text-xs">
              <i className="fa-solid fa-briefcase text-3xl text-slate-300 block mb-2" />
              Belum ada proyek tersedia saat ini.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
