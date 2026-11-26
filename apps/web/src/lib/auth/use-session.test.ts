import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "@crochet-peakz/shared";
import { useSession } from "./use-session";

const user: AuthUser = {
  id: "user-1",
  name: "Ada Lovelace",
  email: "ada@example.com",
  role: "CUSTOMER",
  avatarUrl: null,
  emailVerified: true,
};

/** Reads a fetch input as its URL string. */
function urlOf(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  return input.url;
}

const fetchMock = vi.fn<
  (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
>((input) => {
  const url = urlOf(input);

  if (url === "/api/auth/me") {
    return Promise.resolve(
      new Response(JSON.stringify(user), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  }

  return Promise.resolve(new Response(null, { status: 204 }));
});

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useSession sign out", () => {
  it("clears the user once the server revokes the session", async () => {
    const { result } = renderHook(() => useSession());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.user).toEqual(user);

    let outcome: Awaited<ReturnType<typeof result.current.signOut>> | undefined;
    await act(async () => {
      outcome = await result.current.signOut();
    });

    expect(outcome).toEqual({ success: true });
    expect(result.current.user).toBeNull();
  });

  it("keeps the user when sign out fails", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = urlOf(input);

      if (url === "/api/auth/me") {
        return Promise.resolve(
          new Response(JSON.stringify(user), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        );
      }

      return Promise.resolve(new Response(null, { status: 502 }));
    });

    const { result } = renderHook(() => useSession());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.user).toEqual(user);

    let outcome: Awaited<ReturnType<typeof result.current.signOut>> | undefined;
    await act(async () => {
      outcome = await result.current.signOut();
    });

    expect(outcome).toEqual({ success: false });
    expect(result.current.user).toEqual(user);
  });

  it("passes an abort signal to /me and /logout and recovers cleanly on timeouts", async () => {
    const { result } = renderHook(() => useSession());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    const meCall = fetchMock.mock.calls.find(
      ([input]) => urlOf(input) === "/api/auth/me",
    );
    expect(meCall?.[1]?.signal).toBeInstanceOf(AbortSignal);

    fetchMock.mockImplementation((input) => {
      const url = urlOf(input);
      if (url === "/api/auth/logout") {
        return Promise.reject(
          new DOMException(
            "The operation was aborted due to timeout",
            "TimeoutError",
          ),
        );
      }
      return Promise.resolve(new Response(null, { status: 204 }));
    });

    let outcome: Awaited<ReturnType<typeof result.current.signOut>> | undefined;
    await act(async () => {
      outcome = await result.current.signOut();
    });

    const logoutCall = fetchMock.mock.calls.find(
      ([input]) => urlOf(input) === "/api/auth/logout",
    );
    expect(logoutCall?.[1]?.signal).toBeInstanceOf(AbortSignal);
    expect(outcome).toEqual({ success: false });
    expect(result.current.user).toEqual(user);

    fetchMock.mockRejectedValueOnce(
      new DOMException(
        "The operation was aborted due to timeout",
        "TimeoutError",
      ),
    );
    const timedOut = renderHook(() => useSession());

    await waitFor(() => {
      expect(timedOut.result.current.loading).toBe(false);
    });
    expect(timedOut.result.current.user).toBeNull();
  });
});
