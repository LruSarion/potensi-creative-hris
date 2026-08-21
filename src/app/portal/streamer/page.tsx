"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

export default function StreamerPortalPage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<"marketplace" | "profile">("marketplace");
  const [listings, setListings] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    load();
    loadProfile();
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

  async function loadProfile() {
    try {
      const r = await fetch("/api/streamer-profile");
      const d = await r.json();
      if (d.status === "success") {
        setProfile(d.data);
        setPhotoUrl(d.data?.photoUrl ?? "");
        setBio(d.data?.bio ?? "");
      }
    } catch {
      // ignore
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

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      const r = await fetch("/api/streamer-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoUrl, bio }),
      });
      const d = await r.json();
      if (d.status === "success") {
        setSuccess("Profil berhasil diperbarui! Klien kini dapat melihat foto & biodata Anda.");
        loadProfile();
      } else {
        setError(d.message ?? "Gagal menyimpan profil");
      }
    } catch {
      setError("Koneksi gagal");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Portal Streamer</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Kelola profil Anda dan lamar proyek brand sesuai sertifikasi.
          </p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab("marketplace")}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === "marketplace" ? "bg-white text-blue-600 shadow-sm" : "text-slate-600"
            }`}
          >
            Marketplace Proyek
          </button>
          <button
            onClick={() => setActiveTab("profile")}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === "profile" ? "bg-white text-blue-600 shadow-sm" : "text-slate-600"
            }`}
          >
            Profil & Pengalaman
          </button>
        </div>
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

      {activeTab === "marketplace" && (
        loading ? (
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
        )
      )}

      {activeTab === "profile" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Profile edit */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-800">Profil Saya</h3>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-blue-600/10 border-2 border-blue-200 overflow-hidden flex items-center justify-center">
                {photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoUrl} alt="Foto profil" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-black text-blue-600">
                    {session?.user?.name?.charAt(0) ?? "?"}
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-500">
                <div className="font-bold text-slate-800">{session?.user?.name}</div>
                <div className="text-amber-500 font-bold mt-0.5">★ {profile?.rating?.toFixed(1) ?? "0.0"}</div>
                <div>{profile?.totalSessions ?? 0} sesi selesai</div>
              </div>
            </div>

            <form onSubmit={saveProfile} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">URL Foto Profil</label>
                <input
                  type="url"
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  placeholder="https://.../foto-anda.jpg (Drive / gambar)"
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Biodata / Pengalaman Singkat</label>
                <textarea
                  rows={4}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Ceritakan pengalaman Anda sebagai host live streaming..."
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-xs transition"
              >
                Simpan Profil
              </button>
            </form>
          </div>

          {/* Experience portfolio */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-800">Pengalaman Proyek ({profile?.experiences?.length ?? 0})</h3>
            {(profile?.experiences ?? []).length > 0 ? (
              <div className="space-y-3">
                {profile.experiences.map((x: any) => (
                  <div key={x.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 text-xs">{x.title}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {x.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      {x.clientName ?? "Brand"} • {x.platform ?? "-"} • {x.periode ?? "-"}
                    </div>
                    {x.result && <div className="text-[11px] text-slate-600 mt-1">{x.result}</div>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400 text-xs">
                <i className="fa-solid fa-award text-3xl text-slate-300 block mb-2" />
                Belum ada pengalaman proyek. Selesaikan proyek marketplace agar tercatat di sini.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

