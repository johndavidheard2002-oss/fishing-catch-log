import { notFound } from "next/navigation";
import { PlanPaywall } from "@/components/PlanPaywall";
import { fallbackPlanOffer } from "@/lib/plan-iap";

export const dynamic = "force-dynamic";

/** Local rendering of the real Plan paywall. Production returns 404. */
export default function DevPlanPaywallPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <PlanPaywall offer={fallbackPlanOffer()} />;
}
