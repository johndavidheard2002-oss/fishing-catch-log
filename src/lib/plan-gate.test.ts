import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  PLAN_LOGGING_NOTE,
  PLAN_REQUIRED_NOTE,
  planAppAccess,
  planGateAllowsPath,
  serverPlanSubscribed,
} from "./plan-gate";

describe("Tide Mark Plan app gate", () => {
  it("leaves the website and 1.0 open", () => {
    expect(
      planAppAccess({
        native: false,
        serverSubscribed: false,
        storekitEntitled: false,
      }),
    ).toBe("open");
  });

  it("locks logging on 2.0 until StoreKit or the server says the plan is current", () => {
    expect(
      planAppAccess({
        native: true,
        serverSubscribed: false,
        storekitEntitled: false,
      }),
    ).toBe("locked");
    expect(
      planAppAccess({
        native: true,
        serverSubscribed: false,
        storekitEntitled: true,
      }),
    ).toBe("open");
    expect(
      planAppAccess({
        native: true,
        serverSubscribed: true,
        storekitEntitled: false,
      }),
    ).toBe("open");
  });

  it("locks every native account the same way, including ones that already logged catches", () => {
    expect(PLAN_LOGGING_NOTE).toBe("Subscribe on the Home screen to log catches.");
    expect(
      planAppAccess({
        native: true,
        serverSubscribed: false,
        storekitEntitled: false,
      }),
    ).toBe("locked");
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
    expect(gate).toContain("PLAN_LOGGING_NOTE");
    expect(gate).toContain('data-testid="plan-logging-note"');
    expect(gate).not.toContain("PlanSubscribeScreen");
    expect(gate).not.toContain('href="/subscribe"');
    expect(gate).not.toContain("grandfather");
    expect(gate).not.toContain("router.replace");
    const history = readFileSync(resolve(process.cwd(), "src/components/HistoryClient.tsx"), "utf8");
    expect(history).toContain("usePlanLoggingLocked");
    expect(history).toContain("PlanLoggingNote");
    expect(history).not.toContain('href="/subscribe"');
    const detail = readFileSync(resolve(process.cwd(), "src/components/CatchDetail.tsx"), "utf8");
    expect(detail).toContain("PlanLoggingNote");
    expect(detail).toContain("if (editing && isOwner)");
    expect(detail).not.toContain('href="/subscribe"');
    const log = readFileSync(resolve(process.cwd(), "src/components/LogClient.tsx"), "utf8");
    expect(log).toContain("PlanLoggingNote");
    expect(log).not.toContain('href="/subscribe"');
    const backfill = readFileSync(resolve(process.cwd(), "src/components/BackfillClient.tsx"), "utf8");
    expect(backfill).toContain("PlanLoggingNote");
    expect(backfill).not.toContain('href="/subscribe"');
    const plan = readFileSync(resolve(process.cwd(), "src/components/PlanClient.tsx"), "utf8");
    expect(plan).toContain("PlanLoggingNote");
    expect(plan).not.toContain("find-fish-folder");
    expect(plan).not.toContain('href="/subscribe"');
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
    const priceAt = ui.indexOf('data-testid="plan-paywall-price"');
    const trialAt = ui.indexOf('data-testid="plan-paywall-trial"');
    const requiredAt = ui.indexOf('data-testid="plan-paywall-required"');
    const titleAt = ui.indexOf('data-testid="plan-paywall-title"');
    const subscribeAt = ui.indexOf('data-testid="plan-subscribe"');
    expect(priceAt).toBeLessThan(trialAt);
    expect(trialAt).toBeLessThan(requiredAt);
    expect(requiredAt).toBeLessThan(titleAt);
    expect(titleAt).toBeLessThan(subscribeAt);
    expect(ui).toContain("{copy.requiredNote}");
  });
});
