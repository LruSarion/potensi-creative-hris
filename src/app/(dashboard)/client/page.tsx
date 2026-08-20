"use client";

import { useEffect, useState } from "react";

export default function ClientPage() {
  const [list, setList] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"clients" | "products">("clients");
  const [selectedClientId, setSelectedClientId] = useState<string>("");

  const [form, setForm] = useState({
    namaClient: "",
    platform: "Shopee Live",
    pic: "",
    kontak: "",
  });

  const [prodForm, setProdForm] = useState({
    namaProduk: "",
    sku: "",
    harga: "",
    uspText: "",
    status: "ONLINE",
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadClients();
    loadProducts();
  }, []);

  async function loadClients() {
    try {
      const res = await fetch("/api/clients");
      const d = await res.json();
      if (d.status === "success") {
        setList(d.data);
        if (d.data.length > 0 && !selectedClientId) setSelectedClientId(d.data[0].id);
      }
    } catch {
      // ignore
    }
  }

  async function loadProducts(cId?: string) {
    try {
      const q = cId ? `?clientId=${cId}` : "";
      const res = await fetch(`/api/produk${q}`);
      const d = await res.json();
      if (d.status === "success") setProducts(d.data);
    } catch {
      // ignore
    }
  }

  async function submitClient(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (d.status === "success") {
        setSuccess(`Brand Partner "${form.namaClient}" berhasil ditambahkan!`);
        setForm({ namaClient: "", platform: "Shopee Live", pic: "", kontak: "" });
        loadClients();
      } else {
        setError(d.message ?? "Gagal menyimpan data client");
      }
    } catch {
      setError("Terjadi kesalahan koneksi");
    } finally {
      setLoading(false);
    }
  }

  async function submitProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedClientId) {
      setError("Pilih brand client pemilik produk terlebih dahulu");
      return;
    }
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await fetch("/api/produk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...prodForm,
          clientId: selectedClientId,
          harga: Number(prodForm.harga) || 0,
        }),
      });
      const d = await res.json();
      if (d.status === "success") {
        setSuccess(`Produk "${prodForm.namaProduk}" berhasil didaftarkan ke katalog live!`);
        setProdForm({ namaProduk: "", sku: "", harga: "", uspText: "", status: "ONLINE" });
        loadProducts(selectedClientId);
      } else {
        setError(d.message ?? "Gagal menyimpan produk");
      }
    } catch {
      setError("Koneksi gagal");
    } finally {
      setLoading(false);
    }
  }

  const rupiah = (v: any) => `Rp ${Number(v ?? 0).toLocaleString("id-ID")}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Klien Brand & Katalog Produk Live</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manajemen brand partner agency, PIC penanggung jawab, dan katalog SKU produk untuk siaran live streaming.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
          <button
            onClick={() => setActiveTab("clients")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === "clients" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Brand Partners ({list.length})
          </button>
          <button
            onClick={() => setActiveTab("products")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === "products" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Katalog SKU ({products.length})
          </button>
        </div>
      </div>

      {/* Alerts */}
      {success && (
        <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-2">
          <i className="fa-solid fa-circle-check text-emerald-600 text-sm" />
          <span>{success}</span>
        </div>
      )}
      {error && (
        <div className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-2">
          <i className="fa-solid fa-circle-exclamation text-red-600 text-sm" />
          <span>{error}</span>
        </div>
      )}

      {activeTab === "clients" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* New Client Form (5 cols) */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
              <i className="fa-solid fa-plus text-blue-600" />
              <span>Tambah Brand Klien Baru</span>
            </h3>

            <form onSubmit={submitClient} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nama Brand / Perusahaan
                </label>
                <input
                  type="text"
                  value={form.namaClient}
                  onChange={(e) => setForm({ ...form, namaClient: e.target.value })}
                  placeholder="mis. Somethinc Official Store"
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Marketplace Utama
                </label>
                <select
                  value={form.platform}
                  onChange={(e) => setForm({ ...form, platform: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                >
                  <option value="Shopee Live">Shopee Live</option>
                  <option value="TikTok Shop">TikTok Shop</option>
                  <option value="Tokopedia Live">Tokopedia Live</option>
                  <option value="Lazada Live">Lazada Live</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nama PIC
                </label>
                <input
                  type="text"
                  value={form.pic}
                  onChange={(e) => setForm({ ...form, pic: e.target.value })}
                  placeholder="mis. Ibu Jessica"
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Kontak / WhatsApp
                </label>
                <input
                  type="text"
                  value={form.kontak}
                  onChange={(e) => setForm({ ...form, kontak: e.target.value })}
                  placeholder="mis. 081234567890"
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition shadow-md shadow-blue-600/20 disabled:opacity-50"
                >
                  {loading ? "Menyimpan..." : "Simpan Brand Klien"}
                </button>
              </div>
            </form>
          </div>

          {/* Client Directory (7 cols) */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 sm:px-6 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm">Daftar Klien Terdaftar ({list.length})</h3>
              <span className="text-xs text-slate-500 font-medium">Active Accounts</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Nama Brand</th>
                    <th className="px-4 py-3">Marketplace</th>
                    <th className="px-4 py-3">PIC</th>
                    <th className="px-4 py-3">Kontak</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {list.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-4 py-3.5 font-bold text-slate-800">{c.namaClient}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          {c.platform ?? "Shopee"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{c.pic ?? "-"}</td>
                      <td className="px-4 py-3 font-mono text-slate-600">{c.kontak ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Products Catalog Tab */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* New Product Form (5 cols) */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
              <i className="fa-solid fa-box-open text-blue-600" />
              <span>Tambah SKU Produk Siaran</span>
            </h3>

            <form onSubmit={submitProduct} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Brand Pemilik Produk
                </label>
                <select
                  value={selectedClientId}
                  onChange={(e) => {
                    setSelectedClientId(e.target.value);
                    loadProducts(e.target.value);
                  }}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {list.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.namaClient} ({c.platform ?? "General"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nama Produk
                </label>
                <input
                  type="text"
                  value={prodForm.namaProduk}
                  onChange={(e) => setProdForm({ ...prodForm, namaProduk: e.target.value })}
                  placeholder="mis. Niacinamide 10% Barrier Serum 20ml"
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Kode SKU
                  </label>
                  <input
                    type="text"
                    value={prodForm.sku}
                    onChange={(e) => setProdForm({ ...prodForm, sku: e.target.value })}
                    placeholder="SKU-SERUM-01"
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Harga Live (Rp)
                  </label>
                  <input
                    type="number"
                    value={prodForm.harga}
                    onChange={(e) => setProdForm({ ...prodForm, harga: e.target.value })}
                    placeholder="129000"
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  USP & Pitching Notes Streamer
                </label>
                <textarea
                  rows={3}
                  value={prodForm.uspText}
                  onChange={(e) => setProdForm({ ...prodForm, uspText: e.target.value })}
                  placeholder="mis. Menyamarkan noda hitam dalam 14 hari, tekstur ringan cepat menyerap, promo Buy 1 Get 1 di keranjang kuning."
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition shadow-md shadow-blue-600/20 disabled:opacity-50"
                >
                  {loading ? "Menyimpan..." : "Simpan Produk SKU"}
                </button>
              </div>
            </form>
          </div>

          {/* Product Directory (7 cols) */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 sm:px-6 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm">Katalog Produk Terdaftar ({products.length})</h3>
              <span className="text-xs text-slate-500">Live Showcase SKUs</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Nama Produk & SKU</th>
                    <th className="px-4 py-3">Harga Live</th>
                    <th className="px-4 py-3">USP Brief</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-800">{p.namaProduk}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{p.sku}</div>
                      </td>
                      <td className="px-4 py-3 font-bold text-emerald-600">{rupiah(p.harga)}</td>
                      <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{p.uspText ?? "-"}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {p.status ?? "ONLINE"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {products.length === 0 && (
                <div className="p-8 text-center text-slate-400 text-xs">
                  Belum ada produk terdaftar untuk brand ini.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
