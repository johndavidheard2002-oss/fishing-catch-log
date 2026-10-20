import { createHmac, timingSafeEqual } from "node:crypto";

const SESSION_MAX_AGE = 60 * 60 * 24 * 365;

export function sessionSecret(): string {
  return (
    process.env.SESSION_SECRET?.trim() ||
    process.env.TURSO_AUTH_TOKEN?.trim() ||
    "cast-log-dev-session"
  );
}

export function signSession(anglerId: string): string {
  const exp = String(Math.floor(Date.now() / 1000) + SESSION_MAX_AGE);
  const payload = `${anglerId}.${exp}`;
  const sig = createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function readSession(token?: string | null): string | null {
  return readSessionDetail(token)?.anglerId ?? null;
}

/**
 * Verified session id plus the second it was issued. Tokens carry only the expiry,
 * so issue time is exp minus the fixed session lifetime.
 */
export function readSessionDetail(
  token?: string | null,
): { anglerId: string; issuedAtSec: number } | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [id, exp, sig] = parts;
  if (!id || !exp || !sig) return null;
  if (Number(exp) * 1000 < Date.now()) return null;
  const expected = createHmac("sha256", sessionSecret()).update(`${id}.${exp}`).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return { anglerId: id, issuedAtSec: Number(exp) - SESSION_MAX_AGE };
}

/** False when the angler revoked older sessions (password reset) after this token was issued. */
export function sessionStillValid(issuedAtSec: number, sessionsValidAfter: string | null | undefined): boolean {
  if (!sessionsValidAfter) return true;
  const cutoffMs = Date.parse(sessionsValidAfter);
  if (!Number.isFinite(cutoffMs)) return true;
  // Same-second tokens stay valid so the sign-in that follows a reset keeps working.
  return issuedAtSec >= Math.floor(cutoffMs / 1000);
}

export const SESSION_COOKIE_OPTS = {
  path: "/",
  maxAge: SESSION_MAX_AGE,
  sameSite: "lax" as const,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
};
