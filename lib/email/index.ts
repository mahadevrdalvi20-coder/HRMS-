import "server-only";
import { Resend } from "resend";

/**
 * Send an email through Resend (free tier). Without RESEND_API_KEY the mail is
 * written to the server log so every flow still works in development.
 * Email failures never block the HR action that triggered them.
 */
export async function sendEmail(to: string | null | undefined, subject: string, text: string): Promise<void> {
  if (!to) return;
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "Lehar HRMS <onboarding@resend.dev>";
  if (!key) {
    console.log(`[email:dev] to=${to} subject=${subject}\n${text}`);
    return;
  }
  try {
    const { error } = await new Resend(key).emails.send({ from, to, subject, text });
    if (error) console.error("[email] send failed", error);
  } catch (e) {
    console.error("[email] send failed", e);
  }
}

export function appUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  return `${base.replace(/\/$/, "")}${path}`;
}
