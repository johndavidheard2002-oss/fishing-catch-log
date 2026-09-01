import { CatchDetail } from "@/components/CatchDetail";

export default async function CatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CatchDetail id={id} />;
}
