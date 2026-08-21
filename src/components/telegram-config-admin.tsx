"use client";

import { useEffect, useState } from "react";

export default function TelegramConfigAdmin() {
  const [botToken, setBotToken] = useState("");
  const [botUsername, setBotUsername] = useState("");
  const [hasToken, setHasToken] = useState(false);
  const [source, setSource] = useState("none");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function load() {
    setError("");
    try {
      const r = await fetch("/api/telegram/config", { cache: "no-store" });
      const d = await r.json();
      if (d.status === "success") {
        setHasToken(d.data.hasToken);
        setBotUsername(d.data.botUsername);
        setSource(d.data.source);
      } else {
        setError(d.message ?? "Gagal memuat konfigurasi Telegram");
      }
    } catch {
      setError("Koneksi gagal");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      const r = await fetch("/api/telegram/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botToken, botUsername }),
      });
      const d = await r.json();
      if (d.status === "success") {
        setSuccess("Konfigurasi bot Telegram berhasil disimpan!");
        setBotToken("");
        setHasToken(true);
        load();
      } else {
        setError(d.message ?? "Gagal menyimpan konfigurasi");
      }
    } catch {
      setError("Koneksi gagal");
    }
  }

  const [webhookLoading, setWebhookLoading] = useState(false);

  async function setWebhook() {
    setError("");
    setSuccess("");
    setWebhookLoading(true);
    try {
      const r = await fetch("/api/telegram/webhook/set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appUrl: window.location.origin }),
      });
      const d = await r.json();
      if (d.status === "success") {
        setSuccess(`Webhook Bot berhasil diaktifkan ke: ${d.data.webhookUrl}`);
      } else {
        setError(d.message ?? "Gagal memasang webhook");
      }
    } catch {
      setError("Gagal menghubungkan webhook");
    } finally {
      setWebhookLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
      <div className="flex items-center gap-2">
        <i className="fa-brands fa-telegram text-[#229ED9] text-xl" />
        <div>
          <h3 className="font-bold text-slate-900 text-sm">Notifikasi Telegram</h3>
          <p className="text-[11px] text-slate-500">
            Setel bot Telegram agar seluruh staff/karyawan/role bisa menerima notifikasi di chat pribadi mereka.
          </p>
        </div>
        {hasToken && (
          <span className="ml-auto text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            {source === "tenant" ? "Tersimpan" : "Dari ENV"}
          </span>
        )}
      </div>

      {error && <div className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-xl p-3">⚠ {error}</div>}
      {success && <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl p-3">✓ {success}</div>}

      <form onSubmit={save} className="space-y-3 text-xs">
        <div>
          <label className="block font-semibold text-slate-700 mb-1">Token Bot (dari @BotFather)</label>
          <input
            type="password"
            value={botToken}
            onChange={(e) => setBotToken(e.target.value)}
            placeholder="123456789:AA..."
            className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>
        <div>
          <label className="block font-semibold text-slate-700 mb-1">Username Bot (tanpa @)</label>
          <input
            type="text"
            value={botUsername}
            onChange={(e) => setBotUsername(e.target.value)}
            placeholder="mis. PotensiKreatifBot"
            className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>
        <button
          type="submit"
          className="w-full bg-[#229ED9] hover:bg-[#1c86b8] text-white font-bold py-2.5 rounded-xl text-xs transition"
        >
          Simpan Konfigurasi Bot
        </button>
      </form>

      {hasToken && (
        <div className="pt-2 border-t border-slate-100 space-y-2">
          <button
            type="button"
            onClick={setWebhook}
            disabled={webhookLoading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs transition flex items-center justify-center gap-2"
          >
            {webhookLoading ? "Memasang Webhook..." : "🚀 Aktifkan Webhook Bot ke Domain Ini (1-Klik)"}
          </button>
          <p className="text-[10px] text-slate-400 text-center">
            Setiap kali mengubah domain Vercel / server, klik tombol di atas agar Telegram mengirim balasan & absensi ke URL baru.
          </p>
        </div>
      )}
    </div>
  );
}
