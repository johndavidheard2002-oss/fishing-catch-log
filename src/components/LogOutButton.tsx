"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { notifyAuthChange } from "@/lib/tour";

export function LogOutButton({
  testId = "log-out",
  className = "w-full rounded-xl bg-copper px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-60",
}: {
  testId?: string;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logOut() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      notifyAuthChange();
      router.replace("/signin");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={() => void logOut()} disabled={busy} data-testid={testId} className={className}>
      {busy ? "Signing out…" : "Log out"}
    </button>
  );
}
