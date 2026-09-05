import { addMs, DAY_MS, isSubscriptionStatus, type SubscriptionStatus } from "./entitlement";
import { APP_STORE_PRODUCT_YEARLY, APP_STORE_SUBSCRIPTION_GROUP } from "./native-app";

export const STOREKIT_YEARLY_PRODUCT_ID = APP_STORE_PRODUCT_YEARLY;
export const STOREKIT_SUBSCRIPTION_GROUP = APP_STORE_SUBSCRIPTION_GROUP;
export const STOREKIT_YEAR_MS = 365 * DAY_MS;

export const STOREKIT_SOURCES = ["purchase", "restore"] as const;
export type StorekitSource = (typeof STOREKIT_SOURCES)[number];

export type StorekitClaim = {
  productId: typeof STOREKIT_YEARLY_PRODUCT_ID;
  transactionId: string;
  originalTransactionId: string | null;
  expiresAt: string | null;
  source: StorekitSource;
};

export type StorekitActivateResult =
  | { ok: true; status: Extract<SubscriptionStatus, "active" | "expired">; expiresAt: string | null; claim: StorekitClaim }
  | { ok: false; error: string };

export function isStorekitYearlyProductId(value: unknown): value is typeof STOREKIT_YEARLY_PRODUCT_ID {
  return value === STOREKIT_YEARLY_PRODUCT_ID;
}

export function isStorekitSource(value: unknown): value is StorekitSource {
  return typeof value === "string" && (STOREKIT_SOURCES as readonly string[]).includes(value);
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asIsoDate(value: unknown, now: Date): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value < 1e12 ? value * 1000 : value;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) {
    const raw = Number(trimmed);
    const ms = raw < 1e12 ? raw * 1000 : raw;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  if (date.getTime() < now.getTime() - 50 * 365 * DAY_MS) return null;
  return date.toISOString();
}

/** Decode the payload of a StoreKit 2 JWS without verifying the signature. */
export function decodeStorekitJwsPayload(jws: string): Record<string, unknown> | null {
  const parts = jws.trim().split(".");
  if (parts.length !== 3) return null;
  try {
    const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
    const json = Buffer.from(padded + pad, "base64").toString("utf8");
    const parsed = JSON.parse(json) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function parseStorekitClaim(
  body: unknown,
  now = new Date(),
): { ok: true; claim: StorekitClaim } | { ok: false; error: string } {
  const raw = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  if (!raw) return { ok: false, error: "StoreKit claim is required." };

  const jws = asNonEmptyString(raw.jws) ?? asNonEmptyString(raw.signedTransaction);
  const fromJws = jws ? decodeStorekitJwsPayload(jws) : null;
  const productId = raw.productId ?? fromJws?.productId;
  if (!isStorekitYearlyProductId(productId)) {
    return { ok: false, error: `productId must be ${STOREKIT_YEARLY_PRODUCT_ID}.` };
  }

  const source = raw.source ?? "purchase";
  if (!isStorekitSource(source)) {
    return { ok: false, error: "source must be purchase or restore." };
  }

  const transactionId =
    asNonEmptyString(raw.transactionId) ??
    asNonEmptyString(fromJws?.transactionId) ??
    (typeof fromJws?.transactionId === "number" ? String(fromJws.transactionId) : null);
  if (!transactionId) {
    return { ok: false, error: "transactionId is required." };
  }

  const originalTransactionId =
    asNonEmptyString(raw.originalTransactionId) ??
    asNonEmptyString(fromJws?.originalTransactionId) ??
    (typeof fromJws?.originalTransactionId === "number" ? String(fromJws.originalTransactionId) : null);

  const expiresAt = asIsoDate(raw.expiresAt ?? raw.expiresDate ?? fromJws?.expiresDate, now);

  return {
    ok: true,
    claim: {
      productId,
      transactionId,
      originalTransactionId,
      expiresAt,
      source,
    },
  };
}

export function storekitSubscriptionExpiresAt(claim: StorekitClaim, now = new Date()): string {
  if (claim.expiresAt) return claim.expiresAt;
  return addMs(now.toISOString(), STOREKIT_YEAR_MS);
}

export function resolveStorekitActivation(claim: StorekitClaim, now = new Date()): StorekitActivateResult {
  if (!isStorekitYearlyProductId(claim.productId)) {
    return { ok: false, error: `productId must be ${STOREKIT_YEARLY_PRODUCT_ID}.` };
  }
  const expiresAt = storekitSubscriptionExpiresAt(claim, now);
  const expired = new Date(expiresAt).getTime() <= now.getTime();
  const status = expired ? "expired" : "active";
  if (!isSubscriptionStatus(status)) {
    return { ok: false, error: "Could not resolve StoreKit entitlement." };
  }
  return { ok: true, status, expiresAt, claim };
}

