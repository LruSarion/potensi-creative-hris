"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PengajuanLemburRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/pengajuan?tab=lembur");
  }, [router]);

  return (
    <div className="p-8 text-center text-slate-500 font-medium">
      Mengalihkan ke Pusat Pengajuan (Tab Lembur)...
    </div>
  );
}
