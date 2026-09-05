"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import type { ScheduleFormItem } from "@/types/jadwal";
import type { ClientRecord } from "@/types/employee";
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
        fetch("/api/employees?compact=true").then((r) => r.json()),
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
  // ONLY client + platform combinations are returned. Standalone platforms without client are excluded.
  const platformClientOptions = useMemo<PlatformClientOption[]>(() => {
    const options: PlatformClientOption[] = [];
    const seen = new Set<string>();

    if (Array.isArray(clients) && clients.length > 0) {
      for (const c of clients) {
        const brand = (c.namaMerk || c.namaClient || "").trim();
        if (!brand) continue;

        const clientMps = new Set<string>();

        // 1. Direct platform field on Client
        if (c.platform && typeof c.platform === "string") {
          const raw = c.platform.trim();
          if (raw) {
            raw.split(/[,;/]+/).forEach((part: string) => {
              const trimmed = part.trim();
              if (trimmed) clientMps.add(trimmed);
            });
          }
        }

        // 2. Ketentuan entries (platform, marketplace1, marketplace2, marketplace3)
        if (Array.isArray(c.ketentuan) && c.ketentuan.length > 0) {
          for (const k of c.ketentuan) {
            if (!k) continue;
            [k.platform, k.marketplace1, k.marketplace2, k.marketplace3].forEach((m) => {
              if (m && typeof m === "string") {
                const raw = m.trim();
                if (raw) {
                  raw.split(/[,;/]+/).forEach((part: string) => {
                    const trimmed = part.trim();
                    if (trimmed) clientMps.add(trimmed);
                  });
                }
              }
            });
          }
        }

        // If client has platforms defined, use them. If none defined, default to "Shopee Live"
        const finalMps = clientMps.size > 0 ? Array.from(clientMps) : ["Shopee Live"];

        for (const mp of finalMps) {
          let label: string;
          if (brand.toLowerCase().includes(mp.toLowerCase())) {
            label = brand;
          } else {
            label = `${brand} ${mp}`;
          }

          if (!seen.has(label)) {
            seen.add(label);
            options.push({ label, value: label, clientId: c.id });
          }
        }
      }
    }

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
