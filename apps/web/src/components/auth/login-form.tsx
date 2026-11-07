"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  resolvePostSignInPath,
  sanitizeNextPath,
  type AuthUser,
} from "@crochet-peakz/shared";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import { Divider } from "@/components/divider";
import { FormAlert } from "@/components/auth/form-alert";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { PasswordInput } from "@/components/auth/password-input";
import { detailNumber, detailString, postAuthJson } from "@/lib/auth/api";

/**
 * Email and password sign in form.
 *
 * An unverified account gets a clear message plus a resend action. `next` is
 * validated before navigation and after the API returns the role, so the
 * destination is always a same origin relative path.
 */
export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next");
  const next = sanitizeNextPath(nextParam, "/");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setNotice(null);

    const result = await postAuthJson<AuthUser>("login", { email, password });
    setPending(false);

    if (!result.ok) {
      if (result.error.code === "EMAIL_UNVERIFIED") {
        setUnverifiedEmail(detailString(result.error, "email") ?? email);
        return;
      }
      setUnverifiedEmail(null);
      if (result.status === 429) {
        const seconds = detailNumber(result.error, "retryAfterSeconds") ?? 60;
        setError(
          `Too many sign in attempts. Try again in ${String(seconds)} seconds.`,
        );
        return;
      }
      setError(result.error.message);
      return;
    }

    router.replace(resolvePostSignInPath(nextParam, result.data.role));
    router.refresh();
  }

  async function handleResend() {
    if (!unverifiedEmail) {
      return;
    }
    setPending(true);
    setError(null);
    setNotice(null);

    const result = await postAuthJson<{ message: string }>(
      "resend-verification",
      { email: unverifiedEmail },
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

    setUnverifiedEmail(null);
    setNotice("A new verification link is on its way. Check your inbox.");
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
          Welcome back
        </h1>
        <p className="text-sm text-muted-foreground">
          Sign in to see your orders, saved addresses, and digital patterns.
        </p>
      </div>

      <OAuthButtons next={next} />

      <Divider label="or use your email" />

      {unverifiedEmail ? (
        <FormAlert>
          <p className="font-medium">Your email is not verified yet.</p>
          <p className="mt-1 text-muted-foreground">
            We can send a new link to {unverifiedEmail}. The link works once and
            expires in 24 hours.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            disabled={pending}
            onClick={() => {
              void handleResend();
            }}
          >
            {pending ? "Sending…" : "Resend verification email"}
          </Button>
        </FormAlert>
      ) : null}

      {error ? <FormAlert>{error}</FormAlert> : null}
      {notice ? <FormAlert tone="success">{notice}</FormAlert> : null}

      <form
        className="space-y-5"
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
        noValidate
      >
        <FormField label="Email" htmlFor="login-email" required>
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

        <FormField label="Password" htmlFor="login-password" required>
          <PasswordInput
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
            }}
            required
          />
        </FormField>

        <div className="flex items-center justify-end">
          <Link
            href={`/forgot-password?next=${encodeURIComponent(next)}`}
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Forgot your password?
          </Link>
        </div>

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        New to Crochet PeakZ?{" "}
        <Link
          href={`/register?next=${encodeURIComponent(next)}`}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
