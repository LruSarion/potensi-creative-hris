import React from "react";

export default function DashboardLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      {/* Top Header Skeleton */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div className="space-y-2">
          <div className="h-7 bg-slate-200 rounded-lg w-48"></div>
          <div className="h-4 bg-slate-100 rounded-md w-72"></div>
        </div>
        <div className="h-10 bg-slate-200 rounded-xl w-32"></div>
      </div>

      {/* Stats Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3">
            <div className="flex justify-between items-center">
              <div className="h-4 bg-slate-200 rounded w-24"></div>
              <div className="w-9 h-9 bg-slate-100 rounded-xl"></div>
            </div>
            <div className="h-8 bg-slate-200 rounded-lg w-32"></div>
            <div className="h-3 bg-slate-100 rounded w-20"></div>
          </div>
        ))}
      </div>

      {/* Main Content Table Skeleton */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden p-6 space-y-4">
        <div className="flex justify-between items-center">
          <div className="h-5 bg-slate-200 rounded w-40"></div>
          <div className="h-8 bg-slate-100 rounded-lg w-28"></div>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 bg-slate-50 rounded-xl border border-slate-100"></div>
          ))}
        </div>
      </div>
    </div>
  );
}
