"use client";

import type { ReactNode } from "react";
import { PlanSubscribeScreen } from "@/components/PlanSubscribeScreen";
import { useNativePlanIap } from "@/components/useNativePlanIap";

/**
 * The day planner stays available. On Tide Mark 2.0 the subscription sits
 * above it so a pre-2.0 account can still plan a day and can still buy.
 * The website and the 1.0 app never see the purchase screen.
 */
export function PlanAccess({ children }: { children: ReactNode }) {
  const { native } = useNativePlanIap();
  return (
    <div className="space-y-4">
      {native ? <PlanSubscribeScreen /> : null}
      {children}
    </div>
  );
}
