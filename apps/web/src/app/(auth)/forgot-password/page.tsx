import type { Metadata } from "next";
import { Suspense } from "react";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { AuthFormFallback } from "@/components/auth/auth-form-fallback";

export const metadata: Metadata = {
  title: "Reset your password | Crochet PeakZ",
  description: "Request a password reset link for your Crochet PeakZ account.",
  robots: { index: false, follow: false },
};

/** Password reset request screen. */
export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<AuthFormFallback />}>
      <ForgotPasswordForm />
    </Suspense>
  );
}
