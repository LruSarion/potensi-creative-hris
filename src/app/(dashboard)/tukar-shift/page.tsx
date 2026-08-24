"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function TukarShiftRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/pengajuan?tab=tukar-shift");
  }, [router]);

  return (
    <div className="p-8 text-center text-slate-500 font-medium">
      Mengalihkan ke Pusat Pengajuan (Tab Tukar Shift)...
    </div>
  );
}
