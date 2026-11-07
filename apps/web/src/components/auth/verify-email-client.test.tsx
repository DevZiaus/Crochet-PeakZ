/**
 * Tests for the email verification result screen.
 *
 * Opening the link must never consume the token. The screen only verifies when
 * the customer presses the confirm button, and an expired link has to prefill
 * the account email so a new link is one press away. These are the parts of
 * AC-3 a browser scanner or a stale link would break.
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
  usePathname: () => "/verify-email",
  useSelectedLayoutSegment: () => null,
  useParams: () => ({}),
}));

vi.mock("../../lib/auth/api", async (importOriginal) => {
  const actual = await importOriginal<typeof AuthApi>();
  return { ...actual, postAuthJson: postAuthJsonMock };
});

import type * as AuthApi from "../../lib/auth/api";
import { VerifyEmailClient } from "./verify-email-client";

beforeEach(() => {
  postAuthJsonMock.mockReset();
  for (const key of [...searchParams.keys()]) {
    searchParams.delete(key);
  }
});

describe("VerifyEmailClient", () => {
  it("does not spend the one time token when the link is only opened (AC-3)", () => {
    searchParams.set("token", "token-1");

    render(<VerifyEmailClient />);

    expect(postAuthJsonMock).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: "Confirm your email" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Confirm my email" }),
    ).toBeInTheDocument();
  });

  it("verifies only after the explicit confirm action and offers sign in (AC-3)", async () => {
    searchParams.set("token", "token-1");
    postAuthJsonMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      data: { email: "ada@example.com", emailVerified: true },
    });
    const user = userEvent.setup();

    render(<VerifyEmailClient />);
    await user.click(screen.getByRole("button", { name: "Confirm my email" }));

    expect(postAuthJsonMock).toHaveBeenCalledWith("verify-email", {
      token: "token-1",
    });
    expect(
      await screen.findByRole("heading", { name: "Email confirmed" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "ada@example.com is verified",
    );
    expect(
      screen.getByRole("link", { name: "Sign in to your account" }),
    ).toHaveAttribute("href", "/login");
  });

  it("prefills the account email when the link has expired (AC-3)", async () => {
    searchParams.set("token", "stale-token");
    postAuthJsonMock.mockResolvedValueOnce({
      ok: false,
      status: 410,
      error: {
        message: "This verification link has expired.",
        statusCode: 410,
        details: { email: "ada@example.com" },
      },
    });
    const user = userEvent.setup();

    render(<VerifyEmailClient />);
    await user.click(screen.getByRole("button", { name: "Confirm my email" }));

    expect(
      await screen.findByRole("heading", { name: "This link has expired" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^Email/)).toHaveValue("ada@example.com");
    expect(
      screen.getByRole("button", { name: "Send a new link" }),
    ).toBeInTheDocument();
  });

  it("sends a new link from the expired state and shows a notice (AC-3)", async () => {
    searchParams.set("token", "stale-token");
    postAuthJsonMock
      .mockResolvedValueOnce({
        ok: false,
        status: 410,
        error: {
          message: "This verification link has expired.",
          statusCode: 410,
          details: { email: "ada@example.com" },
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 202,
        data: { message: "If the account exists, a link is on its way." },
      });
    const user = userEvent.setup();

    render(<VerifyEmailClient />);
    await user.click(screen.getByRole("button", { name: "Confirm my email" }));
    await screen.findByRole("heading", { name: "This link has expired" });
    await user.click(screen.getByRole("button", { name: "Send a new link" }));

    expect(postAuthJsonMock).toHaveBeenLastCalledWith("resend-verification", {
      email: "ada@example.com",
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "A new verification link is on its way",
    );
  });

  it("shows how long to wait when resend is throttled (AC-12)", async () => {
    searchParams.set("token", "stale-token");
    postAuthJsonMock
      .mockResolvedValueOnce({
        ok: false,
        status: 410,
        error: {
          message: "This verification link has expired.",
          statusCode: 410,
          details: { email: "ada@example.com" },
        },
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        error: {
          message: "Too many requests.",
          statusCode: 429,
          details: { retryAfterSeconds: 45 },
        },
      });
    const user = userEvent.setup();

    render(<VerifyEmailClient />);
    await user.click(screen.getByRole("button", { name: "Confirm my email" }));
    await screen.findByRole("heading", { name: "This link has expired" });
    await user.click(screen.getByRole("button", { name: "Send a new link" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Please wait 45 seconds",
    );
  });

  it("treats a missing token as an invalid link and offers a new one (AC-3)", () => {
    render(<VerifyEmailClient />);

    expect(postAuthJsonMock).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: "This link is no longer valid" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^Email/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Send a new link" }),
    ).toBeInTheDocument();
  });
});
