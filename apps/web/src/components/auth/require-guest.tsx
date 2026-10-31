"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { resolvePostSignInPath } from "@crochet-peakz/shared";
import { Loader2 } from "lucide-react";
import { useSession } from "@/lib/auth/use-session";

interface RequireGuestProps {
  /** The sign in or register form. */
  children: ReactNode;
}

/**
 * Client guard for the sign in and register screens.
 *
 * An already signed in customer is sent to a safe relative `next` or their
 * role default, so the forms that just created the session do not appear
 * again. It asks `/api/auth/me` through the web proxy, which refreshes a stale
 * access token, matching {@link RequireRole}. Verification, reset, and the
 * OAuth result screens stay outside this guard because they are still useful
 * while a session exists.
 *
 * @param props Form content to render for a signed out visitor.
 * @returns The form, or a status message while the session is checked.
 */
export function RequireGuest({ children }: RequireGuestProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useSession();

  useEffect(() => {
    if (loading || !user) {
      return;
    }

    router.replace(resolvePostSignInPath(searchParams.get("next"), user.role));
  }, [loading, router, searchParams, user]);

  if (loading || user) {
    return (
      <div
        className="flex min-h-48 items-center justify-center gap-3 text-sm text-muted-foreground"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <Loader2
          className="size-4 animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
        <span>
          {loading ? "Checking your session…" : "Taking you to your account…"}
        </span>
      </div>
    );
  }

  return children;
}
