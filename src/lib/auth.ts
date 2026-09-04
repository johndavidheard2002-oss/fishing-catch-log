import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import {
  createAngler,
  getAnglerByEmail,
  getAnglerPasswordHash,
  setAnglerCredentials,
  type AnglerRecord,
} from "./db/anglers";
import { ensureTrialStarted } from "./db/entitlement";
import { SESSION_COOKIE } from "./viewer-cookie";
import { SESSION_COOKIE_OPTS, readSession, sessionSecret, signSession } from "./session-token";

const scrypt = promisify(scryptCb);
const KEYLEN = 64;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 8;

export { SESSION_COOKIE };
export { AUTH_PRIVACY_LINE } from "./privacy";
export { SESSION_COOKIE_OPTS, readSession, sessionSecret, signSession };
export const AUTH_WRONG = "Email or password is wrong.";

const loginAttempts = new Map<string, { count: number; resetAt: number }>();

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidEmail(raw: string): boolean {
  const email = normalizeEmail(raw);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = (await scrypt(password, salt, KEYLEN)) as Buffer;
  return `scrypt$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltB64, hashB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  try {
    const salt = Buffer.from(saltB64, "base64url");
    const expected = Buffer.from(hashB64, "base64url");
    const key = (await scrypt(password, salt, expected.length)) as Buffer;
    if (key.length !== expected.length) return false;
    return timingSafeEqual(key, expected);
  } catch {
    return false;
  }
}

function loginKey(ip: string, email: string): string {
  return `${ip}|${normalizeEmail(email)}`;
}

export function loginRateLimited(ip: string, email: string): boolean {
  const key = loginKey(ip, email);
  const now = Date.now();
  const row = loginAttempts.get(key);
  if (!row || row.resetAt < now) {
    loginAttempts.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return false;
  }
  row.count += 1;
  return row.count > LOGIN_MAX_ATTEMPTS;
}

export function clearLoginAttempts(ip: string, email: string) {
  loginAttempts.delete(loginKey(ip, email));
}

export type AuthResult =
  | { ok: true; angler: AnglerRecord }
  | { ok: false; error: string; status: number };

export async function registerJournal(args: {
  name: string;
  email: string;
  password: string;
  confirm: string;
}): Promise<AuthResult> {
  const email = normalizeEmail(args.email);
  if (!isValidEmail(email)) return { ok: false, error: "Enter a valid email.", status: 400 };
  if (args.password.length < 8) return { ok: false, error: "Use at least 8 characters.", status: 400 };
  if (args.password !== args.confirm) return { ok: false, error: "Passwords do not match.", status: 400 };
  if (await getAnglerByEmail(email)) {
    return { ok: false, error: "That email already has a journal. Sign in.", status: 409 };
  }
  const hash = await hashPassword(args.password);
  const created = await createAngler(args.name.trim() || "You");
  const saved = await setAnglerCredentials(created.id, {
    name: args.name.trim() || "You",
    email,
    passwordHash: hash,
  });
  if (!saved) return { ok: false, error: "Could not save this journal.", status: 500 };
  await ensureTrialStarted(saved.id);
  return { ok: true, angler: saved };
}

export async function loginJournal(args: {
  email: string;
  password: string;
  ip: string;
}): Promise<AuthResult> {
  const email = normalizeEmail(args.email);
  if (loginRateLimited(args.ip, email)) {
    return { ok: false, error: "Try again in a few minutes.", status: 429 };
  }
  const angler = await getAnglerByEmail(email);
  const hash = angler ? await getAnglerPasswordHash(angler.id) : null;
  const dummy = "scrypt$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
  const matches = await verifyPassword(args.password, hash || dummy);
  if (!angler || !hash || !matches) {
    return { ok: false, error: AUTH_WRONG, status: 401 };
  }
  clearLoginAttempts(args.ip, email);
  await ensureTrialStarted(angler.id);
  return { ok: true, angler };
}

export function requestIp(request: { headers: Headers }): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "local";
  return request.headers.get("x-real-ip")?.trim() || "local";
}

export function publicAngler(angler: AnglerRecord): AnglerRecord {
  return {
    id: angler.id,
    name: angler.name,
    inviteCode: angler.inviteCode,
    createdAt: angler.createdAt,
    email: angler.email,
    claimed: angler.claimed,
  };
}
