import { describe, expect, it } from "vitest";
import { timingSafeStringEquals } from "./timing-safe.js";

describe("timingSafeStringEquals", () => {
  it("accepts identical strings", () => {
    expect(timingSafeStringEquals("s3cret-value", "s3cret-value")).toBe(true);
  });

  it("rejects a same length string that differs in one byte", () => {
    expect(timingSafeStringEquals("s3cret-value", "s3cret-valuE")).toBe(false);
  });

  it("rejects different lengths without throwing", () => {
    expect(timingSafeStringEquals("short", "a much longer secret")).toBe(false);
    expect(timingSafeStringEquals("", "non-empty")).toBe(false);
    expect(timingSafeStringEquals("non-empty", "")).toBe(false);
    expect(timingSafeStringEquals("", "")).toBe(true);
  });
});
