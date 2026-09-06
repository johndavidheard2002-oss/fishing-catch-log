import { redirect } from "next/navigation";
import { DEFAULT_CALENDAR_LOG_VIEW } from "@/lib/calendar";

export default async function HistoryRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === "string") next.set(key, value);
    else if (Array.isArray(value)) {
      for (const item of value) next.append(key, item);
    }
  }
  if (next.get("view") === DEFAULT_CALENDAR_LOG_VIEW) next.delete("view");
  const qs = next.toString();
  redirect(qs ? `/calendar?${qs}` : "/calendar");
}
