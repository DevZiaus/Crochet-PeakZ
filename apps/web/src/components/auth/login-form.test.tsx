/**
 * Tests for the email and password sign in form.
 *
 * An unverified account gets a readable message and a resend action, a signed
 * in account lands on a safe relative `next` or its role default, and a
 * throttled attempt says how long to wait. These are the browser side halves of
 * AC-2, AC-11, and AC-12.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AuthUser } from "@crochet-peakz/shared";

const { postAuthJsonMock, searchParams, routerReplace, routerRefresh } =
  vi.hoisted(() => ({
    postAuthJsonMock: vi.fn(),
    searchParams: new URLSearchParams(),
    routerReplace: vi.fn(),
    routerRefresh: vi.fn(),
  }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: routerReplace,
    push: vi.fn(),
    refresh: routerRefresh,
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => searchParams,
  usePathname: () => "/login",
  useSelectedLayoutSegment: () => null,
  useParams: () => ({}),
}));

vi.mock("../../lib/auth/api", async (importOriginal) => {
  const actual = await importOriginal<typeof AuthApi>();
  return { ...actual, postAuthJson: postAuthJsonMock };
});

import type * as AuthApi from "../../lib/auth/api";
import { LoginForm } from "./login-form";

const customer: AuthUser = {
  id: "user-1",
  name: "Ada Lovelace",
  email: "ada@example.com",
  role: "CUSTOMER",
  avatarUrl: null,
  emailVerified: true,
};

async function fillAndSubmit(): Promise<void> {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/^Email/), "ada@example.com");
  await user.type(screen.getByLabelText(/^Password/), "correct horse");
  await user.click(screen.getByRole("button", { name: "Sign in" }));
}

beforeEach(() => {
  postAuthJsonMock.mockReset();
  routerReplace.mockClear();
  routerRefresh.mockClear();
  for (const key of [...searchParams.keys()]) {
    searchParams.delete(key);
  }
});

describe("LoginForm", () => {
  it("tells an unverified customer to confirm and offers a resend (AC-2)", async () => {
    postAuthJsonMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      error: {
        message: "Confirm your email before signing in.",
        statusCode: 403,
        code: "EMAIL_UNVERIFIED",
        details: { email: "ada@example.com" },
      },
    });
    render(<LoginForm />);

    await fillAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Your email is not verified yet.",
    );
    expect(
      screen.getByRole("button", { name: "Resend verification email" }),
    ).toBeInTheDocument();
  });

  it("resends the verification link to the account the API named (AC-2)", async () => {
    postAuthJsonMock
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        error: {
          message: "Confirm your email before signing in.",
          statusCode: 403,
          code: "EMAIL_UNVERIFIED",
          details: { email: "ada@example.com" },
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 202,
        data: { message: "If the account exists, a link is on its way." },
      });
    const user = userEvent.setup();
    render(<LoginForm />);

    await fillAndSubmit();
    await user.click(
      await screen.findByRole("button", {
        name: "Resend verification email",
      }),
    );

    expect(postAuthJsonMock).toHaveBeenLastCalledWith("resend-verification", {
      email: "ada@example.com",
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "A new verification link is on its way",
    );
  });

  it("moves a signed in customer to the requested relative page (AC-11)", async () => {
    searchParams.set("next", "/orders?tab=open");
    postAuthJsonMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      data: customer,
    });
    render(<LoginForm />);

    await fillAndSubmit();

    expect(postAuthJsonMock).toHaveBeenCalledWith("login", {
      email: "ada@example.com",
      password: "correct horse",
    });
    expect(routerReplace).toHaveBeenCalledWith("/orders?tab=open");
    expect(routerRefresh).toHaveBeenCalled();
  });

  it("falls back to the role default for an external next (AC-11)", async () => {
    searchParams.set("next", "https://evil.example/steal");
    postAuthJsonMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      data: customer,
    });
    render(<LoginForm />);

    await fillAndSubmit();

    expect(routerReplace).toHaveBeenCalledWith("/");
  });

  it("shows the retry window when sign in is throttled (AC-12)", async () => {
    postAuthJsonMock.mockResolvedValueOnce({
      ok: false,
      status: 429,
      error: {
        message: "Too many attempts.",
        statusCode: 429,
        details: { retryAfterSeconds: 30 },
      },
    });
    render(<LoginForm />);

    await fillAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Too many sign in attempts. Try again in 30 seconds.",
    );
    expect(routerReplace).not.toHaveBeenCalled();
  });
});
