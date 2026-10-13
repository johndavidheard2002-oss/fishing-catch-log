/**
 * Accounts that keep full logging on every build, including iOS 14+.
 * The App Review demo account is intentionally not on this list, so that
 * build still shows the Tide Mark Plan paywall.
 */
export const DEFAULT_COMP_ACCOUNT_EMAILS = [
  "johndavidheard2002@gmail.com",
  "jd@southtexascharters.com",
] as const;

/** Unset or blank keeps the default. A non-empty value replaces it. */
export function compAccountEmails(raw = process.env.COMP_ACCOUNT_EMAILS): string[] {
  if (raw == null || !raw.trim()) return [...DEFAULT_COMP_ACCOUNT_EMAILS];
  const parsed = raw
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : [...DEFAULT_COMP_ACCOUNT_EMAILS];
}

export function isCompAccountEmail(email: string | null | undefined, raw = process.env.COMP_ACCOUNT_EMAILS): boolean {
  if (!email?.trim()) return false;
  return compAccountEmails(raw).includes(email.trim().toLowerCase());
}
