/**
 * Tests for the browser auth helpers.
 *
 * Every auth call goes through postAuthJson, which turns an API error body, an
 * unparseable error body, and a dead network into one typed error shape the
 * forms can render. firstIssueMessage then picks the field level message a
 * validation error carries, so a rejected field shows its own reason instead of
 * the generic line (AC-1, AC-9).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  detailNumber,
  detailString,
  firstIssueMessage,
  postAuthJson,
  type AuthApiError,
} from "./api";

/** Builds a fetch response carrying a JSON body. */
function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("postAuthJson", () => {
  it("posts JSON to the auth path and returns the parsed body", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ message: "ok" }, 200));
    vi.stubGlobal("fetch", fetchMock);

    const result = await postAuthJson<{ message: string }>("login", {
      email: "ada@example.com",
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/auth/login", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "ada@example.com" }),
    });
    expect(result).toEqual({ ok: true, status: 200, data: { message: "ok" } });
  });

  it("returns an undefined body for a 204 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    );

    const result = await postAuthJson("logout", {});

    expect(result).toEqual({ ok: true, status: 204, data: undefined });
  });

  it("normalizes an API error body into the typed error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            error: {
              message: "Validation failed.",
              statusCode: 422,
              code: "VALIDATION_ERROR",
              details: { issues: [{ message: "Email is required." }] },
            },
          },
          422,
        ),
      ),
    );

    const result = await postAuthJson("register", {});

    expect(result).toEqual({
      ok: false,
      status: 422,
      error: {
        message: "Validation failed.",
        statusCode: 422,
        code: "VALIDATION_ERROR",
        details: { issues: [{ message: "Email is required." }] },
      },
    });
  });

  it("falls back to a generic message when the error body is unparseable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("not json", { status: 500 })),
    );

    const result = await postAuthJson("login", {});

    expect(result).toEqual({
      ok: false,
      status: 500,
      error: { message: "Something went wrong. Try again.", statusCode: 500 },
    });
  });

  it("reports an unreachable store when the network fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    const result = await postAuthJson("login", {});

    expect(result).toEqual({
      ok: false,
      status: 0,
      error: {
        message:
          "We could not reach the store. Check your connection and try again.",
        statusCode: 0,
      },
    });
  });
});

describe("firstIssueMessage", () => {
  const errorWith = (details?: Record<string, unknown>): AuthApiError => ({
    message: "Validation failed.",
    statusCode: 422,
    details,
  });

  it("returns the first issue message from a validation error", () => {
    expect(
      firstIssueMessage(
        errorWith({
          issues: [{ message: "Email is required." }, { message: "Too long." }],
        }),
      ),
    ).toBe("Email is required.");
  });

  it("falls back to the general message when there are no issues", () => {
    expect(firstIssueMessage(errorWith())).toBe("Validation failed.");
  });

  it("falls back when the first issue carries no string message", () => {
    expect(
      firstIssueMessage(errorWith({ issues: [{ path: ["email"] }] })),
    ).toBe("Validation failed.");
  });

  it("falls back when issues is not an array", () => {
    expect(firstIssueMessage(errorWith({ issues: "nope" }))).toBe(
      "Validation failed.",
    );
  });
});

describe("detail readers", () => {
  const error: AuthApiError = {
    message: "Too many attempts.",
    statusCode: 429,
    details: { retryAfterSeconds: 120, scope: "network" },
  };

  it("reads string and number detail values", () => {
    expect(detailString(error, "scope")).toBe("network");
    expect(detailNumber(error, "retryAfterSeconds")).toBe(120);
  });

  it("returns undefined for a missing detail", () => {
    expect(detailString(error, "absent")).toBeUndefined();
    expect(detailNumber(error, "absent")).toBeUndefined();
  });

  it("returns undefined when the detail has the wrong type", () => {
    expect(detailNumber(error, "scope")).toBeUndefined();
    expect(detailString(error, "retryAfterSeconds")).toBeUndefined();
  });
});
