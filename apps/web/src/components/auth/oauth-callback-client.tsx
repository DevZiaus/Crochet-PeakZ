"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  OAUTH_ERROR_CODES,
  type OAuthErrorCode,
  type OAuthProvider,
  sanitizeNextPath,
} from "@crochet-peakz/shared";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/auth/form-alert";

/** Human readable provider names. */
const PROVIDER_LABELS: Record<OAuthProvider, string> = {
  google: "Google",
  facebook: "Facebook",
};

/** Readable copy for each failure code. */
const ERROR_MESSAGES: Record<OAuthErrorCode, string> = {
  access_denied:
    "You cancelled the sign in before sharing your account. Nothing changed.",
  email_missing:
    "Your provider did not share an email address. Add one to that account, or sign in with email instead.",
  provider_error:
    "The provider did not finish the sign in. This is usually temporary, so try again.",
  link_failed:
    "We could not link that provider to your account. Sign in with email and try again.",
};

/** Narrows an untrusted query value to a supported provider. */
function toProvider(value: string | null): OAuthProvider | null {
  return value === "google" || value === "facebook" ? value : null;
}

/** Narrows an untrusted query value to a known failure code. */
function toErrorCode(value: string | null): OAuthErrorCode | null {
  return OAUTH_ERROR_CODES.find((code) => code === value) ?? null;
}

/**
 * OAuth result screen.
 *
 * On success the API has already set the auth cookies and resolved `next`, so
 * the page simply replaces the current route. On failure it shows a readable
 * message and offers another attempt or email sign in, without exposing any
 * provider detail beyond the failure code.
 */
export function OAuthCallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const provider = toProvider(searchParams.get("provider"));
  const next = sanitizeNextPath(searchParams.get("next"), "/");
  const errorCode = toErrorCode(searchParams.get("error"));
  const succeeded = searchParams.get("status") === "success";

  useEffect(() => {
    if (!succeeded || errorCode) {
      return;
    }
    router.replace(next);
    router.refresh();
  }, [errorCode, next, router, succeeded]);

  const providerLabel = provider ? PROVIDER_LABELS[provider] : "provider";

  if (succeeded && !errorCode) {
    return (
      <div
        className="space-y-6"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="space-y-2">
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
            You are signed in
          </h1>
          <p className="text-sm text-muted-foreground">
            Taking you to your account with {providerLabel}…
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2
            className="size-4 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
          <span>One moment.</span>
        </div>
      </div>
    );
  }

  const message = errorCode
    ? ERROR_MESSAGES[errorCode]
    : "The sign in did not finish. This is usually temporary, so try again.";

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
          Could not sign in with {providerLabel}
        </h1>
        <p className="text-sm text-muted-foreground">
          Your account is safe and nothing was changed.
        </p>
      </div>

      <FormAlert>{message}</FormAlert>

      <div className="grid gap-3 sm:grid-cols-2">
        {provider ? (
          <Button asChild className="w-full">
            <Link
              href={`/api/auth/${provider}?next=${encodeURIComponent(next)}`}
            >
              Try again
            </Link>
          </Button>
        ) : null}
        <Button asChild variant="outline" className="w-full">
          <Link href={`/login?next=${encodeURIComponent(next)}`}>
            Sign in with email
          </Link>
        </Button>
      </div>
    </div>
  );
}
