/** Transactional email through the Resend HTTP API. Only password reset uses this today. */

export const RESEND_API_URL = "https://api.resend.com/emails";
export const DEFAULT_RESEND_FROM = "Tide Mark <no-reply@southtexascharters.com>";

export type OutgoingEmail = {
  to: string;
  subject: string;
  text: string;
};

export type SendEmailResult =
  | { ok: true; id: string | null }
  | { ok: false; reason: "not-configured" | "rejected" | "network"; detail?: string };

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

/**
 * Send one plain-text email. Never throws: a missing key or a Resend error is logged
 * and returned so callers can keep their response unchanged.
 */
export async function sendEmail(
  message: OutgoingEmail,
  opts: { env?: Record<string, string | undefined>; fetchImpl?: FetchLike } = {},
): Promise<SendEmailResult> {
  const env = opts.env ?? process.env;
  const apiKey = env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY is not set; email not sent:", message.subject);
    return { ok: false, reason: "not-configured" };
  }
  const from = env.RESEND_FROM?.trim() || DEFAULT_RESEND_FROM;
  const fetchImpl = opts.fetchImpl ?? fetch;
  try {
    const res = await fetchImpl(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
      }),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 300);
      console.error(`[email] Resend rejected the email (${res.status}):`, detail);
      return { ok: false, reason: "rejected", detail };
    }
    const data = (await res.json().catch(() => ({}))) as { id?: unknown };
    return { ok: true, id: typeof data.id === "string" ? data.id : null };
  } catch (err) {
    console.error("[email] Could not reach Resend:", err instanceof Error ? err.message : err);
    return { ok: false, reason: "network" };
  }
}
