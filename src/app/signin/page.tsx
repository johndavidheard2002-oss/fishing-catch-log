import { SignInClient } from "@/components/SignInClient";

export const metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = params.next;
  const nextPath = typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
  return <SignInClient nextPath={nextPath} />;
}
