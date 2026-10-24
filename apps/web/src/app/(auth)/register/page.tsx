import type { Metadata } from "next";
import { Suspense } from "react";
import { RegisterForm } from "@/components/auth/register-form";
import { AuthFormFallback } from "@/components/auth/auth-form-fallback";

export const metadata: Metadata = {
  title: "Create account | Crochet PeakZ",
  description: "Create a Crochet PeakZ account to track orders and patterns.",
  robots: { index: false, follow: false },
};

/** Account creation screen. */
export default function RegisterPage() {
  return (
    <Suspense fallback={<AuthFormFallback />}>
      <RegisterForm />
    </Suspense>
  );
}
