"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function PengajuanRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");

  useEffect(() => {
    if (tab === "izin") {
      router.replace("/pengajuan-izin");
    } else if (tab === "tukar-shift") {
      router.replace("/tukar-shift");
    } else if (tab === "suara") {
      router.replace("/suara-karyawan");
    } else {
      router.replace("/pengajuan-lembur");
    }
  }, [router, tab]);

  return (
    <div className="p-8 text-center text-slate-500 font-medium flex items-center justify-center gap-2">
      <i className="fa-solid fa-circle-notch fa-spin text-blue-600" />
      <span>Mengalihkan ke halaman pengajuan...</span>
    </div>
  );
}

export default function PengajuanPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Memuat...</div>}>
      <PengajuanRedirect />
    </Suspense>
  );
}
