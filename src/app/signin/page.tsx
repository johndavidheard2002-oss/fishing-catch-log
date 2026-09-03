import { AuthForm } from "@/components/AuthForm";

export const metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <div className="space-y-4">
      <AuthForm nextPath="/" />
    </div>
  );
}
