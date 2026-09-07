"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  planHrefForPendingSpot,
  writePendingPlanSpot,
  type PendingPlanSpot,
} from "@/lib/pending-plan-spot";

export const ADD_TO_PLAN_CHIP =
  "rounded-full bg-teal px-2 py-0.5 text-[10px] font-semibold text-white";

export function AddToPlanButton({
  spot,
  className = ADD_TO_PLAN_CHIP,
  children = "Add to plan",
  testId = "add-to-plan",
}: {
  spot: PendingPlanSpot;
  className?: string;
  children?: ReactNode;
  testId?: string;
}) {
  return (
    <Link
      href={planHrefForPendingSpot(spot)}
      data-testid={testId}
      aria-label={`Add ${spot.placeName || "this catch"} to plan`}
      onClick={(event) => {
        event.stopPropagation();
        writePendingPlanSpot(typeof sessionStorage === "undefined" ? null : sessionStorage, spot);
      }}
      onPointerDown={(event) => event.stopPropagation()}
      className={className}
    >
      {children}
    </Link>
  );
}
