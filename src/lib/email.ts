/** Transactional email through Gmail SMTP (nodemailer). Only password reset uses this today. */

import nodemailer from "nodemailer";

export const GMAIL_SMTP_HOST = "smtp.gmail.com";
export const GMAIL_SMTP_PORT = 465;

export type OutgoingEmail = {
  to: string;
  subject: string;
  text: string;
};

export type SendEmailResult =
  | { ok: true; id: string | null }
  | { ok: false; reason: "not-configured" | "rejected" | "network"; detail?: string };

export type MailTransport = {
  sendMail(mail: { from: string; to: string; subject: string; text: string }): Promise<{
    messageId?: string;
    rejected?: unknown[];
  }>;
};

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  auth: { user: string; pass: string };
};

type CreateTransport = (config: SmtpConfig) => MailTransport;

const defaultCreateTransport: CreateTransport = (config) => nodemailer.createTransport(config);

/** Network-level failures (could not reach or talk to smtp.gmail.com). */
const NETWORK_CODES = new Set(["ECONNECTION", "ETIMEDOUT", "ESOCKET", "EDNS", "ECONNREFUSED", "ENOTFOUND"]);

/**
 * Send one plain-text email through Gmail SMTP. Never throws: missing config or an SMTP
 * error is logged and returned so callers can keep their response unchanged.
 * Needs GMAIL_USER and GMAIL_APP_PASSWORD. From is `Tide Mark <GMAIL_USER>` unless MAIL_FROM is set.
 */
export async function sendEmail(
  message: OutgoingEmail,
  opts: { env?: Record<string, string | undefined>; createTransport?: CreateTransport } = {},
): Promise<SendEmailResult> {
  const env = opts.env ?? process.env;
  const user = env.GMAIL_USER?.trim();
  const pass = env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");
  const missing = [!user && "GMAIL_USER", !pass && "GMAIL_APP_PASSWORD"].filter(Boolean);
  if (!user || !pass) {
    console.error(
      `[email] ${missing.join(" and ")} ${missing.length > 1 ? "are" : "is"} not set; email not sent:`,
      message.subject,
    );
    return { ok: false, reason: "not-configured" };
  }
  const from = env.MAIL_FROM?.trim() || `Tide Mark <${user}>`;
  const createTransport = opts.createTransport ?? defaultCreateTransport;
  try {
    const transport = createTransport({
      host: GMAIL_SMTP_HOST,
      port: GMAIL_SMTP_PORT,
      secure: true,
      auth: { user, pass },
    });
    const info = await transport.sendMail({
      from,
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
    if (Array.isArray(info.rejected) && info.rejected.length > 0) {
      console.error("[email] Gmail rejected the recipient.");
      return { ok: false, reason: "rejected", detail: "recipient rejected" };
    }
    return { ok: true, id: typeof info.messageId === "string" ? info.messageId : null };
  } catch (err) {
    const code = (err as { code?: unknown } | null)?.code;
    const detail = (err instanceof Error ? err.message : String(err)).slice(0, 300);
    if (typeof code === "string" && NETWORK_CODES.has(code)) {
      console.error("[email] Could not reach Gmail SMTP:", detail);
      return { ok: false, reason: "network", detail };
    }
    console.error("[email] Gmail SMTP refused the email:", detail);
    return { ok: false, reason: "rejected", detail };
  }
}
