import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { AuthFormFallback } from "@/components/auth/auth-form-fallback";
import { RequireGuest } from "@/components/auth/require-guest";

export const metadata: Metadata = {
  title: "Sign in | Crochet PeakZ",
  description: "Sign in to your Crochet PeakZ account.",
  robots: { index: false, follow: false },
};

/** Sign in screen. */
export default function LoginPage() {
  return (
    <Suspense fallback={<AuthFormFallback />}>
      <RequireGuest>
        <LoginForm />
      </RequireGuest>
    </Suspense>
  );
}
