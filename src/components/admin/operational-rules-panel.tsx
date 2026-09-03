"use client";

import { useEffect, useState } from "react";
import { fetchJson, sendJson } from "@/lib/api-client";
import {
  DEFAULT_OPERATIONAL_RULES,
  parseGMapCoords,
  type OperationalRulesConfig,
  type RoleOperationalRule,
  type GeoLocationRule,
} from "@/lib/types/operational-rules";

export default function OperationalRulesPanel() {
  const [rulesConfig, setRulesConfig] = useState<OperationalRulesConfig>(DEFAULT_OPERATIONAL_RULES);
  const [selectedRuleRole, setSelectedRuleRole] = useState<"streamer" | "ots" | "staff">("streamer");
  const [loadingRules, setLoadingRules] = useState(false);
  const [savingRules, setSavingRules] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadRules();
  }, []);

  async function loadRules() {
    setLoadingRules(true);
    try {
      const data = await fetchJson<OperationalRulesConfig>("/api/admin/rules");
      if (data) setRulesConfig(data);
    } catch (err) {
      console.error("Gagal memuat rules:", err);
    } finally {
      setLoadingRules(false);
    }
  }

  async function saveRules(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setSavingRules(true);
    setError("");
    setSuccess("");
    try {
      const res = await sendJson<{ success: boolean; message: string; rules: OperationalRulesConfig }>(
        "/api/admin/rules",
        "POST",
        rulesConfig
      );
      if (res.rules) setRulesConfig(res.rules);
      setSuccess("Rules & Kebijakan Operasional berhasil disimpan ke database!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan rules operasional");
    } finally {
      setSavingRules(false);
    }
  }

  function updateCurrentRoleRule(patch: Partial<RoleOperationalRule>) {
    setRulesConfig((prev) => ({
      ...prev,
      [selectedRuleRole]: {
        ...prev[selectedRuleRole],
        ...patch,
      },
    }));
  }

  function addGeoLocation() {
    const newLoc: GeoLocationRule = {
      cabang: "Cabang Baru",
      koordinat: "-7.7956, 110.3695",
      lat: -7.7956,
      lng: 110.3695,
      radiusMeter: 100,
      mode: "STRICT",
    };
    const currentLocs = rulesConfig[selectedRuleRole]?.geoLocations ?? [];
    updateCurrentRoleRule({ geoLocations: [...currentLocs, newLoc] });
  }

  function updateGeoLocation(index: number, patch: Partial<GeoLocationRule>) {
    const currentLocs = [...(rulesConfig[selectedRuleRole]?.geoLocations ?? [])];
    if (!currentLocs[index]) return;
    currentLocs[index] = { ...currentLocs[index], ...patch };
    updateCurrentRoleRule({ geoLocations: currentLocs });
  }

  function updateGeoLocationCoords(index: number, rawVal: string) {
    const currentLocs = [...(rulesConfig[selectedRuleRole]?.geoLocations ?? [])];
    if (!currentLocs[index]) return;
    const parsed = parseGMapCoords(rawVal);
    currentLocs[index] = {
      ...currentLocs[index],
      koordinat: rawVal,
      ...(parsed ? { lat: parsed.lat, lng: parsed.lng } : {}),
    };
    updateCurrentRoleRule({ geoLocations: currentLocs });
  }

  function removeGeoLocation(index: number) {
    const currentLocs = (rulesConfig[selectedRuleRole]?.geoLocations ?? []).filter((_, i) => i !== index);
    updateCurrentRoleRule({ geoLocations: currentLocs });
  }

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {success && (
        <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-2">
          <i className="fa-solid fa-circle-check text-emerald-600 text-sm" />
          <span>{success}</span>
        </div>
      )}
      {error && (
        <div className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-2">
          <i className="fa-solid fa-circle-exclamation text-red-600 text-sm" />
          <span>{error}</span>
        </div>
      )}

      {/* Header Card with Role Selector */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="bg-[#941A0B]/10 text-[#941A0B] w-10 h-10 rounded-xl flex items-center justify-center text-lg">
                <i className="fa-solid fa-gavel" />
              </span>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Rules & Kebijakan Operasional Presensi</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Atur jam wajib hadir, batas waktu check-in, toleransi keterlambatan, dan koordinat geo-lokasi studio per role.
                </p>
              </div>
            </div>
          </div>

          {/* Role Toggle Selector */}
          <div className="flex items-center gap-1.5 p-1.5 bg-slate-100 rounded-xl border border-slate-200">
            {(["streamer", "ots", "staff"] as const).map((r) => {
              const label = r === "streamer" ? "Streamer (Host)" : r === "ots" ? "Operator OTS" : "Staff Umum";
              const isAct = selectedRuleRole === r;
              const isEnabled = rulesConfig[r]?.enabled;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setSelectedRuleRole(r)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    isAct
                      ? "bg-white text-[#941A0B] shadow-sm border border-slate-200"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${isEnabled ? "bg-emerald-500" : "bg-slate-300"}`} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Role Activation Switch */}
        <div className="flex items-center justify-between pt-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700">
              Status Penegakan Rules untuk {selectedRuleRole.toUpperCase()}:
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
              rulesConfig[selectedRuleRole]?.enabled
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-slate-100 text-slate-500 border border-slate-200"
            }`}>
              {rulesConfig[selectedRuleRole]?.enabled ? "AKTIF" : "NON-AKTIF"}
            </span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={rulesConfig[selectedRuleRole]?.enabled ?? false}
              onChange={(e) => updateCurrentRoleRule({ enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#941A0B]" />
          </label>
        </div>
      </div>

      <form onSubmit={saveRules} className="space-y-6">
        {/* Card 1: Rules Waktu & Keterlambatan */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <i className="fa-regular fa-clock text-[#941A0B]" />
              <h3 className="font-bold text-sm text-slate-900">
                Aturan Waktu & Keterlambatan ({selectedRuleRole.toUpperCase()})
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">Semua Nilai Dapat Disimpan ke Database</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
              <label className="block text-xs font-bold text-slate-700">Wajib Hadir Sebelum Sesi</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  value={rulesConfig[selectedRuleRole]?.wajibHadirMenit ?? 15}
                  onChange={(e) => updateCurrentRoleRule({ wajibHadirMenit: Math.max(0, parseInt(e.target.value) || 0) })}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-[#941A0B] outline-none"
                />
                <span className="text-xs text-slate-500 font-semibold">Menit</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">Host/Staff harus sudah di lokasi X menit sebelum live mulai.</p>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
              <label className="block text-xs font-bold text-slate-700">Jendela Buka Check-In</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  value={rulesConfig[selectedRuleRole]?.jendelaBukaMenit ?? 120}
                  onChange={(e) => updateCurrentRoleRule({ jendelaBukaMenit: Math.max(0, parseInt(e.target.value) || 0) })}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-[#941A0B] outline-none"
                />
                <span className="text-xs text-slate-500 font-semibold">Menit</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">Form check-in baru boleh diakses X menit sebelum jam mulai.</p>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
              <label className="block text-xs font-bold text-slate-700">Jendela Tutup Check-In</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  value={rulesConfig[selectedRuleRole]?.jendelaTutupMenit ?? 60}
                  onChange={(e) => updateCurrentRoleRule({ jendelaTutupMenit: Math.max(0, parseInt(e.target.value) || 0) })}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-[#941A0B] outline-none"
                />
                <span className="text-xs text-slate-500 font-semibold">Menit</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">Batas telat reguler (setelah lewat, diarahkan ke form terbatas).</p>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
              <label className="block text-xs font-bold text-slate-700">Toleransi Keterlambatan</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  value={rulesConfig[selectedRuleRole]?.toleransiTerlambatMenit ?? 0}
                  onChange={(e) => updateCurrentRoleRule({ toleransiTerlambatMenit: Math.max(0, parseInt(e.target.value) || 0) })}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-[#941A0B] outline-none"
                />
                <span className="text-xs text-slate-500 font-semibold">Menit</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">Masa tenggang (grace period) tanpa dihitung status terlambat.</p>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-slate-100">
            <div>
              <h4 className="text-xs font-bold text-slate-800">Wajibkan Pengisian Alasan Jika Terlambat</h4>
              <p className="text-[11px] text-slate-500">
                Tombol Check-In akan dinonaktifkan sampai pengguna mengisi alasan keterlambatan.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={rulesConfig[selectedRuleRole]?.wajibAlasanTerlambat ?? true}
                onChange={(e) => updateCurrentRoleRule({ wajibAlasanTerlambat: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#941A0B]" />
            </label>
          </div>
        </div>

        {/* Card 2: Rules Geo-Lokasi Studio */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-location-dot text-[#941A0B]" />
                <h3 className="font-bold text-sm text-slate-900">
                  Aturan Geo-Lokasi & Radius Studio ({selectedRuleRole.toUpperCase()})
                </h3>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Tentukan titik koordinat GPS cabang studio dan mode penegakan (Strict = Tolak, Warning = Catat Peringatan).
              </p>
            </div>
            <button
              type="button"
              onClick={addGeoLocation}
              className="bg-slate-100 hover:bg-[#941A0B] hover:text-white text-slate-700 font-bold px-3 py-1.5 rounded-lg text-xs transition flex items-center gap-1.5 border border-slate-200 cursor-pointer"
            >
              <i className="fa-solid fa-plus text-xs" />
              <span>Tambah Cabang</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
              <thead className="bg-slate-50 font-bold text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="p-3">Nama Cabang / Studio</th>
                  <th className="p-3">
                    <div className="flex items-center gap-1.5">
                      <i className="fa-solid fa-map-pin text-[#941A0B]" />
                      <span>Koordinat Google Maps (Lat, Lng)</span>
                    </div>
                  </th>
                  <th className="p-3">Radius Toleransi (m)</th>
                  <th className="p-3">Mode Penegakan</th>
                  <th className="p-3 text-center w-16">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {(rulesConfig[selectedRuleRole]?.geoLocations ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-400 italic">
                      Belum ada lokasi studio yang didaftarkan. Klik tombol &quot;Tambah Cabang&quot; di atas.
                    </td>
                  </tr>
                ) : (
                  (rulesConfig[selectedRuleRole]?.geoLocations ?? []).map((loc, idx) => {
                    const displayCoords = loc.koordinat ?? (loc.lat && loc.lng ? `${loc.lat}, ${loc.lng}` : "");
                    const isCoordsValid = Boolean(loc.lat && loc.lng && !isNaN(loc.lat) && !isNaN(loc.lng));

                    return (
                      <tr key={idx} className="hover:bg-slate-50/80">
                        <td className="p-2.5">
                          <input
                            type="text"
                            value={loc.cabang}
                            onChange={(e) => updateGeoLocation(idx, { cabang: e.target.value })}
                            placeholder="misal: Timoho"
                            className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold text-slate-800 focus:ring-1 focus:ring-[#941A0B] outline-none"
                          />
                        </td>
                        <td className="p-2.5">
                          <div className="relative">
                            <input
                              type="text"
                              value={displayCoords}
                              onChange={(e) => updateGeoLocationCoords(idx, e.target.value)}
                              placeholder="-7.7956, 110.3695 (copas langsung dari Google Maps)"
                              className="w-full min-w-[240px] border border-slate-200 rounded-lg pl-2.5 pr-8 py-1.5 font-mono text-xs text-slate-800 focus:ring-1 focus:ring-[#941A0B] outline-none bg-white"
                            />
                            {isCoordsValid ? (
                              <span
                                className="absolute right-2.5 top-2 text-[11px] text-emerald-600 font-bold"
                                title={`Koordinat Valid: Lat ${loc.lat}, Lng ${loc.lng}`}
                              >
                                <i className="fa-solid fa-circle-check" />
                              </span>
                            ) : (
                              <span
                                className="absolute right-2.5 top-2 text-[11px] text-amber-500 font-bold"
                                title="Pastikan format koordinat: Lat, Lng (misal: -7.7956, 110.3695)"
                              >
                                <i className="fa-solid fa-triangle-exclamation" />
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-2.5">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="10"
                              max="10000"
                              value={loc.radiusMeter}
                              onChange={(e) => updateGeoLocation(idx, { radiusMeter: Math.max(10, parseInt(e.target.value) || 100) })}
                              className="w-20 border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono text-slate-800 font-bold focus:ring-1 focus:ring-[#941A0B] outline-none"
                            />
                            <span className="text-[11px] text-slate-400 font-medium">Meter</span>
                          </div>
                        </td>
                        <td className="p-2.5">
                          <select
                            value={loc.mode}
                            onChange={(e) => updateGeoLocation(idx, { mode: e.target.value as "STRICT" | "WARNING" })}
                            className={`border rounded-lg px-2.5 py-1.5 font-bold text-xs outline-none ${
                              loc.mode === "STRICT"
                                ? "border-red-200 bg-red-50 text-red-700"
                                : "border-amber-200 bg-amber-50 text-amber-700"
                            }`}
                          >
                            <option value="STRICT">Strict (Tolak Check-In)</option>
                            <option value="WARNING">Warning (Catat Peringatan)</option>
                          </select>
                        </td>
                        <td className="p-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => removeGeoLocation(idx)}
                            className="w-8 h-8 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition inline-flex items-center justify-center cursor-pointer"
                            title="Hapus Cabang"
                          >
                            <i className="fa-solid fa-trash-can text-xs" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Save Action Button */}
        <div className="flex items-center justify-between bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="text-xs text-slate-500">
            Nilai konfigurasi di atas akan disimpan langsung ke database dan diterapkan otomatis pada sistem presensi.
          </div>
          <button
            type="submit"
            disabled={savingRules || loadingRules}
            className="bg-[#941A0B] hover:bg-[#781408] text-white font-bold px-6 py-2.5 rounded-xl text-xs transition shadow-md shadow-[#941A0B]/20 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {savingRules ? (
              <>
                <i className="fa-solid fa-spinner fa-spin text-xs" />
                <span>Menyimpan ke Database...</span>
              </>
            ) : (
              <>
                <i className="fa-solid fa-floppy-disk text-xs" />
                <span>Simpan Pengaturan Rules</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
