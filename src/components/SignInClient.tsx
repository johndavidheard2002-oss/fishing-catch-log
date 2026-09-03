"use client";

import { useEffect, useState } from "react";
import { AuthForm } from "@/components/AuthForm";

export function SignInClient({ nextPath = "/" }: { nextPath?: string }) {
  const [claimExisting, setClaimExisting] = useState(false);
  const [defaultName, setDefaultName] = useState("");

  useEffect(() => {
    fetch("/api/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data.signedIn) return;
        if (data.claimable && data.me) {
          setClaimExisting(true);
          setDefaultName(data.me.name === "You" ? "" : (data.me.name ?? ""));
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-4">
      <section className="page-intro space-y-2 text-center">
        <h1 className="font-display text-3xl text-teal">Sign in</h1>
        <p className="text-sm text-ink">Sign in or create an account to open your journal.</p>
      </section>
      <AuthForm
        defaultMode="signin"
        defaultName={defaultName}
        claimExisting={claimExisting}
        nextPath={nextPath}
      />
    </div>
  );
}
