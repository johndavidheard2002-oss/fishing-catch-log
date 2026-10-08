import { notFound } from "next/navigation";
import { DevPlanPaywallPreview } from "@/components/DevPlanPaywallPreview";

export const dynamic = "force-dynamic";

/** Local rendering of the real Plan paywall. Production returns 404. */
export default function DevPlanPaywallPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DevPlanPaywallPreview />;
}
