"use client";

import { useState } from "react";
import { AuthForm } from "@/components/AuthForm";

export function SignInClient({ nextPath = "/" }: { nextPath?: string }) {
  const [phase, setPhase] = useState<"form" | "location">("form");

  return (
    <div className="space-y-4">
      <section className="page-intro space-y-2 text-center">
        <h1 className="font-display text-3xl text-teal">
          {phase === "location" ? "You’re in" : "Sign in"}
        </h1>
        <p className="text-sm text-ink">
          {phase === "location"
            ? "Allow location so a live photo can drop the pin on the water where you caught the fish. You can still move the pin."
            : "Sign in or create an account to open your journal. First month free, then $39.99/year."}
        </p>
      </section>
      <AuthForm defaultMode="signin" nextPath={nextPath} onPhaseChange={setPhase} />
    </div>
  );
}
