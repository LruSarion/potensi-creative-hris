"use client";

import React, { useState, useMemo } from "react";

export interface ColumnDef<T> {
  key: string;
  header: string | React.ReactNode;
  cell?: (item: T, index: number) => React.ReactNode;
  className?: string;
  headerClassName?: string;
  sortable?: boolean;
}

export interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  keyExtractor: (item: T, index: number) => string | number;
  pageSize?: number;
  pageSizeOptions?: number[];
  emptyMessage?: string | React.ReactNode;
  searchFilter?: (item: T, query: string) => boolean;
  searchPlaceholder?: string;
  headerTitle?: string;
  headerSubtitle?: string;
  headerAction?: React.ReactNode;
  className?: string;
}

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  pageSize: initialPageSize = 10,
  pageSizeOptions = [5, 10, 20, 50],
  emptyMessage = "Tidak ada data yang tersedia.",
  searchFilter,
  searchPlaceholder = "Cari data...",
  headerTitle,
  headerSubtitle,
  headerAction,
  className = "",
}: DataTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Filtered data
  const filteredData = useMemo(() => {
    if (!searchFilter || !searchQuery.trim()) return data;
    return data.filter((item) => searchFilter(item, searchQuery.trim()));
  }, [data, searchFilter, searchQuery]);

  // Sorted data
  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;
    return [...filteredData].sort((a: any, b: any) => {
      const valA = a[sortKey];
      const valB = b[sortKey];
      if (valA === valB) return 0;
      if (valA == null) return 1;
      if (valB == null) return -1;
      if (typeof valA === "string") {
        return sortDirection === "asc"
          ? valA.localeCompare(String(valB))
          : String(valB).localeCompare(valA);
      }
      return sortDirection === "asc" ? valA - valB : valB - valA;
    });
  }, [filteredData, sortKey, sortDirection]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const page = Math.min(currentPage, totalPages);
  const startIndex = (page - 1) * pageSize;
  const paginatedData = sortedData.slice(startIndex, startIndex + pageSize);

  function handleSort(key: string) {
    if (sortKey === key) {
      if (sortDirection === "asc") setSortDirection("desc");
      else {
        setSortKey(null);
        setSortDirection("asc");
      }
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  }

  return (
    <div className={`bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden ${className}`}>
      {/* Header bar */}
      {(headerTitle || searchFilter || headerAction) && (
        <div className="p-4 sm:px-6 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            {headerTitle && (
              <h3 className="font-extrabold text-black text-sm">{headerTitle}</h3>
            )}
            {headerSubtitle && (
              <p className="text-xs text-slate-500 mt-0.5">{headerSubtitle}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {searchFilter && (
              <div className="relative flex-1 sm:w-64">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder={searchPlaceholder}
                  className="w-full border border-slate-300 rounded-xl px-3 py-1.5 pr-8 text-xs outline-none focus:ring-2 focus:ring-[#941A0B] bg-white transition"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setCurrentPage(1);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500"
                  >
                    <i className="fa-solid fa-circle-xmark text-xs" />
                  </button>
                )}
              </div>
            )}
            {headerAction}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-auto max-h-[500px]">
        <table className="min-w-full text-xs text-left">
          <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 z-10 border-b border-slate-200">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => col.sortable && handleSort(col.key)}
                  className={`p-3 ${col.headerClassName || ""} ${
                    col.sortable ? "cursor-pointer select-none hover:bg-slate-200 transition" : ""
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <span>{col.header}</span>
                    {col.sortable && sortKey === col.key && (
                      <i
                        className={`fa-solid ${
                          sortDirection === "asc" ? "fa-arrow-up" : "fa-arrow-down"
                        } text-[10px] text-[#941A0B]`}
                      />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-8 text-center text-slate-400">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedData.map((item, idx) => (
                <tr
                  key={keyExtractor(item, startIndex + idx)}
                  className="hover:bg-slate-50 transition"
                >
                  {columns.map((col) => (
                    <td key={col.key} className={`p-3 ${col.className || ""}`}>
                      {col.cell ? col.cell(item, startIndex + idx) : (item as any)[col.key] ?? "–"}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar */}
      <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs">
        <div className="flex items-center gap-3 text-slate-500">
          <span>
            Menampilkan <strong>{sortedData.length === 0 ? 0 : startIndex + 1}</strong> - <strong>{Math.min(startIndex + pageSize, sortedData.length)}</strong> dari <strong>{sortedData.length}</strong> data
          </span>
          {pageSizeOptions.length > 1 && (
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="border border-slate-300 rounded-lg px-2 py-1 text-xs bg-white font-bold"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt} / hal
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 disabled:opacity-40 font-bold hover:bg-slate-50 transition"
          >
            Sebelumnya
          </button>
          <span className="px-3 py-1.5 font-bold text-slate-700">
            Hal {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 disabled:opacity-40 font-bold hover:bg-slate-50 transition"
          >
            Selanjutnya
          </button>
        </div>
      </div>
    </div>
  );
}
