import { NextResponse } from "next/server";
import { sendEmail, sendIzinNotificationEmail, sendPayrollNotificationEmail, sendQCViolationEmail } from "@/lib/services/email";
import { createNotification } from "@/lib/services/integration";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "all";
  const to = searchParams.get("to") || "admin@potensicreative.test";

  const results: any = {};

  try {
    // 1. Test In-App Notification (Bell)
    if (type === "bell" || type === "all") {
      const adminUser = await db.user.findFirst({
        where: { email: { in: [to, "admin@potensicreative.test"] } },
      });

      if (adminUser) {
        const bellResult = await createNotification({
          targetUserId: adminUser.id,
          title: "🔔 [Uji Coba Notifikasi] Pengajuan Baru Menunggu Approval",
          message: "Ini adalah notifikasi uji coba sistem HRIS Potensi Creative. Sistem berfungsi dengan baik!",
          link: "/approval",
        });
        results.bell = { success: true, message: "Notifikasi lonceng berhasil dibuat!", data: bellResult };
      } else {
        results.bell = { success: false, message: "User tidak ditemukan untuk notifikasi lonceng." };
      }
    }

    // 2. Test Email Notification (Resend / SMTP)
    if (type === "email" || type === "all") {
      const emailResult = await sendEmail({
        to,
        subject: "[HRIS Uji Coba] Notifikasi Berhasil Terhubung! 🎉",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
            <h2 style="color: #2563eb; margin-top: 0;">Uji Coba Notifikasi HRIS Berhasil! 🚀</h2>
            <p style="color: #475569; font-size: 14px; line-height: 1.6;">
              Halo, email ini dikirim untuk memverifikasi bahwa layanan email HRIS Potensi Creative (Resend / SMTP) telah terkonfigurasi dengan benar.
            </p>
            <div style="background-color: #f0fdf4; border: 1px solid #16a34a; padding: 12px; border-radius: 8px; color: #166534; font-size: 13px; font-weight: bold; text-align: center; margin: 16px 0;">
              Status: Layanan Email Aktif & Siap Digunakan
            </div>
            <p style="color: #94a3b8; font-size: 11px; margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 12px;">
              &copy; 2026 PT Potensi Creative. Sistem Informasi HRIS.
            </p>
          </div>
        `,
      });
      results.email = emailResult;
    }

    return NextResponse.json({
      success: results.email?.success ?? true,
      testedTo: to,
      environmentConfig: {
        hasResendApiKey: Boolean(process.env.RESEND_API_KEY),
        hasSmtpHost: Boolean(process.env.SMTP_HOST),
        emailFrom: process.env.EMAIL_FROM || "onboarding@resend.dev (default testing)",
      },
      results,
      instructions: {
        ifNotReceived: "Jika email belum masuk: 1) Pastikan RESEND_API_KEY sudah diisi di Vercel Environment Variables. 2) Cek folder Spam / Promosi. 3) Jika menggunakan akun Free Resend tanpa domain custom, pastikan tujuan 'to' adalah email pemilik akun Resend.",
        checkInAppBell: "Lihat ikon lonceng di pojok kanan atas Dashboard.",
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { template, to = "admin@potensicreative.test" } = body;

    let res;
    if (template === "izin") {
      res = await sendIzinNotificationEmail({
        to,
        nama: "Host Streamer Demo",
        tipe: "Izin Sakit / Cuti",
        tanggal: new Date().toLocaleDateString("id-ID"),
        status: "APPROVED",
      });
    } else if (template === "payroll") {
      res = await sendPayrollNotificationEmail({
        to,
        nama: "Host Streamer Demo",
        periode: "Agustus 2026",
        totalGajiFormatted: "Rp 4.750.000",
      });
    } else if (template === "qc") {
      res = await sendQCViolationEmail({
        to,
        nama: "Host Streamer Demo",
        jenisPelanggaran: "Token Jeda Kurang dari 30 Menit",
        poinPenalti: 5,
        catatan: "Sesi live kedua dimulai hanya 15 menit setelah sesi pertama.",
        tanggal: new Date().toLocaleDateString("id-ID"),
      });
    } else {
      res = await sendEmail({
        to,
        subject: body.subject || "[HRIS] Test Notification",
        html: body.html || "<p>Uji coba notifikasi kustom.</p>",
      });
    }

    return NextResponse.json({ success: true, result: res });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
