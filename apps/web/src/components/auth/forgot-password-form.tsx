"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { sanitizeNextPath } from "@crochet-peakz/shared";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import { FormAlert } from "@/components/auth/form-alert";
import { detailNumber, postAuthJson } from "@/lib/auth/api";

/**
 * Password reset request form.
 *
 * The API always answers 202, so the confirmation never reveals whether an
 * account exists.
 */
export function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const next = sanitizeNextPath(searchParams.get("next"), "/");
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const result = await postAuthJson<{ message: string }>("forgot-password", {
      email,
    });
    setPending(false);

    if (!result.ok) {
      if (result.status === 429) {
        const seconds = detailNumber(result.error, "retryAfterSeconds") ?? 60;
        setError(
          `Too many reset requests. Try again in ${String(seconds)} seconds.`,
        );
        return;
      }
      setError(result.error.message);
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <div className="space-y-6">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
          Check your email
        </h1>
        <FormAlert tone="success">
          If an account with {email} has a password, a reset link is on its way.
          The link works once and expires in 1 hour.
        </FormAlert>
        <Button asChild variant="outline" className="w-full">
          <Link href={`/login?next=${encodeURIComponent(next)}`}>
            Back to sign in
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
          Forgot your password?
        </h1>
        <p className="text-sm text-muted-foreground">
          Enter the email on your account and we will send a link to choose a
          new password. Accounts created with Google or Facebook sign in with
          their provider instead.
        </p>
      </div>

      {error ? <FormAlert>{error}</FormAlert> : null}

      <form
        className="space-y-5"
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
        noValidate
      >
        <FormField label="Email" htmlFor="forgot-email" required>
          <Input
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
            }}
            required
          />
        </FormField>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Sending…" : "Send reset link"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link
          href={`/login?next=${encodeURIComponent(next)}`}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
