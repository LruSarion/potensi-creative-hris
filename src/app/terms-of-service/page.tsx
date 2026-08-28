import Link from "next/link";

export const metadata = {
  title: "Ketentuan Layanan (Terms of Service) - Potensi Creative",
  description: "Ketentuan Layanan penggunaan platform manajemen operasional Potensi Creative HRIS.",
};

export default function TermsOfServicePage() {
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
            Ketentuan Layanan (Terms of Service)
          </h1>
          <p className="text-slate-400 text-xs">
            Terakhir diperbarui: 27 Agustus 2026 | Berlaku untuk: <strong>Potensi Creative HRIS</strong> (https://potensi-creative-hris.vercel.app)
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-white">1. Penerimaan Ketentuan</h2>
          <p>
            Dengan mengakses atau menggunakan platform <strong>Potensi Creative HRIS</strong> (&ldquo;Layanan&rdquo;), Anda menyatakan telah membaca, memahami, dan menyetujui untuk terikat oleh Ketentuan Layanan ini.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-white">2. Deskripsi Layanan</h2>
          <p>
            Potensi Creative HRIS adalah sistem manajemen operasional internal yang mencakup penjadwalan siaran langsung, presensi berbasis lokasi studio, manajemen pertukaran shift, penilaian KPI kinerja karyawan, dan rekapitulasi penggajian.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-white">3. Akun dan Keamanan Pengguna</h2>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
            <li>Pengguna wajib menggunakan akun Google resmi yang telah didaftarkan dalam sistem database Potensi Creative.</li>
            <li>Pengguna bertanggung jawab penuh untuk menjaga kerahasiaan kredensial akun mereka.</li>
            <li>Dilarang keras membagikan kredensial atau memberikan akses akun kepada pihak luar yang tidak berwenang.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-white">4. Kewajiban & Larangan Penggunaan</h2>
          <p>Pengguna dilarang untuk:</p>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
            <li>Melakukan manipulasi data presensi, GPS spoofing, atau pemalsuan rekaman siaran.</li>
            <li>Mencoba merusak, membobol, atau mengganggu integritas server dan basis data.</li>
            <li>Menyebarkan data rahasia klien brand, dokumen brief, atau data payroll kepada pihak ketiga.</li>
          </ul>
        </section>

        <section className="space-y-3 border-t border-slate-800 pt-6">
          <h2 className="text-base sm:text-lg font-bold text-white">5. Kontak dan Bantuan</h2>
          <p>
            Untuk pertanyaan terkait Ketentuan Layanan ini, silakan hubungi tim administrasi operasional melalui email: <a href="mailto:paundra.afif@gmail.com" className="text-blue-400">paundra.afif@gmail.com</a>.
          </p>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 py-6 px-4 text-center text-xs text-slate-500">
        <p>&copy; {new Date().getFullYear()} Potensi Creative. All rights reserved.</p>
      </footer>
    </div>
  );
}
