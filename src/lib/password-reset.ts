import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { hashPassword, isValidEmail, normalizeEmail } from "./auth";
import { APP_DISPLAY_NAME } from "./brand";
import { getAnglerByEmail, getAnglerPasswordHash, setAnglerPasswordAndRevokeSessions } from "./db/anglers";
import { ensureDb } from "./db/index";
import { getRow, runChange } from "./db/query";
import { passwordResets } from "./db/schema";
import { sendEmail, type OutgoingEmail, type SendEmailResult } from "./email";

export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
export const RESET_PATH = "/reset-password";
export const FORGOT_PATH = "/forgot-password";
export const PRODUCTION_APP_URL = "https://fishing-catch-log-ivl7.onrender.com";

/** Same text for every request, known email or not, so the form cannot reveal accounts. */
export const FORGOT_GENERIC_MESSAGE =
  "If that email has a Tide Mark account, we sent a link to reset the password. Check your inbox and spam folder. The link works for 1 hour.";
export const FORGOT_RATE_LIMITED = "Too many reset requests. Try again in a few minutes.";
export const RESET_LINK_INVALID = "This reset link is invalid or has expired. Request a new one.";

const IP_WINDOW_MS = 15 * 60 * 1000;
const IP_MAX = 10;
const EMAIL_WINDOW_MS = 60 * 60 * 1000;
const EMAIL_MAX = 3;
const RESET_WINDOW_MS = 15 * 60 * 1000;
const RESET_MAX = 20;

type Bucket = { count: number; resetAt: number };
const ipBuckets = new Map<string, Bucket>();
const emailBuckets = new Map<string, Bucket>();
const resetBuckets = new Map<string, Bucket>();

function hit(map: Map<string, Bucket>, key: string, windowMs: number, max: number, now: number): boolean {
  const row = map.get(key);
  if (!row || row.resetAt < now) {
    map.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  row.count += 1;
  return row.count > max;
}

export function resetPasswordResetLimitsForTests() {
  ipBuckets.clear();
  emailBuckets.clear();
  resetBuckets.clear();
}

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newResetToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Origin for links in email. APP_BASE_URL wins; production falls back to the Render URL.
 * The request Host header is only trusted outside production (local dev), so a forged
 * Host cannot point a real user's reset link at another site.
 */
export function resetLinkOrigin(args: {
  requestOrigin?: string | null;
  env?: Record<string, string | undefined>;
}): string {
  const env = args.env ?? process.env;
  const configured = env.APP_BASE_URL?.trim().replace(/\/+$/, "");
  if (configured && /^https?:\/\//i.test(configured)) return configured;
  if (env.NODE_ENV === "production") return PRODUCTION_APP_URL;
  return (args.requestOrigin || "http://localhost:3000").replace(/\/+$/, "");
}

export function resetEmail(args: { to: string; link: string }): OutgoingEmail {
  return {
    to: args.to,
    subject: `Reset your ${APP_DISPLAY_NAME} password`,
    text: [
      "Hello,",
      "",
      `We received a request to reset the password for the ${APP_DISPLAY_NAME} account that uses this email address.`,
      "",
      "To choose a new password, open this link:",
      args.link,
      "",
      "The link expires in 1 hour and can be used once. Resetting your password signs you out on all devices.",
      "",
      "If you did not ask to reset your password, you can ignore this email. Your password will not change.",
      "",
      `${APP_DISPLAY_NAME}`,
    ].join("\n"),
  };
}

export type ForgotResult =
  | { ok: true; message: string; send: Promise<SendEmailResult | null> }
  | { ok: false; error: string; status: number };

/**
 * Start a reset. Always answers with FORGOT_GENERIC_MESSAGE unless rate limited.
 * `send` resolves once the email attempt finishes (or immediately when nothing is sent);
 * the route schedules it after the response so timing does not reveal accounts.
 */
export async function requestPasswordReset(args: {
  email: string;
  ip: string;
  origin: string;
  now?: number;
  sender?: (message: OutgoingEmail) => Promise<SendEmailResult>;
}): Promise<ForgotResult> {
  const now = args.now ?? Date.now();
  const email = normalizeEmail(args.email);
  if (hit(ipBuckets, args.ip, IP_WINDOW_MS, IP_MAX, now)) {
    return { ok: false, error: FORGOT_RATE_LIMITED, status: 429 };
  }
  const generic = (send: Promise<SendEmailResult | null> = Promise.resolve(null)): ForgotResult => ({
    ok: true,
    message: FORGOT_GENERIC_MESSAGE,
    send,
  });
  if (!isValidEmail(email)) return generic();
  // Per-email limit is silent: answering differently would hint that the address exists.
  if (hit(emailBuckets, email, EMAIL_WINDOW_MS, EMAIL_MAX, now)) return generic();

  const angler = await getAnglerByEmail(email);
  if (!angler?.claimed || !angler.email) return generic();

  const token = newResetToken();
  const db = await ensureDb();
  // One live link per account: a new request replaces any earlier unused link.
  await runChange(db.delete(passwordResets).where(eq(passwordResets.anglerId, angler.id)));
  await runChange(
    db.insert(passwordResets).values({
      id: crypto.randomUUID(),
      anglerId: angler.id,
      tokenHash: hashResetToken(token),
      expiresAt: new Date(now + RESET_TOKEN_TTL_MS).toISOString(),
      usedAt: null,
      createdAt: new Date(now).toISOString(),
    }),
  );
  const link = `${args.origin}${RESET_PATH}?token=${encodeURIComponent(token)}`;
  const sender = args.sender ?? ((message: OutgoingEmail) => sendEmail(message));
  const message = resetEmail({ to: angler.email, link });
  return generic(
    Promise.resolve()
      .then(() => sender(message))
      .catch((err) => {
        console.error("[password-reset] email send failed:", err instanceof Error ? err.message : err);
        return null;
      }),
  );
}

/** True while the token is unused and unexpired. Does not consume it. */
export async function resetTokenUsable(token: string, now = Date.now()): Promise<boolean> {
  if (!token || token.length > 200) return false;
  const db = await ensureDb();
  const row = await getRow(
    db
      .select()
      .from(passwordResets)
      .where(
        and(
          eq(passwordResets.tokenHash, hashResetToken(token)),
          isNull(passwordResets.usedAt),
          gt(passwordResets.expiresAt, new Date(now).toISOString()),
        ),
      ),
  );
  return Boolean(row);
}

export type ResetResult =
  | { ok: true; anglerId: string }
  | { ok: false; error: string; status: number };

/** Set a new password from an emailed token. Same rules as register (8+ chars, must match). */
export async function resetPasswordWithToken(args: {
  token: string;
  password: string;
  confirm: string;
  ip: string;
  now?: number;
}): Promise<ResetResult> {
  const now = args.now ?? Date.now();
  if (hit(resetBuckets, args.ip, RESET_WINDOW_MS, RESET_MAX, now)) {
    return { ok: false, error: "Try again in a few minutes.", status: 429 };
  }
  const token = args.token.trim();
  if (!token || token.length > 200) return { ok: false, error: RESET_LINK_INVALID, status: 400 };
  if (args.password.length < 8) return { ok: false, error: "Use at least 8 characters.", status: 400 };
  if (args.password !== args.confirm) return { ok: false, error: "Passwords do not match.", status: 400 };

  const db = await ensureDb();
  const nowIso = new Date(now).toISOString();
  const row = await getRow(
    db
      .select()
      .from(passwordResets)
      .where(
        and(
          eq(passwordResets.tokenHash, hashResetToken(token)),
          isNull(passwordResets.usedAt),
          gt(passwordResets.expiresAt, nowIso),
        ),
      ),
  );
  if (!row) return { ok: false, error: RESET_LINK_INVALID, status: 400 };
  if (!(await getAnglerPasswordHash(row.anglerId))) {
    return { ok: false, error: RESET_LINK_INVALID, status: 400 };
  }
  const hash = await hashPassword(args.password);
  // Claim the token first; only one concurrent request can flip used_at.
  const claimed = await runChange(
    db
      .update(passwordResets)
      .set({ usedAt: nowIso })
      .where(and(eq(passwordResets.id, row.id), isNull(passwordResets.usedAt))),
  );
  if (claimed < 1) return { ok: false, error: RESET_LINK_INVALID, status: 400 };
  const saved = await setAnglerPasswordAndRevokeSessions(row.anglerId, hash, nowIso);
  if (!saved) return { ok: false, error: RESET_LINK_INVALID, status: 400 };
  await runChange(db.delete(passwordResets).where(eq(passwordResets.anglerId, row.anglerId)));
  return { ok: true, anglerId: row.anglerId };
}
