"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

const DEMO_ACCOUNTS = [
  { role: "Super Admin", email: "admin@potensicreative.test", pin: "1234", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { role: "Operations", email: "ops@potensicreative.test", pin: "1234", color: "bg-purple-50 text-purple-700 border-purple-200" },
  { role: "Streamer", email: "streamer@potensicreative.test", pin: "1234", color: "bg-pink-50 text-pink-700 border-pink-200" },
  { role: "Trainer", email: "trainer@potensicreative.test", pin: "1234", color: "bg-amber-50 text-amber-700 border-amber-200" },
  { role: "QC Reviewer", email: "qc@potensicreative.test", pin: "1234", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { role: "Finance", email: "finance@potensicreative.test", pin: "1234", color: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  { role: "Staff", email: "staff@potensicreative.test", pin: "1234", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  { role: "Client", email: "client@potensicreative.test", pin: "1234", color: "bg-orange-50 text-orange-700 border-orange-200" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);

  useEffect(() => {
    // Only show Google OAuth if the provider is actually configured server-side.
    fetch("/api/auth/providers")
      .then((r) => r.json())
      .then((p) => setGoogleEnabled(!!p?.google))
      .catch(() => setGoogleEnabled(false));
  }, []);

  async function handleLogin(targetEmail?: string, targetPin?: string) {
    const loginEmail = (targetEmail ?? email).trim().toLowerCase();
    const loginPin = (targetPin ?? pin).trim();

    if (!loginEmail || !loginPin) {
      setError("Silakan masukkan Email dan PIN.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const res = await signIn("credentials", {
        email: loginEmail,
        pin: loginPin,
        redirect: false,
      });

      if (!res?.error) {
        router.push("/dashboard");
        router.refresh();
      } else {
        setError("Email atau PIN tidak valid.");
      }
    } catch {
      setError("Terjadi kesalahan koneksi. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  function handleDemoClick(acc: typeof DEMO_ACCOUNTS[0]) {
    setEmail(acc.email);
    setPin(acc.pin);
    setError("");
    handleLogin(acc.email, acc.pin);
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
        {/* Header Branding (Ref: ref-website-lama/index.html) */}
        <div className="bg-slate-50 p-8 text-center border-b border-slate-100">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-md">
            <span className="text-3xl font-bold text-white">P</span>
          </div>
          <h1 className="text-2xl font-bold text-blue-600 mb-1">Potensi Creative</h1>
          <p className="text-slate-500 text-sm font-medium">
            Human Resource Information System
          </p>
        </div>

        <div className="p-7 sm:p-8 space-y-6">
          {/* Primary Google OAuth Button (Matching ref-deploy/index.html) */}
          <div>
            <button
              type="button"
              onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
              className="w-full flex items-center justify-center gap-3 bg-white border border-slate-300 rounded-xl py-3 px-4 font-semibold text-sm text-slate-700 hover:bg-slate-50 transition shadow-sm hover:border-slate-400 group"
            >
              <svg width="20" height="20" viewBox="0 0 48 48">
                <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/>
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
                <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"/>
              </svg>
              <span>Masuk dengan Google (OAuth 2.0)</span>
            </button>
          </div>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-200 w-full" />
            <span className="bg-white px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider absolute">
              atau gunakan Email & PIN
            </span>
          </div>

          {/* Main Login Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin();
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Alamat Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition bg-white"
                placeholder="nama@potensicreative.test"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Masukkan PIN Internal
              </label>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-4 py-3 text-lg tracking-widest text-center text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none font-mono bg-white"
                placeholder="••••"
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2 font-medium">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl transition shadow-md disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
            >
              {loading ? (
                <>
                  <i className="fa-solid fa-circle-notch fa-spin"></i>
                  <span>Otentikasi...</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-right-to-bracket"></i>
                  <span>Masuk ke Dashboard</span>
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-200 w-full" />
            <span className="bg-white px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider absolute">
              Akun Uji Coba (1-Click)
            </span>
          </div>

          {/* Demo Quick Accounts */}
          <div>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.role}
                  type="button"
                  onClick={() => handleDemoClick(acc)}
                  disabled={loading}
                  className={`text-left px-3 py-2 rounded-lg border text-xs font-semibold transition hover:shadow-sm flex items-center justify-between ${acc.color}`}
                >
                  <span className="truncate">{acc.role}</span>
                  <span className="text-[10px] opacity-60 ml-1 font-mono">Demo</span>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-center text-slate-400 mt-2">
              Klik salah satu role di atas untuk login instan.
            </p>
          </div>
        </div>

        <div className="bg-slate-50 p-4 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-400">&copy; 2026 HRIS Potensi Creative. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
