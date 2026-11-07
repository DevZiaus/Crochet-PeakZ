/**
 * Tests for the password reset form.
 *
 * The reset token must not be spent until the customer submits a new password.
 * Client side checks catch mismatches and byte limits early, and the states for
 * an expired or used link have to offer a new request instead of leaving the
 * customer on a dead form (AC-9, AC-13).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { postAuthJsonMock, searchParams } = vi.hoisted(() => ({
  postAuthJsonMock: vi.fn(),
  searchParams: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: vi.fn(),
    push: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => searchParams,
  usePathname: () => "/reset-password",
  useSelectedLayoutSegment: () => null,
  useParams: () => ({}),
}));

vi.mock("../../lib/auth/api", async (importOriginal) => {
  const actual = await importOriginal<typeof AuthApi>();
  return { ...actual, postAuthJson: postAuthJsonMock };
});

import type * as AuthApi from "../../lib/auth/api";
import { ResetPasswordForm } from "./reset-password-form";

beforeEach(() => {
  postAuthJsonMock.mockReset();
  for (const key of [...searchParams.keys()]) {
    searchParams.delete(key);
  }
});

async function fillAndSubmit(
  password: string,
  confirmPassword: string,
): Promise<void> {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/^New password/), password);
  await user.type(
    screen.getByLabelText(/^Confirm new password/),
    confirmPassword,
  );
  await user.click(screen.getByRole("button", { name: "Update password" }));
}

describe("ResetPasswordForm", () => {
  it("shows an incomplete link state when the token is missing (AC-9)", () => {
    render(<ResetPasswordForm />);

    expect(
      screen.getByRole("heading", { name: "This reset link is incomplete" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Request a new reset link" }),
    ).toHaveAttribute("href", "/forgot-password");
    expect(postAuthJsonMock).not.toHaveBeenCalled();
  });

  it("rejects two different passwords before calling the API", async () => {
    searchParams.set("token", "token-1");
    render(<ResetPasswordForm />);

    await fillAndSubmit("correct horse", "correct house");

    expect(screen.getByRole("alert")).toHaveTextContent(
      "The two passwords do not match.",
    );
    expect(postAuthJsonMock).not.toHaveBeenCalled();
  });

  it("rejects a password shorter than 8 bytes before calling the API", async () => {
    searchParams.set("token", "token-1");
    render(<ResetPasswordForm />);

    await fillAndSubmit("short", "short");

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Password must be at least 8 bytes.",
    );
    expect(postAuthJsonMock).not.toHaveBeenCalled();
  });

  it("rejects a password above 72 bytes before calling the API", async () => {
    searchParams.set("token", "token-1");
    render(<ResetPasswordForm />);

    await fillAndSubmit("a".repeat(73), "a".repeat(73));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Password must be 72 bytes or fewer.",
    );
    expect(postAuthJsonMock).not.toHaveBeenCalled();
  });

  it("shows the expired state when the link is past its hour (AC-9)", async () => {
    searchParams.set("token", "expired-token");
    postAuthJsonMock.mockResolvedValueOnce({
      ok: false,
      status: 410,
      error: {
        message: "This reset link has expired.",
        statusCode: 410,
      },
    });
    render(<ResetPasswordForm />);

    await fillAndSubmit("correct horse", "correct horse");

    expect(
      await screen.findByRole("heading", {
        name: "This reset link has expired",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Request a new reset link" }),
    ).toHaveAttribute("href", "/forgot-password");
  });

  it("shows the invalid state when the link was already used (AC-9)", async () => {
    searchParams.set("token", "used-token");
    postAuthJsonMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      error: {
        message: "This reset link is invalid.",
        statusCode: 400,
      },
    });
    render(<ResetPasswordForm />);

    await fillAndSubmit("correct horse", "correct horse");

    expect(
      await screen.findByRole("heading", {
        name: "This reset link is no longer valid",
      }),
    ).toBeInTheDocument();
  });

  it("shows the first server validation issue for a rejected password (AC-9)", async () => {
    searchParams.set("token", "token-1");
    postAuthJsonMock.mockResolvedValueOnce({
      ok: false,
      status: 422,
      error: {
        message: "Validation failed.",
        statusCode: 422,
        details: {
          issues: [{ message: "Password must be at least 8 bytes." }],
        },
      },
    });
    render(<ResetPasswordForm />);

    await fillAndSubmit("correct horse", "correct horse");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Password must be at least 8 bytes.",
    );
    expect(
      screen.getByRole("button", { name: "Update password" }),
    ).toBeInTheDocument();
  });

  it("confirms the change and points to sign in after a successful reset (AC-9)", async () => {
    searchParams.set("token", "token-1");
    postAuthJsonMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      data: { message: "Password updated." },
    });
    render(<ResetPasswordForm />);

    await fillAndSubmit("correct horse", "correct horse");

    expect(
      await screen.findByRole("heading", { name: "Password updated" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Sign in to your account" }),
    ).toHaveAttribute("href", "/login");
    expect(postAuthJsonMock).toHaveBeenCalledWith("reset-password", {
      token: "token-1",
      password: "correct horse",
    });
  });
});
