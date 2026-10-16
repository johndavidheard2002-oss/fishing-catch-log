import { ForgotPasswordClient } from "@/components/ForgotPasswordClient";

export const metadata = { title: "Forgot password" };

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string | string[] }>;
}) {
  const params = await searchParams;
  const email = typeof params.email === "string" ? params.email.slice(0, 254) : "";
  return <ForgotPasswordClient defaultEmail={email} />;
}
