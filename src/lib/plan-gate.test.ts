import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  PLAN_GRANDFATHER_BEFORE_DEFAULT,
  PLAN_REQUIRED_NOTE,
  accountIsGrandfathered,
  catchGrandfathersAccount,
  isPlanReviewAccount,
  planAppAccess,
  planGateAllowsPath,
  planGrandfatherCutoff,
  planGrandfatherEnabled,
  serverPlanSubscribed,
} from "./plan-gate";

const envKeys = ["TIDEMARK_PLAN_GRANDFATHER", "TIDEMARK_PLAN_GRANDFATHER_BEFORE", "TIDEMARK_PLAN_REVIEW_EMAILS"] as const;
const previous: Record<string, string | undefined> = {};

afterEach(() => {
  for (const key of envKeys) {
    if (previous[key] === undefined) delete process.env[key];
    else process.env[key] = previous[key];
  }
});

function rememberEnv() {
  for (const key of envKeys) previous[key] = process.env[key];
}

describe("Tide Mark Plan app gate", () => {
  it("leaves the website and 1.0 open", () => {
    expect(
      planAppAccess({
        native: false,
        grandfathered: false,
        serverSubscribed: false,
        storekitEntitled: false,
      }),
    ).toBe("open");
  });

  it("shows the paywall on 2.0 until StoreKit or the server says the plan is current", () => {
    expect(
      planAppAccess({
        native: true,
        grandfathered: false,
        serverSubscribed: false,
        storekitEntitled: false,
      }),
    ).toBe("paywall");
    expect(
      planAppAccess({
        native: true,
        grandfathered: false,
        serverSubscribed: false,
        storekitEntitled: true,
      }),
    ).toBe("open");
    expect(
      planAppAccess({
        native: true,
        grandfathered: false,
        serverSubscribed: true,
        storekitEntitled: false,
      }),
    ).toBe("open");
  });

  it("does not treat the journal trial clock as a Plan subscription", () => {
    expect(serverPlanSubscribed({ subscriptionStatus: "trial", subscriptionExpiresAt: null })).toBe(false);
    expect(serverPlanSubscribed({ subscriptionStatus: "expired", subscriptionExpiresAt: null })).toBe(false);
    expect(
      serverPlanSubscribed(
        { subscriptionStatus: "active", subscriptionExpiresAt: "2026-10-01T00:00:00.000Z" },
        new Date("2026-10-13T00:00:00.000Z"),
      ),
    ).toBe(false);
    expect(
      serverPlanSubscribed(
        { subscriptionStatus: "active", subscriptionExpiresAt: "2027-10-01T00:00:00.000Z" },
        new Date("2026-10-13T00:00:00.000Z"),
      ),
    ).toBe(true);
  });

  it("grandfathers an account that already had a catch before the cutoff", () => {
    const cutoff = PLAN_GRANDFATHER_BEFORE_DEFAULT;
    expect(catchGrandfathersAccount("2026-10-01T00:00:00.000Z", cutoff)).toBe(true);
    expect(catchGrandfathersAccount(cutoff, cutoff)).toBe(false);
    expect(catchGrandfathersAccount("2026-10-13T12:00:01.000Z", cutoff)).toBe(false);
    expect(
      accountIsGrandfathered({
        catchCreatedAts: ["2026-10-13T18:00:00.000Z", "2026-09-01T00:00:00.000Z"],
        cutoff,
      }),
    ).toBe(true);
    expect(
      accountIsGrandfathered({
        catchCreatedAts: [],
        cutoff,
      }),
    ).toBe(false);
    expect(
      accountIsGrandfathered({
        catchCreatedAts: ["2026-09-01T00:00:00.000Z"],
        reviewAccount: true,
        cutoff,
      }),
    ).toBe(false);
  });

  it("toggles grandfathering and review accounts from the environment", () => {
    rememberEnv();
    delete process.env.TIDEMARK_PLAN_GRANDFATHER;
    delete process.env.TIDEMARK_PLAN_GRANDFATHER_BEFORE;
    delete process.env.TIDEMARK_PLAN_REVIEW_EMAILS;
    expect(planGrandfatherEnabled()).toBe(true);
    expect(planGrandfatherCutoff()).toBe(new Date(PLAN_GRANDFATHER_BEFORE_DEFAULT).toISOString());
    process.env.TIDEMARK_PLAN_GRANDFATHER = "0";
    expect(planGrandfatherEnabled()).toBe(false);
    expect(planGrandfatherCutoff()).toBeNull();
    expect(
      accountIsGrandfathered({
        catchCreatedAts: ["2020-01-01T00:00:00.000Z"],
        cutoff: planGrandfatherCutoff(),
      }),
    ).toBe(false);
    delete process.env.TIDEMARK_PLAN_GRANDFATHER;
    process.env.TIDEMARK_PLAN_GRANDFATHER_BEFORE = "2026-01-01T00:00:00.000Z";
    expect(planGrandfatherCutoff()).toBe("2026-01-01T00:00:00.000Z");
    process.env.TIDEMARK_PLAN_REVIEW_EMAILS = " Review@Example.com , other@example.com ";
    expect(isPlanReviewAccount("review@example.com")).toBe(true);
    expect(isPlanReviewAccount("new@example.com")).toBe(false);
  });

  it("keeps sign-in, privacy, the paywall, and account deletion reachable", () => {
    expect(planGateAllowsPath("/signin")).toBe(true);
    expect(planGateAllowsPath("/privacy")).toBe(true);
    expect(planGateAllowsPath("/subscribe")).toBe(true);
    expect(planGateAllowsPath("/")).toBe(false);
    expect(planGateAllowsPath("/plan")).toBe(false);
    expect(planGateAllowsPath("/log")).toBe(false);
    expect(planGateAllowsPath("/calendar")).toBe(false);
    expect(planGateAllowsPath("/spots")).toBe(false);
    const gate = readFileSync(resolve(process.cwd(), "src/components/PlanAppGate.tsx"), "utf8");
    expect(gate).toContain('data-testid="plan-app-gate"');
    expect(gate).toContain("PlanSubscribeScreen");
    expect(gate).toContain("DeleteAccount");
    expect(gate).toContain("plan-gate-delete");
    const shell = readFileSync(resolve(process.cwd(), "src/components/AppShell.tsx"), "utf8");
    expect(shell).toContain("PlanAppGate");
    expect(shell).toContain("HelpButton");
    expect(shell).toContain("planGated ? null : <FirstRunSetup");
    const help = readFileSync(resolve(process.cwd(), "src/components/HelpGuide.tsx"), "utf8");
    expect(help).toContain('data-testid="help-open"');
    const home = readFileSync(resolve(process.cwd(), "src/components/HomeClient.tsx"), "utf8");
    expect(home).not.toContain("Your journal is free");
    expect(home.toLowerCase()).not.toContain("journal is free");
    const auth = readFileSync(resolve(process.cwd(), "src/components/AuthForm.tsx"), "utf8");
    expect(auth).not.toContain("JOURNAL_FREE_LINE");
    expect(auth).not.toContain("Your journal is free");
  });

  it("puts the subscription sentence under the trial line", () => {
    expect(PLAN_REQUIRED_NOTE).toBe(
      "A subscription is required to keep using Tide Mark after the trial.",
    );
    const ui = readFileSync(resolve(process.cwd(), "src/components/PlanPaywall.tsx"), "utf8");
    expect(ui).toContain('data-testid="plan-paywall-required"');
    expect(ui.indexOf('data-testid="plan-paywall-trial"')).toBeLessThan(
      ui.indexOf('data-testid="plan-paywall-required"'),
    );
    expect(ui).toContain("{copy.requiredNote}");
  });
});
