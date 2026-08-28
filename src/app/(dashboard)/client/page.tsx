"use client";

import { useEffect, useState } from "react";
import { useAlert } from "@/components/ui/custom-alert";

interface ClientData {
  id: string;
  namaClient: string;
  platform?: string | null;
  pic?: string | null;
  kontak?: string | null;
  ketentuan?: {
    platform?: string;
    kategori?: string;
    marketplace1?: string;
    marketplace2?: string;
    marketplace3?: string;
    alamat?: string;
    catatan?: string;
    namaPerusahaan?: string;
    namaMerk?: string;
  }[];
  produk?: ProdukItem[];
}

interface ProdukItem {
  id?: string;
  no?: number;
  idProduk?: string;
  sku?: string;
  sellerSku?: string;
  brand?: string;
  namaProduk: string;
  varian?: string[];
  link?: string;
  catatan?: string;
  kategori?: string;
  harga?: number;
}

interface FormClientItem {
  id: number;
  namaPerusahaan: string;
  namaMerk: string;
  penanggungJawab: string;
  kategori: string;
  manualKategori: string;
  nomorTeleponSuffix: string;
  email: string;
  alamat: string;
  marketplace1: string;
  manualMp1: string;
  marketplace2: string;
  manualMp2: string;
  marketplace3: string;
  manualMp3: string;
  catatan: string;
  isExpanded: boolean;
}

interface FormProdukItem {
  id: number;
  idProduk: string;
  sellerSku: string;
  brand: string;
  namaProduk: string;
  varianList: string[];
  varianInput: string;
  linkProduk: string;
  catatan: string;
  isExpanded: boolean;
}

interface EditColumnRow {
  field: string;
  value: string;
}

function createDefaultClientForm(id: number, isExpanded = true): FormClientItem {
  return {
    id,
    namaPerusahaan: "",
    namaMerk: "",
    penanggungJawab: "",
    kategori: "",
    manualKategori: "",
    nomorTeleponSuffix: "",
    email: "",
    alamat: "",
    marketplace1: "",
    manualMp1: "",
    marketplace2: "",
    manualMp2: "",
    marketplace3: "",
    manualMp3: "",
    catatan: "",
    isExpanded,
  };
}

function createDefaultProdukForm(id: number, isExpanded = true): FormProdukItem {
  return {
    id,
    idProduk: "",
    sellerSku: "",
    brand: "",
    namaProduk: "",
    varianList: [],
    varianInput: "",
    linkProduk: "",
    catatan: "",
    isExpanded,
  };
}

export default function ClientPage() {
  const [activeTab, setActiveTab] = useState<"daftar" | "input" | "edit" | "produk">("daftar");

  // Client Data list
  const [clients, setClients] = useState<ClientData[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [searchDaftar, setSearchDaftar] = useState("");

  // Tab 2: Registrasi Client State
  const [clientForms, setClientForms] = useState<FormClientItem[]>([createDefaultClientForm(1, true)]);
  const [submittingClients, setSubmittingClients] = useState(false);

  // Tab 3: Rubah Data Client State
  const [searchEditId, setSearchEditId] = useState("");
  const [selectedEditClientId, setSelectedEditClientId] = useState("");
  const { showAlert } = useAlert();
  const [selectedEditClient, setSelectedEditClient] = useState<ClientData | null>(null);
  const [editClientForm, setEditClientForm] = useState<FormClientItem>(createDefaultClientForm(1, true));
  const [savingEditClient, setSavingEditClient] = useState(false);

  // Tab 4: Manajemen Produk State
  const [subTabProduk, setSubTabProduk] = useState<"list" | "input" | "edit">("list");
  const [selectedPlatformClientId, setSelectedPlatformClientId] = useState("");
  const [searchKatalog, setSearchKatalog] = useState("");
  const [produkList, setProdukList] = useState<ProdukItem[]>([]);
  const [loadingProduk, setLoadingProduk] = useState(false);

  // Subtab 4.2: Input Produk State
  const [produkForms, setProdukForms] = useState<FormProdukItem[]>([createDefaultProdukForm(1, true)]);
  const [submittingProduk, setSubmittingProduk] = useState(false);

  // Subtab 4.3: Edit Produk State
  const [searchEditProduk, setSearchEditProduk] = useState("");
  const [selectedEditProduk, setSelectedEditProduk] = useState<ProdukItem | null>(null);
  const [editProdukRows, setEditProdukRows] = useState<EditColumnRow[]>([{ field: "", value: "" }]);
  const [savingEditProduk, setSavingEditProduk] = useState(false);

  useEffect(() => {
    loadClients();
  }, []);

  async function loadClients() {
    setLoadingClients(true);
    try {
      const res = await fetch("/api/clients");
      const d = await res.json();
      if (d.status === "success" && Array.isArray(d.data)) {
        setClients(d.data);
      } else if (Array.isArray(d)) {
        setClients(d);
      }
    } catch {
      // ignore
    } finally {
      setLoadingClients(false);
    }
  }

  // Load products when client platform is selected
  async function handleSelectPlatform(clientId: string) {
    setSelectedPlatformClientId(clientId);
    setSelectedEditProduk(null);
    setSearchEditProduk("");
    if (!clientId) {
      setProdukList([]);
      return;
    }

    setLoadingProduk(true);
    try {
      const res = await fetch(`/api/produk?clientId=${clientId}`);
      const d = await res.json();
      if (d.status === "success" && Array.isArray(d.data)) {
        setProdukList(d.data);
      } else if (Array.isArray(d)) {
        setProdukList(d);
      } else {
        // Fallback dummy catalog for demo purposes
        setProdukList([
          {
            id: "1",
            no: 1,
            idProduk: "PRD-001",
            sku: "SKU-BEAUTY-01",
            brand: "Glow Skin",
            namaProduk: "Brightening Facial Serum 30ml",
            varian: ["Standard 30ml", "Travel 15ml"],
            link: "https://shopee.co.id",
            catatan: "Best Seller",
          },
          {
            id: "2",
            no: 2,
            idProduk: "PRD-002",
            sku: "SKU-BEAUTY-02",
            brand: "Glow Skin",
            namaProduk: "Hydrating Moisturizer Gel 50g",
            varian: ["Normal", "Dry Skin"],
            link: "https://tiktok.com",
            catatan: "Promo Bundling",
          },
        ]);
      }
    } catch {
      setProdukList([]);
    } finally {
      setLoadingProduk(false);
    }
  }

  // Multi-Form Handlers for Client Registration
  function handleAddClientForm() {
    if (clientForms.length >= 5) {
      showAlert("⚠️ Maksimal 5 data client dalam satu kali proses pendaftaran.");
      return;
    }
    const updated = clientForms.map((f) => ({ ...f, isExpanded: false }));
    const newId = clientForms.length > 0 ? Math.max(...clientForms.map((f) => f.id)) + 1 : 1;
    setClientForms([...updated, createDefaultClientForm(newId, true)]);
  }

  function handleRemoveClientForm(id: number) {
    if (clientForms.length <= 1) {
      showAlert("⚠️ Minimal harus ada 1 formulir registrasi.");
      return;
    }
    setClientForms(clientForms.filter((f) => f.id !== id));
  }

  function toggleClientAccordion(id: number) {
    setClientForms(clientForms.map((f) => (f.id === id ? { ...f, isExpanded: !f.isExpanded } : f)));
  }

  async function handleSubmitClients(e: React.FormEvent) {
    e.preventDefault();
    for (const f of clientForms) {
      if (!f.namaMerk.trim()) {
        showAlert(`⚠️ Mohon isi Nama Merk pada Formulir #${f.id}`);
        return;
      }
      if (!f.nomorTeleponSuffix.trim()) {
        showAlert(`⚠️ Mohon isi Nomor WhatsApp pada Formulir #${f.id}`);
        return;
      }
    }

    setSubmittingClients(true);
    try {
      for (const f of clientForms) {
        const payload = {
          namaClient: f.namaMerk,
          platform: f.marketplace1 === "Lainnya" ? f.manualMp1 : f.marketplace1 || "Shopee",
          pic: f.penanggungJawab || "-",
          kontak: `62${f.nomorTeleponSuffix.replace(/^0+/, "")}`,
        };

        await fetch("/api/clients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      showAlert(`✅ Berhasil menyimpan ${clientForms.length} data client baru ke sistem!`);
      setClientForms([createDefaultClientForm(1, true)]);
      loadClients();
      setActiveTab("daftar");
    } catch {
      showAlert("⚠️ Terjadi kesalahan koneksi saat menyimpan data client.");
    } finally {
      setSubmittingClients(false);
    }
  }

  // Edit Client Handlers
  function handleSelectEditClient(customClient?: ClientData) {
    let target: ClientData | null = customClient || null;

    if (!target && searchEditId.trim()) {
      const raw = searchEditId.trim();
      const q = raw.toLowerCase();

      // 1. Direct ID match
      target = clients.find((c) => c.id === raw || c.id.toLowerCase() === q) || null;

      // 2. Tokenized search
      if (!target) {
        const parts = q.split("|").map((p) => p.trim()).filter(Boolean);
        const brandPart = (parts[0] || q).toLowerCase();
        const picPart = (parts[1] || "").toLowerCase();
        const kontakPart = (parts[2] || "").toLowerCase();

        // Pass A: Exact match on brand name
        target =
          clients.find(
            (c) => (c.namaClient || "").toLowerCase() === brandPart || (c.namaClient || "").toLowerCase() === q
          ) || null;

        // Pass B: Substring containment on brand name
        if (!target) {
          target =
            clients.find((c) => {
              const cName = (c.namaClient || "").toLowerCase();
              return cName.includes(brandPart) || brandPart.includes(cName);
            }) || null;
        }

        // Pass C: Specific PIC or Contact match
        if (!target && (picPart || kontakPart)) {
          target =
            clients.find((c) => {
              const cPic = (c.pic || "").toLowerCase();
              const cKontak = (c.kontak || "").replace(/\D/g, "");
              const kClean = kontakPart.replace(/\D/g, "");
              return (picPart && cPic && (cPic.includes(picPart) || picPart.includes(cPic))) ||
                     (kClean && cKontak && (cKontak.includes(kClean) || kClean.includes(cKontak)));
            }) || null;
        }

        // Pass D: General query containment
        if (!target) {
          target =
            clients.find((c) => {
              const cName = (c.namaClient || "").toLowerCase();
              const cPic = (c.pic || "").toLowerCase();
              return (cName && q.includes(cName)) || (cPic && q.includes(cPic));
            }) || null;
        }
      }
    }

    if (target) {
      setSelectedEditClient(target);
      setSelectedEditClientId(target.id);
      setSearchEditId(`${target.namaClient} ${target.platform ? `(${target.platform})` : ""} | ${target.pic || "PIC -"} | ${target.kontak || "No WA -"}`);
      
      const k0 = target.ketentuan?.[0];
      const kontakSuffix = (target.kontak || "").replace(/^62/, "").replace(/^0+/, "");
      setEditClientForm({
        id: 1,
        namaPerusahaan: k0?.namaPerusahaan || target.namaClient,
        namaMerk: target.namaClient,
        penanggungJawab: target.pic || "",
        kategori: k0?.kategori || "Beauty",
        manualKategori: "",
        nomorTeleponSuffix: kontakSuffix,
        email: k0?.alamat?.includes("@") ? k0.alamat : "",
        alamat: k0?.alamat || "",
        marketplace1: target.platform || "Shopee",
        manualMp1: "",
        marketplace2: k0?.marketplace2 || "",
        manualMp2: "",
        marketplace3: k0?.marketplace3 || "",
        manualMp3: "",
        catatan: k0?.catatan || "",
        isExpanded: true,
      });
    } else {
      showAlert("⚠️ Data client tidak ditemukan. Pastikan memilih dari daftar saran.");
    }
  }

  async function handleSaveEditClient(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEditClient) return;

    if (!editClientForm.namaMerk.trim()) {
      showAlert("⚠️ Mohon isi Nama Merk / Brand client.");
      return;
    }

    setSavingEditClient(true);
    try {
      const payload = {
        namaClient: editClientForm.namaMerk.trim(),
        platform: editClientForm.marketplace1 === "Lainnya" ? editClientForm.manualMp1 : editClientForm.marketplace1 || "Shopee",
        pic: editClientForm.penanggungJawab.trim() || "-",
        kontak: editClientForm.nomorTeleponSuffix
          ? `62${editClientForm.nomorTeleponSuffix.replace(/^62/, "").replace(/^0+/, "")}`
          : selectedEditClient.kontak || "-",
      };

      const res = await fetch(`/api/clients?id=${selectedEditClient.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const d = await res.json();
      if (res.ok && (d.status === "success" || d.data || d.id)) {
        showAlert("✅ Perubahan data client berhasil disimpan!");
        await loadClients();
        const updated = {
          ...selectedEditClient,
          ...payload,
        };
        setSelectedEditClient(updated);
      } else {
        showAlert(`❌ Gagal menyimpan: ${d.message || "Terjadi kesalahan."}`);
      }
    } catch {
      showAlert("⚠️ Terjadi kesalahan koneksi saat menyimpan perubahan.");
    } finally {
      setSavingEditClient(false);
    }
  }

  // Multi-Form Handlers for Products
  function handleAddProdukForm() {
    if (produkForms.length >= 10) {
      showAlert("⚠️ Maksimal 10 produk dalam satu kali penginputan.");
      return;
    }
    const updated = produkForms.map((f) => ({ ...f, isExpanded: false }));
    const newId = produkForms.length > 0 ? Math.max(...produkForms.map((f) => f.id)) + 1 : 1;
    setProdukForms([...updated, createDefaultProdukForm(newId, true)]);
  }

  function handleRemoveProdukForm(id: number) {
    if (produkForms.length <= 1) return;
    setProdukForms(produkForms.filter((f) => f.id !== id));
  }

  function handleAddVarianTag(formId: number) {
    setProdukForms(
      produkForms.map((f) => {
        if (f.id === formId && f.varianInput.trim()) {
          return {
            ...f,
            varianList: [...f.varianList, f.varianInput.trim()],
            varianInput: "",
          };
        }
        return f;
      })
    );
  }

  function handleRemoveVarianTag(formId: number, tagIndex: number) {
    setProdukForms(
      produkForms.map((f) => {
        if (f.id === formId) {
          return {
            ...f,
            varianList: f.varianList.filter((_, idx) => idx !== tagIndex),
          };
        }
        return f;
      })
    );
  }

  async function handleSubmitProdukMaster(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPlatformClientId) {
      showAlert("⚠️ Pilih Platform Klien di bagian atas terlebih dahulu.");
      return;
    }

    setSubmittingProduk(true);
    try {
      for (const p of produkForms) {
        if (!p.namaProduk.trim()) continue;
        await fetch("/api/produk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId: selectedPlatformClientId,
            namaProduk: p.namaProduk,
            kategori: p.brand || "General",
          }),
        }).catch(() => {});
      }

      showAlert(`✅ Berhasil menyimpan ${produkForms.length} produk baru!`);
      setProdukForms([createDefaultProdukForm(1, true)]);
      handleSelectPlatform(selectedPlatformClientId);
      setSubTabProduk("list");
    } catch {
      showAlert("⚠️ Terjadi kesalahan saat menyimpan produk.");
    } finally {
      setSubmittingProduk(false);
    }
  }

  // Autocomplete UI dropdown states
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [showProdukDropdown, setShowProdukDropdown] = useState(false);

  // Edit Product Handlers
  function handleSelectEditProduk(customProduk?: ProdukItem) {
    const target = customProduk || (() => {
      if (!searchEditProduk.trim()) return null;
      const q = searchEditProduk.toLowerCase().trim();
      const parts = q.split("|").map((p) => p.trim());
      const firstPart = parts[0] || q;
      const skuPart = parts[1] || "";
      const namePart = parts[2] || "";

      return produkList.find((p, idx) => {
        const pName = (p.namaProduk || "").toLowerCase();
        const pSku = (p.sku || p.sellerSku || "").toLowerCase();
        const pBrand = (p.brand || "").toLowerCase();
        const pId = (p.id || p.idProduk || "").toLowerCase();
        const pNo = String(p.no ?? idx + 1);

        return (
          pId === q ||
          pSku === q ||
          (skuPart && pSku === skuPart.toLowerCase()) ||
          pNo === q ||
          pNo === firstPart ||
          pName === q ||
          (namePart && pName === namePart.toLowerCase()) ||
          pName.includes(q) ||
          (namePart && pName.includes(namePart.toLowerCase())) ||
          q.includes(pName) ||
          pBrand.includes(q) ||
          (pSku && q.includes(pSku))
        );
      });
    })();

    if (target) {
      setSelectedEditProduk(target);
      setSearchEditProduk(`${target.no || "1"} | ${target.sku || target.sellerSku || "-"} | ${target.namaProduk}`);
      setEditProdukRows([{ field: "NAMA_PRODUK", value: target.namaProduk || "" }]);
    } else {
      showAlert("⚠️ Produk tidak ditemukan di katalog. Pastikan memilih produk dari daftar saran.");
    }
  }

  const selectedClientInfo = clients.find((c) => c.id === selectedPlatformClientId);

  const filteredDaftar = clients.filter(
    (c) =>
      !searchDaftar ||
      (c.namaClient ?? "").toLowerCase().includes(searchDaftar.toLowerCase()) ||
      (c.pic ?? "").toLowerCase().includes(searchDaftar.toLowerCase()) ||
      (c.platform ?? "").toLowerCase().includes(searchDaftar.toLowerCase()) ||
      (c.kontak ?? "").toLowerCase().includes(searchDaftar.toLowerCase())
  );

  const filteredKatalog = produkList.filter(
    (p) =>
      !searchKatalog ||
      (p.namaProduk ?? "").toLowerCase().includes(searchKatalog.toLowerCase()) ||
      (p.sku ?? "").toLowerCase().includes(searchKatalog.toLowerCase()) ||
      (p.brand ?? "").toLowerCase().includes(searchKatalog.toLowerCase())
  );

  const inputCls = "w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-medium text-black focus:ring-2 focus:ring-[#941A0B] outline-none bg-white transition";
  const selectCls = `${inputCls} cursor-pointer`;
  const labelCls = "block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5";

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16 p-4 sm:p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-black tracking-tight">Manajemen Client &amp; Produk</h1>
        <p className="text-slate-500 text-sm mt-1 font-medium">Kelola daftar client, produk marketplace, dan registrasi baru.</p>
      </div>

      {/* Main Tabs Navigation (4 Tab Baku) */}
      <div className="flex flex-wrap gap-2 sm:gap-3 border-b border-slate-200 pb-4">
        {[
          { id: "daftar", label: "Daftar Client", icon: "fa-list" },
          { id: "input", label: "Registrasi Client", icon: "fa-user-plus" },
          { id: "edit", label: "Rubah Data Client", icon: "fa-pen-to-square" },
          { id: "produk", label: "Manajemen Produk", icon: "fa-box-open" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition flex items-center gap-2 border ${
              activeTab === tab.id
                ? "bg-[#941A0B] text-white border-[#941A0B] shadow-md shadow-[#941A0B]/20"
                : "bg-white text-slate-600 border-slate-200 hover:bg-[#F1F1F1] hover:text-black"
            }`}
          >
            <i className={`fa-solid ${tab.icon}`} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: DAFTAR CLIENT                                                      */}
      {/* Header Tabel Baku: PLATFORM, KATEGORI, PIC, KONTAK                        */}
      {/* ========================================================================= */}
      {activeTab === "daftar" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[480px]">
          <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-extrabold text-base text-black">Database Client</h2>
              <p className="text-xs text-slate-500 mt-0.5">{filteredDaftar.length} client terdaftar di sistem.</p>
            </div>
            <div className="flex items-center bg-white border border-slate-300 rounded-xl px-3 py-2 w-full sm:w-72 focus-within:ring-2 focus-within:ring-[#941A0B]">
              <i className="fa-solid fa-magnifying-glass text-slate-400 mr-2 text-sm" />
              <input
                type="text"
                value={searchDaftar}
                onChange={(e) => setSearchDaftar(e.target.value)}
                placeholder="Cari platform, PIC, merk..."
                className="border-none bg-transparent focus:ring-0 outline-none text-sm w-full text-slate-700 placeholder-slate-400"
              />
              {searchDaftar && (
                <button onClick={() => setSearchDaftar("")} className="text-slate-400 hover:text-slate-700 ml-1">
                  <i className="fa-solid fa-xmark" />
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200 font-bold">
                <tr>
                  <th className="px-5 py-3.5 font-bold">PLATFORM</th>
                  <th className="px-5 py-3.5 font-bold">KATEGORI</th>
                  <th className="px-5 py-3.5 font-bold">PIC</th>
                  <th className="px-5 py-3.5 font-bold">KONTAK</th>
                  <th className="px-5 py-3.5 font-bold text-center">AKSI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingClients ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-slate-400 italic">
                      <i className="fa-solid fa-circle-notch fa-spin mr-2 text-[#941A0B]" />
                      Memuat data client...
                    </td>
                  </tr>
                ) : filteredDaftar.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-[#941A0B]/10 text-[#941A0B] flex items-center justify-center font-bold text-xs shrink-0">
                          {c.namaClient?.slice(0, 1).toUpperCase() || "C"}
                        </div>
                        <div>
                          <div className="font-bold text-black text-sm">{c.namaClient}</div>
                          <div className="text-[11px] text-slate-500">{c.platform || "Shopee"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {c.ketentuan?.[0]?.kategori || "Beauty / General"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-medium text-slate-800">{c.pic || "-"}</td>
                    <td className="px-5 py-3.5 font-mono text-slate-700">
                      {c.kontak ? (
                        <a
                          href={`https://wa.me/${c.kontak.replace(/[^0-9]/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#941A0B] hover:underline flex items-center gap-1.5 font-semibold"
                        >
                          <i className="fa-brands fa-whatsapp text-emerald-600 text-base" />
                          <span>{c.kontak}</span>
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab("edit");
                          handleSelectEditClient(c);
                        }}
                        className="text-[#941A0B] hover:bg-red-50 px-3 py-1.5 rounded-lg font-bold text-xs transition inline-flex items-center gap-1 border border-red-200"
                      >
                        <i className="fa-solid fa-pen-to-square" />
                        <span>Rubah</span>
                      </button>
                    </td>
                  </tr>
                ))}
                {!loadingClients && filteredDaftar.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-slate-400 italic">
                      {searchDaftar ? "Tidak ada client yang sesuai dengan pencarian." : "Belum ada client yang terdaftar."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: REGISTRASI CLIENT (Multi-Form Maks 5 & WhatsApp Prefix 62 Baku)     */}
      {/* ========================================================================= */}
      {activeTab === "input" && (
        <form onSubmit={handleSubmitClients} className="space-y-4">
          {clientForms.map((form) => (
            <div key={form.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition">
              {/* Accordion Card Header */}
              <div
                onClick={() => toggleClientAccordion(form.id)}
                className="bg-slate-50 border-b border-slate-200 p-4 flex justify-between items-center cursor-pointer hover:bg-slate-100 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-[#941A0B] text-white w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shadow-sm">
                    #{form.id}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm">{form.namaMerk || "Client Baru"}</h3>
                    <p className="text-xs text-slate-500 font-medium">PIC: {form.penanggungJawab || "-"}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveClientForm(form.id);
                    }}
                    disabled={clientForms.length === 1}
                    className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition disabled:opacity-30"
                    title="Hapus Form"
                  >
                    <i className="fa-solid fa-trash" />
                  </button>
                  <button
                    type="button"
                    className="text-[#941A0B] bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1"
                  >
                    <i className={`fa-solid ${form.isExpanded ? "fa-chevron-up" : "fa-chevron-down"}`} />
                    <span className="hidden sm:inline">{form.isExpanded ? "Minimize" : "Buka"}</span>
                  </button>
                </div>
              </div>

              {/* Form Content */}
              {form.isExpanded && (
                <div className="p-5 sm:p-6 space-y-6">
                  {/* 1. Data Dasar */}
                  <div className="space-y-3 border-b border-slate-100 pb-5">
                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">1. Data Dasar</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={labelCls}>Nama Perusahaan</label>
                        <input
                          type="text"
                          value={form.namaPerusahaan}
                          onChange={(e) =>
                            setClientForms(clientForms.map((f) => (f.id === form.id ? { ...f, namaPerusahaan: e.target.value } : f)))
                          }
                          placeholder="PT / CV..."
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Nama Merk / Brand *</label>
                        <input
                          type="text"
                          value={form.namaMerk}
                          onChange={(e) =>
                            setClientForms(clientForms.map((f) => (f.id === form.id ? { ...f, namaMerk: e.target.value } : f)))
                          }
                          placeholder="Nama Merk Dagang"
                          className={inputCls}
                          required
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Penanggung Jawab (PIC)</label>
                        <input
                          type="text"
                          value={form.penanggungJawab}
                          onChange={(e) =>
                            setClientForms(clientForms.map((f) => (f.id === form.id ? { ...f, penanggungJawab: e.target.value } : f)))
                          }
                          placeholder="Nama PIC Client"
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Kategori *</label>
                        <select
                          value={form.kategori}
                          onChange={(e) =>
                            setClientForms(clientForms.map((f) => (f.id === form.id ? { ...f, kategori: e.target.value } : f)))
                          }
                          className={selectCls}
                          required
                        >
                          <option value="" disabled>Pilih Kategori</option>
                          <option value="Beauty">Beauty</option>
                          <option value="FMGC">FMGC</option>
                          <option value="Fashion">Fashion</option>
                          <option value="Lainnya">Lainnya...</option>
                        </select>
                        {form.kategori === "Lainnya" && (
                          <input
                            type="text"
                            value={form.manualKategori}
                            onChange={(e) =>
                              setClientForms(clientForms.map((f) => (f.id === form.id ? { ...f, manualKategori: e.target.value } : f)))
                            }
                            placeholder="Tulis kategori manual..."
                            className={`${inputCls} mt-2`}
                            required
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 2. Kontak & Alamat (Nomor WhatsApp Prefix 62 Baku) */}
                  <div className="space-y-3 border-b border-slate-100 pb-5">
                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">2. Kontak &amp; Alamat</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={labelCls}>Nomor Telepon (WA) *</label>
                        <div className="flex rounded-xl border border-slate-300 overflow-hidden focus-within:ring-2 focus-within:ring-[#941A0B]">
                          <span className="bg-[#F1F1F1] text-slate-700 font-bold px-3 py-2.5 text-sm border-r border-slate-300 flex items-center select-none">
                            +62
                          </span>
                          <input
                            type="tel"
                            value={form.nomorTeleponSuffix}
                            onChange={(e) =>
                              setClientForms(
                                clientForms.map((f) =>
                                  f.id === form.id
                                    ? { ...f, nomorTeleponSuffix: e.target.value.replace(/[^0-9]/g, "") }
                                    : f
                                )
                              )
                            }
                            placeholder="81234567890"
                            className="w-full px-3.5 py-2.5 text-sm font-medium text-black outline-none bg-white font-mono"
                            required
                          />
                        </div>
                      </div>
                      <div>
                        <label className={labelCls}>Email</label>
                        <input
                          type="email"
                          value={form.email}
                          onChange={(e) =>
                            setClientForms(clientForms.map((f) => (f.id === form.id ? { ...f, email: e.target.value } : f)))
                          }
                          placeholder="client@brand.com"
                          className={inputCls}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className={labelCls}>Alamat Lengkap</label>
                        <input
                          type="text"
                          value={form.alamat}
                          onChange={(e) =>
                            setClientForms(clientForms.map((f) => (f.id === form.id ? { ...f, alamat: e.target.value } : f)))
                          }
                          placeholder="Alamat kantor / gudang client..."
                          className={inputCls}
                        />
                      </div>
                    </div>
                  </div>

                  {/* 3. Preferensi Marketplace & Catatan */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">3. Preferensi Marketplace &amp; Catatan</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className={labelCls}>Marketplace 1</label>
                        <select
                          value={form.marketplace1}
                          onChange={(e) =>
                            setClientForms(clientForms.map((f) => (f.id === form.id ? { ...f, marketplace1: e.target.value } : f)))
                          }
                          className={selectCls}
                        >
                          <option value="">-- Kosong --</option>
                          <option value="Shopee">Shopee</option>
                          <option value="TikTok">TikTok</option>
                          <option value="Instagram">Instagram</option>
                          <option value="Lainnya">Lainnya...</option>
                        </select>
                        {form.marketplace1 === "Lainnya" && (
                          <input
                            type="text"
                            value={form.manualMp1}
                            onChange={(e) =>
                              setClientForms(clientForms.map((f) => (f.id === form.id ? { ...f, manualMp1: e.target.value } : f)))
                            }
                            placeholder="Tulis marketplace..."
                            className={`${inputCls} mt-2`}
                          />
                        )}
                      </div>
                      <div>
                        <label className={labelCls}>Marketplace 2</label>
                        <select
                          value={form.marketplace2}
                          onChange={(e) =>
                            setClientForms(clientForms.map((f) => (f.id === form.id ? { ...f, marketplace2: e.target.value } : f)))
                          }
                          className={selectCls}
                        >
                          <option value="">-- Kosong --</option>
                          <option value="Shopee">Shopee</option>
                          <option value="TikTok">TikTok</option>
                          <option value="Instagram">Instagram</option>
                          <option value="Lainnya">Lainnya...</option>
                        </select>
                        {form.marketplace2 === "Lainnya" && (
                          <input
                            type="text"
                            value={form.manualMp2}
                            onChange={(e) =>
                              setClientForms(clientForms.map((f) => (f.id === form.id ? { ...f, manualMp2: e.target.value } : f)))
                            }
                            placeholder="Tulis marketplace..."
                            className={`${inputCls} mt-2`}
                          />
                        )}
                      </div>
                      <div>
                        <label className={labelCls}>Marketplace 3</label>
                        <select
                          value={form.marketplace3}
                          onChange={(e) =>
                            setClientForms(clientForms.map((f) => (f.id === form.id ? { ...f, marketplace3: e.target.value } : f)))
                          }
                          className={selectCls}
                        >
                          <option value="">-- Kosong --</option>
                          <option value="Shopee">Shopee</option>
                          <option value="TikTok">TikTok</option>
                          <option value="Instagram">Instagram</option>
                          <option value="Lainnya">Lainnya...</option>
                        </select>
                        {form.marketplace3 === "Lainnya" && (
                          <input
                            type="text"
                            value={form.manualMp3}
                            onChange={(e) =>
                              setClientForms(clientForms.map((f) => (f.id === form.id ? { ...f, manualMp3: e.target.value } : f)))
                            }
                            placeholder="Tulis marketplace..."
                            className={`${inputCls} mt-2`}
                          />
                        )}
                      </div>
                      <div className="md:col-span-3">
                        <label className={labelCls}>Catatan Khusus</label>
                        <textarea
                          rows={2}
                          value={form.catatan}
                          onChange={(e) =>
                            setClientForms(clientForms.map((f) => (f.id === form.id ? { ...f, catatan: e.target.value } : f)))
                          }
                          placeholder="Catatan tambahan mengenai ketentuan siaran / PIC..."
                          className={inputCls}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Action Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4 mt-6">
            <button
              type="button"
              onClick={handleAddClientForm}
              disabled={clientForms.length >= 5}
              className="w-full sm:w-auto text-[#941A0B] bg-red-50 hover:bg-red-100 font-bold py-3 px-6 rounded-xl transition flex items-center justify-center gap-2 text-sm disabled:opacity-40"
            >
              <i className="fa-solid fa-plus" />
              <span>Tambah Form (Maks 5)</span>
            </button>
            <button
              type="submit"
              disabled={submittingClients}
              className="w-full sm:w-auto bg-[#941A0B] hover:bg-[#7D1509] text-white font-bold py-3 px-8 rounded-xl transition shadow-md flex items-center justify-center gap-2 text-sm disabled:opacity-50"
            >
              <i className={`fa-solid ${submittingClients ? "fa-circle-notch fa-spin" : "fa-cloud-arrow-up"}`} />
              <span>{submittingClients ? "Menyimpan Data..." : "Simpan Semua Data"}</span>
            </button>
          </div>
        </form>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: RUBAH DATA CLIENT (Autocomplete Datalist & Form Dinamis)           */}
      {/* ========================================================================= */}
      {activeTab === "edit" && (
        <div className="space-y-6">
          {/* Search Box with Autocomplete Datalist & Live Dropdown */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-sm font-bold text-slate-800 mb-3">Cari Client Target</h2>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <div className="relative">
                  <input
                    list="listClientSuggestions"
                    type="text"
                    value={searchEditId}
                    onFocus={() => setShowClientDropdown(true)}
                    onChange={(e) => {
                      setSearchEditId(e.target.value);
                      setSelectedEditClientId("");
                      setShowClientDropdown(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        setShowClientDropdown(false);
                        handleSelectEditClient();
                      }
                    }}
                    placeholder="Ketik nama perusahaan | merk | PIC..."
                    className={inputCls}
                  />
                  {searchEditId && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchEditId("");
                        setSelectedEditClientId("");
                        setSelectedEditClient(null);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    >
                      <i className="fa-solid fa-xmark" />
                    </button>
                  )}
                </div>

                <datalist id="listClientSuggestions">
                  {clients.map((c) => (
                    <option
                      key={c.id}
                      value={`${c.namaClient} ${c.platform ? `(${c.platform})` : ""} | ${c.pic || "PIC -"} | ${c.kontak || "No WA -"}`}
                    />
                  ))}
                </datalist>

                {/* Floating Interactive Live Suggestions */}
                {showClientDropdown && searchEditId.trim() && (
                  <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto divide-y divide-slate-100">
                    {clients
                      .filter((c) => {
                        const q = searchEditId.toLowerCase().trim();
                        return (
                          (c.namaClient || "").toLowerCase().includes(q) ||
                          (c.pic || "").toLowerCase().includes(q) ||
                          (c.kontak || "").toLowerCase().includes(q) ||
                          (c.platform || "").toLowerCase().includes(q)
                        );
                      })
                      .map((c) => (
                        <div
                          key={c.id}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSelectEditClient(c);
                            setShowClientDropdown(false);
                          }}
                          className="p-3 hover:bg-red-50/60 cursor-pointer transition flex items-center justify-between"
                        >
                          <div>
                            <span className="font-bold text-black text-sm">{c.namaClient}</span>
                            <span className="text-xs text-slate-500 ml-2">({c.platform || "Shopee"})</span>
                            <div className="text-xs text-slate-400">
                              PIC: <span className="text-slate-700 font-medium">{c.pic || "-"}</span> • WA:{" "}
                              <span className="text-slate-700 font-mono">{c.kontak || "-"}</span>
                            </div>
                          </div>
                          <span className="text-xs font-bold text-[#941A0B] bg-red-50 px-2.5 py-1 rounded-lg border border-red-100">
                            Pilih
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowClientDropdown(false);
                  handleSelectEditClient();
                }}
                className="bg-[#941A0B] hover:bg-[#7D1509] text-white px-7 py-2.5 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 shadow-md shadow-[#941A0B]/20 shrink-0"
              >
                <i className="fa-solid fa-pen-to-square" />
                <span>Pilih Client</span>
              </button>
            </div>
          </div>

          {/* Panel Target Client */}
          {selectedEditClient && (
            <div className="bg-slate-900 text-white p-5 sm:p-6 rounded-2xl border border-slate-700 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <i className="fa-solid fa-building text-6xl" />
              </div>
              <h3 className="text-xs font-bold text-slate-300 mb-4 border-b border-slate-700 pb-2 uppercase tracking-wider relative z-10 flex items-center justify-between">
                <span>Target Data Client Terpilih</span>
                <span className="text-emerald-400 text-xs font-mono font-bold">● Terhubung</span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 relative z-10 text-xs">
                <div>
                  <span className="block text-[11px] text-slate-400 mb-0.5">Nama Merk / Brand</span>
                  <div className="font-extrabold text-sm text-amber-300">{selectedEditClient.namaClient}</div>
                </div>
                <div>
                  <span className="block text-[11px] text-slate-400 mb-0.5">Platform Marketplace</span>
                  <div className="font-extrabold text-sm text-white">{selectedEditClient.platform || "Shopee"}</div>
                </div>
                <div>
                  <span className="block text-[11px] text-slate-400 mb-0.5">Penanggung Jawab (PIC)</span>
                  <div className="font-extrabold text-sm text-white">{selectedEditClient.pic || "-"}</div>
                </div>
                <div>
                  <span className="block text-[11px] text-slate-400 mb-0.5">Kontak WhatsApp</span>
                  <div className="font-extrabold text-sm text-emerald-400 font-mono">
                    {selectedEditClient.kontak ? (
                      <a
                        href={`https://wa.me/${selectedEditClient.kontak.replace(/[^0-9]/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline flex items-center gap-1 font-bold"
                      >
                        <i className="fa-brands fa-whatsapp text-emerald-400" />
                        <span>{selectedEditClient.kontak}</span>
                      </a>
                    ) : (
                      "-"
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Panel Formulir Perubahan Lengkap Data Client */}
          {selectedEditClient && (
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Perbarui Data Client</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Data client terisi otomatis dari database. Anda dapat langsung mengubah nilai di kolom formulir berikut.
                  </p>
                </div>
                <span className="text-xs font-bold text-[#941A0B] bg-red-50 px-3 py-1 rounded-lg border border-red-100">
                  {selectedEditClient.namaClient}
                </span>
              </div>

              <form onSubmit={handleSaveEditClient} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Nama Perusahaan */}
                  <div>
                    <label className={labelCls}>Nama Perusahaan / Legal</label>
                    <input
                      type="text"
                      value={editClientForm.namaPerusahaan}
                      onChange={(e) => setEditClientForm({ ...editClientForm, namaPerusahaan: e.target.value })}
                      placeholder="PT / CV / Nama Usaha..."
                      className={inputCls}
                    />
                  </div>

                  {/* Nama Merk */}
                  <div>
                    <label className={labelCls}>Nama Merk / Brand *</label>
                    <input
                      type="text"
                      value={editClientForm.namaMerk}
                      onChange={(e) => setEditClientForm({ ...editClientForm, namaMerk: e.target.value })}
                      placeholder="Nama Brand..."
                      className={inputCls}
                      required
                    />
                  </div>

                  {/* Penanggung Jawab (PIC) */}
                  <div>
                    <label className={labelCls}>Penanggung Jawab (PIC) *</label>
                    <input
                      type="text"
                      value={editClientForm.penanggungJawab}
                      onChange={(e) => setEditClientForm({ ...editClientForm, penanggungJawab: e.target.value })}
                      placeholder="Nama PIC..."
                      className={inputCls}
                      required
                    />
                  </div>

                  {/* Kategori */}
                  <div>
                    <label className={labelCls}>Kategori Client *</label>
                    <select
                      value={editClientForm.kategori}
                      onChange={(e) => setEditClientForm({ ...editClientForm, kategori: e.target.value })}
                      className={selectCls}
                      required
                    >
                      <option value="Beauty">Beauty</option>
                      <option value="FMGC">FMGC</option>
                      <option value="Fashion">Fashion</option>
                      <option value="Lainnya">Lainnya...</option>
                    </select>
                    {editClientForm.kategori === "Lainnya" && (
                      <input
                        type="text"
                        value={editClientForm.manualKategori}
                        onChange={(e) => setEditClientForm({ ...editClientForm, manualKategori: e.target.value })}
                        placeholder="Tulis kategori manual..."
                        className={`${inputCls} mt-2`}
                        required
                      />
                    )}
                  </div>

                  {/* No Telepon WhatsApp (Baku 62) */}
                  <div>
                    <label className={labelCls}>No. WhatsApp PIC *</label>
                    <div className="flex rounded-xl border border-slate-300 overflow-hidden focus-within:ring-2 focus-within:ring-[#941A0B]">
                      <span className="bg-[#F1F1F1] text-slate-700 font-bold px-3.5 py-2.5 text-sm border-r border-slate-300 flex items-center select-none">
                        +62
                      </span>
                      <input
                        type="tel"
                        value={editClientForm.nomorTeleponSuffix}
                        onChange={(e) =>
                          setEditClientForm({
                            ...editClientForm,
                            nomorTeleponSuffix: e.target.value.replace(/[^0-9]/g, ""),
                          })
                        }
                        placeholder="81234567890"
                        className="w-full px-3.5 py-2.5 text-sm font-medium text-black outline-none bg-white font-mono"
                        required
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label className={labelCls}>Email Client</label>
                    <input
                      type="email"
                      value={editClientForm.email}
                      onChange={(e) => setEditClientForm({ ...editClientForm, email: e.target.value })}
                      placeholder="client@brand.com"
                      className={inputCls}
                    />
                  </div>
                </div>

                {/* Alamat Lengkap */}
                <div>
                  <label className={labelCls}>Alamat Lengkap Kantor / Gudang</label>
                  <textarea
                    rows={2}
                    value={editClientForm.alamat}
                    onChange={(e) => setEditClientForm({ ...editClientForm, alamat: e.target.value })}
                    placeholder="Alamat lengkap..."
                    className={inputCls}
                  />
                </div>

                {/* Marketplaces */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-slate-100">
                  <div>
                    <label className={labelCls}>Marketplace 1 (Utama) *</label>
                    <select
                      value={editClientForm.marketplace1}
                      onChange={(e) => setEditClientForm({ ...editClientForm, marketplace1: e.target.value })}
                      className={selectCls}
                      required
                    >
                      <option value="Shopee">Shopee</option>
                      <option value="TikTok">TikTok Shop</option>
                      <option value="Instagram">Instagram Live</option>
                      <option value="Tokopedia">Tokopedia</option>
                      <option value="Lainnya">Lainnya...</option>
                    </select>
                    {editClientForm.marketplace1 === "Lainnya" && (
                      <input
                        type="text"
                        value={editClientForm.manualMp1}
                        onChange={(e) => setEditClientForm({ ...editClientForm, manualMp1: e.target.value })}
                        placeholder="Tulis marketplace 1..."
                        className={`${inputCls} mt-2`}
                        required
                      />
                    )}
                  </div>

                  <div>
                    <label className={labelCls}>Marketplace 2 (Opsional)</label>
                    <select
                      value={editClientForm.marketplace2}
                      onChange={(e) => setEditClientForm({ ...editClientForm, marketplace2: e.target.value })}
                      className={selectCls}
                    >
                      <option value="">-- Tidak Ada --</option>
                      <option value="Shopee">Shopee</option>
                      <option value="TikTok">TikTok Shop</option>
                      <option value="Instagram">Instagram Live</option>
                      <option value="Tokopedia">Tokopedia</option>
                      <option value="Lainnya">Lainnya...</option>
                    </select>
                    {editClientForm.marketplace2 === "Lainnya" && (
                      <input
                        type="text"
                        value={editClientForm.manualMp2}
                        onChange={(e) => setEditClientForm({ ...editClientForm, manualMp2: e.target.value })}
                        placeholder="Tulis marketplace 2..."
                        className={`${inputCls} mt-2`}
                      />
                    )}
                  </div>

                  <div>
                    <label className={labelCls}>Marketplace 3 (Opsional)</label>
                    <select
                      value={editClientForm.marketplace3}
                      onChange={(e) => setEditClientForm({ ...editClientForm, marketplace3: e.target.value })}
                      className={selectCls}
                    >
                      <option value="">-- Tidak Ada --</option>
                      <option value="Shopee">Shopee</option>
                      <option value="TikTok">TikTok Shop</option>
                      <option value="Instagram">Instagram Live</option>
                      <option value="Tokopedia">Tokopedia</option>
                      <option value="Lainnya">Lainnya...</option>
                    </select>
                    {editClientForm.marketplace3 === "Lainnya" && (
                      <input
                        type="text"
                        value={editClientForm.manualMp3}
                        onChange={(e) => setEditClientForm({ ...editClientForm, manualMp3: e.target.value })}
                        placeholder="Tulis marketplace 3..."
                        className={`${inputCls} mt-2`}
                      />
                    )}
                  </div>
                </div>

                {/* Catatan */}
                <div>
                  <label className={labelCls}>Catatan Tambahan</label>
                  <textarea
                    rows={2}
                    value={editClientForm.catatan}
                    onChange={(e) => setEditClientForm({ ...editClientForm, catatan: e.target.value })}
                    placeholder="Ketentuan siaran, target live, dsb..."
                    className={inputCls}
                  />
                </div>

                <div className="flex justify-end pt-4 border-t border-slate-100">
                  <button
                    type="submit"
                    disabled={savingEditClient}
                    className="bg-[#941A0B] hover:bg-[#7D1509] text-white font-bold py-3 px-8 rounded-xl transition shadow-md flex items-center gap-2 text-sm disabled:opacity-50"
                  >
                    <i className={`fa-solid ${savingEditClient ? "fa-circle-notch fa-spin" : "fa-cloud-arrow-up"}`} />
                    <span>{savingEditClient ? "Menyimpan Perubahan..." : "Simpan Perubahan Data"}</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: MANAJEMEN PRODUK (3 Subtab: Daftar, Input, Rubah Data Produk)      */}
      {/* ========================================================================= */}
      {activeTab === "produk" && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 lg:p-6 space-y-6">
          {/* Subtab Buttons */}
          <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
            {[
              { id: "list", label: "Daftar Produk", icon: "fa-list-ul" },
              { id: "input", label: "Input Produk", icon: "fa-plus" },
              { id: "edit", label: "Rubah Data Produk", icon: "fa-pen" },
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setSubTabProduk(st.id as any)}
                className={`px-4 py-2 text-sm font-bold rounded-xl transition flex items-center gap-2 ${
                  subTabProduk === st.id
                    ? "bg-[#941A0B] text-white shadow-sm"
                    : "text-slate-600 hover:text-black hover:bg-[#F1F1F1]"
                }`}
              >
                <i className={`fa-solid ${st.icon}`} />
                <span>{st.label}</span>
              </button>
            ))}
          </div>

          {/* Platform Client Selector */}
          <div className="bg-red-50/50 border border-red-100 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <label className="text-sm font-bold text-[#941A0B] flex-shrink-0 flex items-center gap-1.5">
              <i className="fa-solid fa-filter" />
              <span>Pilih Platform Klien:</span>
            </label>
            <select
              value={selectedPlatformClientId}
              onChange={(e) => handleSelectPlatform(e.target.value)}
              className="w-full sm:w-80 border border-slate-300 rounded-xl px-3.5 py-2 text-sm focus:ring-2 focus:ring-[#941A0B] bg-white outline-none font-medium cursor-pointer"
            >
              <option value="">-- Pilih Platform / Client --</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.namaClient} {c.platform ? `(${c.platform})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Rangkuman Klien Banner */}
          {selectedClientInfo && (
            <div className="bg-gradient-to-r from-[#4A0A04] via-[#6D1207] to-[#941A0B] rounded-2xl p-5 text-white shadow-md relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <i className="fa-solid fa-building text-6xl" />
              </div>
              <h4 className="text-xs font-bold text-red-200 mb-3 border-b border-white/20 pb-2 uppercase tracking-wider relative z-10">
                Rangkuman Klien
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 relative z-10 text-xs">
                <div>
                  <span className="block text-slate-300 mb-0.5">Platform Target</span>
                  <div className="font-extrabold text-sm text-amber-300">{selectedClientInfo.namaClient} ({selectedClientInfo.platform || "Live"})</div>
                </div>
                <div>
                  <span className="block text-slate-300 mb-0.5">Kategori</span>
                  <div className="font-extrabold text-sm">{selectedClientInfo.ketentuan?.[0]?.kategori || "Beauty"}</div>
                </div>
                <div>
                  <span className="block text-slate-300 mb-0.5">Penanggung Jawab</span>
                  <div className="font-extrabold text-sm">{selectedClientInfo.pic || "-"}</div>
                </div>
                <div>
                  <span className="block text-slate-300 mb-0.5">Kontak WhatsApp</span>
                  <div className="font-extrabold text-sm font-mono">{selectedClientInfo.kontak || "-"}</div>
                </div>
              </div>
            </div>
          )}

          {!selectedPlatformClientId ? (
            <div className="text-center py-12 text-slate-400">
              <i className="fa-solid fa-hand-pointer text-4xl text-slate-300 mb-3 block" />
              <p className="font-medium text-sm">Silakan pilih Platform Klien di atas untuk mengelola data produk.</p>
            </div>
          ) : (
            <>
              {/* ------------------------------------------------------------- */}
              {/* SUBTAB 4.1: DAFTAR PRODUK (Katalog Produk)                    */}
              {/* Columns: NO, ID PRODUK, SKU, BRAND, NAMA PRODUK, VARIAN, LINK */}
              {/* ------------------------------------------------------------- */}
              {subTabProduk === "list" && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <h3 className="font-extrabold text-black text-sm">Katalog Produk Terdaftar ({filteredKatalog.length})</h3>
                    <div className="flex items-center bg-white border border-slate-300 rounded-xl px-3 py-1.5 w-full sm:w-64 focus-within:ring-2 focus-within:ring-[#941A0B]">
                      <i className="fa-solid fa-magnifying-glass text-slate-400 mr-2 text-xs" />
                      <input
                        type="text"
                        value={searchKatalog}
                        onChange={(e) => setSearchKatalog(e.target.value)}
                        placeholder="Cari Produk / SKU..."
                        className="border-none bg-transparent focus:ring-0 outline-none text-xs w-full text-slate-700"
                      />
                    </div>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-xs text-left whitespace-nowrap">
                      <thead className="text-[11px] text-slate-500 uppercase bg-slate-50 border-b border-slate-200 font-bold">
                        <tr>
                          <th className="px-4 py-3 text-center">NO</th>
                          <th className="px-4 py-3">ID PRODUK</th>
                          <th className="px-4 py-3">SKU</th>
                          <th className="px-4 py-3">BRAND</th>
                          <th className="px-4 py-3">NAMA PRODUK</th>
                          <th className="px-4 py-3">VARIAN</th>
                          <th className="px-4 py-3 text-center">LINK</th>
                          <th className="px-4 py-3">CATATAN</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {loadingProduk ? (
                          <tr>
                            <td colSpan={8} className="px-4 py-8 text-center text-slate-400 italic">
                              <i className="fa-solid fa-circle-notch fa-spin mr-2 text-[#941A0B]" />
                              Memuat katalog produk...
                            </td>
                          </tr>
                        ) : filteredKatalog.map((prod, idx) => (
                          <tr key={prod.id ?? idx} className="hover:bg-slate-50 transition">
                            <td className="px-4 py-3 text-center font-bold text-slate-500">{prod.no ?? idx + 1}</td>
                            <td className="px-4 py-3 font-mono font-bold text-[#941A0B]">{prod.idProduk || `PRD-${idx + 1}`}</td>
                            <td className="px-4 py-3 font-mono text-slate-700">{prod.sku || prod.sellerSku || "-"}</td>
                            <td className="px-4 py-3 font-semibold text-slate-800">{prod.brand || selectedClientInfo?.namaClient || "Brand"}</td>
                            <td className="px-4 py-3 font-bold text-black max-w-xs truncate" title={prod.namaProduk}>
                              {prod.namaProduk}
                            </td>
                            <td className="px-4 py-3">
                              {prod.varian && prod.varian.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {prod.varian.map((v, vIdx) => (
                                    <span key={vIdx} className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-medium border border-slate-200">
                                      {v}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                "-"
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {prod.link ? (
                                <a href={prod.link} target="_blank" rel="noopener noreferrer" className="text-[#941A0B] hover:text-red-700 text-sm">
                                  <i className="fa-solid fa-arrow-up-right-from-square" />
                                </a>
                              ) : (
                                "-"
                              )}
                            </td>
                            <td className="px-4 py-3 text-slate-500">{prod.catatan || "-"}</td>
                          </tr>
                        ))}
                        {!loadingProduk && filteredKatalog.length === 0 && (
                          <tr>
                            <td colSpan={8} className="px-4 py-8 text-center text-slate-400 italic">
                              {searchKatalog ? "Tidak ada produk yang cocok." : "Belum ada produk terdaftar untuk platform ini."}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* SUBTAB 4.2: INPUT PRODUK (Multi-Baris Maks 10)                 */}
              {/* ------------------------------------------------------------- */}
              {subTabProduk === "input" && (
                <form onSubmit={handleSubmitProdukMaster} className="space-y-4">
                  {produkForms.map((pForm) => (
                    <div key={pForm.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="bg-slate-50 border-b border-slate-200 p-3.5 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className="bg-[#941A0B] text-white w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs">
                            #{pForm.id}
                          </div>
                          <h4 className="font-bold text-slate-800 text-xs">{pForm.namaProduk || "Produk Baru"}</h4>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveProdukForm(pForm.id)}
                          disabled={produkForms.length === 1}
                          className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition disabled:opacity-30 text-xs"
                        >
                          <i className="fa-solid fa-trash" />
                        </button>
                      </div>

                      <div className="p-4 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className={labelCls}>ID Produk (Opsional)</label>
                            <input
                              type="text"
                              value={pForm.idProduk}
                              onChange={(e) =>
                                setProdukForms(produkForms.map((f) => (f.id === pForm.id ? { ...f, idProduk: e.target.value } : f)))
                              }
                              placeholder="mis. PRD-001"
                              className={inputCls}
                            />
                          </div>
                          <div>
                            <label className={labelCls}>Seller SKU *</label>
                            <input
                              type="text"
                              value={pForm.sellerSku}
                              onChange={(e) =>
                                setProdukForms(produkForms.map((f) => (f.id === pForm.id ? { ...f, sellerSku: e.target.value } : f)))
                              }
                              placeholder="mis. SKU-GLOW-01"
                              className={inputCls}
                              required
                            />
                          </div>
                          <div>
                            <label className={labelCls}>Brand *</label>
                            <input
                              type="text"
                              value={pForm.brand}
                              onChange={(e) =>
                                setProdukForms(produkForms.map((f) => (f.id === pForm.id ? { ...f, brand: e.target.value } : f)))
                              }
                              placeholder="Nama Brand"
                              className={inputCls}
                              required
                            />
                          </div>
                          <div>
                            <label className={labelCls}>Nama Produk Lengkap *</label>
                            <input
                              type="text"
                              value={pForm.namaProduk}
                              onChange={(e) =>
                                setProdukForms(produkForms.map((f) => (f.id === pForm.id ? { ...f, namaProduk: e.target.value } : f)))
                              }
                              placeholder="Nama Produk"
                              className={inputCls}
                              required
                            />
                          </div>
                        </div>

                        {/* Varian Tagging Box */}
                        <div className="bg-red-50/40 p-3.5 rounded-xl border border-red-100">
                          <label className="block text-xs font-bold text-[#941A0B] mb-1">
                            <i className="fa-solid fa-tags mr-1" />
                            <span>Varian Produk</span>
                          </label>
                          <p className="text-[10px] text-slate-500 mb-2">Ketik nama varian lalu tekan <b>Enter</b> atau klik <b>Tambah</b>.</p>
                          <div className="flex gap-2 mb-2">
                            <input
                              type="text"
                              value={pForm.varianInput}
                              onChange={(e) =>
                                setProdukForms(produkForms.map((f) => (f.id === pForm.id ? { ...f, varianInput: e.target.value } : f)))
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleAddVarianTag(pForm.id);
                                }
                              }}
                              placeholder="Ketik varian (e.g. 50ml / Merah)..."
                              className={inputCls}
                            />
                            <button
                              type="button"
                              onClick={() => handleAddVarianTag(pForm.id)}
                              className="bg-[#941A0B] text-white px-4 py-2 rounded-xl text-xs font-bold shrink-0 hover:bg-[#7D1509]"
                            >
                              Tambah
                            </button>
                          </div>
                          {pForm.varianList.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {pForm.varianList.map((v, tagIdx) => (
                                <span
                                  key={tagIdx}
                                  className="bg-white border border-slate-300 text-black px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs"
                                >
                                  <span>{v}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveVarianTag(pForm.id, tagIdx)}
                                    className="text-red-500 hover:text-red-700"
                                  >
                                    <i className="fa-solid fa-xmark text-[10px]" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className={labelCls}>Link Produk Marketplace</label>
                            <input
                              type="url"
                              value={pForm.linkProduk}
                              onChange={(e) =>
                                setProdukForms(produkForms.map((f) => (f.id === pForm.id ? { ...f, linkProduk: e.target.value } : f)))
                              }
                              placeholder="https://..."
                              className={inputCls}
                            />
                          </div>
                          <div>
                            <label className={labelCls}>Catatan</label>
                            <input
                              type="text"
                              value={pForm.catatan}
                              onChange={(e) =>
                                setProdukForms(produkForms.map((f) => (f.id === pForm.id ? { ...f, catatan: e.target.value } : f)))
                              }
                              placeholder="Catatan..."
                              className={inputCls}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4 mt-6">
                    <button
                      type="button"
                      onClick={handleAddProdukForm}
                      disabled={produkForms.length >= 10}
                      className="w-full sm:w-auto text-[#941A0B] bg-red-50 hover:bg-red-100 font-bold py-2.5 px-6 rounded-xl transition flex items-center justify-center gap-2 text-xs disabled:opacity-40"
                    >
                      <i className="fa-solid fa-plus" />
                      <span>Tambah Baris Produk (Maks 10)</span>
                    </button>
                    <button
                      type="submit"
                      disabled={submittingProduk}
                      className="w-full sm:w-auto bg-[#941A0B] hover:bg-[#7D1509] text-white font-bold py-2.5 px-8 rounded-xl transition shadow-md flex items-center justify-center gap-2 text-xs disabled:opacity-50"
                    >
                      <i className={`fa-solid ${submittingProduk ? "fa-circle-notch fa-spin" : "fa-cloud-arrow-up"}`} />
                      <span>{submittingProduk ? "Menyimpan Produk..." : "Simpan Semua Produk"}</span>
                    </button>
                  </div>
                </form>
              )}

              {/* ------------------------------------------------------------- */}
              {/* SUBTAB 4.3: RUBAH DATA PRODUK (Autocomplete & Form Dinamis)   */}
              {/* ------------------------------------------------------------- */}
              {subTabProduk === "edit" && (
                <div className="space-y-5">
                  <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200">
                    <label className={labelCls}>Cari &amp; Pilih Produk (Ketik No / SKU / Nama) *</label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="flex-1 relative">
                        <div className="relative">
                          <input
                            list="listEditProdukSuggestions"
                            type="text"
                            value={searchEditProduk}
                            onFocus={() => setShowProdukDropdown(true)}
                            onChange={(e) => {
                              setSearchEditProduk(e.target.value);
                              setShowProdukDropdown(true);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                setShowProdukDropdown(false);
                                handleSelectEditProduk();
                              }
                            }}
                            placeholder="Pilih dari daftar saran produk..."
                            className={inputCls}
                          />
                          {searchEditProduk && (
                            <button
                              type="button"
                              onClick={() => {
                                setSearchEditProduk("");
                                setSelectedEditProduk(null);
                              }}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                            >
                              <i className="fa-solid fa-xmark" />
                            </button>
                          )}
                        </div>

                        <datalist id="listEditProdukSuggestions">
                          {produkList.map((p, pIdx) => (
                            <option
                              key={p.id ?? pIdx}
                              value={`${p.no || pIdx + 1} | ${p.sku || p.sellerSku || "-"} | ${p.namaProduk}`}
                            />
                          ))}
                        </datalist>

                        {/* Floating Live Suggestions for Products */}
                        {showProdukDropdown && searchEditProduk.trim() && (
                          <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto divide-y divide-slate-100">
                            {produkList
                              .filter((p, idx) => {
                                const q = searchEditProduk.toLowerCase().trim();
                                return (
                                  (p.namaProduk || "").toLowerCase().includes(q) ||
                                  (p.sku || p.sellerSku || "").toLowerCase().includes(q) ||
                                  (p.brand || "").toLowerCase().includes(q) ||
                                  String(p.no ?? idx + 1) === q
                                );
                              })
                              .map((p, idx) => (
                                <div
                                  key={p.id ?? idx}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    handleSelectEditProduk(p);
                                    setShowProdukDropdown(false);
                                  }}
                                  className="p-3 hover:bg-red-50/60 cursor-pointer transition flex items-center justify-between"
                                >
                                  <div>
                                    <div className="font-bold text-black text-xs">
                                      #{p.no ?? idx + 1} • {p.namaProduk}
                                    </div>
                                    <div className="text-[11px] text-slate-500">
                                      SKU: <span className="font-mono">{p.sku || p.sellerSku || "-"}</span> • Brand:{" "}
                                      <span>{p.brand || "-"}</span>
                                    </div>
                                  </div>
                                  <span className="text-xs font-bold text-[#941A0B] bg-red-50 px-2.5 py-1 rounded-lg border border-red-100">
                                    Pilih
                                  </span>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setShowProdukDropdown(false);
                          handleSelectEditProduk();
                        }}
                        className="bg-[#941A0B] hover:bg-[#7D1509] text-white px-6 py-2.5 rounded-xl text-xs font-bold transition shrink-0"
                      >
                        Pilih
                      </button>
                    </div>
                  </div>

                  {selectedEditProduk && (
                    <div className="bg-slate-800 text-white p-4 rounded-2xl border border-slate-700 shadow-sm relative overflow-hidden">
                      <h4 className="text-xs font-bold text-amber-300 mb-3 border-b border-slate-700 pb-2 uppercase tracking-wider">
                        Produk Terpilih
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div><span className="block text-[10px] text-slate-400 mb-0.5">Nomor Urut (NO)</span><div className="font-bold text-amber-300">{selectedEditProduk.no || "1"}</div></div>
                        <div><span className="block text-[10px] text-slate-400 mb-0.5">SKU</span><div className="font-bold text-white font-mono">{selectedEditProduk.sku || selectedEditProduk.sellerSku || "-"}</div></div>
                        <div className="col-span-2"><span className="block text-[10px] text-slate-400 mb-0.5">Nama Produk</span><div className="font-bold text-white truncate">{selectedEditProduk.namaProduk}</div></div>
                      </div>
                    </div>
                  )}

                  {selectedEditProduk && (
                    <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4">
                      <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wide">Rubah Kolom Data Produk</h4>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          showAlert("✅ Perubahan data produk berhasil diterapkan!");
                          setSelectedEditProduk(null);
                          setSearchEditProduk("");
                        }}
                        className="space-y-3"
                      >
                        {editProdukRows.map((r, rIdx) => (
                          <div key={rIdx} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center bg-white p-3 rounded-xl border border-slate-200">
                            <div className="w-full sm:w-1/3">
                              <select
                                value={r.field}
                                onChange={(e) => {
                                  const updated = [...editProdukRows];
                                  updated[rIdx].field = e.target.value;
                                  setEditProdukRows(updated);
                                }}
                                className={selectCls}
                                required
                              >
                                <option value="" disabled>-- Kolom Data --</option>
                                <option value="NO">Nomor Urut (NO)</option>
                                <option value="ID_PRODUK">ID Produk</option>
                                <option value="SELLER_SKU">Seller SKU</option>
                                <option value="BRAND">Brand</option>
                                <option value="NAMA_PRODUK">Nama Produk</option>
                                <option value="VARIANT">Varian Produk</option>
                                <option value="LINK_PRODUK">Link Produk</option>
                                <option value="CATATAN">Catatan</option>
                              </select>
                            </div>
                            <div className="w-full sm:flex-1">
                              <input
                                type="text"
                                value={r.value}
                                disabled={!r.field}
                                onChange={(e) => {
                                  const updated = [...editProdukRows];
                                  updated[rIdx].value = e.target.value;
                                  setEditProdukRows(updated);
                                }}
                                placeholder={r.field ? "Masukkan nilai baru..." : "Pilih kolom data dulu..."}
                                className={`${inputCls} ${!r.field ? "bg-slate-100 cursor-not-allowed" : ""}`}
                                required
                              />
                            </div>
                            <div className="w-full sm:w-auto flex justify-end">
                              <button
                                type="button"
                                onClick={() => {
                                  if (editProdukRows.length > 1) {
                                    setEditProdukRows(editProdukRows.filter((_, idx) => idx !== rIdx));
                                  }
                                }}
                                disabled={editProdukRows.length === 1}
                                className="text-red-500 hover:text-red-700 p-2 rounded-lg transition disabled:opacity-30 text-xs"
                              >
                                <i className="fa-solid fa-trash" />
                              </button>
                            </div>
                          </div>
                        ))}

                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => setEditProdukRows([...editProdukRows, { field: "", value: "" }])}
                            className="text-[#941A0B] hover:text-[#7D1509] text-xs font-bold flex items-center gap-1.5 transition"
                          >
                            <i className="fa-solid fa-plus" />
                            <span>Tambah Kolom</span>
                          </button>
                        </div>

                        <div className="flex justify-end pt-3 border-t border-slate-200">
                          <button
                            type="submit"
                            className="bg-[#941A0B] hover:bg-[#7D1509] text-white font-bold py-2.5 px-7 rounded-xl text-xs transition shadow-md"
                          >
                            Terapkan Perubahan
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mt-12 text-center pb-4">
        <p className="text-xs text-[#919191]">&copy; 2026 HRIS Potensi Creative. All rights reserved.</p>
      </div>
    </div>
  );
}
