export const ANGLER_COOKIE = "cast-log-angler";
export const SESSION_COOKIE = "cast-log-session";

export const VIEWER_COOKIE = {
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
  sameSite: "lax" as const,
};
