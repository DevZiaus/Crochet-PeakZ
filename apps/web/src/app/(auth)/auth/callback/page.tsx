import type { Metadata } from "next";
import { Suspense } from "react";
import { OAuthCallbackClient } from "@/components/auth/oauth-callback-client";
import { AuthFormFallback } from "@/components/auth/auth-form-fallback";

export const metadata: Metadata = {
  title: "Signing you in | Crochet PeakZ",
  description: "Completing your Crochet PeakZ sign in.",
  robots: { index: false, follow: false },
};

/** OAuth result screen. */
export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<AuthFormFallback />}>
      <OAuthCallbackClient />
    </Suspense>
  );
}
