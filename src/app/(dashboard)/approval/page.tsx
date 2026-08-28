"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";

type MainTab = "marketplace" | "lembur" | "izin" | "shift";
type MarketplaceSubTab = "jadwal" | "approved" | "online" | "cleaning" | "riwayat";
type NormalSubTab = "pending" | "history";

interface ApprovalItem {
  type: "jadwal" | "izin" | "lembur" | "shift";
  id: string;
  ref: string;
  idJadwal?: string;
  platform?: string;
  judulLive?: string;
  tanggal: string;
  jamMulai?: string;
  jamSelesai?: string;
  durasi?: string;
  namaLengkap: string;
  idKaryawan: string | null;
  detail: string;
  alasan?: string | null;
  status: string;
  liveState?: string;
  cabangStudio?: string | null;
  nomorStudio?: string | null;
  filePendukungHost?: string | null;
  filePendukungOts?: string | null;
  produkPrioritas?: string | null;
  promoLive?: string | null;
  lampiranDriveId?: string | null;
  buktiDriveId?: string | null;
  createdAt: string;
}

export default function ApprovalPage() {
  const { data: session } = useSession();
  const userRole = (session?.user?.role || "").toUpperCase();
  const isAdmin = ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION", "CLIENT"].includes(userRole);

  // Tabs state
  const [mainTab, setMainTab] = useState<MainTab>("marketplace");
  const [mkSubTab, setMkSubTab] = useState<MarketplaceSubTab>("jadwal");
  const [normSubTab, setNormSubTab] = useState<NormalSubTab>("pending");

  // Data & loading state
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  // Selections for batch actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pendingStudioAssignments, setPendingStudioAssignments] = useState<
    Record<string, { cabang: string; studio: string }>
  >({});

  // Accordion expanded panel IDs
  const [expandedPanels, setExpandedPanels] = useState<Record<string, boolean>>({});

  // Edit Modal State
  const [editingItem, setEditingItem] = useState<ApprovalItem | null>(null);
  const [editForm, setEditForm] = useState({
    platform: "",
    tanggal: "",
    jamMulai: "",
    jamSelesai: "",
    judulLive: "",
    cabangStudio: "",
    nomorStudio: "",
    promoLive: "",
    filePendukungHost: "",
    filePendukungOts: "",
    produkPrioritas: "",
  });

  // Image zoom modal
  const [previewModalImg, setPreviewModalImg] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch("/api/approval");
      const data = await res.json();
      if (Array.isArray(data)) {
        setItems(data);
      }
    } catch (err) {
      console.error("Gagal memuat data approval:", err);
    } finally {
      setLoading(false);
    }
  }

  // Filtered lists for each view
  const currentFilteredList = useMemo(() => {
    const q = search.toLowerCase();

    if (mainTab === "marketplace") {
      return items.filter((item) => {
        if (item.type !== "jadwal") return false;

        let statusMatch = false;
        if (mkSubTab === "jadwal") statusMatch = item.status === "PENDING";
        else if (mkSubTab === "approved") statusMatch = item.status === "APPROVED" && (!item.liveState || item.liveState === "SCHEDULED");
        else if (mkSubTab === "online") statusMatch = item.liveState === "LIVE";
        else if (mkSubTab === "cleaning") statusMatch = item.liveState === "REVIEW";
        else if (mkSubTab === "riwayat") statusMatch = item.status === "REJECTED" || item.status === "DIBATALKAN" || item.status === "SELESAI";

        if (!statusMatch) return false;
        if (!q) return true;

        return (
          (item.platform && item.platform.toLowerCase().includes(q)) ||
          (item.judulLive && item.judulLive.toLowerCase().includes(q)) ||
          (item.ref && item.ref.toLowerCase().includes(q)) ||
          (item.namaLengkap && item.namaLengkap.toLowerCase().includes(q))
        );
      });
    }

    // Normal tabs (lembur, izin, shift)
    return items.filter((item) => {
      if (item.type !== mainTab) return false;
      const isPending = item.status === "PENDING";
      const statusMatch = normSubTab === "pending" ? isPending : !isPending;

      if (!statusMatch) return false;
      if (!q) return true;

      return (
        (item.namaLengkap && item.namaLengkap.toLowerCase().includes(q)) ||
        (item.ref && item.ref.toLowerCase().includes(q)) ||
        (item.detail && item.detail.toLowerCase().includes(q)) ||
        (item.alasan && item.alasan.toLowerCase().includes(q))
      );
    });
  }, [items, mainTab, mkSubTab, normSubTab, search]);

  // Bulk selections
  function toggleSelectAll() {
    if (selectedIds.length === currentFilteredList.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(currentFilteredList.map((i) => i.id));
    }
  }

  function toggleSelectOne(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  // Toggle Accordion Details
  function togglePanel(id: string) {
    setExpandedPanels((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  // Handle Cabang/Studio selection in accordion panel
  function handleStudioChange(id: string, field: "cabang" | "studio", val: string) {
    setPendingStudioAssignments((prev) => {
      const current = prev[id] || { cabang: "", studio: "" };
      const updated = { ...current, [field]: val };
      return { ...prev, [id]: updated };
    });

    // Auto-select row if cabang is picked
    if (field === "cabang" && val && !selectedIds.includes(id)) {
      setSelectedIds((prev) => [...prev, id]);
    }
  }

  // Single Action (Approve / Reject)
  async function handleSingleAction(item: ApprovalItem, approve: boolean) {
    const actionName = approve ? "MENYETUJUI" : "MENOLAK";
    if (!confirm(`Yakin ingin ${actionName} pengajuan ini?`)) return;

    try {
      const res = await fetch(
        `/api/approval?id=${item.id}&action=${approve ? "approve" : "reject"}&type=${item.type}`,
        { method: "PATCH" }
      );
      if (res.ok) {
        alert(`✅ Pengajuan berhasil ${approve ? "disetujui" : "ditolak"}!`);
        loadData();
      } else {
        alert("❌ Gagal memproses pengajuan.");
      }
    } catch {
      alert("⚠️ Terjadi kesalahan koneksi.");
    }
  }

  // Bulk Approve Jadwal (Pengajuan tab)
  async function handleBulkApproveJadwal() {
    if (selectedIds.length === 0) {
      alert("⚠️ Pilih minimal 1 jadwal yang akan disetujui.");
      return;
    }

    const payload = selectedIds.map((id) => ({
      id,
      cabangStudio: pendingStudioAssignments[id]?.cabang,
      nomorStudio: pendingStudioAssignments[id]?.studio,
    }));

    try {
      const res = await fetch("/api/approval?action=bulk_approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: payload }),
      });
      if (res.ok) {
        alert(`✅ Berhasil menyetujui ${selectedIds.length} jadwal terpilih!`);
        setSelectedIds([]);
        loadData();
      } else {
        alert("❌ Gagal menyetujui jadwal terpilih.");
      }
    } catch {
      alert("⚠️ Terjadi kesalahan koneksi.");
    }
  }

  // Publish to Marketplace (Approved tab)
  async function handlePublishSelected() {
    if (selectedIds.length === 0) {
      alert("⚠️ Pilih jadwal yang akan diterbitkan ke Marketplace.");
      return;
    }
    try {
      const res = await fetch("/api/approval?action=publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      });
      if (res.ok) {
        alert(`✅ Berhasil menerbitkan ${selectedIds.length} jadwal ke Marketplace!`);
        setSelectedIds([]);
        loadData();
      }
    } catch {
      alert("⚠️ Terjadi kesalahan koneksi.");
    }
  }

  // Send to Cleaning (Online tab)
  async function handleSendToCleaningSelected() {
    if (selectedIds.length === 0) {
      alert("⚠️ Pilih sesi yang akan dikirim ke Cleaning.");
      return;
    }
    try {
      const res = await fetch("/api/approval?action=send_cleaning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      });
      if (res.ok) {
        alert(`✅ Berhasil mengirim ${selectedIds.length} sesi ke Cleaning!`);
        setSelectedIds([]);
        loadData();
      }
    } catch {
      alert("⚠️ Terjadi kesalahan koneksi.");
    }
  }

  // Pull back to Approved (Cleaning tab)
  async function handlePullToApprovedSelected() {
    if (selectedIds.length === 0) {
      alert("⚠️ Pilih jadwal yang akan ditarik ke Approved.");
      return;
    }
    try {
      const res = await fetch("/api/approval?action=pull_approved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      });
      if (res.ok) {
        alert(`✅ Berhasil menarik ${selectedIds.length} jadwal kembali ke status Approved!`);
        setSelectedIds([]);
        loadData();
      }
    } catch {
      alert("⚠️ Terjadi kesalahan koneksi.");
    }
  }

  // Open Edit Modal
  function openEditModal(item: ApprovalItem) {
    setEditingItem(item);
    setEditForm({
      platform: item.platform || "",
      tanggal: item.tanggal || "",
      jamMulai: item.jamMulai || "18:00",
      jamSelesai: item.jamSelesai || "21:00",
      judulLive: item.judulLive || "",
      cabangStudio: item.cabangStudio || "",
      nomorStudio: item.nomorStudio || "",
      promoLive: item.promoLive || "",
      filePendukungHost: item.filePendukungHost || "",
      filePendukungOts: item.filePendukungOts || "",
      produkPrioritas: item.produkPrioritas || "",
    });
  }

  // Submit Edit Modal
  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingItem) return;

    try {
      const res = await fetch("/api/approval?action=update_details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingItem.id,
          data: editForm,
        }),
      });
      if (res.ok) {
        alert("✅ Data pengajuan klien berhasil diperbarui!");
        setEditingItem(null);
        loadData();
      } else {
        alert("❌ Gagal memperbarui data pengajuan.");
      }
    } catch {
      alert("⚠️ Terjadi kesalahan koneksi.");
    }
  }

  // Subtab count badges
  function getSubTabCount(tabKey: MarketplaceSubTab) {
    return items.filter((item) => {
      if (item.type !== "jadwal") return false;
      if (tabKey === "jadwal") return item.status === "PENDING";
      if (tabKey === "approved") return item.status === "APPROVED" && (!item.liveState || item.liveState === "SCHEDULED");
      if (tabKey === "online") return item.liveState === "LIVE";
      if (tabKey === "cleaning") return item.liveState === "REVIEW";
      if (tabKey === "riwayat") return item.status === "REJECTED" || item.status === "DIBATALKAN" || item.status === "SELESAI";
      return false;
    }).length;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-slate-200/80 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-700 to-blue-500 flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-500/20 text-white">
            <i className="fa-regular fa-square-check text-lg" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">Approval Management</h1>
            <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
              Persetujuan pengajuan lembur, cuti, tukar shift, dan Jadwal Klien (Marketplace).
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadData}
          className="p-2.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-xl transition border border-slate-200"
          title="Refresh Data"
        >
          <i className={`fa-solid fa-rotate-right ${loading ? "fa-spin" : ""}`} />
        </button>
      </div>

      {/* ======================================================= */}
      {/* LAYER 1: MAIN TAB BAR                                   */}
      {/* ======================================================= */}
      <div className="flex flex-nowrap overflow-x-auto border-b border-slate-200 gap-6 no-scrollbar">
        <button
          type="button"
          onClick={() => {
            setMainTab("marketplace");
            setSelectedIds([]);
          }}
          className={`py-2.5 px-2 text-sm transition whitespace-nowrap border-b-2 flex items-center gap-2 ${
            mainTab === "marketplace"
              ? "border-blue-600 text-blue-600 font-bold"
              : "border-transparent text-slate-500 font-medium hover:text-slate-800 hover:border-slate-300"
          }`}
        >
          <i className="fa-solid fa-store" />
          <span>Marketplace</span>
          {getSubTabCount("jadwal") > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {getSubTabCount("jadwal")}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setMainTab("lembur");
            setSelectedIds([]);
          }}
          className={`py-2.5 px-2 text-sm transition whitespace-nowrap border-b-2 flex items-center gap-2 ${
            mainTab === "lembur"
              ? "border-blue-600 text-blue-600 font-bold"
              : "border-transparent text-slate-500 font-medium hover:text-slate-800 hover:border-slate-300"
          }`}
        >
          <i className="fa-solid fa-clock" />
          <span>Lembur</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setMainTab("izin");
            setSelectedIds([]);
          }}
          className={`py-2.5 px-2 text-sm transition whitespace-nowrap border-b-2 flex items-center gap-2 ${
            mainTab === "izin"
              ? "border-blue-600 text-blue-600 font-bold"
              : "border-transparent text-slate-500 font-medium hover:text-slate-800 hover:border-slate-300"
          }`}
        >
          <i className="fa-solid fa-calendar-xmark" />
          <span>Cuti / Izin</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setMainTab("shift");
            setSelectedIds([]);
          }}
          className={`py-2.5 px-2 text-sm transition whitespace-nowrap border-b-2 flex items-center gap-2 ${
            mainTab === "shift"
              ? "border-blue-600 text-blue-600 font-bold"
              : "border-transparent text-slate-500 font-medium hover:text-slate-800 hover:border-slate-300"
          }`}
        >
          <i className="fa-solid fa-right-left" />
          <span>Tukar Shift</span>
        </button>
      </div>

      {/* ======================================================= */}
      {/* LAYER 2: SUB TAB BAR                                    */}
      {/* ======================================================= */}
      <div className="flex overflow-x-auto bg-white p-1.5 rounded-2xl border border-slate-200 shadow-2xs gap-1.5 w-fit">
        {mainTab === "marketplace" ? (
          <>
            <button
              type="button"
              onClick={() => { setMkSubTab("jadwal"); setSelectedIds([]); }}
              className={`py-2 px-4 rounded-xl text-xs sm:text-sm transition whitespace-nowrap flex items-center gap-1.5 font-bold ${
                mkSubTab === "jadwal" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <i className="fa-solid fa-inbox" />
              <span>Pengajuan</span>
              {getSubTabCount("jadwal") > 0 && (
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${mkSubTab === "jadwal" ? "bg-white text-blue-700" : "bg-red-500 text-white"}`}>
                  {getSubTabCount("jadwal")}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => { setMkSubTab("approved"); setSelectedIds([]); }}
              className={`py-2 px-4 rounded-xl text-xs sm:text-sm transition whitespace-nowrap flex items-center gap-1.5 font-bold ${
                mkSubTab === "approved" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <i className="fa-solid fa-check-circle" />
              <span>Approved</span>
              {getSubTabCount("approved") > 0 && (
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${mkSubTab === "approved" ? "bg-white text-blue-700" : "bg-emerald-600 text-white"}`}>
                  {getSubTabCount("approved")}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => { setMkSubTab("online"); setSelectedIds([]); }}
              className={`py-2 px-4 rounded-xl text-xs sm:text-sm transition whitespace-nowrap flex items-center gap-1.5 font-bold ${
                mkSubTab === "online" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <i className="fa-solid fa-globe" />
              <span>Online</span>
              {getSubTabCount("online") > 0 && (
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${mkSubTab === "online" ? "bg-white text-blue-700" : "bg-blue-500 text-white"}`}>
                  {getSubTabCount("online")}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => { setMkSubTab("cleaning"); setSelectedIds([]); }}
              className={`py-2 px-4 rounded-xl text-xs sm:text-sm transition whitespace-nowrap flex items-center gap-1.5 font-bold ${
                mkSubTab === "cleaning" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <i className="fa-solid fa-broom" />
              <span>Cleaning</span>
              {getSubTabCount("cleaning") > 0 && (
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${mkSubTab === "cleaning" ? "bg-white text-blue-700" : "bg-amber-500 text-white"}`}>
                  {getSubTabCount("cleaning")}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => { setMkSubTab("riwayat"); setSelectedIds([]); }}
              className={`py-2 px-4 rounded-xl text-xs sm:text-sm transition whitespace-nowrap flex items-center gap-1.5 font-bold ${
                mkSubTab === "riwayat" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <i className="fa-solid fa-clock-rotate-left" />
              <span>Riwayat</span>
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => { setNormSubTab("pending"); setSelectedIds([]); }}
              className={`py-2 px-6 rounded-xl text-xs sm:text-sm transition whitespace-nowrap flex items-center gap-1.5 font-bold ${
                normSubTab === "pending" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <i className="fa-solid fa-clock" />
              <span>Perlu Aksi</span>
            </button>

            <button
              type="button"
              onClick={() => { setNormSubTab("history"); setSelectedIds([]); }}
              className={`py-2 px-6 rounded-xl text-xs sm:text-sm transition whitespace-nowrap flex items-center gap-1.5 font-bold ${
                normSubTab === "history" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <i className="fa-solid fa-clock-rotate-left" />
              <span>Riwayat</span>
            </button>
          </>
        )}
      </div>

      {/* ======================================================= */}
      {/* MAIN TABLE CONTAINER                                    */}
      {/* ======================================================= */}
      <div className="border border-slate-200 rounded-2xl p-5 lg:p-6 shadow-sm bg-white min-h-[420px] space-y-4">
        {/* Table Title & Actions Header */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-center border-b border-slate-100 pb-4 gap-3">
          <h3 className="font-bold text-slate-900 uppercase flex items-center gap-2 tracking-wide text-sm">
            <i className="fa-solid fa-list-check text-blue-600" />
            <span>
              {mainTab === "marketplace"
                ? mkSubTab === "jadwal"
                  ? "DAFTAR PENGAJUAN JADWAL"
                  : mkSubTab === "approved"
                  ? "DAFTAR JADWAL APPROVED"
                  : mkSubTab === "online"
                  ? "DAFTAR JADWAL MARKETPLACE"
                  : mkSubTab === "cleaning"
                  ? "DAFTAR JADWAL CLEANING"
                  : "RIWAYAT PENGAJUAN JADWAL"
                : `MODUL ${mainTab.toUpperCase()}: ${normSubTab === "pending" ? "PERLU AKSI" : "RIWAYAT"}`}
            </span>
          </h3>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400 text-xs" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari Platform / Judul / Nama..."
                className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none shadow-2xs"
              />
            </div>

            {/* Bulk Action Buttons */}
            {isAdmin && mainTab === "marketplace" && (
              <>
                {mkSubTab === "jadwal" && (
                  <button
                    type="button"
                    onClick={handleBulkApproveJadwal}
                    disabled={selectedIds.length === 0}
                    className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-4 rounded-xl shadow-sm transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <i className="fa-solid fa-check-double" />
                    <span>Approve Terpilih ({selectedIds.length})</span>
                  </button>
                )}

                {mkSubTab === "approved" && (
                  <button
                    type="button"
                    onClick={handlePublishSelected}
                    disabled={selectedIds.length === 0}
                    className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 px-4 rounded-xl shadow-sm transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <i className="fa-solid fa-satellite-dish" />
                    <span>Terbitkan ke Marketplace ({selectedIds.length})</span>
                  </button>
                )}

                {mkSubTab === "online" && (
                  <button
                    type="button"
                    onClick={handleSendToCleaningSelected}
                    disabled={selectedIds.length === 0}
                    className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2 px-4 rounded-xl shadow-sm transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <i className="fa-solid fa-broom" />
                    <span>Kirim ke Cleaning ({selectedIds.length})</span>
                  </button>
                )}

                {mkSubTab === "cleaning" && (
                  <button
                    type="button"
                    onClick={handlePullToApprovedSelected}
                    disabled={selectedIds.length === 0}
                    className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs py-2 px-4 rounded-xl shadow-sm transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <i className="fa-solid fa-rotate-left" />
                    <span>Tarik ke Approved ({selectedIds.length})</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-2xs">
          <table className="w-full text-xs text-left border-collapse min-w-[750px]">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                {mainTab === "marketplace" && mkSubTab !== "riwayat" && (
                  <th className="px-4 py-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.length > 0 && selectedIds.length === currentFilteredList.length}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                    />
                  </th>
                )}
                <th className="px-4 py-3 font-medium">ID Target</th>
                <th className="px-4 py-3 font-medium">
                  {mainTab === "marketplace" ? "Pengajuan Client" : "Pemohon / Info"}
                </th>
                <th className="px-4 py-3 font-medium">Tanggal / Waktu</th>
                <th className="px-4 py-3 font-medium">
                  {mainTab === "marketplace" ? (mkSubTab === "riwayat" ? "Streamer" : "Detail Sesi") : "Keterangan"}
                </th>
                <th className="px-4 py-3 font-medium text-center">Aksi / Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                    <i className="fa-solid fa-circle-notch fa-spin text-2xl text-blue-500 mb-2 block" />
                    Memuat data approval...
                  </td>
                </tr>
              ) : currentFilteredList.length > 0 ? (
                currentFilteredList.map((item) => {
                  const isChecked = selectedIds.includes(item.id);
                  const isPanelOpen = Boolean(expandedPanels[item.id]);

                  return (
                    <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                      {mainTab === "marketplace" && mkSubTab !== "riwayat" && (
                        <td className="px-4 py-3.5 text-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelectOne(item.id)}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                          />
                        </td>
                      )}

                      <td className="px-4 py-3.5 font-mono font-bold text-slate-800 align-top">
                        {item.ref || item.idJadwal || item.id}
                      </td>

                      <td className="px-4 py-3.5 align-top">
                        <div className="font-bold text-slate-900 text-xs">{item.platform || item.namaLengkap}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5 truncate max-w-xs" title={item.judulLive || item.detail}>
                          {item.judulLive || item.detail}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 align-top">
                        <div className="font-semibold text-slate-800 flex items-center gap-1">
                          <i className="fa-regular fa-calendar text-slate-400" />
                          <span>{item.tanggal}</span>
                        </div>
                        {item.jamMulai && item.jamSelesai && (
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center gap-1">
                            <i className="fa-regular fa-clock text-slate-400" />
                            <span>{item.jamMulai} - {item.jamSelesai}</span>
                            {item.durasi && <span className="text-blue-600 font-bold">({item.durasi})</span>}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3.5 align-top">
                        {mainTab === "marketplace" ? (
                          mkSubTab === "riwayat" ? (
                            <span className="font-semibold text-slate-800">{item.namaLengkap}</span>
                          ) : (
                            <div className="space-y-1">
                              {item.cabangStudio && (
                                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-bold block w-fit">
                                  {item.cabangStudio} {item.nomorStudio ? `- ${item.nomorStudio}` : ""}
                                </span>
                              )}
                              <span className="text-[11px] text-slate-500 font-medium">{item.detail}</span>
                            </div>
                          )
                        ) : (
                          <div className="max-w-xs text-slate-600">{item.alasan || item.detail || "–"}</div>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-center align-top">
                        {mainTab === "marketplace" ? (
                          mkSubTab === "jadwal" ? (
                            <div className="flex flex-col gap-1.5 items-center">
                              <button
                                type="button"
                                onClick={() => togglePanel(item.id)}
                                className="w-full px-3 py-1.5 text-xs font-bold border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-600 hover:text-white rounded-lg transition shadow-2xs"
                              >
                                <i className="fa-solid fa-gears mr-1" />
                                <span>{isPanelOpen ? "Tutup Panel" : "Tinjau & Lengkapi"}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditModal(item)}
                                className="w-full px-3 py-1 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-[11px] font-bold transition shadow-2xs"
                              >
                                <i className="fa-solid fa-pen mr-1" />
                                <span>Rubah Data</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSingleAction(item, false)}
                                className="w-full px-3 py-1 text-[11px] font-bold border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition shadow-2xs"
                              >
                                <i className="fa-solid fa-ban mr-1" />
                                <span>Tolak Pengajuan</span>
                              </button>
                            </div>
                          ) : mkSubTab === "approved" || mkSubTab === "online" || mkSubTab === "cleaning" ? (
                            <div className="flex flex-col items-center gap-1 text-[11px]">
                              <span className="px-2 py-1 font-bold rounded bg-emerald-50 text-emerald-800 w-full text-center border border-emerald-200">
                                {item.cabangStudio || "Cabang –"}
                              </span>
                              <span className="text-slate-500 font-medium">{item.nomorStudio || "Bebas"}</span>
                              <button
                                type="button"
                                onClick={() => togglePanel(item.id)}
                                className="mt-1 text-blue-600 font-bold hover:underline bg-blue-50 px-3 py-1 rounded-lg w-full border border-blue-100"
                              >
                                <i className="fa-solid fa-eye mr-1" />
                                <span>Rangkuman</span>
                              </button>
                            </div>
                          ) : (
                            <div className="text-center">
                              <span className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border block mb-1 ${
                                item.status === "APPROVED" || item.status === "SELESAI"
                                  ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                                  : "bg-red-100 text-red-700 border-red-200"
                              }`}>
                                {item.status}
                              </span>
                              <button
                                type="button"
                                onClick={() => togglePanel(item.id)}
                                className="text-[10px] font-bold text-blue-600 hover:underline"
                              >
                                <i className="fa-solid fa-eye mr-1" />
                                <span>Rangkuman</span>
                              </button>
                            </div>
                          )
                        ) : normSubTab === "pending" ? (
                          <div className="flex gap-1.5 justify-center">
                            <button
                              type="button"
                              onClick={() => handleSingleAction(item, true)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] px-2.5 py-1 rounded-lg transition active:scale-95"
                            >
                              Setujui
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSingleAction(item, false)}
                              className="bg-red-600 hover:bg-red-700 text-white font-bold text-[11px] px-2.5 py-1 rounded-lg transition active:scale-95"
                            >
                              Tolak
                            </button>
                          </div>
                        ) : (
                          <span className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border ${
                            item.status === "APPROVED"
                              ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                              : "bg-red-100 text-red-700 border-red-200"
                          }`}>
                            {item.status}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400 italic">
                    <i className="fa-solid fa-inbox text-3xl mb-2 block text-slate-300" />
                    Tidak ada data persetujuan pada modul dan subtab ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Accordion Panels Rendered for active items */}
        {currentFilteredList.map((item) => {
          if (!expandedPanels[item.id]) return null;

          return (
            <div key={`panel_${item.id}`} className="bg-slate-50/90 border border-blue-200 rounded-2xl p-5 space-y-4 shadow-sm animate-fade-in">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md">
                    {item.ref || item.idJadwal}
                  </span>
                  <span className="font-bold text-slate-800 text-xs">{item.platform} — {item.judulLive}</span>
                </div>
                <button
                  type="button"
                  onClick={() => togglePanel(item.id)}
                  className="text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  ✕ Tutup Rincian
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-700 block mb-1">Dokumen Brief & File:</span>
                  <div className="space-y-1">
                    {item.filePendukungHost ? (
                      <a href={item.filePendukungHost} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center gap-1 font-semibold">
                        <i className="fa-solid fa-link" /> Brief Host
                      </a>
                    ) : <span className="text-slate-400 block">Brief Host: –</span>}
                    {item.filePendukungOts ? (
                      <a href={item.filePendukungOts} target="_blank" rel="noreferrer" className="text-emerald-600 hover:underline flex items-center gap-1 font-semibold">
                        <i className="fa-solid fa-link" /> Brief OTS
                      </a>
                    ) : <span className="text-slate-400 block">Brief OTS: –</span>}
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-700 block mb-1">Produk & Promo Live:</span>
                  <p className="text-slate-600 leading-relaxed">{item.produkPrioritas || "Produk: –"}</p>
                  {item.promoLive && <p className="text-blue-600 font-semibold mt-1">Promo: {item.promoLive}</p>}
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-700 block mb-1">Penetapan Lokasi Studio:</span>
                  {mkSubTab === "jadwal" ? (
                    <div className="space-y-2">
                      <select
                        value={pendingStudioAssignments[item.id]?.cabang || item.cabangStudio || ""}
                        onChange={(e) => handleStudioChange(item.id, "cabang", e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                      >
                        <option value="" disabled>-- Pilih Cabang (Wajib) --</option>
                        <option value="Timoho">Timoho</option>
                        <option value="Berbah">Berbah</option>
                        <option value="Wiyoro">Wiyoro</option>
                      </select>
                      <select
                        value={pendingStudioAssignments[item.id]?.studio || item.nomorStudio || ""}
                        onChange={(e) => handleStudioChange(item.id, "studio", e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                      >
                        <option value="">Belum Ditentukan / Bebas</option>
                        <option value="Studio 1">Studio 1</option>
                        <option value="Studio 2">Studio 2</option>
                        <option value="Studio 3">Studio 3</option>
                        <option value="Studio 4">Studio 4</option>
                        <option value="Studio 5">Studio 5</option>
                      </select>
                    </div>
                  ) : (
                    <p className="text-slate-700 font-bold">{item.cabangStudio || "–"} ({item.nomorStudio || "Bebas"})</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ======================================================= */}
      {/* MODAL: EDIT DATA PENGAJUAN KLIEN                        */}
      {/* ======================================================= */}
      {editingItem && (
        <div className="fixed inset-0 bg-slate-900/70 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/80 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <i className="fa-solid fa-pen-to-square text-blue-600" />
                <span>Rubah Data Pengajuan Klien ({editingItem.ref})</span>
              </h3>
              <button type="button" onClick={() => setEditingItem(null)} className="text-slate-400 hover:text-slate-600 text-base">✕</button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Platform</label>
                  <input
                    type="text"
                    value={editForm.platform}
                    onChange={(e) => setEditForm({ ...editForm, platform: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tanggal</label>
                  <input
                    type="date"
                    value={editForm.tanggal}
                    onChange={(e) => setEditForm({ ...editForm, tanggal: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Jam Mulai</label>
                  <input
                    type="time"
                    value={editForm.jamMulai}
                    onChange={(e) => setEditForm({ ...editForm, jamMulai: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Jam Selesai</label>
                  <input
                    type="time"
                    value={editForm.jamSelesai}
                    onChange={(e) => setEditForm({ ...editForm, jamSelesai: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Judul Live / Campaign</label>
                  <input
                    type="text"
                    value={editForm.judulLive}
                    onChange={(e) => setEditForm({ ...editForm, judulLive: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Cabang Studio</label>
                  <select
                    value={editForm.cabangStudio}
                    onChange={(e) => setEditForm({ ...editForm, cabangStudio: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Pilih Cabang --</option>
                    <option value="Timoho">Timoho</option>
                    <option value="Berbah">Berbah</option>
                    <option value="Wiyoro">Wiyoro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nomor Studio</label>
                  <select
                    value={editForm.nomorStudio}
                    onChange={(e) => setEditForm({ ...editForm, nomorStudio: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Belum Ditentukan / Bebas</option>
                    <option value="Studio 1">Studio 1</option>
                    <option value="Studio 2">Studio 2</option>
                    <option value="Studio 3">Studio 3</option>
                    <option value="Studio 4">Studio 4</option>
                    <option value="Studio 5">Studio 5</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Promo Live / Diskon</label>
                  <textarea
                    rows={2}
                    value={editForm.promoLive}
                    onChange={(e) => setEditForm({ ...editForm, promoLive: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Zoom Foto */}
      {previewModalImg && (
        <div className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/80 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <i className="fa-solid fa-file-image text-blue-500" />
                <span>Bukti Lampiran</span>
              </h3>
              <button type="button" onClick={() => setPreviewModalImg(null)} className="text-slate-400 hover:text-slate-600 text-base">✕</button>
            </div>
            <div className="p-6 text-center bg-slate-900/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewModalImg.startsWith("http") || previewModalImg.startsWith("data:") ? previewModalImg : `https://drive.google.com/open?id=${previewModalImg}`}
                alt="Lampiran"
                className="max-h-80 mx-auto rounded-xl object-contain border border-slate-200 shadow-md bg-white"
              />
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewModalImg(null)}
                className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 px-6 rounded-xl text-xs transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
