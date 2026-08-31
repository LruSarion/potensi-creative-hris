/**
 * Shared type definitions for employee-related entities.
 */

/** Minimal employee record used in dropdowns and lists. */
export interface EmployeeBasic {
  id: string;
  idKaryawan: string;
  namaLengkap: string;
  jabatan?: string;
  statusAktif?: string;
  cabang?: string;
  telegramChatId?: string;
}

/** A streamer (Host) is an employee with streamer-specific role. */
export type Streamer = EmployeeBasic;

/** An OTS staff member. */
export type OtsStaff = EmployeeBasic;

/** Client / brand record. */
export interface ClientRecord {
  id: string;
  namaClient: string;
  namaMerk?: string;
  platform?: string;
  ketentuan?: Array<{
    marketplace1?: string;
    marketplace2?: string;
    marketplace3?: string;
    [key: string]: any;
  }>;
  [key: string]: any;
}
