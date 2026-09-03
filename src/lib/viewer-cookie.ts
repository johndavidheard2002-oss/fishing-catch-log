export const ANGLER_COOKIE = "cast-log-angler";
/** Shared-journal-era login cookie. Read never; expire only. */
export const LEGACY_SESSION_COOKIE = "cast-log-session";
/** Rotated so leftover tester sessions from the shared journal are invalid. */
export const SESSION_COOKIE = "cast-log-session-v2";

export const VIEWER_COOKIE = {
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
  sameSite: "lax" as const,
};
