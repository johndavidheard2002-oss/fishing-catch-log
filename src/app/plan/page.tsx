import { PlanClient } from "@/components/PlanClient";

export const dynamic = "force-dynamic";

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = params.date;
  const initialDate = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : null;
  return <PlanClient initialDate={initialDate} />;
}
