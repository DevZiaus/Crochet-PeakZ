/**
 * Tests for the account creation form.
 *
 * A new account is not signed in yet, so the success panel has to name the
 * address, point to sign in, and keep a resend action close by. Server field
 * errors and the per network throttle must stay readable (AC-1, AC-12, AC-13).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AuthUser } from "@crochet-peakz/shared";

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
  usePathname: () => "/register",
  useSelectedLayoutSegment: () => null,
  useParams: () => ({}),
}));

vi.mock("../../lib/auth/api", async (importOriginal) => {
  const actual = await importOriginal<typeof AuthApi>();
  return { ...actual, postAuthJson: postAuthJsonMock };
});

import type * as AuthApi from "../../lib/auth/api";
import { RegisterForm } from "./register-form";

const created: AuthUser = {
  id: "user-1",
  name: "Ada Lovelace",
  email: "ada@example.com",
  role: "CUSTOMER",
  avatarUrl: null,
  emailVerified: false,
};

async function fillAndSubmit(): Promise<void> {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/^Name/), "Ada Lovelace");
  await user.type(screen.getByLabelText(/^Email/), "ada@example.com");
  await user.type(screen.getByLabelText(/^Password/), "correct horse");
  await user.type(screen.getByLabelText(/^Confirm password/), "correct horse");
  await user.click(screen.getByRole("button", { name: "Create account" }));
}

beforeEach(() => {
  postAuthJsonMock.mockReset();
  for (const key of [...searchParams.keys()]) {
    searchParams.delete(key);
  }
});

describe("RegisterForm", () => {
  it("rejects two different passwords before calling the API (AC-1)", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByLabelText(/^Name/), "Ada Lovelace");
    await user.type(screen.getByLabelText(/^Email/), "ada@example.com");
    await user.type(screen.getByLabelText(/^Password/), "correct horse");
    await user.type(
      screen.getByLabelText(/^Confirm password/),
      "correct house",
    );
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "The two passwords do not match.",
    );
    expect(postAuthJsonMock).not.toHaveBeenCalled();
  });

  it("shows the next step and the address after creating an account (AC-1)", async () => {
    postAuthJsonMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      data: created,
    });
    render(<RegisterForm />);

    await fillAndSubmit();

    expect(postAuthJsonMock).toHaveBeenCalledWith("register", {
      name: "Ada Lovelace",
      email: "ada@example.com",
      password: "correct horse",
    });
    expect(
      await screen.findByRole("heading", { name: "Check your email" }),
    ).toBeInTheDocument();
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to sign in" })).toHaveAttribute(
      "href",
      "/login?next=%2F",
    );
  });

  it("resends the verification link from the confirmation panel (AC-3)", async () => {
    postAuthJsonMock
      .mockResolvedValueOnce({ ok: true, status: 201, data: created })
      .mockResolvedValueOnce({
        ok: true,
        status: 202,
        data: { message: "If the account exists, a link is on its way." },
      });
    const user = userEvent.setup();
    render(<RegisterForm />);

    await fillAndSubmit();
    await user.click(
      await screen.findByRole("button", { name: "Resend the email" }),
    );

    expect(postAuthJsonMock).toHaveBeenLastCalledWith("resend-verification", {
      email: "ada@example.com",
    });
    expect(
      await screen.findByText(/A new verification link is on its way/),
    ).toBeInTheDocument();
  });

  it("shows the first server field issue for a rejected sign up (AC-1)", async () => {
    postAuthJsonMock.mockResolvedValueOnce({
      ok: false,
      status: 422,
      error: {
        message: "Validation failed.",
        statusCode: 422,
        details: {
          issues: [{ message: "Email must be a valid address." }],
        },
      },
    });
    render(<RegisterForm />);

    await fillAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Email must be a valid address.",
    );
    expect(
      screen.getByRole("button", { name: "Create account" }),
    ).toBeInTheDocument();
  });

  it("shows the retry window when sign up is throttled (AC-12)", async () => {
    postAuthJsonMock.mockResolvedValueOnce({
      ok: false,
      status: 429,
      error: {
        message: "Too many accounts.",
        statusCode: 429,
        details: { retryAfterSeconds: 120 },
      },
    });
    render(<RegisterForm />);

    await fillAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Too many accounts created from this network. Try again in 120 seconds.",
    );
  });
});
