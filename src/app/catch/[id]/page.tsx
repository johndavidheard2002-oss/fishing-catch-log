import { CatchDetail } from "@/components/CatchDetail";
import { parsePlannedPhotoContext } from "@/lib/notes";

export default async function CatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string | string[]; planNote?: string | string[]; planDay?: string | string[] }>;
}) {
  const { id } = await params;
  const planned = parsePlannedPhotoContext(await searchParams);
  return (
    <CatchDetail
      id={id}
      fromPlan={planned.fromPlan}
      planNote={planned.calendarNoteId}
      planDay={planned.day}
    />
  );
}
