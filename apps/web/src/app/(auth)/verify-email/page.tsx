import type { Metadata } from "next";
import { Suspense } from "react";
import { VerifyEmailClient } from "@/components/auth/verify-email-client";
import { AuthFormFallback } from "@/components/auth/auth-form-fallback";

export const metadata: Metadata = {
  title: "Confirm your email | Crochet PeakZ",
  description: "Confirm the email address on your Crochet PeakZ account.",
  robots: { index: false, follow: false },
};

/** Email verification result screen. */
export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<AuthFormFallback />}>
      <VerifyEmailClient />
    </Suspense>
  );
}
