import { ResetPasswordClient } from "@/components/ResetPasswordClient";

export const metadata = { title: "Reset password", referrer: "no-referrer" as const };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token.slice(0, 200) : "";
  return <ResetPasswordClient token={token} />;
}
