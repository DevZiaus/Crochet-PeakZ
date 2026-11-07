/**
 * Tests for the password reset request form.
 *
 * The confirmation must stay the same whether or not an account exists, and a
 * throttled request has to say how long to wait. Both keep the screen honest
 * without leaking which addresses are registered (AC-9, AC-12, AC-13).
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
  usePathname: () => "/forgot-password",
  useSelectedLayoutSegment: () => null,
  useParams: () => ({}),
}));

vi.mock("../../lib/auth/api", async (importOriginal) => {
  const actual = await importOriginal<typeof AuthApi>();
  return { ...actual, postAuthJson: postAuthJsonMock };
});

import type * as AuthApi from "../../lib/auth/api";
import { ForgotPasswordForm } from "./forgot-password-form";

beforeEach(() => {
  postAuthJsonMock.mockReset();
  for (const key of [...searchParams.keys()]) {
    searchParams.delete(key);
  }
});

describe("ForgotPasswordForm", () => {
  it("submits the email and shows a neutral confirmation with sign in (AC-9)", async () => {
    postAuthJsonMock.mockResolvedValueOnce({
      ok: true,
      status: 202,
      data: { message: "If an account exists, a link is on its way." },
    });
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText(/^Email/), "ada@example.com");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(postAuthJsonMock).toHaveBeenCalledWith("forgot-password", {
      email: "ada@example.com",
    });
    expect(
      await screen.findByRole("heading", { name: "Check your email" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "If an account with ada@example.com has a password",
    );
    expect(
      screen.getByRole("link", { name: "Back to sign in" }),
    ).toHaveAttribute("href", "/login?next=%2F");
  });

  it("shows the wait time when reset requests are throttled (AC-12)", async () => {
    postAuthJsonMock.mockResolvedValueOnce({
      ok: false,
      status: 429,
      error: {
        message: "Too many requests.",
        statusCode: 429,
        details: { retryAfterSeconds: 90 },
      },
    });
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText(/^Email/), "ada@example.com");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Too many reset requests. Try again in 90 seconds.",
    );
  });

  it("keeps the form visible after a request that could not be sent", async () => {
    postAuthJsonMock.mockResolvedValueOnce({
      ok: false,
      status: 0,
      error: {
        message:
          "We could not reach the store. Check your connection and try again.",
        statusCode: 0,
      },
    });
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText(/^Email/), "ada@example.com");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We could not reach the store",
    );
    expect(screen.getByLabelText(/^Email/)).toHaveValue("ada@example.com");
  });
});
