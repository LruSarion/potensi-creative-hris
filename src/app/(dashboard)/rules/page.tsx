import OperationalRulesPanel from "@/components/admin/operational-rules-panel";

export default function RulesPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Rules Operasional & Kebijakan</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Pusat konfigurasi aturan waktu presensi, toleransi keterlambatan, dan validasi radius GPS studio multi-role.
          </p>
        </div>
      </div>

      <OperationalRulesPanel />
    </div>
  );
}
