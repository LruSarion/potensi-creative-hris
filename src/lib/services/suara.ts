import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-helpers";

const suaraSchema = z.object({
  kategori: z.string().optional().nullable(),
  pesan: z.string().min(1),
  lampiranDriveId: z.string().optional().nullable(),
});

export type SuaraInput = z.infer<typeof suaraSchema>;

/**
 * Submit feedback. Stores the submitter's userId so each user can see
 * their own riwayat; the list endpoint never exposes identity to others.
 */
export async function submitSuara(input: SuaraInput) {
  const user = await requireRole();
  const parsed = suaraSchema.parse(input);
  return db.logAktivitas.create({
    data: {
      aksi: "SUARA_KARYAWAN",
      userId: user.id,
      detail: JSON.stringify({
        kategori: parsed.kategori ?? null,
        pesan: parsed.pesan,
        lampiranDriveId: parsed.lampiranDriveId ?? null,
      }),
    },
  });
}

/**
 * List feedback. SUPER_ADMIN sees all submissions; every other role sees
 * only their own. Returned rows contain content only — no submitter identity.
 * (Entries created before userId tracking have userId = null and are visible
 * to SUPER_ADMIN only.)
 */
export async function listSuara() {
  const user = await requireRole();
  const rows = await db.logAktivitas.findMany({
    where: {
      aksi: "SUARA_KARYAWAN",
      ...(user.role === "SUPER_ADMIN" ? {} : { userId: user.id }),
    },
    orderBy: { createdAt: "desc" },
  });
  return rows
    .map((r) => {
      try {
        const d = JSON.parse(r.detail ?? "{}");
        return {
          id: r.id,
          createdAt: r.createdAt,
          kategori: d.kategori ?? null,
          pesan: d.pesan ?? "",
          lampiranDriveId: d.lampiranDriveId ?? null,
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}
