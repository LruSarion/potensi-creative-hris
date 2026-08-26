import React from "react";

export default function RootLoading() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full mx-auto flex flex-col items-center text-center border border-slate-100 animate-fadeIn">
        <div className="relative mb-5 flex items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-600/10 flex items-center justify-center border border-blue-200">
            <span className="text-2xl font-black text-blue-600 font-sans">P</span>
          </div>
          <div className="absolute -inset-2 rounded-3xl border-2 border-blue-600 border-t-transparent animate-spin"></div>
        </div>
        <h3 className="text-lg font-bold text-slate-800 tracking-tight">Memuat Potensi HRIS...</h3>
        <p className="text-xs text-slate-400 mt-1.5 font-medium">Menghubungkan ke server...</p>
      </div>
    </div>
  );
}
