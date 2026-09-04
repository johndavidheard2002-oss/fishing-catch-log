import type { Metadata } from "next";
import Link from "next/link";
import { APP_DISPLAY_NAME, APP_SUBTITLE } from "@/lib/brand";
import {
  PRIVACY_CONTACT_EMAIL,
  PRIVACY_INTRO,
  PRIVACY_SECTIONS,
  PRIVACY_UPDATED,
} from "@/lib/privacy";

export const metadata: Metadata = {
  title: "Privacy",
  description: `How ${APP_DISPLAY_NAME} stores account email, catch photos, location pins, and friend sharing — and how to request deletion.`,
};

export default function PrivacyPage() {
  return (
    <article className="space-y-4" data-testid="privacy-page">
      <header className="page-intro space-y-2">
        <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
          {APP_SUBTITLE}
        </p>
        <h1 className="font-display text-3xl text-teal">Privacy</h1>
        <p className="text-sm text-ink">{PRIVACY_INTRO}</p>
        <p className="text-xs text-ink-muted">Last updated {PRIVACY_UPDATED}.</p>
      </header>
      {PRIVACY_SECTIONS.map((section) => (
        <section
          key={section.id}
          id={section.id}
          className="journal-card space-y-2 rounded-2xl p-4"
          data-testid={`privacy-${section.id}`}
        >
          <h2 className="font-display text-xl text-teal">{section.title}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph} className="text-sm text-ink">
              {paragraph}
            </p>
          ))}
        </section>
      ))}
      <p className="page-intro text-sm">
        Questions or a deletion request:{" "}
        <a className="font-semibold text-teal underline" href={`mailto:${PRIVACY_CONTACT_EMAIL}`}>
          {PRIVACY_CONTACT_EMAIL}
        </a>
        . Back to{" "}
        <Link href="/signin" className="font-semibold text-teal underline">
          sign in
        </Link>
        .
      </p>
    </article>
  );
}
