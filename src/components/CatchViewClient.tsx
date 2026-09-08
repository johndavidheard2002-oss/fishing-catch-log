"use client";

import { useSearchParams } from "next/navigation";
import { CatchDetail } from "@/components/CatchDetail";

export function CatchViewClient() {
  const id = useSearchParams().get("id")?.trim() ?? "";
  if (!id) return <p className="on-wash-chip text-sm">Catch not found</p>;
  return <CatchDetail id={id} />;
}
