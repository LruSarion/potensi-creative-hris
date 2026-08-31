"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import type { ScheduleFormItem } from "@/types/jadwal";
import type { ClientRecord } from "@/types/employee";
import { PLATFORMS } from "@/types/jadwal";
import type { PlatformClientOption } from "@/lib/utils/schedule-helpers";

/**
 * Custom hook that centralises all data fetching and shared state
 * for the Input Jadwal page.
 *
 * Returns:
 * - Employee / client / jadwal data
 * - Derived `platformClientOptions`
 * - Loading & feedback state
 * - Re-fetch helpers
 */
export function useJadwalData() {
  // Global data
  const [streamers, setStreamers] = useState<any[]>([]);
  const [otsStaff, setOtsStaff] = useState<any[]>([]);
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [recentJadwal, setRecentJadwal] = useState<any[]>([]);
  const [allJadwal, setAllJadwal] = useState<any[]>([]);

  // Feedback
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // Kendali config & Info streamer
  const [kendaliConfig, setKendaliConfig] = useState<any>(null);
  const [kendaliLoading, setKendaliLoading] = useState(false);
  const [infoStreamerData, setInfoStreamerData] = useState<any>(null);

  // ---- Fetch all core data -------------------------------------------
  const fetchData = useCallback(async () => {
    try {
      const [empRes, clientRes, jadwalRes] = await Promise.all([
        fetch("/api/employees").then((r) => r.json()),
        fetch("/api/clients")
          .then((r) => r.json())
          .catch(() => ({ status: "success", data: [] })),
        fetch("/api/jadwal").then((r) => r.json()),
      ]);

      if (empRes.status === "success") {
        const all = empRes.data || [];
        const activeOnly = all.filter(
          (e: any) => e.statusAktif === "AKTIF" || !e.statusAktif,
        );

        const strList = activeOnly.filter((e: any) => {
          const j = (e.jabatan || "").toLowerCase().trim();
          return (
            j.includes("streamer dedicated") ||
            j.includes("streamer on-call") ||
            j === "streamer dedicated" ||
            j === "streamer on-call"
          );
        });

        const otsList = activeOnly.filter((e: any) => {
          const j = (e.jabatan || "").toLowerCase().trim();
          return (
            j.includes("operator technical support") ||
            j === "operator technical support" ||
            j === "ots"
          );
        });

        setStreamers(strList);
        setOtsStaff(otsList);
      }
      if (clientRes.status === "success") setClients(clientRes.data);
      if (jadwalRes.status === "success") {
        setAllJadwal(jadwalRes.data);
        setRecentJadwal(jadwalRes.data);
      }
    } catch {
      // ignore
    }
  }, []);

  // ---- Kendali Config -------------------------------------------------
  const loadKendaliConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/scheduler-tools?view=kendali-form").then(
        (r) => r.json(),
      );
      if (res.status === "success") {
        setKendaliConfig(res.data);
      }
    } catch {
      // ignore
    }
  }, []);

  // ---- Info Streamer ---------------------------------------------------
  const loadInfoStreamer = useCallback(async () => {
    try {
      const res = await fetch("/api/scheduler-tools?view=info-streamer").then(
        (r) => r.json(),
      );
      if (res.status === "success") {
        setInfoStreamerData(res.data);
      }
    } catch {
      // ignore
    }
  }, []);

  // ---- Initial fetch --------------------------------------------------
  useEffect(() => {
    fetchData();
    loadKendaliConfig();
    loadInfoStreamer();
  }, [fetchData, loadKendaliConfig, loadInfoStreamer]);

  // ---- Derived: Platform Client Options --------------------------------
  const platformClientOptions = useMemo<PlatformClientOption[]>(() => {
    const options: PlatformClientOption[] = [];
    const seen = new Set<string>();

    if (Array.isArray(clients) && clients.length > 0) {
      for (const c of clients) {
        const brand = (c.namaMerk || c.namaClient || "").trim();
        const k0 = c.ketentuan?.[0];
        const mps = [
          k0?.marketplace1 || c.platform,
          k0?.marketplace2,
          k0?.marketplace3,
        ]
          .filter((m): m is string => Boolean(m))
          .map((m) => m.trim());
        const finalMps = mps.length > 0 ? mps : [c.platform || "Shopee Live"];

        for (const mp of finalMps) {
          const label = brand ? `${brand} ${mp}` : mp;
          if (!seen.has(label)) {
            seen.add(label);
            options.push({ label, value: label, clientId: c.id });
          }
        }
      }
    }

    // Always ensure standard / fallback platforms are present
    PLATFORMS.forEach((p) => {
      if (!seen.has(p)) {
        seen.add(p);
        options.push({ label: p, value: p, clientId: "" });
      }
    });

    return options;
  }, [clients]);

  return {
    // Data
    streamers,
    otsStaff,
    clients,
    recentJadwal,
    allJadwal,
    platformClientOptions,
    kendaliConfig,
    infoStreamerData,

    // Feedback
    error,
    setError,
    success,
    setSuccess,
    loading,
    setLoading,
    kendaliLoading,
    setKendaliLoading,

    // Actions
    fetchData,
    loadKendaliConfig,
    loadInfoStreamer,
  };
}
