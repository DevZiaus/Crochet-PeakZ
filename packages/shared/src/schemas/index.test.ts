import { describe, it, expect } from "vitest";
import { currencySchema } from "./index";

/**
 * Tests for the currency Zod validation schema.
 * Covers happy path (valid codes), edge cases (empty, null,
 * wrong type), and error messages.
 */

describe("currencySchema", () => {
  describe("happy path: accepts valid currency codes", () => {
    it("parses BDT successfully", () => {
      expect(currencySchema.parse("BDT")).toBe("BDT");
    });

    it("parses USD successfully", () => {
      expect(currencySchema.parse("USD")).toBe("USD");
    });
  });

  describe("edge cases: rejects invalid inputs", () => {
    it("rejects an unknown currency code", () => {
      expect(() => currencySchema.parse("EUR")).toThrow();
    });

    it("rejects lowercase variants", () => {
      expect(() => currencySchema.parse("bdt")).toThrow();
      expect(() => currencySchema.parse("usd")).toThrow();
    });

    it("rejects an empty string", () => {
      expect(() => currencySchema.parse("")).toThrow();
    });

    it("rejects null", () => {
      expect(() => currencySchema.parse(null)).toThrow();
    });

    it("rejects undefined", () => {
      expect(() => currencySchema.parse(undefined)).toThrow();
    });

    it("rejects a number", () => {
      expect(() => currencySchema.parse(42)).toThrow();
    });

    it("rejects an object", () => {
      expect(() => currencySchema.parse({ code: "BDT" })).toThrow();
    });
  });

  describe("safeParse returns structured results", () => {
    it("returns success true for a valid code", () => {
      const result = currencySchema.safeParse("BDT");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("BDT");
      }
    });

    it("returns success false for an invalid code", () => {
      const result = currencySchema.safeParse("GBP");
      expect(result.success).toBe(false);
    });
  });
});
