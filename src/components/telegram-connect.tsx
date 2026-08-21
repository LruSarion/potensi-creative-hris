"use client";

import { useEffect, useState } from "react";

export default function TelegramConnect() {
  const [connected, setConnected] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [link, setLink] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/telegram/connect", { cache: "no-store" });
      const d = await r.json();
      if (d.status === "success") {
        setConnected(d.data.connected);
        setChatId(d.data.chatId);
      } else {
        setError(d.message ?? "Gagal memuat status Telegram");
      }
    } catch {
      setError("Koneksi gagal");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleConnect() {
    setError("");
    setSuccess("");
    try {
      const r = await fetch("/api/telegram/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "connect" }),
      });
      const d = await r.json();
      if (d.status === "success") {
        setLink(d.data.link);
      } else {
        setError(d.message ?? "Gagal membuat tautan Telegram");
      }
    } catch {
      setError("Koneksi gagal");
    }
  }

  async function handleDisconnect() {
    if (!confirm("Putuskan koneksi Telegram?")) return;
    setError("");
    try {
      const r = await fetch("/api/telegram/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnect" }),
      });
      const d = await r.json();
      if (d.status === "success") {
        setConnected(false);
        setChatId(null);
        setLink("");
        setSuccess("Koneksi Telegram diputuskan.");
      } else {
        setError(d.message ?? "Gagal memutuskan koneksi");
      }
    } catch {
      setError("Koneksi gagal");
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
        <div className="space-y-2">
          <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2">
            <i className="fa-solid fa-circle-check" />
            Aktif {chatId ? `(chat ${chatId})` : ""}
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
              <li>Buka Telegram di HP.</li>
              <li>Klik tombol hijau di bawah ini.</li>
              <li>Tekan "Start" di chat bot.</li>
            </ol>
          </div>
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[#229ED9] hover:bg-[#1c86b8] text-white font-bold px-4 py-2.5 rounded-xl text-xs transition shadow-md shadow-sky-500/20"
          >
            <i className="fa-brands fa-telegram" /> Buka Bot Telegram
          </a>
          <p className="text-[10px] text-slate-400">Sudah menekan Start? Kembali ke sini sebentar, status akan terhubung otomatis.</p>
          <div className="flex gap-2">
            <button onClick={load} className="text-[11px] font-semibold text-blue-600 hover:underline">
              Periksa Status
            </button>
            <button onClick={() => setLink("")} className="text-[11px] font-semibold text-slate-400 hover:underline">
              Batal
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={handleConnect}
          className="w-full inline-flex items-center justify-center gap-2 bg-[#229ED9] hover:bg-[#1c86b8] text-white font-bold py-2.5 rounded-xl text-xs transition shadow-md shadow-sky-500/20"
        >
          <i className="fa-brands fa-telegram" /> Hubungkan Telegram
        </button>
      )}
    </div>
  );
}
