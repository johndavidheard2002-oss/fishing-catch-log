import { generateKeyPairSync } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { activateFromPlay, getEntitlementRow } from "./db/entitlement";
import { createAngler } from "./db/anglers";
import { getDb, resetDbForTests } from "./db/index";
import {
  playSubscriptionUrl,
  readPlayServiceAccount,
  signPlayServiceAccountJwt,
  verifyPlayPurchase,
} from "./play-billing";
import {
  PLAY_PRODUCT_ID,
  entitlementFromPlaySubscription,
  parsePlayClaim,
  unverifiedPlayEntitlement,
} from "./play-plan";
import { parseStorekitClaim } from "./storekit";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const privatePem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

function activeBody(expiry = "2027-10-20T00:00:00.000Z") {
  return {
    subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
    lineItems: [
      {
        productId: PLAY_PRODUCT_ID,
        expiryTime: expiry,
        offerDetails: { basePlanId: "yearly", offerId: "free-month" },
      },
    ],
  };
}

describe("Google Play plan claim", () => {
  it("accepts the Play product and rejects it on the StoreKit parser", () => {
    const parsed = parsePlayClaim({
      productId: "tidemark_plan_yearly",
      purchaseToken: "token-1",
      orderId: "GPA.1",
      basePlanId: "yearly",
      offerId: "free-month",
      source: "purchase",
    });
    expect(parsed.ok).toBe(true);
    expect(parseStorekitClaim({ productId: "tidemark_plan_yearly", transactionId: "1" }).ok).toBe(false);
    expect(parsePlayClaim({ productId: "com.tidemark.logbook.plan.annual", purchaseToken: "t" }).ok).toBe(false);
    expect(parsePlayClaim({ productId: PLAY_PRODUCT_ID, basePlanId: "monthly", purchaseToken: "t" }).ok).toBe(false);
    expect(parsePlayClaim({ productId: PLAY_PRODUCT_ID }).ok).toBe(false);
  });

  it("maps subscriptionsv2 states", () => {
    const now = new Date("2026-10-20T00:00:00.000Z");
    expect(entitlementFromPlaySubscription(activeBody(), now).ok).toBe(true);
    const canceled = entitlementFromPlaySubscription(
      { ...activeBody("2027-01-01T00:00:00.000Z"), subscriptionState: "SUBSCRIPTION_STATE_CANCELED" },
      now,
    );
    expect(canceled.ok && canceled.entitlement.status).toBe("active");
    const lapsed = entitlementFromPlaySubscription(
      { ...activeBody("2026-01-01T00:00:00.000Z"), subscriptionState: "SUBSCRIPTION_STATE_CANCELED" },
      now,
    );
    expect(lapsed.ok && lapsed.entitlement.status).toBe("expired");
    expect(entitlementFromPlaySubscription({ ...activeBody(), subscriptionState: "SUBSCRIPTION_STATE_PAUSED" }, now).ok).toBe(
      false,
    );
    expect(
      entitlementFromPlaySubscription(
        {
          subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
          lineItems: [{ productId: "other", expiryTime: "2027-01-01T00:00:00.000Z" }],
        },
        now,
      ).ok,
    ).toBe(false);
  });

  it("trusts a device purchase for one year only when verification is off", () => {
    const now = new Date("2026-10-20T00:00:00.000Z");
    const claim = parsePlayClaim({ productId: PLAY_PRODUCT_ID, purchaseToken: "token-1", source: "purchase" });
    expect(claim.ok).toBe(true);
    if (!claim.ok) return;
    const open = unverifiedPlayEntitlement(claim.claim, now);
    expect(open.status).toBe("active");
    expect(open.expiresAt).toBe("2027-10-20T00:00:00.000Z");
    const past = unverifiedPlayEntitlement({ ...claim.claim, expiresAt: "2026-01-01T00:00:00.000Z" }, now);
    expect(past.status).toBe("expired");
  });
});

describe("Google Play verification env", () => {
  it("stays off when the service account vars are unset and does not call Google", async () => {
    expect(readPlayServiceAccount({}).configured).toBe(false);
    let called = false;
    const result = await verifyPlayPurchase(
      { productId: PLAY_PRODUCT_ID, purchaseToken: "token-1", orderId: null, basePlanId: null, offerId: null, expiresAt: null, source: "purchase" },
      {
        env: {},
        fetchImpl: async () => {
          called = true;
          throw new Error("network");
        },
      },
    );
    expect(result.configured).toBe(false);
    expect(called).toBe(false);
  });

  it("errors when only one of the split credentials is set", () => {
    const read = readPlayServiceAccount({ GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL: "play@example.iam.gserviceaccount.com" });
    expect(read.configured).toBe(true);
    expect("error" in read).toBe(true);
  });

  it("calls purchases.subscriptionsv2 with the service account token", async () => {
    const urls: string[] = [];
    const env = {
      GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: JSON.stringify({
        client_email: "play@example.iam.gserviceaccount.com",
        private_key: privatePem,
      }),
    };
    const jwt = signPlayServiceAccountJwt(
      { email: "play@example.iam.gserviceaccount.com", privateKey: privatePem, packageName: "com.tidemark.logbook" },
      Date.parse("2026-10-20T00:00:00.000Z"),
    );
    expect(jwt.split(".")).toHaveLength(3);
    const result = await verifyPlayPurchase(
      {
        productId: PLAY_PRODUCT_ID,
        purchaseToken: "tok en/1",
        orderId: "GPA.1",
        basePlanId: "yearly",
        offerId: "free-month",
        expiresAt: null,
        source: "purchase",
      },
      {
        env,
        now: new Date("2026-10-20T00:00:00.000Z"),
        fetchImpl: async (url, init) => {
          urls.push(url);
          if (url.includes("oauth2.googleapis.com")) {
            expect(String(init?.body)).toContain("grant_type=urn");
            return new Response(JSON.stringify({ access_token: "ya29.test" }), { status: 200 });
          }
          expect(init?.headers).toMatchObject({ authorization: "Bearer ya29.test" });
          return new Response(JSON.stringify(activeBody()), { status: 200 });
        },
      },
    );
    expect(result.configured && result.ok && result.entitlement.status).toBe("active");
    expect(urls[1]).toBe(playSubscriptionUrl("com.tidemark.logbook", "tok en/1"));
    expect(urls[1]).toContain("purchases/subscriptionsv2/tokens/");
    expect(urls[1]).toContain("tok%20en%2F1");
  });
});

describe("persisted Play entitlement", () => {
  const previousPath = process.env.DATABASE_PATH;
  const tmpDirs: string[] = [];

  afterEach(() => {
    resetDbForTests();
    if (previousPath === undefined) delete process.env.DATABASE_PATH;
    else process.env.DATABASE_PATH = previousPath;
    for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
    tmpDirs.length = 0;
  });

  function freshJournal() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cast-log-play-"));
    tmpDirs.push(dir);
    process.env.DATABASE_PATH = path.join(dir, "journal.sqlite");
    delete process.env.TIDEMARK_FORCE_ENTITLEMENT;
    resetDbForTests();
    getDb();
  }

  it("stores an unverified purchase when Google credentials are unset", async () => {
    freshJournal();
    const created = await createAngler("Pat");
    const result = await activateFromPlay(
      created.id,
      { productId: PLAY_PRODUCT_ID, purchaseToken: "token-db", source: "purchase" },
      new Date("2026-10-20T00:00:00.000Z"),
      async () => ({ configured: false }),
    );
    expect("entitlement" in result).toBe(true);
    if (!("entitlement" in result)) return;
    expect(result.verification).toBe("unconfigured");
    expect(result.verified).toBe(false);
    expect(result.entitlement.subscriptionStatus).toBe("active");
    const row = await getEntitlementRow(created.id);
    expect(row?.subscriptionExpiresAt).toBe("2027-10-20T00:00:00.000Z");
  });

  it("stores the verified expiry and refuses a Play error", async () => {
    freshJournal();
    const created = await createAngler("Pat");
    const ok = await activateFromPlay(
      created.id,
      { productId: PLAY_PRODUCT_ID, purchaseToken: "token-db", expiresAt: "2026-11-01T00:00:00.000Z", source: "purchase" },
      new Date("2026-10-20T00:00:00.000Z"),
      async () => ({
        configured: true,
        ok: true,
        entitlement: { status: "active", expiresAt: "2027-02-01T00:00:00.000Z" },
      }),
    );
    expect("entitlement" in ok && ok.verification).toBe("google");
    const row = await getEntitlementRow(created.id);
    expect(row?.subscriptionExpiresAt).toBe("2027-02-01T00:00:00.000Z");
    const denied = await activateFromPlay(
      created.id,
      { productId: PLAY_PRODUCT_ID, purchaseToken: "nope", source: "restore" },
      new Date("2026-10-20T00:00:00.000Z"),
      async () => ({ configured: true, ok: false, error: "Google Play could not find this subscription." }),
    );
    expect("error" in denied && denied.error).toMatch(/could not find/i);
  });
});
