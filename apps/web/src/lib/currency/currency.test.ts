/**
 * Tests for the active currency cookie parser and server reader (AC-3, AC-9,
 * spec 0006 AC-14).
 *
 * Every catalog surface resolves its currency from the `cp_currency` cookie,
 * so an unknown or empty value has to land on BDT rather than leaking through
 * to a price formatter.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Currency } from "@crochet-peakz/shared";
import { CURRENCY_COOKIE, parseCurrency } from "./cookie";
import { getActiveCurrency } from "./server";

const { cookiesMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

beforeEach(() => {
  cookiesMock.mockReset();
});

describe("parseCurrency", () => {
  it("returns USD when the cookie holds USD", () => {
    expect(parseCurrency(Currency.USD)).toBe(Currency.USD);
  });

  it("returns BDT when the cookie holds BDT", () => {
    expect(parseCurrency(Currency.BDT)).toBe(Currency.BDT);
  });

  it.each([
    ["undefined", undefined],
    ["an empty string", ""],
    ["an unknown code", "EUR"],
    ["lowercase usd", "usd"],
    ["padded usd", " USD "],
  ])("falls back to BDT for %s", (_label, value) => {
    expect(parseCurrency(value)).toBe(Currency.BDT);
  });
});

describe("getActiveCurrency", () => {
  it("reads the currency cookie from the request", async () => {
    const get = vi.fn((name: string) =>
      name === CURRENCY_COOKIE ? { name, value: "USD" } : undefined,
    );
    cookiesMock.mockResolvedValue({ get });

    await expect(getActiveCurrency()).resolves.toBe(Currency.USD);
    expect(get).toHaveBeenCalledWith("cp_currency");
  });

  it("defaults to BDT when the cookie is absent", async () => {
    cookiesMock.mockResolvedValue({ get: () => undefined });

    await expect(getActiveCurrency()).resolves.toBe(Currency.BDT);
  });

  it("defaults to BDT when the cookie holds an unsupported value", async () => {
    cookiesMock.mockResolvedValue({
      get: () => ({ name: CURRENCY_COOKIE, value: "GBP" }),
    });

    await expect(getActiveCurrency()).resolves.toBe(Currency.BDT);
  });
});
