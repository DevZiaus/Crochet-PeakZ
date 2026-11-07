"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PASSWORD_MAX_BYTES, utf8ByteLength } from "@crochet-peakz/shared";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/form-field";
import { FormAlert } from "@/components/auth/form-alert";
import { PasswordInput } from "@/components/auth/password-input";
import { firstIssueMessage, postAuthJson } from "@/lib/auth/api";

type ResetState =
  | { kind: "form" }
  | { kind: "missing" }
  | { kind: "expired" }
  | { kind: "invalid" }
  | { kind: "done" };

/**
 * Password reset form.
 *
 * The token comes from the emailed link. Opening the link never consumes it;
 * the reset only happens when the customer submits a new password. A used or
 * expired token gets a readable message with a way to request a new link.
 */
export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [state, setState] = useState<ResetState>(
    token ? { kind: "form" } : { kind: "missing" },
  );
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("The two passwords do not match.");
      return;
    }

    const bytes = utf8ByteLength(password);
    if (bytes < 8) {
      setError("Password must be at least 8 bytes.");
      return;
    }
    if (bytes > PASSWORD_MAX_BYTES) {
      setError("Password must be 72 bytes or fewer.");
      return;
    }

    setPending(true);
    const result = await postAuthJson<{ message: string }>("reset-password", {
      token,
      password,
    });
    setPending(false);

    if (result.ok) {
      setState({ kind: "done" });
      return;
    }

    if (result.status === 410) {
      setState({ kind: "expired" });
      return;
    }

    if (result.status === 400) {
      setState({ kind: "invalid" });
      return;
    }

    setError(
      result.status === 422
        ? firstIssueMessage(result.error)
        : result.error.message,
    );
  }

  if (state.kind === "done") {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
            Password updated
          </h1>
          <p className="text-sm text-muted-foreground">
            Your new password is ready. For safety we signed out every other
            device.
          </p>
        </div>

        <FormAlert tone="success">
          Sign in with the password you just chose.
        </FormAlert>

        <Button asChild className="w-full">
          <Link href="/login">Sign in to your account</Link>
        </Button>
      </div>
    );
  }

  if (state.kind !== "form") {
    const title =
      state.kind === "expired"
        ? "This reset link has expired"
        : state.kind === "missing"
          ? "This reset link is incomplete"
          : "This reset link is no longer valid";

    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
            {title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {state.kind === "expired"
              ? "Reset links last 1 hour. Request a new one and we will email it right away."
              : "The link may be incomplete or already used. Request a new one below."}
          </p>
        </div>

        <Button asChild className="w-full">
          <Link href="/forgot-password">Request a new reset link</Link>
        </Button>

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

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
          Choose a new password
        </h1>
        <p className="text-sm text-muted-foreground">
          Use 8 to 72 bytes. A short phrase is easier to remember than a single
          word. This link works once.
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
        <FormField label="New password" htmlFor="reset-password" required>
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
          label="Confirm new password"
          htmlFor="reset-confirm-password"
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
          {pending ? "Updating your password…" : "Update password"}
        </Button>
      </form>

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
