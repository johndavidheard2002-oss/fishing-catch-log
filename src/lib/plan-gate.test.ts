import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  PLAN_READONLY_HOME,
  PLAN_REQUIRED_NOTE,
  planAppAccess,
  planCatchViewPath,
  planGateAllowsPath,
  serverPlanSubscribed,
} from "./plan-gate";

describe("Tide Mark Plan app gate", () => {
  it("leaves the website and 1.0 open", () => {
    expect(
      planAppAccess({
        native: false,
        hasCatches: true,
        serverSubscribed: false,
        storekitEntitled: false,
      }),
    ).toBe("open");
  });

  it("shows the paywall on 2.0 until StoreKit or the server says the plan is current", () => {
    expect(
      planAppAccess({
        native: true,
        hasCatches: false,
        serverSubscribed: false,
        storekitEntitled: false,
      }),
    ).toBe("paywall");
    expect(
      planAppAccess({
        native: true,
        hasCatches: false,
        serverSubscribed: false,
        storekitEntitled: true,
      }),
    ).toBe("open");
    expect(
      planAppAccess({
        native: true,
        hasCatches: true,
        serverSubscribed: true,
        storekitEntitled: false,
      }),
    ).toBe("open");
  });

  it("lets a non-subscriber view logged catches and blocks every other feature", () => {
    expect(
      planAppAccess({
        native: true,
        hasCatches: true,
        serverSubscribed: false,
        storekitEntitled: false,
      }),
    ).toBe("readonly");
    expect(planCatchViewPath("/calendar")).toBe(true);
    expect(planCatchViewPath("/calendar?view=list")).toBe(false);
    expect(planCatchViewPath("/history")).toBe(true);
    expect(planCatchViewPath("/catch/abc")).toBe(true);
    expect(planCatchViewPath("/")).toBe(false);
    expect(planCatchViewPath("/log")).toBe(false);
    expect(planCatchViewPath("/plan")).toBe(false);
    expect(planCatchViewPath("/spots")).toBe(false);
    expect(planCatchViewPath("/backfill")).toBe(false);
    expect(PLAN_READONLY_HOME).toBe("/calendar?view=list");
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
    expect(gate).toContain('data-testid="plan-app-gate"');
    expect(gate).toContain("PlanSubscribeScreen");
    expect(gate).toContain("DeleteAccount");
    expect(gate).toContain("plan-gate-delete");
    expect(gate).toContain('data-testid="plan-readonly"');
    expect(gate).toContain("plan-readonly-delete");
    expect(gate).not.toContain("grandfather");
    const history = readFileSync(resolve(process.cwd(), "src/components/HistoryClient.tsx"), "utf8");
    expect(history).toContain("usePlanReadOnly");
    const detail = readFileSync(resolve(process.cwd(), "src/components/CatchDetail.tsx"), "utf8");
    expect(detail).toContain('data-testid="catch-readonly"');
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
