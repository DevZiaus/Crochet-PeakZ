import { describe, it, expect } from "vitest";
import {
  Currency,
  currencySchema,
  CURRENCIES,
  ORDER_STATUSES,
} from "./index.js";

/**
 * Tests for the @crochet-peakz/shared barrel export.
 * Proves the workspace link delivers every named export with
 * the correct shape. These are the shared contract between
 * apps/web and apps/api.
 */

describe("@crochet-peakz/shared barrel exports", () => {
  describe("Currency", () => {
    it("exposes BDT and USD as string constants", () => {
      expect(Currency.BDT).toBe("BDT");
      expect(Currency.USD).toBe("USD");
    });

    it("contains exactly two entries", () => {
      expect(Object.keys(Currency)).toHaveLength(2);
    });
  });

  describe("CURRENCIES metadata", () => {
    it("maps BDT to taka symbol and name", () => {
      expect(CURRENCIES.BDT).toEqual({
        symbol: "৳",
        name: "Bangladeshi Taka",
      });
    });

    it("maps USD to dollar symbol and name", () => {
      expect(CURRENCIES.USD).toEqual({
        symbol: "$",
        name: "US Dollar",
      });
    });

    it("contains exactly two currency entries", () => {
      expect(Object.keys(CURRENCIES)).toHaveLength(2);
    });
  });

  describe("ORDER_STATUSES", () => {
    it("is a readonly tuple of 9 statuses", () => {
      expect(ORDER_STATUSES).toHaveLength(9);
    });

    it("starts with PENDING_PAYMENT and ends with REFUNDED", () => {
      expect(ORDER_STATUSES[0]).toBe("PENDING_PAYMENT");
      expect(ORDER_STATUSES[ORDER_STATUSES.length - 1]).toBe("REFUNDED");
    });

    it("contains all expected lifecycle stages in order", () => {
      expect([...ORDER_STATUSES]).toEqual([
        "PENDING_PAYMENT",
        "CONFIRMED",
        "PROCESSING",
        "HANDCRAFTING",
        "READY_TO_SHIP",
        "SHIPPED",
        "DELIVERED",
        "CANCELLED",
        "REFUNDED",
      ]);
    });
  });

  describe("currencySchema (Zod)", () => {
    it("is re-exported from the barrel", () => {
      expect(currencySchema).toBeDefined();
      expect(typeof currencySchema.parse).toBe("function");
    });

    it("accepts BDT as a valid currency code", () => {
      expect(currencySchema.parse(Currency.BDT)).toBe("BDT");
    });

    it("accepts USD as a valid currency code", () => {
      expect(currencySchema.parse(Currency.USD)).toBe("USD");
    });

    it("rejects an unsupported currency code", () => {
      expect(() => currencySchema.parse("EUR")).toThrow();
    });

    it("rejects a non string value", () => {
      expect(() => currencySchema.parse(42)).toThrow();
    });

    it("rejects an empty string", () => {
      expect(() => currencySchema.parse("")).toThrow();
    });
  });
});
