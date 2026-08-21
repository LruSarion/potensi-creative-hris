# Sheet-to-HRIS Mapping

The client runs daily live-schedule planning in two Google Sheets. This document maps
each sheet's columns to the HRIS (`apps/web`) data model so the platform reproduces the
same business rules the operator applies manually.

## Sheet 1 — `ID_HYBRID_LIVE` (daily ops summary)

| Sheet column | Purpose | HRIS model/field |
|---|---|---|
| `TANGGAL` | session date | `Jadwal.tanggal` |
| `CABANG_STUDIO` | studio branch (Timoho/Berbah/Wiyoro) | `Jadwal.cabangStudio` |
| `NOMOR_STUDIO` | studio room number | `Jadwal.nomorStudio` |
| `PLATFORM` | marketplace (Shopee/TikTok/Tokopedia/Lazada) | `Jadwal.platform` |
| `JAM_MULAI_LIVE` | session start time | `Jadwal.jamMulaiLive` |
| `DURASI_JAM` | planned duration (hours) | derived `jamSelesaiLive` (see below) |
| `JAM_SELESAI_LIVE` (formula) | `MOD(start + duration/24; 1)` | `Jadwal.jamSelesaiLive` |
| `STREAMER` | host name | `Jadwal.streamerKaryawanId` (→ `Karyawan`) |
| `DEVICE` | device used | not stored (metadata) |
| `FILE_PENDUKUNG_HOST` / `CATATAN_UNTUK_HOST` | attachments / notes | `Jadwal.filePendukungHostDriveId` / `Jadwal.catatanHost` |
| `RANGKUMAN DURASI JAM` (by studio) | per-studio `SUMIF` | `analytics.scheduleRollup().byStudio` |
| `TOTAL_DURASI_HARIAN` | daily total hours | `analytics.scheduleRollup().totalHours` |
| `RANGKUMAN STREAMER` (`TOTAL_SESI`/`TOTAL_DURASI`) | per-streamer `COUNTIF`/`SUMIF` | `analytics.scheduleRollup().byStreamer` |
| `JAM_SELESAI_TERAKHIR` (formula) | latest real session end w/ overnight rollover | `schedule-rules.computeLastSessionEnd()` |
| `RANGKUMAN PLATFORM` (`TOTAL_DURASI_PLATFORM`) | per-platform `SUMIF` | `analytics.scheduleRollup().byPlatform` |
| `STATUS_LIBUR` | leave flag | `Izin` / `LiburStreamer` |

## Sheet 2 — `ID_PLOTING` (detailed plotting)

| Sheet column | HRIS model/field |
|---|---|
| `ID_JADWAL` | `Jadwal.idJadwal` |
| `TANGGAL` | `Jadwal.tanggal` |
| `PLATFORM` | `Jadwal.platform` |
| `JAM_MULAI_LIVE` / `JAM_SELESAI_LIVE` | `Jadwal.jamMulaiLive` / `Jadwal.jamSelesaiLive` |
| `DURASI` (`MOD(end-start;1)`) | derived via `schedule-rules.computeDurationMinutes()` |
| `KUOTA_HOST` | `KuotaHost` model (per-host quota) |
| `CABANG_STUDIO` / `NOMOR_STUDIO` | `Jadwal.cabangStudio` / `Jadwal.nomorStudio` |
| `STREAMER` | `Jadwal.streamerKaryawanId` |
| `DEVICE` | metadata |
| `JUDUL_LIVE` / `PROMO_LIVE` | `Jadwal.judulLive` / `Jadwal.promoLive` |
| `CATATAN_UNTUK_HOST` | `Jadwal.catatanHost` |
| `FILE_PENDUKUNG_HOST` | `Jadwal.filePendukungHostDriveId` |
| `PRODUK_PRIORITAS` | `Jadwal.produkPrioritas` |

## Business rules reproduced in code

1. **Overnight-safe duration** — `schedule-rules.computeDurationMinutes()`
   (equivalent of `MOD(end - start; 1)`), handles crossing midnight.
2. **End from start + duration** — `services/csv-import.ts` `importHybridCsv()`
   derives `jamSelesaiLive` from `jamMulaiLive + DURASI_JAM`.
3. **JAM_SELESAI_TERAKHIR / rest tracking** — `schedule-rules.computeLastSessionEnd()`
   returns the streamer's absolute latest session end (with overnight rollover);
   the configurable rest gap (`Tenant.config.restGapMinutes`, default 30) enforces
   a mandatory break between sessions.
4. **Collision prevention** — same-streamer overlap, studio room conflict, and
   rest-gap are all enforced atomically in `services/jadwal.ts` (single + batch).
5. **Studio / streamer / platform rollups** — `analytics.scheduleRollup()`
   reproduces Sheet 1's `SUMIF`/`COUNTIF` summaries.
6. **CSV import** — `POST /api/import-schedule` accepts either sheet structure
   (`format: "ploting" | "hybrid"`) and imports into `Jadwal` with full collision checks.

## Import usage

```bash
# Detailed (ID_PLOTING) structure
curl -X POST /api/import-schedule \
  -H "Content-Type: application/json" \
  -d '{"format":"ploting","csv":"ID_JADWAL,TANGGAL,..."}'

# Daily ops (ID_HYBRID_LIVE) structure
curl -X POST /api/import-schedule \
  -H "Content-Type: application/json" \
  -d '{"format":"hybrid","csv":"TANGGAL,CABANG_STUDIO,..."}'
```
