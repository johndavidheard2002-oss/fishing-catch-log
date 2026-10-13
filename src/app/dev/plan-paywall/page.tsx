import { notFound } from "next/navigation";
import { DevPlanPaywallPreview } from "@/components/DevPlanPaywallPreview";

export const dynamic = "force-dynamic";

function firstQuery(value?: string | string[]): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0] ?? null;
  return null;
}

/** Local rendering of the real Plan paywall. Production returns 404. */
export default async function DevPlanPaywallPage({
  searchParams,
}: {
  searchParams: Promise<{ price?: string | string[] }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const params = await searchParams;
  return <DevPlanPaywallPreview priceFromStore={firstQuery(params.price) === "store"} />;
}
