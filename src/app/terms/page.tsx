import type { Metadata } from "next";
import Link from "next/link";
import { APP_DISPLAY_NAME, APP_SUBTITLE } from "@/lib/brand";
import { PLAN_PRICE_LABEL, PLAN_TITLE } from "@/lib/plan-iap";
import { PRIVACY_PATH } from "@/lib/privacy";

export const metadata: Metadata = {
  title: "Terms",
  description: `Terms of Use for ${APP_DISPLAY_NAME}, including the Tide Mark Plan subscription.`,
};

export default function TermsPage() {
  return (
    <article className="space-y-4" data-testid="terms-page">
      <header className="page-intro space-y-2">
        <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">{APP_SUBTITLE}</p>
        <h1 className="font-display text-3xl text-teal">Terms of Use</h1>
        <p className="text-sm text-ink">
          {APP_DISPLAY_NAME} is a private saltwater logbook. These terms cover the {PLAN_TITLE} subscription
          sold in the Android app and the iPhone app.
        </p>
      </header>
      <section className="journal-card space-y-2 rounded-2xl p-4" data-testid="terms-subscription">
        <h2 className="font-display text-xl text-teal">{PLAN_TITLE}</h2>
        <p className="text-sm text-ink">
          {PLAN_TITLE} is a 1-year auto-renewable subscription at {PLAN_PRICE_LABEL} after a 1-month free trial.
          A subscription is required to keep using Tide Mark after the trial. Catches already logged stay
          visible. Payment is charged to your Google Play account on Android, or to your Apple ID on iPhone,
          when you confirm the purchase.
        </p>
        <p className="text-sm text-ink">
          The plan renews automatically each year unless you cancel at least 24 hours before the end of the
          current period. Your account is charged {PLAN_PRICE_LABEL} for renewal within 24 hours before the
          period ends. Any unused part of a free trial is forfeited if you buy a subscription before the trial
          ends.
        </p>
        <p className="text-sm text-ink">
          On Android, manage or cancel anytime in the Google Play Store under Payments & subscriptions. On
          iPhone, manage or cancel in Settings, then Apple ID, then Subscriptions.
        </p>
      </section>
      <p className="text-sm font-semibold">
        <Link href={PRIVACY_PATH} className="text-teal underline" data-testid="terms-privacy">
          Privacy Policy
        </Link>
      </p>
    </article>
  );
}
