/**
 * Shared props interface passed from the InputJadwalPage orchestrator
 * to every tab component.
 */
import type { CrashModalState } from "@/types/jadwal";
import type { PlatformClientOption } from "@/lib/utils/schedule-helpers";
import type { ClientRecord } from "@/types/employee";

export interface TabSharedProps {
  // Data
  streamers: any[];
  otsStaff: any[];
  clients: ClientRecord[];
  recentJadwal: any[];
  allJadwal: any[];
  platformClientOptions: PlatformClientOption[];
  kendaliConfig: any;
  infoStreamerData: any;

  // Feedback
  error: string;
  setError: (v: string) => void;
  success: string;
  setSuccess: (v: string) => void;
  loading: boolean;
  setLoading: (v: boolean) => void;
  kendaliLoading: boolean;
  setKendaliLoading: (v: boolean) => void;

  // Actions
  fetchData: () => Promise<void>;
  loadKendaliConfig: () => Promise<void>;
  loadInfoStreamer: () => Promise<void>;

  // Alert
  showAlert: (msg: string) => void;
  showConfirm: (msg: string) => Promise<boolean>;

  // Crash modal (shared between tabs)
  modalCrashData: CrashModalState;
  setModalCrashData: (v: CrashModalState) => void;
}
