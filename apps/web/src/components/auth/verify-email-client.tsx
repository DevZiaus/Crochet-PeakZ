"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import { FormAlert } from "@/components/auth/form-alert";
import { detailNumber, detailString, postAuthJson } from "@/lib/auth/api";

type VerifyState =
  | { kind: "confirm" }
  | { kind: "verifying" }
  | { kind: "verified"; email: string }
  | { kind: "expired"; email: string }
  | { kind: "invalid" };

/**
 * Verification result screen.
 *
 * Opening the link never consumes the token. The customer confirms with an
 * explicit POST, which keeps mail scanners from burning the one time link.
 */
export function VerifyEmailClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [state, setState] = useState<VerifyState>(
    token ? { kind: "confirm" } : { kind: "invalid" },
  );
  const [resendEmail, setResendEmail] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleVerify() {
    setError(null);
    setPending(true);
    const result = await postAuthJson<{
      email: string;
      emailVerified: boolean;
    }>("verify-email", { token });
    setPending(false);

    if (result.ok) {
      setState({ kind: "verified", email: result.data.email });
      return;
    }

    const email = detailString(result.error, "email") ?? "";
    if (result.status === 410) {
      setState({ kind: "expired", email });
      setResendEmail(email);
      return;
    }

    setState({ kind: "invalid" });
  }

  async function handleResend(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setPending(true);
    const result = await postAuthJson<{ message: string }>(
      "resend-verification",
      { email: resendEmail },
    );
    setPending(false);

    if (!result.ok) {
      if (result.status === 429) {
        const seconds = detailNumber(result.error, "retryAfterSeconds") ?? 60;
        setError(
          `Please wait ${String(seconds)} seconds before requesting another email.`,
        );
        return;
      }
      setError(result.error.message);
      return;
    }

    setNotice("A new verification link is on its way. Check your inbox.");
  }

  if (state.kind === "verified") {
    return (
      <div className="space-y-6">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
          Email confirmed
        </h1>
        <FormAlert tone="success">
          {state.email} is verified. Your orders and downloads now belong to
          your account.
        </FormAlert>
        <Button asChild className="w-full">
          <Link href="/login">Sign in to your account</Link>
        </Button>
      </div>
    );
  }

  const isExpired = state.kind === "expired";
  const isInvalid = state.kind === "invalid";

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
          {isExpired
            ? "This link has expired"
            : isInvalid
              ? "This link is no longer valid"
              : "Confirm your email"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isExpired
            ? "Verification links last 24 hours. Request a new one and we will email it right away."
            : isInvalid
              ? "The link may be incomplete or already used. Request a new one below."
              : "One click and your account is ready. This link works once."}
        </p>
      </div>

      {error ? <FormAlert>{error}</FormAlert> : null}
      {notice ? <FormAlert tone="success">{notice}</FormAlert> : null}

      {state.kind === "confirm" ? (
        <Button
          type="button"
          className="w-full"
          disabled={pending}
          onClick={() => {
            void handleVerify();
          }}
        >
          {pending ? "Confirming…" : "Confirm my email"}
        </Button>
      ) : null}

      {isExpired || isInvalid ? (
        <form
          className="space-y-5"
          onSubmit={(event) => {
            void handleResend(event);
          }}
          noValidate
        >
          <FormField
            label="Email"
            htmlFor="verify-resend-email"
            description="We only send a link when the account exists and is still unverified."
            required
          >
            <Input
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              value={resendEmail}
              onChange={(event) => {
                setResendEmail(event.target.value);
              }}
              required
            />
          </FormField>
          <Button
            type="submit"
            variant="outline"
            className="w-full"
            disabled={pending}
          >
            {pending ? "Sending…" : "Send a new link"}
          </Button>
        </form>
      ) : null}

      <p className="text-center text-sm text-muted-foreground">
        <Link
          href="/login"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
