import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { AuthFormFallback } from "@/components/auth/auth-form-fallback";

export const metadata: Metadata = {
  title: "Choose a new password | Crochet PeakZ",
  description: "Choose a new password for your Crochet PeakZ account.",
  robots: { index: false, follow: false },
};

/** Password reset screen. */
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<AuthFormFallback />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
