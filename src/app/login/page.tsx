"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

const DEMO_ACCOUNTS = [
  { role: "Super Admin", email: "admin@potensicreative.test", pin: "123456", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { role: "Operations", email: "ops@potensicreative.test", pin: "123456", color: "bg-purple-50 text-purple-700 border-purple-200" },
  { role: "Streamer", email: "streamer@potensicreative.test", pin: "123456", color: "bg-pink-50 text-pink-700 border-pink-200" },
  { role: "Trainer", email: "trainer@potensicreative.test", pin: "123456", color: "bg-amber-50 text-amber-700 border-amber-200" },
  { role: "QC Reviewer", email: "qc@potensicreative.test", pin: "123456", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { role: "Finance", email: "finance@potensicreative.test", pin: "123456", color: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  { role: "Staff", email: "staff@potensicreative.test", pin: "123456", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  { role: "Client", email: "client@potensicreative.test", pin: "123456", color: "bg-orange-50 text-orange-700 border-orange-200" },
];

export default function LoginPage() {
  const router = useRouter();

  // Login stage: "google" (Step 1) or "pin" (Step 2 after Google auth)
  const [step, setStep] = useState<"google" | "pin">("google");

  // Google Verified User Data for Step 2
  const [googleUser, setGoogleUser] = useState<{
    email: string;
    name?: string;
    photoURL?: string;
  } | null>(null);

  // Form states
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showManualLogin, setShowManualLogin] = useState(false);

  useEffect(() => {
    // Check if returning from a Google Sign-In redirect operation
    import("@/lib/firebase").then(({ checkFirebaseRedirectResult }) => {
      checkFirebaseRedirectResult().then(async (result) => {
        if (result) {
          setLoading(true);
          try {
            const res = await fetch("/api/auth/firebase", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(result),
            });
            const data = await res.json();

            if (!res.ok) {
              setError(data.error || "Gagal memproses otentikasi Google.");
              setStep("google");
              return;
            }

            if (data?.user?.email) {
              // Transition to Step 2: Input PIN
              setGoogleUser({
                email: data.user.email,
                name: data.user.name,
                photoURL: result.user.photoURL || undefined,
              });
              setStep("pin");
              setPin("");
              setError("");
            }
          } catch (e: any) {
            setError(e.message || "Gagal menghubungkan akun Google.");
            setStep("google");
          } finally {
            setLoading(false);
          }
        }
      });
    });
  }, [router]);

  function getRedirectTargetUrl() {
    if (typeof window === "undefined") return "/dashboard";
    const searchParams = new URLSearchParams(window.location.search);
    return searchParams.get("callbackUrl") || "/dashboard";
  }

  // Handle Step 1: Firebase Google Auth
  async function handleFirebaseGoogleLogin() {
    setLoading(true);
    setError("");
    try {
      const { signInWithGoogleFirebase } = await import("@/lib/firebase");
      const result = await signInWithGoogleFirebase();

      if (!result) {
        // Redirecting to Google Login page...
        return;
      }

      const res = await fetch("/api/auth/firebase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
      });

      const data = await res.json();

      if (!res.ok) {
        // Unregistered user or token error
        throw new Error(
          data.error ||
            `Email Google (${result.user.email}) belum terdaftar di sistem HRIS. Silakan hubungi Administrator/HRD.`
        );
      }

      if (!data?.user?.email) {
        throw new Error("Gagal memvalidasi data akun Google.");
      }

      // Transition to Step 2: Input PIN
      setGoogleUser({
        email: data.user.email,
        name: data.user.name || result.user.displayName || undefined,
        photoURL: result.user.photoURL || undefined,
      });
      setStep("pin");
      setPin("");
      setError("");
    } catch (err: any) {
      console.error("Firebase Google Login Error:", err);
      if (err?.code === "auth/popup-closed-by-user") {
        setError("Login Google dibatalkan.");
      } else {
        setError(err?.message || "Gagal masuk dengan Google.");
      }
    } finally {
      setLoading(false);
    }
  }

  // Handle Step 2: Submit PIN after Google Auth
  async function handleGooglePinSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!googleUser?.email) {
      setError("Data sesi Google tidak ditemukan. Silakan login ulang.");
      setStep("google");
      return;
    }

    const trimmedPin = pin.trim();
    if (!trimmedPin) {
      setError("Silakan masukkan PIN Internal Anda.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await signIn("credentials", {
        email: googleUser.email,
        pin: trimmedPin,
        isFirebaseAuth: "true",
        redirect: false,
      });

      if (!res?.error) {
        window.location.href = getRedirectTargetUrl();
      } else {
        setError("PIN Internal tidak valid. Silakan coba PIN default: 123456 atau hubungi Admin.");
        setPin("");
      }
    } catch {
      setError("Terjadi kesalahan koneksi. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  // Handle Manual Direct Email & PIN Login (e.g. for Demo Accounts or Super Admin direct login)
  async function handleManualLogin(targetEmail?: string, targetPin?: string) {
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
        window.location.href = getRedirectTargetUrl();
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
    handleManualLogin(acc.email, acc.pin);
  }

  function resetToGoogleStep() {
    setPin("");
    setError("");
    setGoogleUser(null);
    setStep("google");
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100 transition-all duration-300">
        {/* Header Branding */}
        <div className="bg-slate-50 p-8 text-center border-b border-slate-100">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-md">
            <span className="text-3xl font-bold text-white font-sans">P</span>
          </div>
          <h1 className="text-2xl font-bold text-blue-600 mb-1">Potensi Creative</h1>
          <p className="text-slate-500 text-sm font-medium">
            Human Resource Information System
          </p>
        </div>

        <div className="p-7 sm:p-8 space-y-6">
          {/* ========================================================================= */}
          {/* TAHAP 1: LOGIN GOOGLE (SISTEM KEAMANAN BERLAPIS) */}
          {/* ========================================================================= */}
          {step === "google" && (
            <div className="space-y-6 animate-fadeIn">
              <div className="text-center">
                <h2 className="text-lg font-bold text-slate-800">Sistem Keamanan Berlapis</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Gunakan akun Google yang telah terdaftar di HRIS untuk melanjutkan.
                </p>
              </div>

              {error && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-3.5 flex items-start gap-2.5 font-medium leading-relaxed">
                  <span className="text-sm shrink-0">⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              {/* Primary Google Sign-In Button */}
              <div>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleFirebaseGoogleLogin}
                  className="w-full flex items-center justify-center gap-3 bg-white border border-slate-300 rounded-xl py-3 px-4 font-semibold text-sm text-slate-700 hover:bg-slate-50 transition shadow-sm hover:border-slate-400 disabled:opacity-50 group cursor-pointer"
                >
                  {loading ? (
                    <>
                      <i className="fa-solid fa-circle-notch fa-spin text-blue-600"></i>
                      <span>Memverifikasi Google...</span>
                    </>
                  ) : (
                    <>
                      <svg width="20" height="20" viewBox="0 0 48 48">
                        <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z" />
                        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
                        <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
                      </svg>
                      <span>Masuk dengan Google</span>
                    </>
                  )}
                </button>
              </div>

              {/* Toggle Alternative / Manual Login */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowManualLogin(!showManualLogin)}
                  className="text-xs text-slate-500 hover:text-blue-600 font-medium transition flex items-center justify-center gap-1.5 mx-auto py-1"
                >
                  <span>{showManualLogin ? "Sembunyikan Opsi Alternatif" : "Atau gunakan Email & PIN / Akun Demo"}</span>
                  <i className={`fa-solid fa-chevron-${showManualLogin ? "up" : "down"} text-[10px]`}></i>
                </button>
              </div>

              {/* Manual Login & Demo Accounts Panel */}
              {showManualLogin && (
                <div className="space-y-5 pt-2 border-t border-slate-100 animate-fadeIn">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleManualLogin();
                    }}
                    className="space-y-3.5"
                  >
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Alamat Email
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition bg-white"
                        placeholder="nama@potensicreative.test"
                        autoComplete="email"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        PIN Internal
                      </label>
                      <input
                        type="password"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={8}
                        value={pin}
                        onChange={(e) => setPin(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3.5 py-2 text-sm text-center text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none font-mono bg-white tracking-widest"
                        placeholder="••••"
                        autoComplete="current-password"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl transition shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 text-xs"
                    >
                      <i className="fa-solid fa-right-to-bracket"></i>
                      <span>Masuk via Email & PIN</span>
                    </button>
                  </form>

                  {/* 1-Click Demo Accounts */}
                  <div>
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 text-center">
                      Akun Uji Coba Cepat (1-Click)
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {DEMO_ACCOUNTS.map((acc) => (
                        <button
                          key={acc.role}
                          type="button"
                          onClick={() => handleDemoClick(acc)}
                          disabled={loading}
                          className={`text-left px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition hover:shadow-sm flex items-center justify-between ${acc.color}`}
                        >
                          <span className="truncate">{acc.role}</span>
                          <span className="text-[10px] opacity-60 ml-1 font-mono">Demo</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAHAP 2: INPUT PIN SETELAH GOOGLE LOGIN (SESUAI REF-DEPLOY) */}
          {/* ========================================================================= */}
          {step === "pin" && (
            <div className="space-y-6 animate-fadeIn">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full mb-3 shadow-sm">
                  <i className="fa-solid fa-shield-check text-xl"></i>
                </div>
                <h2 className="text-lg font-bold text-slate-800">Verifikasi Google Berhasil</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Login sebagai:{" "}
                  <span className="font-semibold text-blue-600 block sm:inline">
                    {googleUser?.name ? `${googleUser.name} (${googleUser.email})` : googleUser?.email}
                  </span>
                </p>
              </div>

              {error && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-3.5 flex items-start gap-2.5 font-medium leading-relaxed">
                  <span className="text-sm shrink-0">⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleGooglePinSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5 text-center sm:text-left">
                    Masukkan 6 Digit PIN Internal
                  </label>
                  <div className="relative">
                    <input
                      type={showPin ? "text" : "password"}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                      className="w-full border border-slate-300 rounded-xl px-4 py-3 text-2xl tracking-[0.4em] text-center text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none font-mono bg-white shadow-inner font-bold"
                      placeholder="••••••"
                      required
                      autoFocus
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-2 cursor-pointer transition"
                      title={showPin ? "Sembunyikan PIN" : "Tampilkan PIN"}
                    >
                      <i className={`fa-solid ${showPin ? "fa-eye-slash" : "fa-eye"}`}></i>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 text-center mt-1.5 font-medium">
                    PIN default akun: <span className="font-mono font-bold text-blue-600">123456</span> (atau <span className="font-mono text-slate-500">1234</span>)
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl transition shadow-md disabled:opacity-50 flex items-center justify-center gap-2 text-sm cursor-pointer"
                >
                  {loading ? (
                    <>
                      <i className="fa-solid fa-circle-notch fa-spin"></i>
                      <span>Memverifikasi PIN...</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-right-to-bracket"></i>
                      <span>Masuk ke Dashboard</span>
                    </>
                  )}
                </button>
              </form>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={resetToGoogleStep}
                  className="text-xs text-slate-500 hover:text-blue-600 font-medium transition flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
                >
                  <i className="fa-solid fa-arrow-left text-[11px]"></i>
                  <span>Ganti Akun Google</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="bg-slate-50 p-4 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-400">&copy; 2026 HRIS Potensi Creative. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
