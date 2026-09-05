import { describe, expect, it } from "vitest";
import { YEARLY_PRICE_LABEL, buildEntitlement, computeSubscriptionStatus } from "./entitlement";
import {
  STOREKIT_SUBSCRIPTION_GROUP,
  STOREKIT_YEARLY_PRODUCT_ID,
  decodeStorekitJwsPayload,
  parseStorekitClaim,
  resolveStorekitActivation,
  storekitSubscriptionExpiresAt,
} from "./storekit";

function jwsWithPayload(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "ES256" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.sig`;
}

describe("StoreKit yearly product", () => {
  it("locks the App Store Connect product id and group", () => {
    expect(STOREKIT_YEARLY_PRODUCT_ID).toBe("tidemark_premium_yearly");
    expect(STOREKIT_SUBSCRIPTION_GROUP).toBe("TideMarkPremium");
    expect(YEARLY_PRICE_LABEL).toBe("$39.99/year");
  });

  it("accepts a purchase claim and defaults a missing term to one year", () => {
    const now = new Date("2026-09-05T12:00:00.000Z");
    const parsed = parseStorekitClaim(
      {
        productId: "tidemark_premium_yearly",
        transactionId: "txn-1",
        originalTransactionId: "orig-1",
        source: "purchase",
      },
      now,
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.claim.productId).toBe("tidemark_premium_yearly");
    const resolved = resolveStorekitActivation(parsed.claim, now);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.status).toBe("active");
    expect(resolved.expiresAt).toBe("2027-09-05T12:00:00.000Z");
    expect(storekitSubscriptionExpiresAt(parsed.claim, now)).toBe("2027-09-05T12:00:00.000Z");
  });

  it("honors StoreKit expiration and treats a lapsed term as expired", () => {
    const now = new Date("2026-12-01T00:00:00.000Z");
    const parsed = parseStorekitClaim(
      {
        productId: "tidemark_premium_yearly",
        transactionId: "txn-2",
        expiresAt: "2026-11-01T00:00:00.000Z",
        source: "restore",
      },
      now,
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const resolved = resolveStorekitActivation(parsed.claim, now);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.status).toBe("expired");
    expect(
      computeSubscriptionStatus({
        now,
        trialStartedAt: "2026-09-01T12:00:00.000Z",
        storedStatus: resolved.status,
        subscriptionExpiresAt: resolved.expiresAt,
      }),
    ).toBe("expired");
  });

  it("reads product id and expiry from a StoreKit 2 JWS payload", () => {
    const now = new Date("2026-09-05T12:00:00.000Z");
    const jws = jwsWithPayload({
      productId: "tidemark_premium_yearly",
      transactionId: 9001,
      originalTransactionId: 8001,
      expiresDate: Date.parse("2027-03-01T00:00:00.000Z"),
    });
    expect(decodeStorekitJwsPayload(jws)?.productId).toBe("tidemark_premium_yearly");
    const parsed = parseStorekitClaim({ jws, source: "purchase" }, now);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.claim.transactionId).toBe("9001");
    expect(parsed.claim.originalTransactionId).toBe("8001");
    expect(parsed.claim.expiresAt).toBe("2027-03-01T00:00:00.000Z");
  });

  it("rejects the wrong product and an empty body", () => {
    expect(parseStorekitClaim({ productId: "other.sku", transactionId: "1" }).ok).toBe(false);
    expect(parseStorekitClaim(null).ok).toBe(false);
    expect(parseStorekitClaim({ productId: "tidemark_premium_yearly" }).ok).toBe(false);
    const trial = buildEntitlement({
      now: new Date("2026-09-15T12:00:00.000Z"),
      trialStartedAt: "2026-09-01T12:00:00.000Z",
      storedStatus: "trial",
      durationMs: 30 * 24 * 60 * 60 * 1000,
    });
    expect(trial.subscriptionStatus).toBe("trial");
    expect(trial.purchaseAvailable).toBe(false);
  });
});
