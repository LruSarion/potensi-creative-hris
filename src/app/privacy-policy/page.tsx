import Link from "next/link";

export const metadata = {
  title: "Kebijakan Privasi (Privacy Policy) - Potensi Creative",
  description: "Kebijakan Privasi penggunaan data dan sistem autentikasi Google OAuth pada platform Potensi Creative HRIS.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between selection:bg-blue-600 selection:text-white">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 font-bold text-white text-sm">
            <span className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-xs font-black">P</span>
            <span>Potensi Creative HRIS</span>
          </Link>
          <Link href="/login" className="text-xs font-bold text-blue-400 hover:text-blue-300">
            Masuk / Login &rarr;
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-8 text-xs sm:text-sm leading-relaxed text-slate-300">
        <div className="border-b border-slate-800 pb-6">
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2">
            Kebijakan Privasi (Privacy Policy)
          </h1>
          <p className="text-slate-400 text-xs">
            Terakhir diperbarui: 27 Agustus 2026 | Berlaku untuk: <strong>Potensi Creative HRIS</strong> (https://potensi-creative-hris.vercel.app)
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-white">1. Pendahuluan</h2>
          <p>
            Selamat datang di <strong>Potensi Creative HRIS</strong> (&ldquo;Aplikasi&rdquo;), sistem internal pengelolaan sumber daya manusia, manajemen jadwal siaran langsung (live streaming), presensi kerja, dan operasional agensi live commerce yang dikelola oleh Potensi Creative.
          </p>
          <p>
            Kami sangat menghormati privasi Anda dan berkomitmen untuk melindungi data pribadi pengguna saat mengakses atau menggunakan layanan kami.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-white">2. Informasi yang Kami Kumpulkan</h2>
          <p>Saat Anda menggunakan fitur <em>Sign in with Google</em> (Google OAuth), kami hanya mengakses informasi profil dasar publik yang diberikan dengan izin Anda:</p>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
            <li><strong>Nama Lengkap (Name)</strong>: Digunakan untuk identifikasi akun dan tampilan nama pada dashboard.</li>
            <li><strong>Alamat Email (Email)</strong>: Digunakan sebagai kredensial unik masuk (login identifier) dan korespondensi notifikasi jadwal kerja.</li>
            <li><strong>Foto Profil (Profile Picture)</strong>: Digunakan sebagai avatar tampilan antarmuka pengguna.</li>
          </ul>
          <p>
            Kami <strong>TIDAK</strong> mengakses data sensitif seperti isi email Gmail, berkas pribadi Google Drive di luar sistem operasional, riwayat penelusuran, kontak pribadi, maupun password akun Google Anda.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-white">3. Penggunaan Data Google User</h2>
          <p>Data akun Google Anda digunakan secara eksklusif untuk tujuan:</p>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
            <li>Melakukan autentikasi dan memvalidasi hak akses role (Super Admin, Admin Operasional, Host / Streamer, Staf Teknis OTS, Trainer, QC, dan Finance).</li>
            <li>Memetakan akun login dengan jadwal shift siaran dan rekaman presensi kerja.</li>
          </ul>
          <p>
            Kami menegaskan bahwa data pengguna Google <strong>TIDAK PERNAH</strong> dijual, disewakan, dialihkan, atau dibagikan kepada pihak ketiga manapun untuk tujuan periklanan atau pemasaran komersial.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-white">4. Keamanan dan Penyimpanan Data</h2>
          <p>
            Seluruh transmisi data dienkripsi menggunakan protokol aman standar industri HTTPS/TLS 1.3. Akses ke database dilindungi dengan otorisasi berbasis peran (Role-Based Access Control) dan mekanisme isolasi tenant.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-white">5. Hak Pengguna & Penghapusan Data</h2>
          <p>
            Anda dapat mencabut izin akses aplikasi Potensi Creative HRIS kapan saja melalui halaman pengelolaan keamanan akun Google Anda di: <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer" className="text-blue-400 underline">https://myaccount.google.com/permissions</a>.
          </p>
          <p>
            Untuk permohonan penghapusan data akun atau pertanyaan mengenai kebijakan privasi ini, Anda dapat menghubungi tim pengembang kami melalui email.
          </p>
        </section>

        <section className="space-y-3 border-t border-slate-800 pt-6">
          <h2 className="text-base sm:text-lg font-bold text-white">6. Kontak Kami</h2>
          <p>
            Jika Anda memiliki pertanyaan mengenai Kebijakan Privasi ini, silakan hubungi:
          </p>
          <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700 text-xs">
            <p className="font-bold text-white">Tim Pengembang Potensi Creative</p>
            <p className="text-slate-400 mt-1">Email: <a href="mailto:paundra.afif@gmail.com" className="text-blue-400">paundra.afif@gmail.com</a></p>
            <p className="text-slate-400">Website: <a href="https://potensi-creative-hris.vercel.app" className="text-blue-400">https://potensi-creative-hris.vercel.app</a></p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 py-6 px-4 text-center text-xs text-slate-500">
        <p>&copy; {new Date().getFullYear()} Potensi Creative. All rights reserved.</p>
      </footer>
    </div>
  );
}
