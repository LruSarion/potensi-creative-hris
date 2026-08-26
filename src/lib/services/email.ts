import { Resend } from "resend";
import nodemailer from "nodemailer";

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

// Resend Singleton Client
const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

// SMTP Transporter Singleton
const smtpHost = process.env.SMTP_HOST;
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const smtpPort = Number(process.env.SMTP_PORT || 587);

const smtpTransporter =
  smtpHost && smtpUser && smtpPass
    ? nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      })
    : null;

const DEFAULT_FROM = process.env.EMAIL_FROM || "HRIS Potensi Creative <onboarding@resend.dev>";

/**
 * Universal Email Sender Service.
 * Supports Resend API, Nodemailer (SMTP), and Dev Mode Console Fallback.
 */
export async function sendEmail(options: SendEmailOptions): Promise<{ success: boolean; id?: string; provider?: string; message?: string; error?: string }> {
  const recipients = Array.isArray(options.to) ? options.to.join(", ") : options.to;

  try {
    // 1. Try Resend API if configured
    if (resend) {
      let fromAddress = DEFAULT_FROM;
      let res = await resend.emails.send({
        from: fromAddress,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      // If custom domain is not verified yet, fallback to Resend testing sender onboarding@resend.dev
      if (res.error && fromAddress !== "onboarding@resend.dev" && (res.error.message.toLowerCase().includes("domain") || res.error.message.toLowerCase().includes("verify"))) {
        console.warn(`[Email Service (Resend)] Retrying with onboarding@resend.dev due to: ${res.error.message}`);
        fromAddress = "HRIS Notification <onboarding@resend.dev>";
        res = await resend.emails.send({
          from: fromAddress,
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text,
        });
      }

      if (res.error) {
        throw new Error(res.error.message);
      }

      console.log(`[Email Service (Resend)] Sent to ${recipients} (ID: ${res.data?.id})`);
      return { success: true, id: res.data?.id, provider: "Resend API" };
    }

    // 2. Try Nodemailer (SMTP) if configured
    if (smtpTransporter) {
      const info = await smtpTransporter.sendMail({
        from: DEFAULT_FROM,
        to: recipients,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      console.log(`[Email Service (SMTP)] Sent to ${recipients} (MessageId: ${info.messageId})`);
      return { success: true, id: info.messageId, provider: "SMTP Transporter" };
    }

    // 3. Fallback for Dev Mode / Demo (logs cleanly)
    console.log(`\n================= [EMAIL DEV PREVIEW] =================`);
    console.log(`TO: ${recipients}`);
    console.log(`SUBJECT: ${options.subject}`);
    console.log(`HTML BODY LENGTH: ${options.html.length} chars`);
    console.log(`========================================================\n`);

    return {
      success: false,
      provider: "Console Log Only (Not Sent)",
      message: "RESEND_API_KEY atau SMTP belum dikonfigurasi di Environment Variables. Email hanya dicetak di log server.",
    };
  } catch (error: any) {
    console.error("[Email Service Error] Failed to send email:", error);
    return { success: false, error: error.message || "Failed to send email" };
  }
}

/* ============================================================================
   EMAIL TEMPLATES & PRE-BUILT NOTIFICATION HELPERS
   ============================================================================ */

const EMAIL_HEADER = `
  <div style="background-color: #2563eb; padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
    <h1 style="color: #ffffff; margin: 0; font-family: 'Segoe UI', Arial, sans-serif; font-size: 22px; font-weight: bold;">
      Potensi Creative HRIS
    </h1>
    <p style="color: #dbeafe; margin: 4px 0 0 0; font-size: 13px; font-family: Arial, sans-serif;">
      Human Resource Information System
    </p>
  </div>
`;

const EMAIL_FOOTER = `
  <div style="background-color: #f8fafc; padding: 16px; text-align: center; border-top: 1px solid #e2e8f0; border-radius: 0 0 12px 12px; margin-top: 24px;">
    <p style="color: #94a3b8; font-size: 12px; font-family: Arial, sans-serif; margin: 0;">
      &copy; 2026 PT Potensi Creative. Email ini dikirim otomatis oleh sistem HRIS.
    </p>
  </div>
`;

/**
 * Send Izin / Cut / Off Request Status Notification Email
 */
export async function sendIzinNotificationEmail(params: {
  to: string;
  nama: string;
  tipe: string;
  tanggal: string;
  status: "APPROVED" | "REJECTED";
  alasanPenolakan?: string;
}) {
  const isApproved = params.status === "APPROVED";
  const badgeColor = isApproved ? "#16a34a" : "#dc2626";
  const badgeBg = isApproved ? "#f0fdf4" : "#fef2f2";
  const statusText = isApproved ? "DISETUJUI (APPROVED)" : "DITOLAK (REJECTED)";

  const html = `
    <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      ${EMAIL_HEADER}
      <div style="padding: 28px;">
        <h2 style="color: #1e293b; font-size: 18px; margin-top: 0;">Halo, ${params.nama} 👋</h2>
        <p style="color: #475569; font-size: 14px; line-height: 1.6;">
          Pengajuan <strong>${params.tipe}</strong> Anda telah diproses oleh Manajemen:
        </p>

        <div style="background: ${badgeBg}; border: 1px solid ${badgeColor}; padding: 16px; border-radius: 10px; margin: 20px 0; text-align: center;">
          <span style="color: ${badgeColor}; font-weight: bold; font-size: 16px;">
            Status: ${statusText}
          </span>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #334155; margin-bottom: 20px;">
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; color: #64748b;">Jenis Pengajuan:</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-weight: 600; text-align: right;">${params.tipe}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; color: #64748b;">Tanggal:</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-weight: 600; text-align: right;">${params.tanggal}</td>
          </tr>
          ${
            params.alasanPenolakan
              ? `<tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; color: #dc2626;">Catatan Penolakan:</td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-weight: 600; text-align: right; color: #dc2626;">${params.alasanPenolakan}</td>
                </tr>`
              : ""
          }
        </table>

        <div style="text-align: center; margin-top: 28px;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/pengajuan-izin" style="background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">
            Buka HRIS Dashboard
          </a>
        </div>
      </div>
      ${EMAIL_FOOTER}
    </div>
  `;

  return sendEmail({
    to: params.to,
    subject: `[HRIS] Status Pengajuan ${params.tipe}: ${statusText}`,
    html,
  });
}

/**
 * Send Payroll & Slip Gaji Notification Email
 */
export async function sendPayrollNotificationEmail(params: {
  to: string;
  nama: string;
  periode: string;
  totalGajiFormatted: string;
  detailLink?: string;
}) {
  const html = `
    <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      ${EMAIL_HEADER}
      <div style="padding: 28px;">
        <h2 style="color: #1e293b; font-size: 18px; margin-top: 0;">Halo, ${params.nama} 💰</h2>
        <p style="color: #475569; font-size: 14px; line-height: 1.6;">
          Slip Gaji & Insentif Anda untuk periode <strong>${params.periode}</strong> telah diterbitkan:
        </p>

        <div style="background: #f0fdf4; border: 1px solid #16a34a; padding: 20px; border-radius: 10px; margin: 20px 0; text-align: center;">
          <div style="color: #15803d; font-size: 13px; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">Total Gaji & Insentif</div>
          <div style="color: #166534; font-size: 24px; font-weight: bold; margin-top: 6px;">${params.totalGajiFormatted}</div>
        </div>

        <p style="color: #64748b; font-size: 13px; line-height: 1.5;">
          Rincian jam live, tiering rate, bonus insentif omset, dan potongan dapat dilihat secara lengkap melalui dashboard HRIS.
        </p>

        <div style="text-align: center; margin-top: 28px;">
          <a href="${params.detailLink || `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/payroll`}" style="background-color: #16a34a; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">
            Lihat Detail Slip Gaji
          </a>
        </div>
      </div>
      ${EMAIL_FOOTER}
    </div>
  `;

  return sendEmail({
    to: params.to,
    subject: `[HRIS] Slip Gaji & Insentif Periode ${params.periode} - ${params.nama}`,
    html,
  });
}

/**
 * Send QC Violation & Audit Notification Email
 */
export async function sendQCViolationEmail(params: {
  to: string;
  nama: string;
  jenisPelanggaran: string;
  poinPenalti: number;
  catatan: string;
  tanggal: string;
}) {
  const html = `
    <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      ${EMAIL_HEADER}
      <div style="padding: 28px;">
        <h2 style="color: #1e293b; font-size: 18px; margin-top: 0;">Pemberitahuan Audit QC ⚠️</h2>
        <p style="color: #475569; font-size: 14px; line-height: 1.6;">
          Halo ${params.nama}, tim Quality Control telah mencatat evaluasi siaran live Anda pada <strong>${params.tanggal}</strong>:
        </p>

        <div style="background: #fff7ed; border: 1px solid #ea580c; padding: 16px; border-radius: 10px; margin: 20px 0;">
          <div style="color: #c2410c; font-weight: bold; font-size: 15px;">Pelanggaran: ${params.jenisPelanggaran}</div>
          <div style="color: #9a3412; font-size: 13px; margin-top: 6px;">Poin Penalti: <strong>-${params.poinPenalti} Poin</strong></div>
          <div style="color: #475569; font-size: 13px; margin-top: 10px; font-style: italic; background: #ffffff; padding: 10px; border-radius: 6px; border: 1px border-slate-200;">
            "${params.catatan}"
          </div>
        </div>

        <div style="text-align: center; margin-top: 28px;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/qc-violations" style="background-color: #ea580c; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">
            Buka Laporan QC
          </a>
        </div>
      </div>
      ${EMAIL_FOOTER}
    </div>
  `;

  return sendEmail({
    to: params.to,
    subject: `[HRIS Audit QC] Evaluasi & Catatan Siaran Live - ${params.nama}`,
    html,
  });
}
