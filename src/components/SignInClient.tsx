"use client";

import { AuthForm } from "@/components/AuthForm";

export function SignInClient({ nextPath = "/" }: { nextPath?: string }) {
  return (
    <div className="space-y-4">
      <section className="page-intro space-y-2 text-center">
        <h1 className="font-display text-3xl text-teal">Sign in</h1>
        <p className="text-sm text-ink">Sign in or create an account to open your journal.</p>
      </section>
      <AuthForm defaultMode="signin" nextPath={nextPath} />
    </div>
  );
}
