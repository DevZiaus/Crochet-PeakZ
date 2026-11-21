/**
 * Unit tests for the `setCurrency` Server Action (AC-2, AC-6).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Currency } from "@crochet-peakz/shared";
import { setCurrency } from "./actions";
import { CURRENCY_COOKIE, CURRENCY_COOKIE_MAX_AGE } from "./cookie";

const { cookiesMock, redirectMock, setMock } = vi.hoisted(() => {
  const set = vi.fn();
  return {
    setMock: set,
    redirectMock: vi.fn(),
    cookiesMock: vi.fn(() => Promise.resolve({ set })),
  };
});

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

beforeEach(() => {
  setMock.mockReset();
  redirectMock.mockReset();
  cookiesMock.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("setCurrency", () => {
  it.each([Currency.BDT, Currency.USD])(
    "sets the %s cookie with the required attributes, returns ok, and never redirects (AC-2, AC-6)",
    async (currency) => {
      vi.stubEnv("NODE_ENV", "development");

      const result = await setCurrency({ currency });

      expect(result).toEqual({ ok: true });
      expect(setMock).toHaveBeenCalledTimes(1);
      expect(setMock).toHaveBeenCalledWith(CURRENCY_COOKIE, currency, {
        path: "/",
        maxAge: CURRENCY_COOKIE_MAX_AGE,
        sameSite: "lax",
        httpOnly: true,
        secure: false,
      });
      expect(redirectMock).not.toHaveBeenCalled();
    },
  );

  it("marks the cookie Secure in production (AC-2)", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const result = await setCurrency({ currency: Currency.USD });

    expect(result).toEqual({ ok: true });
    expect(setMock).toHaveBeenCalledWith(
      CURRENCY_COOKIE,
      Currency.USD,
      expect.objectContaining({ secure: true }),
    );
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it.each([
    ["an unsupported code", { currency: "EUR" }],
    ["an empty string", { currency: "" }],
    ["lowercase code", { currency: "usd" }],
    ["a padded code", { currency: " USD " }],
    ["a missing currency field", {} as never],
    ["a non string value", { currency: 123 as never }],
    ["an array value", { currency: ["USD"] as never }],
    ["a null payload", null as never],
    ["an undefined payload", undefined as never],
  ])(
    "rejects %s without writing a cookie or redirecting (AC-6)",
    async (_label, input) => {
      const result = await setCurrency(input);

      expect(result).toEqual({ ok: false, error: "INVALID_CURRENCY" });
      expect(setMock).not.toHaveBeenCalled();
      expect(redirectMock).not.toHaveBeenCalled();
    },
  );

  it("propagates unexpected cookie store errors so callers can surface failure state (AC-7)", async () => {
    cookiesMock.mockRejectedValueOnce(new Error("cookie store unavailable"));

    await expect(setCurrency({ currency: Currency.USD })).rejects.toThrow(
      "cookie store unavailable",
    );
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
