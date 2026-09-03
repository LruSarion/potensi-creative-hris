"use client";

import { useEffect, useState } from "react";
import { useAlert } from "@/components/ui/custom-alert";
import { fetchJson, sendJson } from "@/lib/api-client";

type NotifType = { key: string; label: string; icon: string };

export default function TelegramConnect() {
  const { showConfirm } = useAlert();
  const [connected, setConnected] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [link, setLink] = useState("");
  const [configured, setConfigured] = useState(false);
  const [types, setTypes] = useState<NotifType[]>([]);
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [savingPrefs, setSavingPrefs] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await fetchJson<{
        connected: boolean;
        chatId: string | null;
        link?: string;
        configured?: boolean;
      }>("/api/telegram/connect", { cache: "no-store" });
      setConnected(data.connected);
      setChatId(data.chatId);
      setLink(data.link ?? "");
      setConfigured(data.configured ?? false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat status Telegram");
    } finally {
      setLoading(false);
    }
  }

  async function loadPrefs() {
    try {
      const data = await fetchJson<{ types?: NotifType[]; prefs?: Record<string, boolean> }>(
        "/api/telegram/prefs",
        { cache: "no-store" }
      );
      setTypes(data.types ?? []);
      setPrefs(data.prefs ?? {});
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    load();
    loadPrefs();
    // Auto-refresh connection status so the widget flips to "Terhubung" right
    // after the user presses Start in Telegram (no manual refresh needed).
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function savePrefs() {
    setSavingPrefs(true);
    setError("");
    setSuccess("");
    try {
      await sendJson("/api/telegram/prefs", "POST", { prefs });
      setSuccess("Preferensi notifikasi Telegram disimpan.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan preferensi");
    } finally {
      setSavingPrefs(false);
    }
  }

  async function handleDisconnect() {
    const confirmed = await showConfirm("Putuskan koneksi Telegram?");
    if (!confirmed) return;
    setError("");
    try {
      await sendJson("/api/telegram/connect", "POST", { action: "disconnect" });
      setConnected(false);
      setChatId(null);
      setLink("");
      setSuccess("Koneksi Telegram diputuskan.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memutuskan koneksi");
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
      <div className="flex items-center gap-2">
        <i className="fa-brands fa-telegram text-[#229ED9] text-xl" />
        <div>
          <h3 className="font-bold text-slate-900 text-sm">Notifikasi Telegram</h3>
          <p className="text-[11px] text-slate-500">
            {connected
              ? "Terhubung — notifikasi dikirim ke chat pribadi Telegram kamu."
              : "Terima notifikasi langsung ke chat Telegram pribadi kamu."}
          </p>
        </div>
      </div>

      {error && <div className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-xl p-3">⚠ {error}</div>}
      {success && <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl p-3">✓ {success}</div>}

      {loading ? (
        <p className="text-xs text-slate-400">Memuat status...</p>
      ) : connected ? (
        <div className="space-y-3">
          <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2">
            <i className="fa-solid fa-circle-check" />
            Aktif {chatId ? `(chat ${chatId})` : ""}
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
            <p className="text-xs font-bold text-slate-700">Notifikasi penting yang dikirim ke Telegram:</p>
            <div className="space-y-1.5">
              {types.map((t) => (
                <label key={t.key} className="flex items-center gap-2 cursor-pointer text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={prefs[t.key] !== false}
                    onChange={() => setPrefs((p) => ({ ...p, [t.key]: !(p[t.key] !== false) }))}
                    className="accent-[#229ED9]"
                  />
                  <i className={`fa-solid ${t.icon} text-slate-400 text-[10px]`} />
                  {t.label}
                </label>
              ))}
            </div>
            <button
              onClick={savePrefs}
              disabled={savingPrefs}
              className="text-xs font-bold text-white bg-[#229ED9] hover:bg-[#1c86b8] px-3 py-1.5 rounded-xl disabled:opacity-50"
            >
              {savingPrefs ? "Menyimpan..." : "Simpan Preferensi"}
            </button>
          </div>

          <button
            onClick={handleDisconnect}
            className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-3 py-1.5 rounded-xl hover:bg-red-100"
          >
            Putuskan Koneksi
          </button>
        </div>
      ) : link ? (
        <div className="space-y-3">
          <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1">
            <p className="font-semibold">Langkah mudah:</p>
            <ol className="list-decimal list-inside space-y-0.5 text-slate-500">
              <li>Klik tombol hijau di bawah ini.</li>
              <li>Tekan "Start" di chat bot.</li>
              <li>Selesai — otomatis terhubung.</li>
            </ol>
          </div>
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center gap-2 bg-[#229ED9] hover:bg-[#1c86b8] text-white font-bold px-4 py-2.5 rounded-xl text-xs transition shadow-md shadow-sky-500/20"
          >
            <i className="fa-brands fa-telegram" /> Buka Bot Telegram &amp; Hubungkan
          </a>
          <p className="text-[10px] text-slate-400">Sudah menekan Start? Kembali ke sini, status terhubung otomatis.</p>
          <button onClick={load} className="text-[11px] font-semibold text-blue-600 hover:underline">
            Periksa Status
          </button>
        </div>
      ) : configured === false ? (
        <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-3">
          Bot Telegram belum dikonfigurasi oleh Super Admin. Hubungi admin untuk mengaktifkan.
        </div>
      ) : (
        <button
          onClick={load}
          className="w-full inline-flex items-center justify-center gap-2 bg-[#229ED9] hover:bg-[#1c86b8] text-white font-bold py-2.5 rounded-xl text-xs transition shadow-md shadow-sky-500/20"
        >
          <i className="fa-brands fa-telegram" /> Cek Status Telegram
        </button>
      )}
    </div>
  );
}
