/**
 * The sign-in "Forgot password?" link stays hidden until a sign-in attempt fails with
 * wrong credentials (401). Network errors, rate limits, and server errors do not reveal it.
 * Once shown it stays shown for the rest of the visit.
 */
export function shouldShowForgotLink(args: {
  alreadyShown: boolean;
  mode: "create" | "signin";
  status: number | null;
}): boolean {
  if (args.alreadyShown) return true;
  return args.mode === "signin" && args.status === 401;
}
