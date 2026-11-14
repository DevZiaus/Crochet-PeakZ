import { describe, expect, it } from "vitest";
import { CloudinaryImageUrlResolver } from "./image-url-resolver.js";

const resolver = new CloudinaryImageUrlResolver("crochet-peakz");

describe("CloudinaryImageUrlResolver", () => {
  it("returns null for empty values", () => {
    expect(resolver.resolve(null)).toBeNull();
    expect(resolver.resolve(undefined)).toBeNull();
    expect(resolver.resolve("")).toBeNull();
    expect(resolver.resolve("   ")).toBeNull();
  });

  it("keeps absolute URLs unchanged", () => {
    expect(resolver.resolve("https://example.com/image.webp")).toBe(
      "https://example.com/image.webp",
    );
    expect(resolver.resolve("http://example.com/image.webp")).toBe(
      "http://example.com/image.webp",
    );
  });

  it("builds a delivery URL and preserves slashes in the public id", () => {
    expect(resolver.resolve("crochet-peakz/products/bear-main")).toBe(
      "https://res.cloudinary.com/crochet-peakz/image/upload/f_auto,q_auto/crochet-peakz/products/bear-main",
    );
  });

  it("encodes unsafe public id path characters without encoding separators", () => {
    expect(resolver.resolve("crochet-peakz/products/bear ?#1")).toBe(
      "https://res.cloudinary.com/crochet-peakz/image/upload/f_auto,q_auto/crochet-peakz/products/bear%20%3F%231",
    );
  });
});
