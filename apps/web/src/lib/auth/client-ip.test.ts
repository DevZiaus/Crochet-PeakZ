import { afterEach, describe, expect, it, vi } from "vitest";
import { getTrustedProxyHops, readClientIp } from "./client-ip";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getTrustedProxyHops", () => {
  it("defaults to 1 when TRUSTED_PROXY_HOPS is unset or blank", () => {
    expect(getTrustedProxyHops(undefined)).toBe(1);
    expect(getTrustedProxyHops("")).toBe(1);
    expect(getTrustedProxyHops("   ")).toBe(1);
  });

  it("parses valid positive integer hop counts", () => {
    expect(getTrustedProxyHops("1")).toBe(1);
    expect(getTrustedProxyHops(" 2 ")).toBe(2);
    expect(getTrustedProxyHops("3")).toBe(3);
  });

  it.each(["0", "-1", "1.5", "abc"])(
    "rejects invalid TRUSTED_PROXY_HOPS value %s",
    (value) => {
      expect(() => getTrustedProxyHops(value)).toThrow(
        /Invalid TRUSTED_PROXY_HOPS/,
      );
    },
  );
});

describe("readClientIp", () => {
  it("takes the last entry by default (1 hop)", () => {
    const headers = new Headers({
      "x-forwarded-for": "9.9.9.9, 203.0.113.10",
    });

    expect(readClientIp(headers, 1)).toBe("203.0.113.10");
  });

  it("takes the 2nd hop from the end behind Cloudflare plus Vercel/origin proxy", () => {
    vi.stubEnv("TRUSTED_PROXY_HOPS", "2");
    const headers = new Headers({
      "x-forwarded-for": "9.9.9.9, 203.0.113.10, 172.70.1.1",
    });

    expect(readClientIp(headers)).toBe("203.0.113.10");
  });

  it("clamps to the earliest entry when fewer hops are present than trustedHops", () => {
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.10",
    });

    expect(readClientIp(headers, 2)).toBe("203.0.113.10");
  });

  it("falls back to x-real-ip or unknown when x-forwarded-for is absent or blank", () => {
    expect(
      readClientIp(new Headers({ "x-real-ip": " 198.51.100.7 " }), 2),
    ).toBe("198.51.100.7");
    expect(
      readClientIp(new Headers({ "x-forwarded-for": " , ", "x-real-ip": " " })),
    ).toBe("unknown");
  });
});
