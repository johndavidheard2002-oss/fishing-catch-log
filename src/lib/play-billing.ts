import { createSign } from "node:crypto";
import {
  PLAY_APPLICATION_ID,
  entitlementFromPlaySubscription,
  type PlayClaim,
  type PlayEntitlement,
} from "./play-plan";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const PUBLISHER_SCOPE = "https://www.googleapis.com/auth/androidpublisher";

export type PlayServiceAccount = {
  email: string;
  privateKey: string;
  packageName: string;
};

export type PlayVerification =
  | { configured: false }
  | { configured: true; ok: true; entitlement: PlayEntitlement }
  | { configured: true; ok: false; error: string };

type EnvLike = Record<string, string | undefined>;

function asText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizePrivateKey(value: string): string {
  return value.includes("\\n") ? value.replace(/\\n/g, "\n") : value;
}

function accountFromJson(raw: string, packageName: string): PlayServiceAccount | { error: string } {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const email = asText(parsed.client_email);
    const privateKey = asText(parsed.private_key);
    if (!email || !privateKey) {
      return { error: "Google Play service account JSON is missing client_email or private_key." };
    }
    return { email, privateKey: normalizePrivateKey(privateKey), packageName };
  } catch {
    return { error: "Google Play service account JSON could not be read." };
  }
}

/**
 * Credentials are optional. Missing vars mean verification is off.
 * A partial setup is an error so a half-configured host does not skip the check.
 */
export function readPlayServiceAccount(
  env: EnvLike = process.env,
): { configured: false } | { configured: true; account: PlayServiceAccount } | { configured: true; error: string } {
  const packageName = asText(env.GOOGLE_PLAY_PACKAGE_NAME) ?? PLAY_APPLICATION_ID;
  const json = asText(env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON);
  const email = asText(env.GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL);
  const privateKey = asText(env.GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY);

  if (json) {
    const account = accountFromJson(json, packageName);
    if ("error" in account) return { configured: true, error: account.error };
    return { configured: true, account };
  }
  if (!email && !privateKey) return { configured: false };
  if (!email || !privateKey) {
    return {
      configured: true,
      error: "Set both GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL and GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY.",
    };
  }
  return {
    configured: true,
    account: { email, privateKey: normalizePrivateKey(privateKey), packageName },
  };
}

export function playBillingConfigured(env: EnvLike = process.env): boolean {
  const read = readPlayServiceAccount(env);
  return read.configured === true && "account" in read;
}

function base64url(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

export function signPlayServiceAccountJwt(account: PlayServiceAccount, nowMs = Date.now()): string {
  const now = Math.floor(nowMs / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      iss: account.email,
      scope: PUBLISHER_SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );
  const unsigned = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  return `${unsigned}.${signer.sign(account.privateKey).toString("base64url")}`;
}

export function playSubscriptionUrl(packageName: string, purchaseToken: string): string {
  return `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * Verify a subscription with purchases.subscriptionsv2.
 * When the service account env vars are unset, returns configured: false and does not call Google.
 */
export async function verifyPlayPurchase(
  claim: PlayClaim,
  options: { env?: EnvLike; fetchImpl?: FetchLike; now?: Date } = {},
): Promise<PlayVerification> {
  const env = options.env ?? process.env;
  const read = readPlayServiceAccount(env);
  if (!read.configured) return { configured: false };
  if ("error" in read) return { configured: true, ok: false, error: read.error };

  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? new Date();
  let accessToken = "";
  try {
    const assertion = signPlayServiceAccountJwt(read.account, now.getTime());
    const tokenResponse = await fetchImpl(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    });
    const tokenBody = (await tokenResponse.json().catch(() => null)) as { access_token?: unknown } | null;
    accessToken = typeof tokenBody?.access_token === "string" ? tokenBody.access_token : "";
    if (!tokenResponse.ok || !accessToken) {
      return { configured: true, ok: false, error: "Google Play credentials were rejected." };
    }
  } catch {
    return { configured: true, ok: false, error: "Could not reach Google Play to verify this subscription." };
  }

  try {
    const subscriptionResponse = await fetchImpl(playSubscriptionUrl(read.account.packageName, claim.purchaseToken), {
      method: "GET",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const subscription = await subscriptionResponse.json().catch(() => null);
    if (subscriptionResponse.status === 404) {
      return { configured: true, ok: false, error: "Google Play could not find this subscription." };
    }
    if (!subscriptionResponse.ok) {
      return { configured: true, ok: false, error: "Google Play could not verify this subscription." };
    }
    const entitlement = entitlementFromPlaySubscription(subscription, now);
    if (!entitlement.ok) return { configured: true, ok: false, error: entitlement.error };
    return { configured: true, ok: true, entitlement: entitlement.entitlement };
  } catch {
    return { configured: true, ok: false, error: "Could not reach Google Play to verify this subscription." };
  }
}
