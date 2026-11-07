"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  PASSWORD_MAX_BYTES,
  sanitizeNextPath,
  utf8ByteLength,
  type AuthUser,
} from "@crochet-peakz/shared";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import { Divider } from "@/components/divider";
import { FormAlert } from "@/components/auth/form-alert";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { PasswordInput } from "@/components/auth/password-input";
import { detailNumber, firstIssueMessage, postAuthJson } from "@/lib/auth/api";

/**
 * Account creation form.
 *
 * On success the account exists and the verification email has been sent. The
 * panel tells the customer what to do next and offers a resend.
 */
export function RegisterForm() {
  const searchParams = useSearchParams();
  const next = sanitizeNextPath(searchParams.get("next"), "/");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);

  async function handleSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (password !== confirmPassword) {
      setError("The two passwords do not match.");
      return;
    }

    if (utf8ByteLength(password) > PASSWORD_MAX_BYTES) {
      setError("Password must be 72 bytes or fewer.");
      return;
    }

    setPending(true);
    const result = await postAuthJson<AuthUser>("register", {
      name,
      email,
      password,
    });
    setPending(false);

    if (!result.ok) {
      if (result.status === 429) {
        const seconds = detailNumber(result.error, "retryAfterSeconds") ?? 60;
        setError(
          `Too many accounts created from this network. Try again in ${String(seconds)} seconds.`,
        );
        return;
      }
      setError(
        result.status === 422
          ? firstIssueMessage(result.error)
          : result.error.message,
      );
      return;
    }

    setRegisteredEmail(result.data.email);
  }

  async function handleResend() {
    if (!registeredEmail) {
      return;
    }
    setPending(true);
    setError(null);
    setNotice(null);
    const result = await postAuthJson<{ message: string }>(
      "resend-verification",
      { email: registeredEmail },
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

  if (registeredEmail) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
            Check your email
          </h1>
          <p className="text-sm text-muted-foreground">
            Your account is ready. We sent a verification link to{" "}
            <span className="font-medium text-foreground">
              {registeredEmail}
            </span>
            .
          </p>
        </div>

        <FormAlert tone="success">
          Open the link and confirm your email, then sign in. The link works
          once and expires in 24 hours.
        </FormAlert>

        {error ? <FormAlert>{error}</FormAlert> : null}
        {notice ? <FormAlert tone="success">{notice}</FormAlert> : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <Button asChild className="w-full">
            <Link href={`/login?next=${encodeURIComponent(next)}`}>
              Go to sign in
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={pending}
            onClick={() => {
              void handleResend();
            }}
          >
            {pending ? "Sending…" : "Resend the email"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
          Create your account
        </h1>
        <p className="text-sm text-muted-foreground">
          Your orders, downloads, and saved addresses live here. Guests can
          browse, but checkout needs an account.
        </p>
      </div>

      <OAuthButtons next={next} />

      <Divider label="or sign up with email" />

      {error ? <FormAlert>{error}</FormAlert> : null}

      <form
        className="space-y-5"
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
        noValidate
      >
        <FormField label="Name" htmlFor="register-name" required>
          <Input
            name="name"
            autoComplete="name"
            placeholder="Your name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
            }}
            required
          />
        </FormField>

        <FormField label="Email" htmlFor="register-email" required>
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

        <FormField
          label="Password"
          htmlFor="register-password"
          description="8 to 72 bytes. A short phrase is easier to remember than a single word."
          required
        >
          <PasswordInput
            name="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
            }}
            required
          />
        </FormField>

        <FormField
          label="Confirm password"
          htmlFor="register-confirm-password"
          required
        >
          <PasswordInput
            name="confirmPassword"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => {
              setConfirmPassword(event.target.value);
            }}
            required
          />
        </FormField>

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Creating your account…" : "Create account"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
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
