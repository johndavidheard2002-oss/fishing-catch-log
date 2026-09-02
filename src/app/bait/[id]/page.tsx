import { BaitSpotDetail } from "@/components/BaitSpotDetail";

export default async function BaitSpotPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BaitSpotDetail id={id} />;
}
