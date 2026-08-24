import { db } from "@/lib/db";

export type InAppNotificationInput = {
  karyawanId: string;
  judul: string;
  pesan: string;
  kategori?: "JADWAL" | "ABSENSI" | "APPROVAL" | "CONTRACT" | "INCIDENT" | "SYSTEM";
  linkUrl?: string;
};

/**
 * Log an in-app website notification to LogAktivitas
 */
export async function sendInAppNotification(input: InAppNotificationInput) {
  try {
    return await db.logAktivitas.create({
      data: {
        userId: input.karyawanId,
        aksi: input.kategori ?? "NOTIFICATION",
        detail: `${input.judul}: ${input.pesan}`,
      },
    });
  } catch (error) {
    console.error("Gagal menyimpan in-app notification:", error);
  }
}

export type EmailNotificationInput = {
  toEmail: string;
  subject: string;
  bodyHtml: string;
};

/**
 * Dispatch an email notification (mock/SMTP/Resend wrapper)
 */
export async function sendEmailNotification(input: EmailNotificationInput) {
  console.log(`[Email Dispatcher] Target: ${input.toEmail} | Subject: ${input.subject}`);
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Potensi HRIS <noreply@potensicreative.com>",
          to: [input.toEmail],
          subject: input.subject,
          html: input.bodyHtml,
        }),
      });
      return response.ok;
    } catch (err) {
      console.error("Gagal mengirim email via Resend:", err);
    }
  }
  return true;
}
