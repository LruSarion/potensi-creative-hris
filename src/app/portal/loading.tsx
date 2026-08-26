import React from "react";

export default function PortalLoading() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-pulse">
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-3">
        <div className="h-6 bg-slate-200 rounded w-48"></div>
        <div className="h-4 bg-slate-100 rounded w-80"></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm h-36"></div>
        ))}
      </div>
    </div>
  );
}
