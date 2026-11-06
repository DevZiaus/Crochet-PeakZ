/**
 * Tests for the web cookie helpers.
 *
 * The API writes cookie values through Express, which percent encodes them, so
 * the web reader has to decode the same way or the two sides disagree about the
 * value. A malformed sequence is attacker controlled input and must read as an
 * absent cookie rather than throw.
 */
import { describe, expect, it } from "vitest";
import { readCookie, readSetCookie, writeCookie } from "./cookies";

describe("readCookie", () => {
  it("decodes a percent encoded value the way the API wrote it", () => {
    expect(readCookie("cp_access=a%2Fb%3Dc", "cp_access")).toBe("a/b=c");
  });

  it("finds a value that itself contains an equals sign", () => {
    expect(readCookie("other=1; cp_access=abc==", "cp_access")).toBe("abc==");
  });

  it("treats a malformed sequence as an absent cookie", () => {
    expect(readCookie("cp_access=%E0%A4%A", "cp_access")).toBeUndefined();
  });

  it("returns undefined when the cookie is not present", () => {
    expect(readCookie("cp_refresh=abc", "cp_access")).toBeUndefined();
  });
});

describe("readSetCookie", () => {
  it("returns the value from the first matching Set-Cookie header", () => {
    expect(
      readSetCookie(
        ["cp_access=one; Path=/; HttpOnly", "cp_refresh=two; Path=/"],
        "cp_refresh",
      ),
    ).toBe("two");
  });
});

describe("writeCookie", () => {
  it("replaces one value and keeps the others", () => {
    expect(
      writeCookie("cp_access=old; cp_refresh=keep", "cp_access", "new"),
    ).toBe("cp_refresh=keep; cp_access=new");
  });
});
